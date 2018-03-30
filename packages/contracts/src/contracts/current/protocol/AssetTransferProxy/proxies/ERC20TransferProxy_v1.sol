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

import "../IAssetProxy.sol";
import "../../../utils/LibBytes/LibBytes.sol";
import "../../TokenTransferProxy/ITokenTransferProxy.sol";
import "../../../utils/Authorizable/Authorizable.sol";

contract ERC20TransferProxy_v1 is
    LibBytes,
    Authorizable,
    IAssetProxy
{
    ITokenTransferProxy TRANSFER_PROXY;

    /// @dev Contract constructor.
    /// @param tokenTransferProxyContract erc20 token transfer proxy contract.
    function ERC20TransferProxy_v1(ITokenTransferProxy tokenTransferProxyContract)
        public
    {
        TRANSFER_PROXY = tokenTransferProxyContract;
    }

    /// @dev Transfers ERC20 tokens.
    /// @param assetMetadata Byte array encoded for the respective asset proxy.
    /// @param from Address to transfer token from.
    /// @param to Address to transfer token to.
    /// @param amount Amount of token to transfer.
    function transferFrom(
        bytes assetMetadata,
        address from,
        address to,
        uint256 amount)
        public
        onlyAuthorized
    {
        address token = decodeMetadata(assetMetadata);
        require(TRANSFER_PROXY.transferFrom(token, from, to, amount));
    }

    /// @dev Encodes ERC20 byte array for the ERC20 asset proxy.
    /// @param assetProxyId Id of the asset proxy.
    /// @param tokenAddress Address of the asset.
    /// @return assetMetadata Byte array encoded for the ERC20 asset proxy.
    function encodeMetadata(
        uint8 assetProxyId,
        address tokenAddress)
        public pure
        returns (bytes assetMetadata)
    {
        // 0 is reserved as invalid proxy id
        require(assetProxyId != 0);

        // Encode fields into a byte array
        assetMetadata = new bytes(21);
        assetMetadata[0] = byte(assetProxyId);
        writeAddress(tokenAddress, assetMetadata, 1);
        return assetMetadata;
    }

    /// @dev Decodes ERC20-encoded byte array for the ERC20 asset proxy.
    /// @param assetMetadata Byte array encoded for the ERC20 asset proxy.
    /// @return tokenAddress Address of ERC20 token.
    function decodeMetadata(bytes assetMetadata)
        public pure
        returns (address tokenAddress)
    {
        require(assetMetadata.length == 21);
        return readAddress(assetMetadata, 1);
    }
}
