pragma solidity 0.4.14;

/*
 * There is no function overloading in typescript, so we must change the Typescript ABI interface.
 * Overloaded function names are incremented as follows: functionName, functionName_2, functioname_3, ...
 * If functionName_N already exists then compilation will fail.
 */

contract Fails1 {
    function test()
        public
    {}

    function test(int a)
        public
    {}
        
    // There is already a test_2 so this compilation will fail.
    function test_2()
        public
    {}
}
