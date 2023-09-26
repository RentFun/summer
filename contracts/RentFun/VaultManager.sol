// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;

import "./interfaces/IRentFun.sol";
import "./interfaces/IVaultManager.sol";

import "./Vault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


contract VaultManager is IVaultManager, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => EnumerableSet.AddressSet) private vaults;
    uint256 public maxVaultNum = 1;
    bool public initialized = false;
    address public rentfun = address(0);

    event VaultCreated(address indexed vault, address indexed owner);
    event VaultRemoved(address indexed vault, address indexed owner);

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
        Vault vlt = new Vault(rentfun);
        vlt.transferOwnership(msg.sender);
        vaults[msg.sender].add(address(vlt));
        emit VaultCreated(address(vlt), msg.sender);
    }

    function removeVault(address vault) external {
        require(vaults[msg.sender].contains(vault), "Not vault owner");
        vaults[msg.sender].remove(vault);
        emit VaultRemoved(vault, msg.sender);
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

    function setRentfun(address rentfun_) external onlyOwner {
        rentfun = rentfun_;
    }

    function isRented(address collection, uint256 tokenId) public view returns (bool) {
        return IRentFun(rentfun).isRented(collection, tokenId);
    }
}