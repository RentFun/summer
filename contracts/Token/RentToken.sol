// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RentToken is ERC20 {
    constructor(uint256 initialSupply) ERC20('RentFun Token', "RENT") {
        _mint(msg.sender, initialSupply);
    }
}