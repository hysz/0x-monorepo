import * as chai from 'chai';
import * as dirtyChai from 'dirty-chai';
import 'mocha';

import {
    createDirIfDoesNotExistAsync,
    getNormalizedErrMsg,
    parseDependencies,
    parseSolidityVersionRange,
} from '../src/utils/compiler';
import { fsWrapper } from '../src/utils/fs_wrapper';

chai.use(dirtyChai);
const expect = chai.expect;

describe('Compiler utils', () => {
    describe('#getNormalizedErrorMessage', () => {
        it('normalizes the error message', () => {
            const errMsg = 'base/Token.sol:6:46: Warning: Unused local variable';
            const normalizedErrMsg = getNormalizedErrMsg(errMsg);
            expect(normalizedErrMsg).to.be.equal('Token.sol:6:46: Warning: Unused local variable');
        });
    });
    describe('#createDirIfDoesNotExistAsync', () => {
        it('creates artifacts dir', async () => {
            const artifactsDir = `${__dirname}/artifacts`;
            expect(fsWrapper.doesPathExistSync(artifactsDir)).to.be.false();
            await createDirIfDoesNotExistAsync(artifactsDir);
            expect(fsWrapper.doesPathExistSync(artifactsDir)).to.be.true();
            fsWrapper.rmdirSync(artifactsDir);
            expect(fsWrapper.doesPathExistSync(artifactsDir)).to.be.false();
        });
    });
    describe('#parseSolidityVersionRange', () => {
        it('correctly parses the version range', () => {
            expect(parseSolidityVersionRange('pragma solidity ^0.0.1;')).to.be.equal('^0.0.1');
            expect(parseSolidityVersionRange('\npragma solidity 0.0.1;')).to.be.equal('0.0.1');
            expect(parseSolidityVersionRange('pragma solidity <=1.0.1;')).to.be.equal('<=1.0.1');
            expect(parseSolidityVersionRange('pragma solidity   ~1.0.1;')).to.be.equal('~1.0.1');
        });
        // TODO: For now that doesn't work. This will work after we switch to a grammar-based parser
        it.skip('correctly parses the version range with comments', () => {
            expect(parseSolidityVersionRange('// pragma solidity ~1.0.1;\npragma solidity ~1.0.2;')).to.be.equal(
                '~1.0.2',
            );
        });
    });
    describe('#parseDependencies', () => {
        it('correctly parses Exchange dependencies', async () => {
            const exchangeSource = await fsWrapper.readFileAsync(`${__dirname}/fixtures/contracts/Exchange.sol`, {
                encoding: 'utf8',
            });
            expect(parseDependencies(exchangeSource)).to.be.deep.equal([
                'TokenTransferProxy.sol',
                'Token.sol',
                'SafeMath.sol',
            ]);
        });
        it('correctly parses TokenTransferProxy dependencies', async () => {
            const exchangeSource = await fsWrapper.readFileAsync(
                `${__dirname}/fixtures/contracts/TokenTransferProxy.sol`,
                {
                    encoding: 'utf8',
                },
            );
            expect(parseDependencies(exchangeSource)).to.be.deep.equal(['Token.sol', 'Ownable.sol']);
        });
        // TODO: For now that doesn't work. This will work after we switch to a grammar-based parser
        it.skip('correctly parses commented out dependencies', async () => {
            const contractWithCommentedOutDependencies = `// import "./TokenTransferProxy.sol";`;
            expect(parseDependencies(contractWithCommentedOutDependencies)).to.be.deep.equal([]);
        });
    });
});
