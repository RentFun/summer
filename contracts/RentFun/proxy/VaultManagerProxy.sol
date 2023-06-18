// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract VaultManagerProxy is TransparentUpgradeableProxy {
    constructor(address _proxyTo, address admin_, bytes memory _data) TransparentUpgradeableProxy(_proxyTo, admin_, _data) {}
}
