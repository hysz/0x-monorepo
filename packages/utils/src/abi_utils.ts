import { AbiDefinition, AbiType, ConstructorAbi, ContractAbi, DataItem, MethodAbi } from '@0xproject/types';
import * as _ from 'lodash';

export const abiUtils = {
    getFunctionSignature(abi: MethodAbi): string {
        const functionName = abi.name;
        const parameterTypeList = abi.inputs.map((param: DataItem) => `${param.type}`);
        const functionSignature = `${functionName}(${parameterTypeList})`;
        return functionSignature;
    },
    renameOverloadedMethods(inputContractAbi: ContractAbi): ContractAbi {
        const contractAbi = _.cloneDeep(inputContractAbi);
        const methodAbis = contractAbi.filter((abi: AbiDefinition) => abi.type === AbiType.Function) as MethodAbi[];
        console.log(
            _.map(methodAbis, methodAbi => {
                return `${methodAbi.name}(${methodAbi.inputs.length})`;
            }),
        );
        const methodAbiOrdered = _.transform(
            methodAbis,
            (result: Array<{ index: number; methodAbi: MethodAbi }>, methodAbi, i: number) => {
                result.push({ index: i, methodAbi });
            },
            [],
        );
        // Sort method Abis into alphabetical order, by function signature
        methodAbiOrdered.sort((lhs, rhs) => {
            const lhsSignature = this.getFunctionSignature(lhs.methodAbi);
            const rhsSignature = this.getFunctionSignature(rhs.methodAbi);
            return lhsSignature < rhsSignature ? -1 : 1;
        });
        // Group method Abis by name (overloaded methods will be grouped together, in alphabetical order)
        const methodAbisByName = _.transform(
            methodAbiOrdered,
            (result: { [key: string]: Array<{ index: number; methodAbi: MethodAbi }> }, entry) => {
                (result[entry.methodAbi.name] || (result[entry.methodAbi.name] = [])).push(entry);
            },
            {},
        );
        // Fix overloaded method names
        const methodAbisRenamed = _.transform(
            methodAbisByName,
            (result: MethodAbi[], methodAbisWithSameName: Array<{ index: number; methodAbi: MethodAbi }>) => {
                _.forEach(methodAbisWithSameName, (entry, i: number) => {
                    // Append an identifier to overloaded methods
                    if (methodAbisWithSameName.length > 1) {
                        const overloadedMethodId = i + 1;
                        entry.methodAbi.name = `${entry.methodAbi.name}_${overloadedMethodId}`;
                    }
                    // Add method to list of ABIs in its original position
                    result.splice(entry.index, 0, entry.methodAbi);
                });
            },
            [...Array(methodAbis.length)],
        );
        return contractAbi;
    },
};
