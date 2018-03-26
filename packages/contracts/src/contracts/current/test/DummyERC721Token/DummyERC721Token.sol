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
import "../../tokens/ERC721Token/ERC721Token.sol";
import "../../utils/Ownable/Ownable.sol";

contract DummyERC721Token is
    Ownable,
    ERC721Token
{
    function DummyERC721Token(
        string name,
        string symbol)
        public
        ERC721Token(name, symbol)
    {
        super._mint(msg.sender, 0x1010101010101010101010101010101010101010101010101010101010101010);
        super._mint(msg.sender, 0x2020202020202020202020202020202020202020202020202020202020202020);
        super._mint(msg.sender, 0x3030303030303030303030303030303030303030303030303030303030303030);
        super._mint(msg.sender, 0x4040404040404040404040404040404040404040404040404040404040404040);
        super._mint(msg.sender, 0x5050505050505050505050505050505050505050505050505050505050505050);
        super._mint(msg.sender, 0x6060606060606060606060606060606060606060606060606060606060606060);
        super._mint(msg.sender, 0x7070707070707070707070707070707070707070707070707070707070707070);
        super._mint(msg.sender, 0x8080808080808080808080808080808080808080808080808080808080808080);
        super._mint(msg.sender, 0x9090909090909090909090909090909090909090909090909090909090909090);
    }
}
