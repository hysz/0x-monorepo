pragma solidity 0.4.14;

/*
 * FunctionOverloadTest
 *
 * There is no function overloading in typescript, so we must change the Typescript ABI interface.
 * Overloaded function names are incremented as follows: functionName, functionName_2, functioname_3, ...
 * If functionName_N already exists then compilation will fail.
 */

contract Passes {
    function test()
        public
    {}

    function test(int a)
        public
    {}

    function test(int a, int b)
        public
    {}
}
