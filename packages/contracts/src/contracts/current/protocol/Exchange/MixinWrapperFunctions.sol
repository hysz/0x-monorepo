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

        // | Offset | Length  | Contents                     |
        // |--------|---------|------------------------------|
        // | 0      | 4       | function selector            |
        // | 4      | 13 * 32 | Order order                  |
        // | 420    | 32      | uint256 takerTokenFillAmount |
        // | 452    | 32      | offset to signature (416)    |
        // | 484    | 32      | len(signature)               |
        // | 516    | (1)     | signature                    |
        // | (2)    | (3)     | padding (zero)               |
        // | (4)    |         | end of input                 |

        // (1): len(signature)
        // (2): 452 + len(signature)
        // (3): (32 - len(signature)) mod 32
        // (4): 452 + len(signature) + (32 - len(signature)) mod 32

        // [1]: https://solidity.readthedocs.io/en/develop/abi-spec.html

        bytes4 fillOrderSelector = this.fillOrder.selector;

        assembly {
            // Load free memory pointer
            let start := mload(0x40)

            // Write function signature
            mstore(start, fillOrderSelector)
            let parameters := add(start, 0x4)
            let parametersOffset := parameters
            let data := add(parameters, mul(3, 0x20)) // 0x20 for each parameter
            let dataOffset := data
            let orderOffset := order
            let orderLen := mul(13, 0x20) // 0x20 for each of the 13 parameters
            let bytesLen := 0
            let bytesLenPadded := 0

            // Write memory location of Order, relative to the start of the parameter list
            mstore(parametersOffset, sub(dataOffset, parameters))
            parametersOffset := add(parametersOffset, 0x20)

            // Copy parameters from Order
            for{let i := 0} lt(i, 13) {i := add(i, 1)} {
                mstore(dataOffset, mload(orderOffset))
                dataOffset := add(dataOffset, 0x20)
                orderOffset := add(orderOffset, 0x20)
            }

            // Write <makerAssetProxyMetadata> to memory
            mstore(add(data, mul(11, 0x20)), sub(dataOffset, data)) // Offset from the variable's location in memory
            bytesLen := mload(orderOffset)  // Read makerAssetProxyData length
            orderOffset := add(orderOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 32), gt(mod(bytesLen, 32), 0))
            mstore(dataOffset, bytesLen)     // Write makerAssetProxyData length
            dataOffset := add(dataOffset, 0x20)
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} { // write makerAssetProxyData contents
                mstore(dataOffset, mload(orderOffset))
                dataOffset := add(dataOffset, 0x20)
                orderOffset := add(orderOffset, 0x20)
            }


            // Write <takerAssetProxyMetadata> to memory
            mstore(add(data, mul(12, 0x20)), sub(dataOffset, data)) // Offset from the variable's location in memory
            bytesLen := mload(orderOffset)  // Read makerAssetProxyData length
            orderOffset := add(orderOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 32), gt(mod(bytesLen, 32), 0))
            mstore(dataOffset, bytesLen)     // Write makerAssetProxyData length
            dataOffset := add(dataOffset, 0x20)
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} { // write makerAssetProxyData contents
                mstore(dataOffset, mload(orderOffset))
                dataOffset := add(dataOffset, 0x20)
                orderOffset := add(orderOffset, 0x20)
            }

            // write takerTokenFillAmount
            mstore(parametersOffset, takerTokenFillAmount)
            parametersOffset := add(parametersOffset, 0x20)

            // Write <signature> to memory
            mstore(parametersOffset, sub(dataOffset, parameters)) // Offset from the variable's location in memory
            parametersOffset := add(parametersOffset, 0x20)
            bytesLen := mload(orderOffset)  // Read makerAssetProxyData length
            orderOffset := add(orderOffset, 0x20)
            bytesLenPadded := add(div(bytesLen, 32), gt(mod(bytesLen, 32), 0))
            mstore(dataOffset, bytesLen)     // Write makerAssetProxyData length
            dataOffset := add(dataOffset, 0x20)
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} { // write makerAssetProxyData contents
                mstore(dataOffset, mload(orderOffset))
                dataOffset := add(dataOffset, 0x20)
                orderOffset := add(orderOffset, 0x20)
            }

            // Execute delegatecall
            let success := delegatecall(
                gas,                         // forward all gas, TODO: look into gas consumption of assert/throw
                address,                     // call address of this contract
                start,                       // pointer to start of input
                //add(sOffset, sigLenWithPadding), // input length is  484 + signature length + padding length
                sub(dataOffset, start),
                start,                       // write output over input
                32                           // output size is 32 bytes
            )
            switch success
            case 0 {
                takerTokenFilledAmount := 0
            }
            case 1 {
                takerTokenFilledAmount := mload(start)
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
