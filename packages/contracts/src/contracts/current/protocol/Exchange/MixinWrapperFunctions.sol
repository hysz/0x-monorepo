/*

  Copyright 2018 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./mixins/MExchangeCore.sol";
import "../../utils/SafeMath/SafeMath.sol";


/// @dev Consumes MExchangeCore
contract MixinWrapperFunctions is
    MExchangeCore,
    SafeMath
{

    event LogGregsss(
        bytes32 value
    );
    /// @param order Order struct containing order specifications.
    /// @param takerTokenFillAmount Desired amount of takerToken to fill.
    /// @param signature Maker's signature of the order.
    function fillOrKillOrder(
        Order order,
        uint256 takerTokenFillAmount,
        bytes signature)
        public
    {
        require(
            fillOrder(
                order,
                takerTokenFillAmount,
                signature
            ) == takerTokenFillAmount
        );
    }

    struct GOrder {
        address makerAddress;
        address takerAddress;
        address makerTokenAddress;
        address takerTokenAddress;
        address feeRecipientAddress;
        uint256 makerTokenAmount;
        uint256 takerTokenAmount;
        uint256 makerFeeAmount;
        uint256 takerFeeAmount;
        uint256 expirationTimeSeconds;
        uint256 salt;
        bytes makerAssetProxyMetadata;
        bytes takerAssetProxyMetadata;
    }

    event GLog(
        bytes32 len,
        uint8 first,
        bytes32 len2,
        uint8 first2
    );

    event GLog2(
        bytes32 len,
       bytes32 len2
    );

    event GLog3(
        bytes32 fill
    );

    event GLog4(
        bytes32 len,
        uint8 first
    );



    function gregOrder(GOrder order, uint256 takerTokenFillAmount, bytes signature)
        public view
        returns (bytes32)
    {
        //emit LogGregsss( bytes32(14) );
        //emit GLog(bytes32(order.makerAssetProxyMetadata.length), uint8(order.makerAssetProxyMetadata[0]), bytes32(order.takerAssetProxyMetadata.length), uint8(order.takerAssetProxyMetadata[1]));
        //emit GLog2(bytes32(order.makerAssetProxyMetadata.length), bytes32(order.takerAssetProxyMetadata.length));
        //emit GLog3(bytes32(takerTokenFillAmount));
        emit GLog4(bytes32(signature.length), uint8(signature[0]));
        return bytes32(14);
    }


    /// @dev Fills an order with specified parameters and ECDSA signature. Returns false if the transaction would otherwise revert.
    /// @param order Order struct containing order specifications.
    /// @param takerTokenFillAmount Desired amount of takerToken to fill.
    /// @param signature Maker's signature of the order.
    /// @return Total amount of takerToken filled in trade.
    function fillOrderNoThrow(
        Order order,
        uint256 takerTokenFillAmount,
        bytes signature)
        public
        returns (uint256 takerTokenFilledAmount)
    {
        // We need to call MExchangeCore.fillOrder using a delegatecall in
        // assembly so that we can intercept a call that throws. For this, we
        // need the input encoded in memory in the Ethereum ABIv2 format [1].

        // | Area     | Offset | Length  | Contents                                    |
        // | -------- |--------|---------|-------------------------------------------- |
        // | Header   | 0x00   | 4       | function selector                           |
        // | Params   |        | 3 * 32  | function parameters:                        |
        // |          | 0x00   |         |   1. offset to order (*)                    |
        // |          | 0x20   |         |   2. takerTokenFillAmount                   |
        // |          | 0x40   |         |   3. offset to signature (*)                |
        // | Data     |        | 13 * 32 | order:                                      |
        // |          | 0x000  |         |   1.  makerAddress                          |
        // |          | 0x020  |         |   2.  takerAddress                          |
        // |          | 0x040  |         |   3.  makerTokenAddress                     |
        // |          | 0x060  |         |   4.  takerTokenAddress                     |
        // |          | 0x080  |         |   5.  feeRecipientAddress                   |
        // |          | 0x0A0  |         |   6.  makerTokenAmount                      |
        // |          | 0x0C0  |         |   7.  takerTokenAmount                      |
        // |          | 0x0E0  |         |   8.  makerFeeAmount                        |
        // |          | 0x100  |         |   9.  takerFeeAmount                        |
        // |          | 0x120  |         |   10. expirationTimeSeconds                 |
        // |          | 0x140  |         |   11. salt                                  |
        // |          | 0x160  |         |   12. Offset to makerAssetProxyMetadata (*) |
        // |          | 0x180  |         |   13. Offset to takerAssetProxyMetadata (*  |
        // |          | 0x1A0  | 32      | makerAssetProxyMetadata Length              |
        // |          | 0x1C0  | **      | makerAssetProxyMetadata Contents            |
        // |          | 0x1E0  | 32      | takerAssetProxyMetadata Length              |
        // |          | 0x200  | **      | takerAssetProxyMetadata Contents            |
        // |          | 0x220  | 32      | signature Length                            |
        // |          | 0x240  | **      | signature Contents                          |

        // * Offsets are calculated from the beginning of the current area: Header, Params, Data:
        //     An offset stored in the Params area is calculated from the beginning of the Params section.
        //     An offset stored in the Data area is calculated from the beginning of the Data section.

        // ** The length of dynamic array contents are stored in the field immediately preceeding the contents.

        // [1]: https://solidity.readthedocs.io/en/develop/abi-spec.html

        bytes4 fillOrderSelector = this.fillOrder.selector;

        assembly {
            // Load free memory pointer
            let freeMemoryStart := mload(0x40)

            // Areas below may use the following variables:
            //   1. <area>Start   -- Start of this area in memory
            //   2. <area>End     -- End of this area in memory. This value may
            //                       be precomputed (before writing contents),
            //                       or it may be computed as contents are written.
            //   3. <area>Offset  -- Current offset into area. If an area's End
            //                       is precomputed, this variable tracks the
            //                       offsets of contents as they are written.

            /////// Setup Header Area ///////
            let headerAreaStart := freeMemoryStart
            mstore(headerAreaStart, fillOrderSelector)
            let headerAreaEnd := add(headerAreaStart, 0x4)

            /////// Setup Params Area ///////
            // This area is preallocated and written to later.
            // This is because we need to fill in offsets that have not yet been calculated.
            let paramsAreaStart := headerAreaEnd
            let paramsAreaEnd := add(paramsAreaStart, 0x60)
            let paramsAreaOffset := paramsAreaStart

            /////// Setup Data Area ///////
            let dataAreaStart := paramsAreaEnd
            let dataAreaEnd := dataAreaStart

            // Offset from the source data we're reading from
            let sourceOffset := order
            // bytesLen and bytesLenPadded track the length of a dynamically-allocated bytes array.
            let bytesLen := 0
            let bytesLenPadded := 0

            /////// Write order Struct ///////
            // Write memory location of Order, relative to the start of the
            // parameter list, then increment the paramsAreaOffset respectively.
            mstore(paramsAreaOffset, sub(dataAreaEnd, paramsAreaStart))
            paramsAreaOffset := add(paramsAreaOffset, 0x20)

            // Write values for each field in the order
            for{let i := 0} lt(i, 13) {i := add(i, 1)} {
                mstore(dataAreaEnd, mload(sourceOffset))
                dataAreaEnd := add(dataAreaEnd, 0x20)
                sourceOffset := add(sourceOffset, 0x20)
            }

            // Write offset to <order.makerAssetProxyMetadata>
            mstore(add(dataAreaStart, mul(11, 0x20)), sub(dataAreaEnd, dataAreaStart))

            // Calculate length of <order.makerAssetProxyMetadata>
            bytesLen := mload(sourceOffset)
            sourceOffset := add(sourceOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 0x20), gt(mod(bytesLen, 0x20), 0))

            // Write length of <order.makerAssetProxyMetadata>
            mstore(dataAreaEnd, bytesLen)
            dataAreaEnd := add(dataAreaEnd, 0x20)

            // Write contents of  <order.makerAssetProxyMetadata>
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} {
                mstore(dataAreaEnd, mload(sourceOffset))
                dataAreaEnd := add(dataAreaEnd, 0x20)
                sourceOffset := add(sourceOffset, 0x20)
            }

            // Write offset to <order.takerAssetProxyMetadata>
            mstore(add(dataAreaStart, mul(12, 0x20)), sub(dataAreaEnd, dataAreaStart))

            // Calculate length of <order.takerAssetProxyMetadata>
            bytesLen := mload(sourceOffset)
            sourceOffset := add(sourceOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 0x20), gt(mod(bytesLen, 0x20), 0))

            // Write length of <order.takerAssetProxyMetadata>
            mstore(dataAreaEnd, bytesLen)
            dataAreaEnd := add(dataAreaEnd, 0x20)

            // Write contents of  <order.takerAssetProxyMetadata>
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} {
                mstore(dataAreaEnd, mload(sourceOffset))
                dataAreaEnd := add(dataAreaEnd, 0x20)
                sourceOffset := add(sourceOffset, 0x20)
            }

            /////// Write takerTokenFillAmount ///////
            mstore(paramsAreaOffset, takerTokenFillAmount)
            paramsAreaOffset := add(paramsAreaOffset, 0x20)

            /////// Write signature ///////
            // Write offset to paramsArea
            mstore(paramsAreaOffset, sub(dataAreaEnd, paramsAreaStart))

            // Calculate length of signature
            bytesLen := mload(sourceOffset)
            sourceOffset := add(sourceOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 0x20), gt(mod(bytesLen, 0x20), 0))

            // Write length of signature
            mstore(dataAreaEnd, bytesLen)
            dataAreaEnd := add(dataAreaEnd, 0x20)

            // Write contents of signature
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} {
                mstore(dataAreaEnd, mload(sourceOffset))
                dataAreaEnd := add(dataAreaEnd, 0x20)
                sourceOffset := add(sourceOffset, 0x20)
            }

            // Execute delegatecall
            let success := delegatecall(
                gas,                                // forward all gas, TODO: look into gas consumption of assert/throw
                address,                            // call address of this contract
                headerAreaStart,                    // pointer to start of input
                sub(dataAreaEnd, headerAreaStart),  // length of input
                headerAreaStart,                    // write output over input
                32                                  // output size is 32 bytes
            )
            switch success
            case 0 {
                takerTokenFilledAmount := 0
            }
            case 1 {
                takerTokenFilledAmount := mload(headerAreaStart)
            }
        }
        emit LogGregsss(bytes32(takerTokenFilledAmount));
        return takerTokenFilledAmount;
    }

    /// @dev Synchronously executes multiple calls of fillOrder in a single transaction.
    /// @param orders Array of orders.
    /// @param takerTokenFillAmounts Array of desired amounts of takerToken to fill in orders.
    /// @param signatures Maker's signatures of the orders.
    function batchFillOrders(
        Order[] orders,
        uint256[] takerTokenFillAmounts,
        bytes[] signatures)
        public
    {
        for (uint256 i = 0; i < orders.length; i++) {
            fillOrder(
                orders[i],
                takerTokenFillAmounts[i],
                signatures[i]
            );
        }
    }

    /// @dev Synchronously executes multiple calls of fillOrKill in a single transaction.
    /// @param orders Array of orders.
    /// @param takerTokenFillAmounts Array of desired amounts of takerToken to fill in orders.
    /// @param signatures Maker's signatures of the orders.
    function batchFillOrKillOrders(
        Order[] orders,
        uint256[] takerTokenFillAmounts,
        bytes[] signatures)
        public
    {
        for (uint256 i = 0; i < orders.length; i++) {
            fillOrKillOrder(
                orders[i],
                takerTokenFillAmounts[i],
                signatures[i]
            );
        }
    }

    /// @dev Fills an order with specified parameters and ECDSA signature. Returns false if the transaction would otherwise revert.
    /// @param orders Array of orders.
    /// @param takerTokenFillAmounts Array of desired amounts of takerToken to fill in orders.
    /// @param signatures Maker's signatures of the orders.
    function batchFillOrdersNoThrow(
        Order[] orders,
        uint256[] takerTokenFillAmounts,
        bytes[] signatures)
        public
    {
        for (uint256 i = 0; i < orders.length; i++) {
            fillOrderNoThrow(
                orders[i],
                takerTokenFillAmounts[i],
                signatures[i]
            );
        }
    }

    /// @dev Synchronously executes multiple fill orders in a single transaction until total takerTokenFillAmount filled.
    /// @param orders Array of orders.
    /// @param takerTokenFillAmount Desired amount of takerToken to fill.
    /// @param signatures Maker's signatures of the orders.
    /// @return Total amount of takerTokenFillAmount filled in orders.
    function marketFillOrders(
        Order[] orders,
        uint256 takerTokenFillAmount,
        bytes[] signatures)
        public
        returns (uint256 totalTakerTokenFilledAmount)
    {
        for (uint256 i = 0; i < orders.length; i++) {
            require(orders[i].takerTokenAddress == orders[0].takerTokenAddress);
            uint256 remainingTakerTokenFillAmount = safeSub(takerTokenFillAmount, totalTakerTokenFilledAmount);
            totalTakerTokenFilledAmount = safeAdd(
                totalTakerTokenFilledAmount,
                fillOrder(
                    orders[i],
                    remainingTakerTokenFillAmount,
                    signatures[i]
                )
            );
            if (totalTakerTokenFilledAmount == takerTokenFillAmount) {
                break;
            }
        }
        return totalTakerTokenFilledAmount;
    }

    /// @dev Synchronously executes multiple calls of fillOrderNoThrow in a single transaction until total takerTokenFillAmount filled.
    /// @param orders Array of orders.
    /// @param takerTokenFillAmount Desired total amount of takerToken to fill in orders.
    /// @param signatures Maker's signatures of the orders.
    /// @return Total amount of takerTokenFillAmount filled in orders.
    function marketFillOrdersNoThrow(
        Order[] orders,
        uint256 takerTokenFillAmount,
        bytes[] signatures)
        public
        returns (uint256 totalTakerTokenFilledAmount)
    {
        for (uint256 i = 0; i < orders.length; i++) {
            require(orders[i].takerTokenAddress == orders[0].takerTokenAddress);
            uint256 remainingTakerTokenFillAmount = safeSub(takerTokenFillAmount, totalTakerTokenFilledAmount);
            totalTakerTokenFilledAmount = safeAdd(
                totalTakerTokenFilledAmount,
                fillOrderNoThrow(
                    orders[i],
                    remainingTakerTokenFillAmount,
                    signatures[i]
                )
            );
            if (totalTakerTokenFilledAmount == takerTokenFillAmount) {
                break;
            }
        }
        return totalTakerTokenFilledAmount;
    }

    /// @dev Synchronously cancels multiple orders in a single transaction.
    /// @param orders Array of orders.
    /// @param takerTokenCancelAmounts Array of desired amounts of takerToken to cancel in orders.
    function batchCancelOrders(
        Order[] orders,
        uint256[] takerTokenCancelAmounts)
        public
    {
        for (uint256 i = 0; i < orders.length; i++) {
            cancelOrder(
                orders[i],
                takerTokenCancelAmounts[i]
            );
        }
    }

}
