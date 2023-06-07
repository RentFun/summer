// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFToken is ERC721, Ownable {

    // Constructor will be called on contract creation
    constructor() ERC721("NFToken", "RENT") {}

    // Allows minting of a new NFT
    function mintCollectionNFT(address collector, uint256 tokenId) public onlyOwner {
        _safeMint(collector, tokenId);
    }
}