import { LogWithDecodedArgs, TransactionReceiptWithDecodedLogs, ZeroEx } from '0x.js';

import { BlockchainLifecycle, devConstants, web3Factory } from '@0xproject/dev-utils';
import { BigNumber } from '@0xproject/utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import * as chai from 'chai';
import ethUtil = require('ethereumjs-util');
import * as Web3 from 'web3';

import { DummyTokenContract } from '../../src/contract_wrappers/generated/dummy_token';
import {
    ExchangeContract,
    LogCancelContractEventArgs,
    LogErrorContractEventArgs,
    LogFillContractEventArgs,
} from '../../src/contract_wrappers/generated/exchange';
import { TokenTransferProxyContract } from '../../src/contract_wrappers/generated/token_transfer_proxy';
import { AssetTransferProxyContract } from '../../src/contract_wrappers/generated/asset_transfer_proxy';
import { ERC20TransferProxyContract } from '../../src/contract_wrappers/generated/e_r_c20_transfer_proxy';
import { ERC20TransferProxy_v1Contract } from '../../src/contract_wrappers/generated/erc20transferproxy_v1';
import { DummyERC721TokenContract } from '../../src/contract_wrappers/generated/dummy_e_r_c721_token';
import { ERC721TransferProxyContract } from '../../src/contract_wrappers/generated/e_r_c721_transfer_proxy';
import { Balances } from '../../src/utils/balances';
import { constants } from '../../src/utils/constants';
import { crypto } from '../../src/utils/crypto';
import { ExchangeWrapper } from '../../src/utils/exchange_wrapper';
import { LogDecoder } from '../../src/utils/log_decoder';
import { OrderFactory } from '../../src/utils/order_factory';
import { orderUtils } from '../../src/utils/order_utils';
import { BalancesByOwner, ContractName, ExchangeContractErrs, SignatureType, SignedOrder, AssetProxyId } from '../../src/utils/types';
import { chaiSetup } from '../utils/chai_setup';
import { deployer } from '../utils/deployer';
import { web3, web3Wrapper } from '../utils/web3_wrapper';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);
const logDecoder = new LogDecoder(constants.TESTRPC_NETWORK_ID);

