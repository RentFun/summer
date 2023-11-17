// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;


import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract RentFunHelper is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint16 private commission = 1000;
    uint16 private vipCommission = 800;
    uint16 private constant cmsBase = 10000;

    uint256 private constant Hour = 3600;
    uint256 private constant Day = 86400;
    uint256 private constant Week = 604800;
    uint256 private constant DayHours = 24;
    uint256 private constant WeekHours = 168;

    address public vaultManager;
    address public wonderBird;
    address public treasure;
    bool public initialized = false;

    /// @notice A mapping pointing collection to its payments
    mapping(address => EnumerableSet.AddressSet) private clcPayments;

    /// @notice A mapping pointing collection contract address to partner structs
    mapping(address => Partner) public partners;

    struct Partner {
        address receiver;
        uint16 share;
    }

    constructor() {
        _transferOwnership(address(0));
        initialized = true;
    }

    function initialize(address owner, address vaultManager_, address wonderBird_, address treasure_) external {
        require(!initialized, "Initialized");
        _transferOwnership(owner);
        initialized = true;
        vaultManager = vaultManager_;
        wonderBird = wonderBird_;
        treasure = treasure_;
    }

    function getCommission(uint256 wbId, address wbOwner) public view returns (uint256) {
        return IERC721(wonderBird).ownerOf(wbId) == wbOwner ? vipCommission : commission;
    }

    function getPatnerReceiver(address collection) public view returns (address) {
        return partners[collection].receiver;
    }

    function calculateRentFee(address collection, uint256 totalFee, uint256 cms)
        public view returns (uint256 lenderFee, uint256 partnerFee, uint256 cmsFee) {
        require(cms <= cmsBase, "RF15");

        Partner memory ptn = partners[collection];
        cmsFee = totalFee * cms / cmsBase;
        partnerFee = cmsFee * ptn.share / cmsBase;
        lenderFee = totalFee - cmsFee;
        cmsFee = cmsFee - partnerFee;

    }

    function totalRentFee(uint8 timeBase, uint8 amount, uint256 fee,
        uint16 dayDiscount, uint16 weekDiscount) public view returns (uint256 price, uint256 endTime) {
        if (timeBase == 1) {
            price = fee;
            endTime = Hour;
        } else if (timeBase == 2) {
            price = fee * DayHours * (cmsBase - dayDiscount) / cmsBase;
            endTime = Day;
        } else if (timeBase == 3) {
            price = fee * WeekHours * (cmsBase - weekDiscount) / cmsBase;
            endTime = Week;
        } else {
            revert("Time base unsupported");
        }

        return (price * amount, endTime * amount+block.timestamp);
    }

    function checkDiscount(uint16 discount) public pure returns (bool) {
        return discount < cmsBase;
    }

    function checkPayment(address collection, address payment) public view returns (bool) {
        return (payment == address(0) && clcPayments[collection].length() == 0) ||
            clcPayments[collection].contains(payment);
    }

    function setPartner(address collection, address receiver, uint16 share, address[] calldata payments) external onlyOwner {
        require(share <= cmsBase, "Patner commission too big");
        partners[collection] = Partner(receiver, share);

        for (uint8 i = 0; i < payments.length; i++) {
            clcPayments[collection].add(payments[i]);
        }
    }

    /// @notice Commission setter
    function setCommission(uint16 commission_) external onlyOwner {
        require(commission_ <= cmsBase, "Commission too big");
        commission = commission_;
    }


    function setVipCommission(uint16 vipCommission_) external onlyOwner {
        require(vipCommission_ <= commission, "Vip commission too big");
        vipCommission = vipCommission_;
    }

    /// @notice treasure setter
    function setTreasure(address treasure_) external onlyOwner {
        treasure = treasure_;
    }

    function setVaultManager(address vaultManager_) external onlyOwner {
        vaultManager = vaultManager_;
    }

    function setWonderBird(address wonderBird_) external onlyOwner {
        wonderBird = wonderBird_;
    }

    /// @dev Helper function to compute hash for a given token
    function getTokenHash(address collection, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encode(collection,  tokenId));
    }

    /// @dev Helper function to compute hash for a given token with a payment
    function getPaymentHash(address collection, uint256 tokenId, address payment) public pure returns (bytes32) {
        return keccak256(abi.encode(collection,  tokenId, payment));
    }

    function getRenterCollection(address renter, address collection) public pure returns (bytes32) {
        return keccak256(abi.encode(renter,  collection));
    }
}