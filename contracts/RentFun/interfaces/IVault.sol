// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.4;

interface IVault {
    function transferERC721(address collection, uint256 tokenId) external;
    function transferERC20(address token, uint256 amount) external;
    function transferETH(uint256 amount) external;
}
