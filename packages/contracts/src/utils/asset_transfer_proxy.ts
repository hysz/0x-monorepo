import { BigNumber } from '@0xproject/utils';
import * as Web3 from 'web3';
import { AssetProxyId } from './types'
var ethersUtils = require('ethers-utils');

export interface AssetTransferMetadataStruct {
    assetProxyId: AssetProxyId;
    tokenAddress: string;
    tokenId: BigNumber;
}

export function zeroPad(value: string, width: number): string {
    return "0".repeat(width - value.length) + value;
}

// Returns new offset
export function encodeAssetProxyId(assetProxyId: AssetProxyId, encoded_metadata: {value: string})//: number
{
    encoded_metadata.value += zeroPad(new BigNumber(assetProxyId).toString(16), 2); // pad to 1 byte (2 hex chars)
    //encoded_metadata[offset++] = assetProxyId;
    //return offset;
}

// Returns new offset
export function encodeAddress(address: string, encoded_metadata: {value: string})//: number
{
    encoded_metadata.value += zeroPad(address.replace("0x", ""), 40); // pad to 20 bytes (40 hex chars)

/*
    for(var i = 0; i < address.length; ++i) {
        encoded_metadata[offset++] = address.charCodeAt(i);
    }*/
    //return offset;
}

// Returns new offset
export function encodeUint256(value: BigNumber, encoded_metadata: {value: string})//: number
{
    encoded_metadata.value += zeroPad(value.toString(16), 64); // pad to 32 bytes (64 hex chars)
    return;

/*
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
    //return offset;
}

export function encodeAssetTransferMetadata(metadata: AssetTransferMetadataStruct): string
{
    var encoded_metadata = { value: "0x" };

    switch(metadata.assetProxyId) {
        case AssetProxyId.ERC20_V1:
        case AssetProxyId.ERC20:
            //var encoded_metadata = new Uint8Array(21);
            var offset = 0;
            encodeAssetProxyId(metadata.assetProxyId, encoded_metadata);
            encodeAddress(metadata.tokenAddress, encoded_metadata);
            //return encoded_metadata;
            break;

        case AssetProxyId.ERC721:
            //var encoded_metadata = new Uint8Array(53);
            var offset = 0;
            encodeAssetProxyId(metadata.assetProxyId, encoded_metadata);
            encodeAddress(metadata.tokenAddress, encoded_metadata);
            encodeUint256(metadata.tokenId, encoded_metadata);
            //return encoded_metadata;
            break;

        default:
            throw new Error("Unrecognized AssetProxyId: " + metadata.assetProxyId);
    }

    return encoded_metadata.value;

    /**** We should never reach this point ****/
}

export function encodeAssetTransferMetadataAsArray(metadata: AssetTransferMetadataStruct): Uint8Array
{
    var encoded_metadata = { value: "0x" };

    switch(metadata.assetProxyId) {
        case AssetProxyId.ERC20_V1:
        case AssetProxyId.ERC20:
            //var encoded_metadata = new Uint8Array(21);
            var offset = 0;
            encodeAssetProxyId(metadata.assetProxyId, encoded_metadata);
            encodeAddress(metadata.tokenAddress, encoded_metadata);
            //return encoded_metadata;
            break;

        case AssetProxyId.ERC721:
            //var encoded_metadata = new Uint8Array(53);
            var offset = 0;
            encodeAssetProxyId(metadata.assetProxyId, encoded_metadata);
            encodeAddress(metadata.tokenAddress, encoded_metadata);
            encodeUint256(metadata.tokenId, encoded_metadata);
            //return encoded_metadata;
            break;

        default:
            throw new Error("Unrecognized AssetProxyId: " + metadata.assetProxyId);
    }

    return ethersUtils.arrayify(encoded_metadata.value);

    /**** We should never reach this point ****/
}
