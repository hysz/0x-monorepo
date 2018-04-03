import * as _ from 'lodash';

import { getPcToInstructionIndexMapping } from './instructions';
import { LineColumn, LocationByOffset, SourceRange } from './types';

const RADIX = 10;

export interface SourceLocation {
    offset: number;
    length: number;
    fileIndex: number;
}

export function getLocationByOffset(str: string): LocationByOffset {
    const locationByOffset: LocationByOffset = { 0: { line: 1, column: 0 } };
    let currentOffset = 0;
    for (const char of str.split('')) {
        const location = locationByOffset[currentOffset];
        const isNewline = char === '\n';
        locationByOffset[currentOffset + 1] = {
            line: location.line + (isNewline ? 1 : 0),
            column: isNewline ? 0 : location.column + 1,
        };
        currentOffset++;
    }
    return locationByOffset;
}

// Parses a sourcemap string
// The solidity sourcemap format is documented here: https://github.com/ethereum/solidity/blob/develop/docs/miscellaneous.rst#source-mappings
export function parseSourceMap(
    sourceCodes: string[],
    srcMap: string,
    bytecodeHex: string,
    sources: string[],
): { [programCounter: number]: SourceRange } {
    const bytecode = Uint8Array.from(Buffer.from(bytecodeHex, 'hex'));
    const pcToInstructionIndex: { [programCounter: number]: number } = getPcToInstructionIndexMapping(bytecode);
    const locationByOffsetByFileIndex = _.map(sourceCodes, getLocationByOffset);
    const entries = srcMap.split(';');
    const parsedEntries: SourceLocation[] = [];
    let lastParsedEntry: SourceLocation = {} as any;
    const instructionIndexToSourceRange: { [instructionIndex: number]: SourceRange } = {};
    _.each(entries, (entry: string, i: number) => {
        const [instructionIndexStrIfExists, lengthStrIfExists, fileIndexStrIfExists, jumpTypeStrIfExists] = entry.split(
            ':',
        );
        const instructionIndexIfExists = parseInt(instructionIndexStrIfExists, RADIX);
        const lengthIfExists = parseInt(lengthStrIfExists, RADIX);
        const fileIndexIfExists = parseInt(fileIndexStrIfExists, RADIX);
        const offset = _.isNaN(instructionIndexIfExists) ? lastParsedEntry.offset : instructionIndexIfExists;
        const length = _.isNaN(lengthIfExists) ? lastParsedEntry.length : lengthIfExists;
        const fileIndex = _.isNaN(fileIndexIfExists) ? lastParsedEntry.fileIndex : fileIndexIfExists;
        const parsedEntry = {
            offset,
            length,
            fileIndex,
        };
        if (parsedEntry.fileIndex !== -1) {
            const sourceRange = {
                location: {
                    start: locationByOffsetByFileIndex[parsedEntry.fileIndex][parsedEntry.offset],
                    end: locationByOffsetByFileIndex[parsedEntry.fileIndex][parsedEntry.offset + parsedEntry.length],
                },
                fileName: sources[parsedEntry.fileIndex],
            };
            instructionIndexToSourceRange[i] = sourceRange;
        } else {
            // Some assembly code generated by Solidity can't be mapped back to a line of source code.
            // Source: https://github.com/ethereum/solidity/issues/3629
        }
        lastParsedEntry = parsedEntry;
    });
    const pcsToSourceRange: { [programCounter: number]: SourceRange } = {};
    for (const programCounterKey of _.keys(pcToInstructionIndex)) {
        const pc = parseInt(programCounterKey, RADIX);
        const instructionIndex: number = pcToInstructionIndex[pc];
        pcsToSourceRange[pc] = instructionIndexToSourceRange[instructionIndex];
    }
    return pcsToSourceRange;
}
