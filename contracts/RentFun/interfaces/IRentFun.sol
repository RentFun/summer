// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.4;

interface IRentFun {
    struct Rental {
        address renter;
        address vault;
        address collection;
        uint256 tokenId;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
    }

    struct LendData {
        LendToken token;
        LendBid lendBid;
    }

    struct LendToken {
        address lender;
        address collection;
        uint256 tokenId;
        uint256 amount;
        uint256 maxEndTime;
        address vault;
    }

    struct LendBid {
        address payment;
        uint256 fee;
        uint16 dayDiscount;
        uint16 weekDiscount;
    }

    struct RentOrder {
        RentBid rentBid;
        uint256 startTime;
        uint256 totalFee;
    }

    /// timeBase: 1 => hour; 2 => day; 3 => week
    struct RentBid {
        address collection;
        uint256 tokenId;
        address payment;
        uint256 tokenAmount;
        uint8 timeBase;
        uint8 timeAmount;
    }

    function lend(LendData[] calldata lents) external;
    function rent(RentBid[] calldata rents) external payable;
    function cancelLend(bytes32[] calldata tokenHashes) external;
    function claimRentFee(uint256 wbId) external;

    function isRented(address collection, uint256 tokenId) external view returns (bool);
    function getAliveRentals(address renter, address contract_) external view returns (Rental[] memory aliveRentals);
}