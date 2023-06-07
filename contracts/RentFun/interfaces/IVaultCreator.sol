// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.4;

interface IVaultCreator {
    function getVaults(address owner) external view returns (address[] memory result);
    function createVault() external;
}