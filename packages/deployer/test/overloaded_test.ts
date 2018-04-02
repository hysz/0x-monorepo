import * as chai from 'chai';
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
import 'mocha';
import * as Web3 from 'web3';

import { Compiler } from '../src/compiler';
import { fsWrapper } from '../src/utils/fs_wrapper';
import {
    CompilerOptions,
    ContractArtifact,
    ContractNetworkData,
    DoneCallback,
    ContractDirectory,
    } from '../src/utils/types';

import { constructor_args, exchange_binary } from './fixtures/exchange_bin';
import { constants } from './util/constants';

const expect = chai.expect;
const artifactsDir = `${__dirname}/fixtures/artifacts`;

/* tslint:disable */
beforeEach(function(done: DoneCallback) {
    this.timeout(constants.timeoutMs);
    done();
});
/* tslint:enable */

describe('#OverloadedFunctions', () => {
    it('should successfully compile overloaded functions, renaming as necessary.', async () => {
        // Compile 'Passes' contract
        const overloadTestContractDir:ContractDirectory = {path: `${__dirname}/fixtures/overloaded_contracts`, namespace: ""};
        let contractDirs:Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        let specifiedContracts:Set<string> = new Set();
        specifiedContracts.add("Passes");
        const passingArtifactPath = `${artifactsDir}/Passes.json`;
        if (fsWrapper.doesPathExistSync(passingArtifactPath)) {
            await fsWrapper.removeFileAsync(passingArtifactPath);
        }
        let compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs: contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts: specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        await compiler.compileAllAsync();

        // Parse ABI
        const opts = {
            encoding: 'utf8',
        };
        const artifactString = await fsWrapper.readFileAsync(passingArtifactPath, opts);
        const artifact: ContractArtifact = JSON.parse(artifactString);
        const abi: Web3.ContractAbi = (((artifact["networks"] as any)["0"] as any)["abi"] as any);

        // Assert test, test_2 and test_3 functions exist
        let testExists:boolean = false;
        let test2Exists:boolean = false;
        let test3Exists:boolean = false;
        for(let i = 0; i < abi.length; ++i) {
            if(abi[i].type !== "function") continue;
            const name:string = (abi[i] as any).name
            if(name === "test") testExists = true;
            if(name === "test_2") test2Exists = true;
            if(name === "test_3") test3Exists =true;
        }
        expect(testExists).to.be.equal(true);
        expect(test2Exists).to.be.equal(true);
        expect(test3Exists).to.be.equal(true);
    });

    it('should fail to compile overloaded function when renaming to a function that was previouly defined.', async () => {
        const overloadTestContractDir:ContractDirectory = {path: `${__dirname}/fixtures/overloaded_contracts`, namespace: ""};
        let contractDirs:Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        let specifiedContracts:Set<string> = new Set();
        specifiedContracts.add("Fails1");
        let compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs: contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts: specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        await expect(compiler.compileAllAsync()).to.be.rejectedWith(Error);

    });

    it('should fail to compile function if an overloaded function was previously assigned its name.', async () => {
        const overloadTestContractDir:ContractDirectory = {path: `${__dirname}/fixtures/overloaded_contracts`, namespace: ""};
        let contractDirs:Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        let specifiedContracts:Set<string> = new Set();
        specifiedContracts.add("Fails2");
        let compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs: contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts: specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        await expect(compiler.compileAllAsync()).to.be.rejectedWith(Error);
    });
});
