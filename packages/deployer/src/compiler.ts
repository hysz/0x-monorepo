import { logUtils, promisify } from '@0xproject/utils';
import * as ethUtil from 'ethereumjs-util';
import * as fs from 'fs';
import 'isomorphic-fetch';
import * as _ from 'lodash';
import * as path from 'path';
import * as requireFromString from 'require-from-string';
import solc = require('solc');
import * as Web3 from 'web3';

import { binPaths } from './solc/bin_paths';
import { constants } from './utils/constants';
import { fsWrapper } from './utils/fs_wrapper';
import {
    CompilerOptions,
    ContractArtifact,
    ContractNetworkData,
    ContractNetworks,
    ContractSourceData,
    ContractSources,
    ContractSpecificSourceData,
    FunctionList,
    ContractIds,
    ContractDirectory,
} from './utils/types';
import { utils } from './utils/utils';

const ALL_CONTRACTS_IDENTIFIER = '*';
const SOLIDITY_VERSION_REGEX = /(?:solidity\s\^?)(\d+\.\d+\.\d+)/;
const SOLIDITY_FILE_EXTENSION_REGEX = /(.*\.sol)/;
const IMPORT_REGEX = /(import\s)/;
const DEPENDENCY_PATH_REGEX = /"([^"]+)"/; // Source: https://github.com/BlockChainCompany/soljitsu/blob/master/lib/shared.js

export class Compiler {
    private _contractDirs: Set<ContractDirectory>;
    private _networkId: number;
    private _optimizerEnabled: number;
    private _artifactsDir: string;
    private _contractSources?: ContractSources;
    private _solcErrors: Set<string> = new Set();
    private _specifiedContracts: Set<string> = new Set();
    private _contractSourceData: ContractSourceData = {};
    private _contractIds: ContractIds = {};

    /**
    * Generates a system-wide unique identifier for the source file.
    * @param directoryNamespace Namespace of the source file's root contract directory
    * @param sourceFilePath Path to a source file, relative to contractBaseDir
    * @return sourceFileId A system-wide unique identifier for the source file.
    */
    private static _constructSourceFileId(directoryNamespace: string, sourceFilePath: string): string {
        let namespacePrefix:string = "";
        if(directoryNamespace != "") {
            namespacePrefix = "/" + directoryNamespace;
        }
        return namespacePrefix + "/" + sourceFilePath.replace(/^\/+/g, '');
    }

    /**
    * Returns File Id
    * @param dependencyFilePath Path from a sourceFile to a dependency.
    * @param  contractBaseDir Base contracts directory of search tree.
    * @return sourceFileId A system-wide unique identifier for the source file.
    */
    private static _constructDependencyFileId(dependencyFilePath: string, sourceFilePath: string): string {
        if(dependencyFilePath.substr(0,1) == '/') {
            // Path of the form /namespace/path/to/xyz.sol
            return dependencyFilePath;
        } else {
            // Dependency is relative to the source file: ./dependency.sol, ../../some/path/dependency.sol, etc.
            // Join the two paths to construct a valid sourec file id: /namespace/path/to/dependency.sol
            return path.join(path.dirname(sourceFilePath), dependencyFilePath);
        }
    }

    /**
    * Generates a system-wide unique identifier for the source file.
    * @param directoryNamespace Namespace of the source file's root contract directory
    * @param sourceFilePath Path to a source file, relative to contractBaseDir
    * @return sourceFileId A system-wide unique identifier for the source file.
    */
    private static _constructContractId(directoryNamespace: string, sourceFilePath: string): string {
        let namespacePrefix:string = "";
        if(directoryNamespace != "") {
            namespacePrefix = directoryNamespace + ":";
        }
        return namespacePrefix + path.basename(sourceFilePath, constants.SOLIDITY_FILE_EXTENSION);
    }

    /**
     * Recursively retrieves Solidity source code from directory.
     * @param  dirPath Directory to search.
     * @param  contractBaseDir Base contracts directory of search tree.
     * @return Mapping of sourceFilePath to the contract source.
     */
    private static async _getContractSourcesAsync(dirPath: string, contractBaseDir: string): Promise<ContractSources> {
        let dirContents: string[] = [];
        try {
            dirContents = await fsWrapper.readdirAsync(dirPath);
        } catch (err) {
            throw new Error(`No directory found at ${dirPath}`);
        }
        let sources: ContractSources = {};
        for (const fileName of dirContents) {
            const contentPath = `${dirPath}/${fileName}`;
            if (path.extname(fileName) === constants.SOLIDITY_FILE_EXTENSION) {
                try {
                    const opts = {
                        encoding: 'utf8',
                    };
                    const source = await fsWrapper.readFileAsync(contentPath, opts);
                    const sourceFilePath = contentPath.substr(contractBaseDir.length);
                    sources[sourceFilePath] = source;
                    logUtils.log(`Reading ${sourceFilePath} source...`);
                } catch (err) {
                    logUtils.log(`Could not find file at ${contentPath}`);
                }
            } else {
                try {
                    const nestedSources = await Compiler._getContractSourcesAsync(contentPath, contractBaseDir);
                    sources = {
                        ...sources,
                        ...nestedSources,
                    };
                } catch (err) {
                    logUtils.log(`${contentPath} is not a directory or ${constants.SOLIDITY_FILE_EXTENSION} file`);
                }
            }
        }
        return sources;
    }

