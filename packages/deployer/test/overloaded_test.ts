import { ContractAbi, MethodAbi } from '@0xproject/types';
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
    ContractDirectory,
    ContractNetworkData,
    ContractNetworks,
    DoneCallback,
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
        const overloadTestContractDir: ContractDirectory = {
            path: `${__dirname}/fixtures/contracts/overloaded`,
            namespace: '',
        };
        const contractDirs: Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        const specifiedContracts: Set<string> = new Set();
        specifiedContracts.add('Passes');
        const passingArtifactPath = `${artifactsDir}/Passes.json`;
        if (fsWrapper.doesPathExistSync(passingArtifactPath)) {
            await fsWrapper.removeFileAsync(passingArtifactPath);
        }
        const compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        await compiler.compileAsync();

        // Parse ABI
        const opts = {
            encoding: 'utf8',
        };
        const artifactString = await fsWrapper.readFileAsync(passingArtifactPath, opts);
        const artifact: ContractArtifact = JSON.parse(artifactString);
        const abi: ContractAbi = artifact.networks[0].abi;

        // Assert test, test_2 and test_3 functions exist
        let testExists: boolean = false;
        let test2Exists: boolean = false;
        let test3Exists: boolean = false;
        for (const abiItem of abi) {
            if (abiItem.type !== 'function') {
                continue;
            }
            const name: string = abiItem.name;
            if (name === 'test') {
                testExists = true;
            }
            if (name === 'test_2') {
                test2Exists = true;
            }
            if (name === 'test_3') {
                test3Exists = true;
            }
        }
        expect(testExists).to.be.equal(true);
        expect(test2Exists).to.be.equal(true);
        expect(test3Exists).to.be.equal(true);
    });

    it('should fail to compile overloaded function when renaming to a function that was previouly defined.', async () => {
        const overloadTestContractDir: ContractDirectory = {
            path: `${__dirname}/fixtures/contracts/overloaded`,
            namespace: '',
        };
        const contractDirs: Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        const specifiedContracts: Set<string> = new Set();
        specifiedContracts.add('Fails1');
        const compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        expect(compiler.compileAsync()).to.be.rejectedWith(Error);
    });

    it('should fail to compile function if an overloaded function was previously assigned its name.', async () => {
        const overloadTestContractDir: ContractDirectory = {
            path: `${__dirname}/fixtures/contracts/overloaded`,
            namespace: '',
        };
        const contractDirs: Set<ContractDirectory> = new Set();
        contractDirs.add(overloadTestContractDir);
        const specifiedContracts: Set<string> = new Set();
        specifiedContracts.add('Fails2');
        const compilerOpts: CompilerOptions = {
            artifactsDir,
            contractDirs,
            networkId: constants.networkId,
            optimizerEnabled: constants.optimizerEnabled,
            specifiedContracts,
        };
        const compiler = new Compiler(compilerOpts);
        expect(compiler.compileAsync()).to.be.rejectedWith(Error);
    });
});
