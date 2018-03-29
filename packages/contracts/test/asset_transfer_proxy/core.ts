import { BlockchainLifecycle, devConstants, web3Factory } from '@0xproject/dev-utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import * as chai from 'chai';
import * as Web3 from 'web3';

import { TokenTransferProxyContract } from '../../src/contract_wrappers/generated/token_transfer_proxy';
import { AssetTransferProxyContract } from '../../src/contract_wrappers/generated/asset_transfer_proxy';
import { ERC20TransferProxyContract } from '../../src/contract_wrappers/generated/e_r_c20_transfer_proxy';
import { ERC20TransferProxy_v1Contract } from '../../src/contract_wrappers/generated/erc20transferproxy_v1';
import { DummyERC721TokenContract } from '../../src/contract_wrappers/generated/dummy_e_r_c721_token';
import { ERC721TransferProxyContract } from '../../src/contract_wrappers/generated/e_r_c721_transfer_proxy';
import { constants } from '../../src/utils/constants';
import { ContractName } from '../../src/utils/types';
import { chaiSetup } from '../utils/chai_setup';
import { deployer } from '../utils/deployer';
import { web3, web3Wrapper } from '../utils/web3_wrapper';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);

describe('AssetTransferProxy', () => {
    let owner: string;
    let notOwner: string;
    let assetProxyManagerAddress: string;
    let address: string;
    let tokenTransferProxy: TokenTransferProxyContract;
    let assetTransferProxy: AssetTransferProxyContract;
    let erc20TransferProxyV1: ERC20TransferProxy_v1Contract;
    let erc20TransferProxy: ERC20TransferProxyContract;
    let erc721TransferProxy: ERC721TransferProxyContract;
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        owner = address = accounts[0];
        notOwner = accounts[1];
        assetProxyManagerAddress = accounts[2];
        const tokenTransferProxyInstance = await deployer.deployAsync(ContractName.TokenTransferProxy);
        tokenTransferProxy = new TokenTransferProxyContract(
            web3Wrapper,
            tokenTransferProxyInstance.abi,
            tokenTransferProxyInstance.address,
        );

        const erc20TransferProxyV1Instance = await deployer.deployAsync(ContractName.ERC20TransferProxy_V1, [
            tokenTransferProxy.address,
        ]);
        erc20TransferProxyV1 = new ERC20TransferProxy_v1Contract(
            web3Wrapper,
            erc20TransferProxyV1Instance.abi,
            erc20TransferProxyV1Instance.address,
        );

        const erc20TransferProxyInstance = await deployer.deployAsync(ContractName.ERC20TransferProxy);
        erc20TransferProxy = new ERC20TransferProxyContract(
            web3Wrapper,
            erc20TransferProxyInstance.abi,
            erc20TransferProxyInstance.address,
        );

        const erc721TransferProxyInstance = await deployer.deployAsync(ContractName.ERC721TransferProxy);
        erc721TransferProxy = new ERC721TransferProxyContract(
            web3Wrapper,
            erc721TransferProxyInstance.abi,
            erc721TransferProxyInstance.address,
        );

        const assetTransferProxyInstance = await deployer.deployAsync(ContractName.AssetTransferProxy);
        assetTransferProxy = new AssetTransferProxyContract(
            web3Wrapper,
            assetTransferProxyInstance.abi,
            assetTransferProxyInstance.address,
        );

        await assetTransferProxy.addAuthorizedAddress.sendTransactionAsync(assetProxyManagerAddress, { from: accounts[0] });
        await erc20TransferProxyV1.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await erc20TransferProxy.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await erc721TransferProxy.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await tokenTransferProxy.addAuthorizedAddress.sendTransactionAsync(erc20TransferProxyV1.address, { from: accounts[0] });
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });

/*
    const nilAddress = "0x0000000000000000000000000000000000000000";
    await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC20_V1, erc20TransferProxyV1.address, nilAddress, { from: assetProxyManagerAddress });
    await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC20, erc20TransferProxy.address, nilAddress, { from: assetProxyManagerAddress });
    await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC721, erc721TransferProxy.address, nilAddress, { from: assetProxyManagerAddress });

    */

    describe.only('registerAssetProxy', () => {
        it('should record proxy upon registration', async () => {
        });

        it('should replace proxy address upon re-registration', async () => {
        });

        it('should throw if registering with incorrect "old_address" field', async () => {
        });

        it('should throw if registering a contract with address=0x0', async () => {
        });

        it('should throw if requesting address is not authorized', async () => {
        });
    });

    describe('getProxy', () => {
        it('should return address of registered proxy', async () => {
        });

        it('should throw if requesting unregistered proxy', async () => {
        });
    });

    describe('deregisterAssetProxy', () => {
        it('should set proxy to unregistered after deregistration', async () => {
        });

        it('should throw when deregistering a proxy that is not registered', async () => {
        });

        it('should throw if requesting address is not authorized', async () => {
        });
    });

    describe('transferFrom', () => {
        it('should delegate transfer to registered proxy', async () => {
        });

        it('should throw if delegating to unregistered proxy', async () => {
        });

        it('should throw if requesting address is not authorized', async () => {
        });
    });
});
