import { BigNumber } from '@0xproject/utils';
import * as Web3 from 'web3';
import { AssetProxyId } from './types'

export interface AssetTransferMetadataStruct {
    assetProxyId: AssetProxyId;
    tokenAddress: string;
    tokenId: BigNumber;
}

// Returns new offset
export function encodeAssetProxyId(assetProxyId: AssetProxyId, encoded_metadata: Uint8Array, offset: number): number
{
    encoded_metadata[offset++] = assetProxyId;
    return offset;
}

// Returns new offset
export function encodeAddress(address: string, encoded_metadata: Uint8Array, offset: number): number
{
    for(var i = 0; i < address.length; ++i) {
        encoded_metadata[offset++] = address.charCodeAt(i);
    }
    return offset;
}

// Returns new offset
export function encodeUint256(value: BigNumber, encoded_metadata: Uint8Array, offset: number): number
{
    var hex_value = value.toString(16);
    for(var i = 0; i < 32; ++i) {
        encoded_metadata[offset++] = parseInt(hex_value[2*i] + hex_value[2*i+1], 16);
    }
    /*
    for(var i = 1; i <= 32; ++i) {
        encoded_metadata[offset++] = (value>>(32-i)) & 0xff;
    }
    return offset;
    */

    //console.log("GREG 0x" + value.toString(16));
    return offset;
}

export function encodeAssetTransferMetadata(metadata: AssetTransferMetadataStruct): Uint8Array
{
    switch(metadata.assetProxyId) {
        case AssetProxyId.ERC20_V1:
        case AssetProxyId.ERC20:
            var encoded_metadata = new Uint8Array(21);
            var offset = 0;
            offset = encodeAssetProxyId(metadata.assetProxyId, encoded_metadata, offset);
            offset = encodeAddress(metadata.tokenAddress, encoded_metadata, offset);
            return encoded_metadata;

        case AssetProxyId.ERC721:
            var encoded_metadata = new Uint8Array(53);
            var offset = 0;
            offset = encodeAssetProxyId(metadata.assetProxyId, encoded_metadata, offset);
            offset = encodeAddress(metadata.tokenAddress, encoded_metadata, offset);
            offset = encodeUint256(metadata.tokenId, encoded_metadata, offset);
            return encoded_metadata;

        default:
            throw new Error("Unrecognized AssetProxyId: " + metadata.assetProxyId);
    }

    /**** We should never reach this point ****/
}