    /**
     * Gets contract dependendencies and keccak256 hash from source.
     * @param sourceFilePath Path to a source file, relative to contractBaseDir
     * @param source Source code of contract.
     * @return Object with contract dependencies and keccak256 hash of source.
     */
    private static _getContractSpecificSourceData(sourceFilePath: string, source: string): ContractSpecificSourceData {
        const dependencies: string[] = [];
        const sourceHash = ethUtil.sha3(source);
        const solcVersion = Compiler._parseSolidityVersion(source);
        const contractSpecificSourceData: ContractSpecificSourceData = {
            dependencies,
            solcVersion,
            sourceHash,
        };
        const lines = source.split('\n');
        _.forEach(lines, line => {
            if (!_.isNull(line.match(IMPORT_REGEX))) {
                const dependencyMatch = line.match(DEPENDENCY_PATH_REGEX);
                if (!_.isNull(dependencyMatch)) {
                    const dependencyPath = dependencyMatch[1];
                    const dependencyId = this._constructDependencyFileId(dependencyPath, sourceFilePath);
                    contractSpecificSourceData.dependencies.push(dependencyId);
                }
            }
        });
        return contractSpecificSourceData;
    }
    /**
     * Searches Solidity source code for compiler version.
     * @param  source Source code of contract.
     * @return Solc compiler version.
     */
    private static _parseSolidityVersion(source: string): string {
        const solcVersionMatch = source.match(SOLIDITY_VERSION_REGEX);
        if (_.isNull(solcVersionMatch)) {
            throw new Error('Could not find Solidity version in source');
        }
        const solcVersion = solcVersionMatch[1];
        return solcVersion;
    }
    /**
     * Normalizes the path found in the error message.
     * Example: converts 'base/Token.sol:6:46: Warning: Unused local variable'
     *          to 'Token.sol:6:46: Warning: Unused local variable'
     * This is used to prevent logging the same error multiple times.
     * @param  errMsg An error message from the compiled output.
     * @return The error message with directories truncated from the contract path.
     */
    private static _getNormalizedErrMsg(errMsg: string): string {
        const errPathMatch = errMsg.match(SOLIDITY_FILE_EXTENSION_REGEX);
        if (_.isNull(errPathMatch)) {
            throw new Error(`Could not find a path in error message: ${errMsg}`);
        }
        const errPath = errPathMatch[0];
        const baseContract = path.basename(errPath);
        const normalizedErrMsg = errMsg.replace(errPath, baseContract);
        return normalizedErrMsg;
    }
    /**
     * Checks if an error message contains a warning.
     * @param errMsg An error message from the compiled output.
     * @return True if the error message is a warning.
     */
    private static _isErrMsgWarning(errMsg: string): boolean {
        const errWarningMatch = errMsg.match(/(?:warning\s)/);
        if (!_.isNull(errWarningMatch)) {
            return true;
        }
        return false;
    }
    /**
     * Instantiates a new instance of the Compiler class.
     * @param opts Options specifying directories, network, and optimization settings.
     * @return An instance of the Compiler class.
     */
    constructor(opts: CompilerOptions) {
        this._contractDirs = opts.contractDirs;
        this._networkId = opts.networkId;
        this._optimizerEnabled = opts.optimizerEnabled;
        this._artifactsDir = opts.artifactsDir;
        this._specifiedContracts = opts.specifiedContracts;
    }
    /**
     * Compiles all Solidity files found in contractDirs and writes JSON artifacts to artifactsDir.
     */
    public async compileAllAsync(): Promise<void> {
        await this._createArtifactsDirIfDoesNotExistAsync();
        this._contractSources = {};
        for(let contractDir of Array.from(this._contractDirs.values())) {
            let sources = await Compiler._getContractSourcesAsync(contractDir.path, contractDir.path);
            _.forIn(sources, (source, sourceFilePath) => {
                // Construct a unique ID for this source file
                const sourceFileId:string = Compiler._constructSourceFileId(contractDir.namespace, sourceFilePath);

                // Record the file's source and data
                if(!_.isUndefined(this._contractSources[sourceFileId])) {
                    throw new Error("Found duplicate source files with ID '" + sourceFileId + "'");
                }
                this._contractSources[sourceFileId] = source;
                this._contractSourceData[sourceFileId] = Compiler._getContractSpecificSourceData(sourceFileId, source);

                // Create a mapping between the contract id and its source file id
                const contractId = Compiler._constructContractId(contractDir.namespace, sourceFilePath);
                this._contractIds[contractId] = sourceFileId;
            });
        }

        const contractIds = this._specifiedContracts.has(ALL_CONTRACTS_IDENTIFIER)
            ? _.keys(this._contractIds)
            : Array.from(this._specifiedContracts.values());
        _.forEach(contractIds, contractId => {
            this._setSourceTreeHash(this._contractIds[contractId]);
        });
        await Promise.all(_.map(contractIds, async contractId => this._compileContractAsync(this._contractIds[contractId])));
        this._solcErrors.forEach(errMsg => {
            logUtils.log(errMsg);
        });
    }
    /**
     * Compiles contract and saves artifact to artifactsDir.
     * @param fileName Name of contract with '.sol' extension.
     */
    private async _compileContractAsync(fileName: string): Promise<void> {
        if (_.isUndefined(this._contractSources)) {
            throw new Error('Contract sources not yet initialized');
        }
        const contractSpecificSourceData = this._contractSourceData[fileName];
        const currentArtifactIfExists = (await this._getContractArtifactIfExistsAsync(fileName)) as ContractArtifact;
        const sourceHash = `0x${contractSpecificSourceData.sourceHash.toString('hex')}`;
        const sourceTreeHash = `0x${contractSpecificSourceData.sourceTreeHashIfExists.toString('hex')}`;

        const shouldCompile =
            _.isUndefined(currentArtifactIfExists) ||
            currentArtifactIfExists.networks[this._networkId].optimizer_enabled !== this._optimizerEnabled ||
            currentArtifactIfExists.networks[this._networkId].source_tree_hash !== sourceTreeHash;
        if (!shouldCompile) {
            return;
        }

        const fullSolcVersion = binPaths[contractSpecificSourceData.solcVersion];
        const compilerBinFilename = path.join(__dirname, '../../solc_bin', fullSolcVersion);
        let solcjs: string;
        const isCompilerAvailableLocally = fs.existsSync(compilerBinFilename);
        if (isCompilerAvailableLocally) {
            solcjs = fs.readFileSync(compilerBinFilename).toString();
        } else {
            logUtils.log(`Downloading ${fullSolcVersion}...`);
            const url = `${constants.BASE_COMPILER_URL}${fullSolcVersion}`;
            const response = await fetch(url);
            if (response.status !== 200) {
                throw new Error(`Failed to load ${fullSolcVersion}`);
            }
            solcjs = await response.text();
            fs.writeFileSync(compilerBinFilename, solcjs);
        }
        const solcInstance = solc.setupMethods(requireFromString(solcjs, compilerBinFilename));

        logUtils.log(`Compiling ${fileName}...`);
        const source = this._contractSources[fileName];
        const input = {
            [fileName]: source,
        };
        const sourcesToCompile = {
            sources: input,
        };
        const compiled = solcInstance.compile(
            sourcesToCompile,
            this._optimizerEnabled,
            this._findImportsIfSourcesExist.bind(this),
        );

        if (!_.isUndefined(compiled.errors)) {
            _.forEach(compiled.errors, errMsg => {
                const normalizedErrMsg = Compiler._getNormalizedErrMsg(errMsg);
                if (!Compiler._isErrMsgWarning(normalizedErrMsg)) {
                    logUtils.log(normalizedErrMsg);
                }
                this._solcErrors.add(normalizedErrMsg);
            });
        }
        const contractName = path.basename(fileName, constants.SOLIDITY_FILE_EXTENSION);
        const contractIdentifier = `${fileName}:${contractName}`;
        const abi: Web3.ContractAbi = JSON.parse(compiled.contracts[contractIdentifier].interface);
        const bytecode = `0x${compiled.contracts[contractIdentifier].bytecode}`;
        const runtimeBytecode = `0x${compiled.contracts[contractIdentifier].runtimeBytecode}`;
        const sourceMap = compiled.contracts[contractIdentifier].srcmap;
        const sourceMapRuntime = compiled.contracts[contractIdentifier].srcmapRuntime;
        const sources = _.keys(compiled.sources);
        const updated_at = Date.now();

        // There is no function overloading in typescript, so we must change the Typescript ABI interface.
        // Overloaded function names are incremented as follows: functionName, functionName2, functioname3, ...
        const functions:FunctionList = {};
        for(let i = 0; i < abi.length; ++i) {
            const type:string = abi[i].type;
            if(type === "function") {
                const name:string = (abi[i] as any).name;
                if(name in functions) {
                    functions[name]++;
                    (abi[i] as any).name += "_" + functions[name];
                } else {
                    functions[name] = 1;
                }
            }
        }

        const contractNetworkData: ContractNetworkData = {
            solc_version: contractSpecificSourceData.solcVersion,
            keccak256: sourceHash,
            source_tree_hash: sourceTreeHash,
            optimizer_enabled: this._optimizerEnabled,
            abi,
            bytecode,
            runtime_bytecode: runtimeBytecode,
            updated_at,
            source_map: sourceMap,
            source_map_runtime: sourceMapRuntime,
            sources,
        };

        let newArtifact: ContractArtifact;
        if (!_.isUndefined(currentArtifactIfExists)) {
            newArtifact = {
                ...currentArtifactIfExists,
                networks: {
                    ...currentArtifactIfExists.networks,
                    [this._networkId]: contractNetworkData,
                },
            };
        } else {
            newArtifact = {
                contract_name: contractName,
                networks: {
                    [this._networkId]: contractNetworkData,
                },
            };
        }

        const artifactString = utils.stringifyWithFormatting(newArtifact);
        const currentArtifactPath = `${this._artifactsDir}/${contractName}.json`;
        await fsWrapper.writeFileAsync(currentArtifactPath, artifactString);
        logUtils.log(`${fileName} artifact saved!`);
    }
    /**
     * Sets the source tree hash for a file and its dependencies.
     * @param fileName Name of contract file.
     */
    private _setSourceTreeHash(fileName: string): void {
        const contractSpecificSourceData = this._contractSourceData[fileName];
        if (_.isUndefined(contractSpecificSourceData)) {
            throw new Error(`Contract data for ${fileName} not yet set`);
        }
        if (_.isUndefined(contractSpecificSourceData.sourceTreeHashIfExists)) {
            const dependencies = contractSpecificSourceData.dependencies;
            if (dependencies.length === 0) {
                contractSpecificSourceData.sourceTreeHashIfExists = contractSpecificSourceData.sourceHash;
            } else {
                _.forEach(dependencies, dependency => {
                    this._setSourceTreeHash(dependency);
                });
                const dependencySourceTreeHashes = _.map(
                    dependencies,
                    dependency => this._contractSourceData[dependency].sourceTreeHashIfExists,
                );
                const sourceTreeHashesBuffer = Buffer.concat([
                    contractSpecificSourceData.sourceHash,
                    ...dependencySourceTreeHashes,
                ]);
                contractSpecificSourceData.sourceTreeHashIfExists = ethUtil.sha3(sourceTreeHashesBuffer);
            }
        }
    }
    /**
     * Callback to resolve dependencies with `solc.compile`.
     * Throws error if contractSources not yet initialized.
     * @param  importPath Path to an imported dependency.
     * @return Import contents object containing source code of dependency.
     */
    private _findImportsIfSourcesExist(importPath: string): solc.ImportContents {

        const fileName = importPath;
        const source = this._contractSources[fileName];
        if (_.isUndefined(source)) {
            throw new Error(`Contract source not found for ${fileName}`);
        }
        const importContents: solc.ImportContents = {
            contents: source,
        };
        return importContents;
    }
    /**
     * Creates the artifacts directory if it does not already exist.
     */
    private async _createArtifactsDirIfDoesNotExistAsync(): Promise<void> {
        if (!fsWrapper.doesPathExistSync(this._artifactsDir)) {
            logUtils.log('Creating artifacts directory...');
            await fsWrapper.mkdirAsync(this._artifactsDir);
        }
    }
    /**
     * Gets contract data on network or returns if an artifact does not exist.
     * @param fileName Name of contract file.
     * @return Contract data on network or undefined.
     */
    private async _getContractArtifactIfExistsAsync(fileName: string): Promise<ContractArtifact | void> {
        let contractArtifact;
        const contractName = path.basename(fileName, constants.SOLIDITY_FILE_EXTENSION);
        const currentArtifactPath = `${this._artifactsDir}/${contractName}.json`;
        try {
            const opts = {
                encoding: 'utf8',
            };
            const contractArtifactString = await fsWrapper.readFileAsync(currentArtifactPath, opts);
            contractArtifact = JSON.parse(contractArtifactString);
            return contractArtifact;
        } catch (err) {
            logUtils.log(`Artifact for ${fileName} does not exist`);
            return undefined;
        }
    }
}
