// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.17;

interface IVaultManager {
    function create() external;
    function getVaults(address owner) external view returns (address[] memory result);
    function isOwned(address owner, address vault) external view returns (bool);
}