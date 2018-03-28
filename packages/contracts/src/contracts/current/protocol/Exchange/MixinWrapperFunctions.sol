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

        bytes4 fillOrderSelector = this.gregOrder.selector;

        assembly {
            // Load free memory pointer
            let start := mload(0x40)

            // Write function signature
            mstore(start, fillOrderSelector)
            let parameters := add(start, 0x4)
            let parametersOffset := parameters
            let data := add(parameters, mul(2, 0x20)) // 0x20 for each parameter
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


/*
            // Write <takerTokenFillAmount>
            mstore(parameters, takerTokenFillAmount)
            parameters := add(parameters, 0x20)

            // Write <signature> location to parameter list
            mstore(parameters, dataOffset)
            parameters := add(parameters, 0x20)

            // Write signature
            bytesLen := mload(signature)  // Read makerAssetProxyData length
            let sigOffset := add(signature, 32)
            bytesLenPadded := add(div(bytesLen, 32), gt(mod(bytesLen, 32), 0))
            mstore(dataOffset, bytesLen)     // Write makerAssetProxyData length
            dataOffset := add(dataOffset, 0x20)
            for {let i := 0} lt(i, bytesLenPadded) {i := add(i, 1)} { // write makerAssetProxyData contents
                mstore(dataOffset, mload(sigOffset))
                dataOffset := add(dataOffset, 0x20)
                sigOffset := add(sigOffset, 0x20)
            }
*/
/*
            // Copy 2 dynamic parameters from Order
            for{let i := 0} lt(i, 2) {i := add(i, 1)} {
                mstore(dataOffset, add(data, mul(0x2, i)))
            }

            startOffset := add(startOffset, 0x20)


            // Write order struct
            mstore(add(start, 4), mload(order))             // makerAddress
            /*mstore(add(start, 36), mload(add(order, 32)))   // takerAddress
            mstore(add(start, 68), mload(add(order, 64)))   // makerTokenAddress
            mstore(add(start, 100), mload(add(order, 96)))  // takerTokenAddress
            mstore(add(start, 132), mload(add(order, 128))) // feeRecipientAddress
            mstore(add(start, 164), mload(add(order, 160))) // makerTokenAmount
            mstore(add(start, 196), mload(add(order, 192))) // takerTokenAmount
            mstore(add(start, 228), mload(add(order, 224))) // makerFeeAmount
            mstore(add(start, 260), mload(add(order, 256))) // takerFeeAmount
            mstore(add(start, 292), mload(add(order, 288))) // expirationTimeSeconds
            mstore(add(start, 324), mload(add(order, 320))) // salt

            let sOffset := add(4, 32)
            let oOffset := add(320, 32) // I am a dummy location @+352

            //mstore(add(start, sOffset), mload(add(order, oOffset))) // some dummy value
            //sOffset := add(sOffset, 32)
            oOffset := add(oOffset, 32) // I am a dummy location @+384

            //mstore(add(start, sOffset), mload(add(order, oOffset)))
            //sOffset := add(sOffset, 32)
            oOffset := add(oOffset, 32) // I hold makerAssetProxyData length

            // makerAsssetProxyData
            let makerAPDLen := mload(add(order, oOffset))  // Read makerAssetProxyData length
            oOffset := add(oOffset, 32)
            let makerADPLenWords := add(div(makerAPDLen, 32), gt(mod(makerAPDLen, 32), 0))
            mstore(add(start, sOffset), add(sOffset, 28)) // Write makerAssetProxyData offset
            sOffset := add(sOffset, 32)
            mstore(add(start, sOffset), makerAPDLen)     // Write makerAssetProxyData length
            sOffset := add(sOffset, 32)
            for {let i := 0} lt(i, makerADPLenWords) {i := add(i, 1)} { // write makerAssetProxyData contents
                mstore(add(start, sOffset), mload(add(order, oOffset)))
                sOffset := add(sOffset, 32)
                oOffset := add(oOffset, 32)
            }
/*
            // takerAsssetProxyData
            let takerAPDLen := mload(add(order, oOffset))   // Read takerAssetProxyData length
            oOffset := add(oOffset, 32)
            let takerADPLenWords := add(div(takerAPDLen, 32), gt(mod(takerAPDLen, 32), 0))
            mstore(add(start, sOffset), add(sOffset, 28)) // Write takerAssetProxyData offset
            sOffset := add(sOffset, 32)
            mstore(add(start, sOffset), takerAPDLen)     // Write takerAssetProxyData length
            sOffset := add(sOffset, 32)
            for {let j := 0} lt(j, takerADPLenWords) {j := add(j, 1)} { // write takerAssetProxyData contents
                mstore(add(start, sOffset), mload(add(order, oOffset)))
                sOffset := add(sOffset, 32)
                oOffset := add(oOffset, 32)
            }
/*
            // Write takerTokenFillAmount
            mstore(add(start, sOffset), takerTokenFillAmount)
            sOffset := add(sOffset, 32)

            // Write signature offset
            mstore(add(start, sOffset), add(sOffset, 28))
            sOffset := add(sOffset, 32)

            // Write signature length
            let sigLen := mload(signature)
            mstore(add(start, sOffset), sigLen)
            sOffset := add(sOffset, 32)

            // Calculate signature length with padding
            let paddingLen := mod(sub(0, sigLen), 32)
            let sigLenWithPadding := add(sigLen, paddingLen)

            takerTokenFilledAmount := takerAPDLen

            // Write signature
            let sigStart := add(signature, 32)
            for { let curr := 0 }
            lt(curr, sigLenWithPadding)
            { curr := add(curr, 32) }
            { mstore(add(start, add(sOffset, curr)), mload(add(sigStart, curr))) } // Note: we assume that padding consists of only 0's
*/
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
                takerTokenFilledAmount := bytesLen
            }
            case 1 {
                takerTokenFilledAmount := 0x69 //mload(start)
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