describe('Exchange', () => {
    let makerAddress: string;
    let tokenOwner: string;
    let takerAddress: string;
    let feeRecipientAddress: string;
    let assetProxyManagerAddress: string;
    const INITIAL_BALANCE = ZeroEx.toBaseUnitAmount(new BigNumber(10000), 18);
    const INITIAL_ALLOWANCE = ZeroEx.toBaseUnitAmount(new BigNumber(10000), 18);

    let rep: DummyTokenContract;
    let dgd: DummyTokenContract;
    let zrx: DummyTokenContract;
    let ck: DummyERC721TokenContract;
    let et: DummyERC721TokenContract;
    let exchange: ExchangeContract;
    let tokenTransferProxy: TokenTransferProxyContract;
    let assetTransferProxy: AssetTransferProxyContract;
    let erc20TransferProxyV1: ERC20TransferProxy_v1Contract;
    let erc20TransferProxy: ERC20TransferProxyContract;
    let erc721TransferProxy: ERC721TransferProxyContract;

    let signedOrder: SignedOrder;
    let balances: BalancesByOwner;
    let exWrapper: ExchangeWrapper;
    let dmyBalances: Balances;
    let orderFactory: OrderFactory;

    let zeroEx: ZeroEx;

    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        makerAddress = accounts[0];
        [tokenOwner, takerAddress, feeRecipientAddress, assetProxyManagerAddress] = accounts;
        const [repInstance, dgdInstance, zrxInstance, ckInstance, etInstance] = await Promise.all([
            deployer.deployAsync(ContractName.DummyToken, constants.DUMMY_TOKEN_ARGS),
            deployer.deployAsync(ContractName.DummyToken, constants.DUMMY_TOKEN_ARGS),
            deployer.deployAsync(ContractName.DummyToken, constants.DUMMY_TOKEN_ARGS),
            deployer.deployAsync(ContractName.DummyERC721Token, constants.DUMMY_ERC721TOKEN_ARGS),
            deployer.deployAsync(ContractName.DummyERC721Token, constants.DUMMY_ERC721TOKEN_ARGS),
        ]);
        rep = new DummyTokenContract(web3Wrapper, repInstance.abi, repInstance.address);
        dgd = new DummyTokenContract(web3Wrapper, dgdInstance.abi, dgdInstance.address);
        zrx = new DummyTokenContract(web3Wrapper, zrxInstance.abi, zrxInstance.address);
        ck = new DummyERC721TokenContract(web3Wrapper, ckInstance.abi, ckInstance.address);
        et = new DummyERC721TokenContract(web3Wrapper, etInstance.abi, etInstance.address);
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

        const exchangeInstance = await deployer.deployAsync(ContractName.Exchange, [
            zrx.address,
            AssetProxyId.ERC20,
            assetTransferProxy.address,
        ]);
        exchange = new ExchangeContract(web3Wrapper, exchangeInstance.abi, exchangeInstance.address);
        await assetTransferProxy.addAuthorizedAddress.sendTransactionAsync(assetProxyManagerAddress, { from: accounts[0] });
        await assetTransferProxy.addAuthorizedAddress.sendTransactionAsync(exchange.address, { from: accounts[0] });
        await erc20TransferProxyV1.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await erc20TransferProxy.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await erc721TransferProxy.addAuthorizedAddress.sendTransactionAsync(assetTransferProxy.address, { from: accounts[0] });
        await tokenTransferProxy.addAuthorizedAddress.sendTransactionAsync(erc20TransferProxyV1.address, { from: accounts[0] });
        const nilAddress = "0x0000000000000000000000000000000000000000";
        await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC20_V1, erc20TransferProxyV1.address, nilAddress, { from: assetProxyManagerAddress });
        await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC20, erc20TransferProxy.address, nilAddress, { from: assetProxyManagerAddress });
        await assetTransferProxy.registerAssetProxy.sendTransactionAsync(AssetProxyId.ERC721, erc721TransferProxy.address, nilAddress, { from: assetProxyManagerAddress });
        zeroEx = new ZeroEx(web3.currentProvider, {
            exchangeContractAddress: exchange.address,
            networkId: constants.TESTRPC_NETWORK_ID,
        });
        exWrapper = new ExchangeWrapper(exchange, zeroEx);

        const defaultOrderParams = {
            exchangeAddress: exchange.address,
            makerAddress,
            feeRecipientAddress,
            makerTokenAddress: rep.address,
            takerTokenAddress: dgd.address,
            makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
            takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(200), 18),
            makerFeeAmount: ZeroEx.toBaseUnitAmount(new BigNumber(1), 18),
            takerFeeAmount: ZeroEx.toBaseUnitAmount(new BigNumber(1), 18),
            makerAssetProxyId: AssetProxyId.ERC20,
            takerAssetProxyId: AssetProxyId.ERC20,
        };
        const privateKey = constants.TESTRPC_PRIVATE_KEYS[0];
        orderFactory = new OrderFactory(privateKey, defaultOrderParams);
        dmyBalances = new Balances([rep, dgd, zrx], [makerAddress, takerAddress, feeRecipientAddress]);
        await Promise.all([
            rep.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            rep.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            rep.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            rep.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            rep.setBalance.sendTransactionAsync(makerAddress, INITIAL_BALANCE, { from: tokenOwner }),
            rep.setBalance.sendTransactionAsync(takerAddress, INITIAL_BALANCE, { from: tokenOwner }),
            dgd.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            dgd.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            dgd.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            dgd.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            dgd.setBalance.sendTransactionAsync(makerAddress, INITIAL_BALANCE, { from: tokenOwner }),
            dgd.setBalance.sendTransactionAsync(takerAddress, INITIAL_BALANCE, { from: tokenOwner }),
            zrx.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            zrx.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            zrx.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            }),
            zrx.approve.sendTransactionAsync(erc20TransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            }),
            zrx.setBalance.sendTransactionAsync(makerAddress, INITIAL_BALANCE, { from: tokenOwner }),
            zrx.setBalance.sendTransactionAsync(takerAddress, INITIAL_BALANCE, { from: tokenOwner }),

            // Distribute NFTs to maker & taker
            // maker owns [0x0000.., ... , 0x4040..] and taker owns [0x5050.., ..., 0x9090..]
            ck.setApprovalForAll.sendTransactionAsync(erc721TransferProxy.address, true, {from: makerAddress}),
            ck.setApprovalForAll.sendTransactionAsync(erc721TransferProxy.address, true, {from: takerAddress}),
            ck.mint.sendTransactionAsync(makerAddress, new BigNumber('0x0000000000000000000000000000000000000000000000000000000000000000'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(makerAddress, new BigNumber('0x1010101010101010101010101010101010101010101010101010101010101010'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(makerAddress, new BigNumber('0x2020202020202020202020202020202020202020202020202020202020202020'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(makerAddress, new BigNumber('0x3030303030303030303030303030303030303030303030303030303030303030'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(makerAddress, new BigNumber('0x4040404040404040404040404040404040404040404040404040404040404040'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(takerAddress, new BigNumber('0x5050505050505050505050505050505050505050505050505050505050505050'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(takerAddress, new BigNumber('0x6060606060606060606060606060606060606060606060606060606060606060'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(takerAddress, new BigNumber('0x7070707070707070707070707070707070707070707070707070707070707070'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(takerAddress, new BigNumber('0x8080808080808080808080808080808080808080808080808080808080808080'), { from: tokenOwner }),
            ck.mint.sendTransactionAsync(takerAddress, new BigNumber('0x9090909090909090909090909090909090909090909090909090909090909090'), { from: tokenOwner }),

            et.setApprovalForAll.sendTransactionAsync(erc721TransferProxy.address, true, {from: makerAddress}),
            et.setApprovalForAll.sendTransactionAsync(erc721TransferProxy.address, true, {from: takerAddress}),
            et.mint.sendTransactionAsync(makerAddress, new BigNumber('0x0000000000000000000000000000000000000000000000000000000000000000'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(makerAddress, new BigNumber('0x1010101010101010101010101010101010101010101010101010101010101010'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(makerAddress, new BigNumber('0x2020202020202020202020202020202020202020202020202020202020202020'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(makerAddress, new BigNumber('0x3030303030303030303030303030303030303030303030303030303030303030'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(takerAddress, new BigNumber('0x5050505050505050505050505050505050505050505050505050505050505050'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(takerAddress, new BigNumber('0x6060606060606060606060606060606060606060606060606060606060606060'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(takerAddress, new BigNumber('0x7070707070707070707070707070707070707070707070707070707070707070'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(takerAddress, new BigNumber('0x8080808080808080808080808080808080808080808080808080808080808080'), { from: tokenOwner }),
            et.mint.sendTransactionAsync(takerAddress, new BigNumber('0x9090909090909090909090909090909090909090909090909090909090909090'), { from: tokenOwner }),
        ]);
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('internal functions', () => {
        it('should include transferViaTokenTransferProxy', () => {
            expect((exchange as any).transferViaTokenTransferProxy).to.be.undefined();
        });
    });

    describe.only('Testing NFTs', () => {
        it('should successfully exchange two NFTs', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAddress: ck.address,
                takerTokenAddress: ck.address,
                makerTokenAmount: new BigNumber('0x1010101010101010101010101010101010101010101010101010101010101010'),
                takerTokenAmount: new BigNumber('0x9090909090909090909090909090909090909090909090909090909090909090'),
                makerAssetProxyId: AssetProxyId.ERC721,
                takerAssetProxyId: AssetProxyId.ERC721,
            });

            const initialOwnerMakerToken = await ck.ownerOf.callAsync(new BigNumber('0x1010101010101010101010101010101010101010101010101010101010101010'));
            expect(initialOwnerMakerToken).to.be.bignumber.equal(makerAddress);
            const initialOwnerTakerToken = await ck.ownerOf.callAsync(new BigNumber('0x9090909090909090909090909090909090909090909090909090909090909090'));
            expect(initialOwnerTakerToken).to.be.bignumber.equal(takerAddress);

            const takerTokenFillAmount = signedOrder.takerTokenAmount;
            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });
            for(var i = 0; i < res.logs.length; ++i) {
                    const log = logDecoder.decodeLogOrThrow(res.logs[i]) as LogWithDecodedArgs<LogFillContractEventArgs>;
                    console.log(log);
                    console.log();
                    console.log();
            }


            const newOwnerMakerToken = await ck.ownerOf.callAsync(new BigNumber('0x1010101010101010101010101010101010101010101010101010101010101010'));
            expect(newOwnerMakerToken).to.be.bignumber.equal(takerAddress);
            const newOwnerTakerToken = await ck.ownerOf.callAsync(new BigNumber('0x9090909090909090909090909090909090909090909090909090909090909090'));
            expect(newOwnerTakerToken).to.be.bignumber.equal(makerAddress);
        });
    })

    describe('fillOrder', () => {
        beforeEach(async () => {
            balances = await dmyBalances.getAsync();
            signedOrder = orderFactory.newSignedOrder();
        });

        it('should create an unfillable order', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: new BigNumber(1001),
                takerTokenAmount: new BigNumber(3),
            });

            const filledTakerTokenAmountBefore = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountBefore).to.be.bignumber.equal(0);

            const fillTakerTokenAmount1 = new BigNumber(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: fillTakerTokenAmount1,
            });

            const filledTakerTokenAmountAfter1 = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountAfter1).to.be.bignumber.equal(fillTakerTokenAmount1);

            const fillTakerTokenAmount2 = new BigNumber(1);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: fillTakerTokenAmount2,
            });

            const filledTakerTokenAmountAfter2 = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountAfter2).to.be.bignumber.equal(filledTakerTokenAmountAfter1);
        });

        it('should transfer the correct amounts when makerTokenAmount === takerTokenAmount', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
            });

            const filledTakerTokenAmountBefore = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountBefore).to.be.bignumber.equal(0);

            const takerTokenFillAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });

            const filledTakerTokenAmountAfter = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountAfter).to.be.bignumber.equal(takerTokenFillAmount);

            const newBalances = await dmyBalances.getAsync();

            const makerTokenFillAmount = takerTokenFillAmount
                .times(signedOrder.makerTokenAmount)
                .dividedToIntegerBy(signedOrder.takerTokenAmount);
            const makerFeePaid = signedOrder.makerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            const takerFeePaid = signedOrder.takerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(makerTokenFillAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(takerTokenFillAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(makerFeePaid),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(takerTokenFillAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(makerTokenFillAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(takerFeePaid),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeePaid.add(takerFeePaid)),
            );
        });

        it('should transfer the correct amounts when makerTokenAmount > takerTokenAmount', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(200), 18),
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
            });

            const filledTakerTokenAmountBefore = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountBefore).to.be.bignumber.equal(0);

            const takerTokenFillAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });

            const filledTakerTokenAmountAfter = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountAfter).to.be.bignumber.equal(takerTokenFillAmount);

            const newBalances = await dmyBalances.getAsync();

            const makerTokenFillAmount = takerTokenFillAmount
                .times(signedOrder.makerTokenAmount)
                .dividedToIntegerBy(signedOrder.takerTokenAmount);
            const makerFeePaid = signedOrder.makerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            const takerFeePaid = signedOrder.takerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(makerTokenFillAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(takerTokenFillAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(makerFeePaid),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(takerTokenFillAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(makerTokenFillAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(takerFeePaid),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeePaid.add(takerFeePaid)),
            );
        });

        it('should transfer the correct amounts when makerTokenAmount < takerTokenAmount', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(200), 18),
            });

            const filledTakerTokenAmountBefore = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountBefore).to.be.bignumber.equal(0);

            const takerTokenFillAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });

            const filledTakerTokenAmountAfter = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountAfter).to.be.bignumber.equal(takerTokenFillAmount);

            const newBalances = await dmyBalances.getAsync();

            const makerTokenFillAmount = takerTokenFillAmount
                .times(signedOrder.makerTokenAmount)
                .dividedToIntegerBy(signedOrder.takerTokenAmount);
            const makerFeePaid = signedOrder.makerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            const takerFeePaid = signedOrder.takerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(makerTokenFillAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(takerTokenFillAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(makerFeePaid),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(takerTokenFillAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(makerTokenFillAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(takerFeePaid),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeePaid.add(takerFeePaid)),
            );
        });

        it('should transfer the correct amounts when taker is specified and order is claimed by taker', async () => {
            signedOrder = orderFactory.newSignedOrder({
                takerAddress,
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(200), 18),
            });

            const filledTakerTokenAmountBefore = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            expect(filledTakerTokenAmountBefore).to.be.bignumber.equal(0);

            const takerTokenFillAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });

            const filledTakerTokenAmountAfter = await exWrapper.getFilledTakerTokenAmountAsync(
                orderUtils.getOrderHashHex(signedOrder),
            );
            const expectedFillAmountTAfter = takerTokenFillAmount.add(filledTakerTokenAmountBefore);
            expect(filledTakerTokenAmountAfter).to.be.bignumber.equal(expectedFillAmountTAfter);

            const newBalances = await dmyBalances.getAsync();

            const makerTokenFillAmount = takerTokenFillAmount
                .times(signedOrder.makerTokenAmount)
                .dividedToIntegerBy(signedOrder.takerTokenAmount);
            const makerFeePaid = signedOrder.makerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            const takerFeePaid = signedOrder.takerFeeAmount
                .times(makerTokenFillAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(makerTokenFillAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(takerTokenFillAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(makerFeePaid),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(takerTokenFillAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(makerTokenFillAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(takerFeePaid),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeePaid.add(takerFeePaid)),
            );
        });

        it('should fill remaining value if takerTokenFillAmount > remaining takerTokenAmount', async () => {
            const takerTokenFillAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, { takerTokenFillAmount });

            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: signedOrder.takerTokenAmount,
            });
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogFillContractEventArgs>;
            expect(log.args.takerTokenFilledAmount).to.be.bignumber.equal(
                signedOrder.takerTokenAmount.minus(takerTokenFillAmount),
            );
            const newBalances = await dmyBalances.getAsync();

            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(signedOrder.makerTokenAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(signedOrder.takerTokenAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(signedOrder.makerFeeAmount),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(signedOrder.takerTokenAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(signedOrder.makerTokenAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(signedOrder.takerFeeAmount),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(
                    signedOrder.makerFeeAmount.add(signedOrder.takerFeeAmount),
                ),
            );
        });

        it('should log 1 event with the correct arguments when order has a feeRecipient', async () => {
            const divisor = 2;
            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: signedOrder.takerTokenAmount.div(divisor),
            });
            expect(res.logs).to.have.length(1);

            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogFillContractEventArgs>;
            const logArgs = log.args;
            const expectedFilledMakerTokenAmount = signedOrder.makerTokenAmount.div(divisor);
            const expectedFilledTakerTokenAmount = signedOrder.takerTokenAmount.div(divisor);
            const expectedFeeMPaid = signedOrder.makerFeeAmount.div(divisor);
            const expectedFeeTPaid = signedOrder.takerFeeAmount.div(divisor);
            const tokensHashBuff = crypto.solSHA3([signedOrder.makerTokenAddress, signedOrder.takerTokenAddress]);
            const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

            expect(signedOrder.makerAddress).to.be.equal(logArgs.makerAddress);
            expect(takerAddress).to.be.equal(logArgs.takerAddress);
            expect(signedOrder.feeRecipientAddress).to.be.equal(logArgs.feeRecipientAddress);
            expect(signedOrder.makerTokenAddress).to.be.equal(logArgs.makerTokenAddress);
            expect(signedOrder.takerTokenAddress).to.be.equal(logArgs.takerTokenAddress);
            expect(expectedFilledMakerTokenAmount).to.be.bignumber.equal(logArgs.makerTokenFilledAmount);
            expect(expectedFilledTakerTokenAmount).to.be.bignumber.equal(logArgs.takerTokenFilledAmount);
            expect(expectedFeeMPaid).to.be.bignumber.equal(logArgs.makerFeeAmountPaid);
            expect(expectedFeeTPaid).to.be.bignumber.equal(logArgs.takerFeeAmountPaid);
            expect(orderUtils.getOrderHashHex(signedOrder)).to.be.equal(logArgs.orderHash);
        });

        it('should log 1 event with the correct arguments when order has no feeRecipient', async () => {
            signedOrder = orderFactory.newSignedOrder({
                feeRecipientAddress: ZeroEx.NULL_ADDRESS,
            });
            const divisor = 2;
            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: signedOrder.takerTokenAmount.div(divisor),
            });
            expect(res.logs).to.have.length(1);

            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogFillContractEventArgs>;
            const logArgs = log.args;
            const expectedFilledMakerTokenAmount = signedOrder.makerTokenAmount.div(divisor);
            const expectedFilledTakerTokenAmount = signedOrder.takerTokenAmount.div(divisor);
            const expectedFeeMPaid = new BigNumber(0);
            const expectedFeeTPaid = new BigNumber(0);
            const tokensHashBuff = crypto.solSHA3([signedOrder.makerTokenAddress, signedOrder.takerTokenAddress]);
            const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

            expect(signedOrder.makerAddress).to.be.equal(logArgs.makerAddress);
            expect(takerAddress).to.be.equal(logArgs.takerAddress);
            expect(signedOrder.feeRecipientAddress).to.be.equal(logArgs.feeRecipientAddress);
            expect(signedOrder.makerTokenAddress).to.be.equal(logArgs.makerTokenAddress);
            expect(signedOrder.takerTokenAddress).to.be.equal(logArgs.takerTokenAddress);
            expect(expectedFilledMakerTokenAmount).to.be.bignumber.equal(logArgs.makerTokenFilledAmount);
            expect(expectedFilledTakerTokenAmount).to.be.bignumber.equal(logArgs.takerTokenFilledAmount);
            expect(expectedFeeMPaid).to.be.bignumber.equal(logArgs.makerFeeAmountPaid);
            expect(expectedFeeTPaid).to.be.bignumber.equal(logArgs.takerFeeAmountPaid);
            expect(orderUtils.getOrderHashHex(signedOrder)).to.be.equal(logArgs.orderHash);
        });

        it('should throw when taker is specified and order is claimed by other', async () => {
            signedOrder = orderFactory.newSignedOrder({
                takerAddress: feeRecipientAddress,
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100), 18),
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(200), 18),
            });
            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if signature is invalid', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(10), 18),
            });

            const invalidR = ethUtil.sha3('invalidR');
            const invalidS = ethUtil.sha3('invalidS');
            const signatureTypeAndV = signedOrder.signature.slice(0, 6);
            const invalidSigBuff = Buffer.concat([ethUtil.toBuffer(signatureTypeAndV), invalidR, invalidS]);
            const invalidSigHex = `0x${invalidSigBuff.toString('hex')}`;
            signedOrder.signature = invalidSigHex;
            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if makerTokenAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: new BigNumber(0),
            });

            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if takerTokenAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder({
                takerTokenAmount: new BigNumber(0),
            });

            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if takerTokenFillAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder();

            return expect(
                exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                    takerTokenFillAmount: new BigNumber(0),
                }),
            ).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if maker balances are too low to fill order', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100000), 18),
            });

            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if taker balances are too low to fill order', async () => {
            signedOrder = orderFactory.newSignedOrder({
                takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(100000), 18),
            });

            return expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if maker allowances are too low to fill order', async () => {
            await rep.approve.sendTransactionAsync(tokenTransferProxy.address, new BigNumber(0), {
                from: makerAddress,
            });
            expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
            await rep.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: makerAddress,
            });
        });

        it('should throw if taker allowances are too low to fill order', async () => {
            await dgd.approve.sendTransactionAsync(tokenTransferProxy.address, new BigNumber(0), {
                from: takerAddress,
            });
            expect(exWrapper.fillOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
            await dgd.approve.sendTransactionAsync(tokenTransferProxy.address, INITIAL_ALLOWANCE, {
                from: takerAddress,
            });
        });

        it('should not change balances if an order is expired', async () => {
            signedOrder = orderFactory.newSignedOrder({
                expirationTimeSeconds: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
            });
            await exWrapper.fillOrderAsync(signedOrder, takerAddress);

            const newBalances = await dmyBalances.getAsync();
            expect(newBalances).to.be.deep.equal(balances);
        });

        it('should log an error event if an order is expired', async () => {
            signedOrder = orderFactory.newSignedOrder({
                expirationTimeSeconds: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
            });

            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress);
            expect(res.logs).to.have.length(1);
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogErrorContractEventArgs>;
            const errCode = log.args.errorId;
            expect(errCode).to.be.equal(ExchangeContractErrs.ERROR_ORDER_EXPIRED);
        });

        it('should log an error event if no value is filled', async () => {
            signedOrder = orderFactory.newSignedOrder({});
            await exWrapper.fillOrderAsync(signedOrder, takerAddress);

            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress);
            expect(res.logs).to.have.length(1);
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogErrorContractEventArgs>;
            const errCode = log.args.errorId;
            expect(errCode).to.be.equal(ExchangeContractErrs.ERROR_ORDER_FULLY_FILLED_OR_CANCELLED);
        });
    });

    describe('cancelOrder', () => {
        beforeEach(async () => {
            balances = await dmyBalances.getAsync();
            signedOrder = orderFactory.newSignedOrder();
        });

        it('should throw if not sent by maker', async () => {
            return expect(exWrapper.cancelOrderAsync(signedOrder, takerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if makerTokenAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder({
                makerTokenAmount: new BigNumber(0),
            });

            return expect(exWrapper.cancelOrderAsync(signedOrder, makerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if takerTokenAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder({
                takerTokenAmount: new BigNumber(0),
            });

            return expect(exWrapper.cancelOrderAsync(signedOrder, makerAddress)).to.be.rejectedWith(constants.REVERT);
        });

        it('should throw if takerTokenCancelAmount is 0', async () => {
            signedOrder = orderFactory.newSignedOrder();

            return expect(
                exWrapper.cancelOrderAsync(signedOrder, makerAddress, {
                    takerTokenCancelAmount: new BigNumber(0),
                }),
            ).to.be.rejectedWith(constants.REVERT);
        });

        it('should be able to cancel a full order', async () => {
            await exWrapper.cancelOrderAsync(signedOrder, makerAddress);
            await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: signedOrder.takerTokenAmount.div(2),
            });

            const newBalances = await dmyBalances.getAsync();
            expect(newBalances).to.be.deep.equal(balances);
        });

        it('should be able to cancel part of an order', async () => {
            const takerTokenCancelAmount = signedOrder.takerTokenAmount.div(2);
            await exWrapper.cancelOrderAsync(signedOrder, makerAddress, {
                takerTokenCancelAmount,
            });

            const res = await exWrapper.fillOrderAsync(signedOrder, takerAddress, {
                takerTokenFillAmount: signedOrder.takerTokenAmount,
            });
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogFillContractEventArgs>;
            expect(log.args.takerTokenFilledAmount).to.be.bignumber.equal(
                signedOrder.takerTokenAmount.minus(takerTokenCancelAmount),
            );

            const newBalances = await dmyBalances.getAsync();
            const cancelMakerTokenAmount = takerTokenCancelAmount
                .times(signedOrder.makerTokenAmount)
                .dividedToIntegerBy(signedOrder.takerTokenAmount);
            const makerFeePaid = signedOrder.makerFeeAmount
                .times(cancelMakerTokenAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            const takerFeePaid = signedOrder.takerFeeAmount
                .times(cancelMakerTokenAmount)
                .dividedToIntegerBy(signedOrder.makerTokenAmount);
            expect(newBalances[makerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.makerTokenAddress].minus(cancelMakerTokenAmount),
            );
            expect(newBalances[makerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrder.takerTokenAddress].add(takerTokenCancelAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(
                balances[makerAddress][zrx.address].minus(makerFeePaid),
            );
            expect(newBalances[takerAddress][signedOrder.takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.takerTokenAddress].minus(takerTokenCancelAmount),
            );
            expect(newBalances[takerAddress][signedOrder.makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrder.makerTokenAddress].add(cancelMakerTokenAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(
                balances[takerAddress][zrx.address].minus(takerFeePaid),
            );
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeePaid.add(takerFeePaid)),
            );
        });

        it('should log 1 event with correct arguments', async () => {
            const divisor = 2;
            const res = await exWrapper.cancelOrderAsync(signedOrder, makerAddress, {
                takerTokenCancelAmount: signedOrder.takerTokenAmount.div(divisor),
            });
            expect(res.logs).to.have.length(1);

            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogCancelContractEventArgs>;
            const logArgs = log.args;
            const expectedCancelledMakerTokenAmount = signedOrder.makerTokenAmount.div(divisor);
            const expectedCancelledTakerTokenAmount = signedOrder.takerTokenAmount.div(divisor);

            expect(signedOrder.makerAddress).to.be.equal(logArgs.makerAddress);
            expect(signedOrder.feeRecipientAddress).to.be.equal(logArgs.feeRecipientAddress);
            expect(signedOrder.makerTokenAddress).to.be.equal(logArgs.makerTokenAddress);
            expect(signedOrder.takerTokenAddress).to.be.equal(logArgs.takerTokenAddress);
            expect(expectedCancelledMakerTokenAmount).to.be.bignumber.equal(logArgs.makerTokenCancelledAmount);
            expect(expectedCancelledTakerTokenAmount).to.be.bignumber.equal(logArgs.takerTokenCancelledAmount);
            expect(orderUtils.getOrderHashHex(signedOrder)).to.be.equal(logArgs.orderHash);
        });

        it('should not log events if no value is cancelled', async () => {
            await exWrapper.cancelOrderAsync(signedOrder, makerAddress);

            const res = await exWrapper.cancelOrderAsync(signedOrder, makerAddress);
            expect(res.logs).to.have.length(1);
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogErrorContractEventArgs>;
            const errCode = log.args.errorId;
            expect(errCode).to.be.equal(ExchangeContractErrs.ERROR_ORDER_FULLY_FILLED_OR_CANCELLED);
        });

        it('should not log events if order is expired', async () => {
            signedOrder = orderFactory.newSignedOrder({
                expirationTimeSeconds: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
            });

            const res = await exWrapper.cancelOrderAsync(signedOrder, makerAddress);
            expect(res.logs).to.have.length(1);
            const log = logDecoder.decodeLogOrThrow(res.logs[0]) as LogWithDecodedArgs<LogErrorContractEventArgs>;
            const errCode = log.args.errorId;
            expect(errCode).to.be.equal(ExchangeContractErrs.ERROR_ORDER_EXPIRED);
        });
    });

   describe('cancelOrdersUpTo', () => {
        it('should fail to set makerEpoch less than current makerEpoch', async () => {
            const makerEpoch = new BigNumber(1);
            await exWrapper.cancelOrdersUpToAsync(makerEpoch, makerAddress);
            const lesserMakerEpoch = new BigNumber(0);
            return expect(
                exWrapper.cancelOrdersUpToAsync(lesserMakerEpoch, makerAddress),
            ).to.be.rejectedWith(constants.REVERT);
        });

        it('should fail to set makerEpoch equal to existing makerEpoch', async () => {
            const makerEpoch = new BigNumber(1);
            await exWrapper.cancelOrdersUpToAsync(makerEpoch, makerAddress);
            return expect(
                exWrapper.cancelOrdersUpToAsync(makerEpoch, makerAddress),
            ).to.be.rejectedWith(constants.REVERT);
        });

        it('should cancel only orders with a makerEpoch less than existing makerEpoch', async () => {
            // Cancel all transactions with a makerEpoch less than 1
            const makerEpoch = new BigNumber(1);
            await exWrapper.cancelOrdersUpToAsync(makerEpoch, makerAddress);

            // Create 3 orders with makerEpoch values: 0,1,2,3
            // Since we cancelled with makerEpoch=1, orders with makerEpoch<=1 will not be processed
            balances = await dmyBalances.getAsync();
            const signedOrders = await Promise.all([
                orderFactory.newSignedOrder({
                    makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(9), 18),
                    takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(9), 18),
                    salt: new BigNumber(0)}),
                orderFactory.newSignedOrder({
                    makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(79), 18),
                    takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(79), 18),
                    salt: new BigNumber(1)}),
                orderFactory.newSignedOrder({
                    makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(979), 18),
                    takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(979), 18),
                    salt: new BigNumber(2)}),
                orderFactory.newSignedOrder({
                    makerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(7979), 18),
                    takerTokenAmount: ZeroEx.toBaseUnitAmount(new BigNumber(7979), 18),
                    salt: new BigNumber(3)}),
            ]);
            await exWrapper.batchFillOrdersNoThrowAsync(signedOrders, takerAddress);

            const newBalances = await dmyBalances.getAsync();
            const fillMakerTokenAmount = signedOrders[2].makerTokenAmount.add(signedOrders[3].makerTokenAmount);
            const fillTakerTokenAmount = signedOrders[2].takerTokenAmount.add(signedOrders[3].takerTokenAmount);
            const makerFeeAmount = signedOrders[2].makerFeeAmount.add(signedOrders[3].makerFeeAmount);
            const takerFeeAmount = signedOrders[2].takerFeeAmount.add(signedOrders[3].takerFeeAmount);
            expect(newBalances[makerAddress][signedOrders[3].makerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrders[3].makerTokenAddress].minus(fillMakerTokenAmount),
            );
            expect(newBalances[makerAddress][signedOrders[3].takerTokenAddress]).to.be.bignumber.equal(
                balances[makerAddress][signedOrders[3].takerTokenAddress].add(fillTakerTokenAmount),
            );
            expect(newBalances[makerAddress][zrx.address]).to.be.bignumber.equal(balances[makerAddress][zrx.address].minus(makerFeeAmount));
            expect(newBalances[takerAddress][signedOrders[3].takerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrders[3].takerTokenAddress].minus(fillTakerTokenAmount),
            );
            expect(newBalances[takerAddress][signedOrders[3].makerTokenAddress]).to.be.bignumber.equal(
                balances[takerAddress][signedOrders[3].makerTokenAddress].add(fillMakerTokenAmount),
            );
            expect(newBalances[takerAddress][zrx.address]).to.be.bignumber.equal(balances[takerAddress][zrx.address].minus(takerFeeAmount));
            expect(newBalances[feeRecipientAddress][zrx.address]).to.be.bignumber.equal(
                balances[feeRecipientAddress][zrx.address].add(makerFeeAmount.add(takerFeeAmount)),
            );
        });
    });
}); // tslint:disable-line:max-file-line-count
