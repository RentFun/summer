// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;

import "./Vault.sol";
import "./interfaces/IVaultManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


contract VaultManager is IVaultManager, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => EnumerableSet.AddressSet) private vaults;
    uint256 public maxVaultNum = 1;
    bool public initialized = false;

    constructor() {
        _transferOwnership(address(0));
        initialized = true;
    }

    function initialize(address owner) external {
        require(!initialized, "Initialized");
        _transferOwnership(owner);
        initialized = true;
    }

    function create() external override {
        require(vaults[msg.sender].length() < maxVaultNum, "RF14");
        Vault vlt = new Vault(address(this));
        vlt.transferOwnership(msg.sender);
        vaults[msg.sender].add(address(vlt));
    }

    function getVaults(address owner) public override view returns (address[] memory result) {
        return vaults[owner].values();
    }

    function isOwned(address owner, address vault) public override view returns (bool) {
        return vaults[owner].contains(vault);
    }

    function setMaxVaultNum(uint256 maxVaultNum_) external onlyOwner {
        maxVaultNum = maxVaultNum_;
    }
}