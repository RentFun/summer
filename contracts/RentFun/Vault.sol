// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;

import "./interfaces/IRentFun.sol";
import "./interfaces/IVault.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract Vault is IVault, Ownable, ERC721Holder {
    address private rentFun;

    constructor(address rentFun_) {
        rentFun = rentFun_;
    }

    function transferERC721(address collection, uint256 tokenId) external override onlyOwner {
        require(!IRentFun(rentFun).isRented(collection, tokenId), "OnRenting");
        IERC721(collection).safeTransferFrom(address(this), msg.sender, tokenId);
    }

    function transferERC20(address token, uint256 amount) external onlyOwner override {
        ERC20(token).transferFrom(address(this), msg.sender, amount);
    }

    function transferETH(uint256 amount) external onlyOwner override {
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
    }
}




