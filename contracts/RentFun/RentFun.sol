// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

import "./Vault.sol";
import "./interfaces/IRentFun.sol";
import "./interfaces/IVaultManager.sol";
import "./RentFunHelper.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract RentFun is IRentFun {
    using SafeERC20 for ERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.UintSet;

    address public helper;
    bool public initialized = false;

    EnumerableSet.Bytes32Set private cancellations;

    /// @notice A mapping pointing token to its Lending
    /// dev tokenHash -> Lending
    mapping(bytes32 => LendToken) private lendTokens;

    /// @notice A mapping pointing token to its lend orders
    /// dev tokenHash -> LendBid
    mapping(bytes32 => LendBid) private lendBids;

    /// @notice An incrementing counter to create unique idx for each rental
    uint256 public totalRentCount = 0;
    /// @notice A mapping pointing token to its last rental
    /// dev tokenHash -> rentalIdx
    mapping(bytes32 => uint256) private rentalIdxes;
    /// @notice A mapping pointing token to its last LendRentBid
    /// dev rentalIdx -> RentOrder
    mapping(uint256 => RentOrder) private rentals;
    /// @notice A mapping pointing renter-collection to rental indexes
    /// dev renter-collection-hash -> rentIdxes
    mapping(bytes32 => EnumerableSet.UintSet) private rentalsByRenter;
    /// @notice A mappings pointing lender to rental indexes
    mapping(address => EnumerableSet.UintSet) private rentalsByLender;

    event Lent(address indexed lender, address indexed collection, uint256 tokenId, uint256 amount);
    event Rented(address indexed renter, uint256 rentalIdx);
    event Delisted(address indexed lender, address indexed collection, uint256 tokenId);
    event Claimed(address indexed lender, uint256 rentalIdx, uint256 rentFee, uint256 cmsFee, uint256 ptnFee);

    constructor() {
        helper = address(0);
        initialized = true;
    }

    function initialize(address helper_) external {
        require(!initialized, "Initialized");
        initialized = true;
        helper = helper_;
    }

    function lend(LendData[] calldata lents) external override {
        uint256 len = lents.length;
        if (len == 0) revert("RF01");

        RentFunHelper hp = RentFunHelper(helper);

        for (uint8 i = 0; i < len; i++) {
            LendBid calldata bid = lents[i].lendBid;
            LendToken calldata token = lents[i].token;
            address clc = token.collection;
            uint256 tokenId = token.tokenId;
            bytes32 tokenHash = hp.getTokenHash(clc, tokenId);
            require(token.lender == msg.sender && IVaultManager(hp.vaultManager()).isOwned(msg.sender, token.vault), "RF02");
            require(token.amount == 0 && hp.checkDiscount(bid.dayDiscount) && hp.checkDiscount(bid.weekDiscount), "RF03");
            require(hp.checkPayment(clc, bid.payment), "RF04");
            require(token.maxEndTime == 0 || token.maxEndTime > block.timestamp, "RF05");

            if (IERC721(clc).ownerOf(tokenId) != token.vault) {
                IERC721(clc).safeTransferFrom(msg.sender, token.vault, tokenId);
            }

            cancellations.remove(tokenHash);
            lendTokens[tokenHash] = token;
            lendBids[hp.getPaymentHash(clc, tokenId, bid.payment)] = bid;
            emit Lent(msg.sender, clc, tokenId, token.amount);
        }
    }

    function rent(RentBid[] calldata rents) external payable override {
        uint256 len = rents.length;
        if (len == 0) revert("RF06");

        RentFunHelper hp = RentFunHelper(helper);
        for (uint8 i = 0; i < len; i++) {
            RentBid calldata rentBid = rents[i];
            bytes32 tokenHash = hp.getTokenHash(rentBid.collection, rentBid.tokenId);
            bytes32 paymentHash = hp.getPaymentHash(rentBid.collection, rentBid.tokenId, rentBid.payment);
            LendToken memory token = lendTokens[tokenHash];
            require(rentBid.timeAmount > 0 && rentBid.tokenAmount <= token.amount , "RF07");
            require(!cancellations.contains(tokenHash), "RF08");
            require(token.vault == IERC721(rentBid.collection).ownerOf(rentBid.tokenId), "RF09");
            require(rentBid.payment == lendBids[paymentHash].payment, "RF10");
            uint256 rentalFee;
            uint256 endTime;
            (rentalFee, endTime) = hp.totalRentFee(rentBid.timeBase, rentBid.timeAmount,
                lendBids[paymentHash].fee, lendBids[paymentHash].dayDiscount, lendBids[paymentHash].weekDiscount);
            require(token.maxEndTime == 0 || token.maxEndTime >= endTime, "RF11");
            _pay(rentBid.payment, msg.sender, address(this), rentalFee);
            rentals[++totalRentCount] = RentOrder(rentBid, msg.sender, token.vault, block.timestamp, endTime, rentalFee);
            rentalIdxes[tokenHash] = totalRentCount;
            rentalsByRenter[hp.getRenterCollection(msg.sender, rentBid.collection)].add(totalRentCount);
            rentalsByLender[token.lender].add(totalRentCount);

            emit Rented(msg.sender, totalRentCount);
        }
    }

    function delist(bytes32[] calldata tokenHashes) external override {
        uint256 len = tokenHashes.length;
        if (len == 0) revert("RF12");
        for (uint8 i = 0; i < len; i++) {
            LendToken memory token = lendTokens[tokenHashes[i]];
            require(token.lender == msg.sender, "RF13");
            cancellations.add(tokenHashes[i]);
            emit Delisted(msg.sender, token.collection, token.tokenId);
        }
    }

    function claimRentFee(uint256 wbId) external override {
        RentFunHelper hp = RentFunHelper(helper);
        uint256 cms = hp.getCommission(wbId, msg.sender);
        uint256[] memory orderIdxes = rentalsByLender[msg.sender].values();
        for (uint8 i = 0; i < orderIdxes.length; i++) {
            RentOrder memory order = rentals[orderIdxes[i]];
            uint256 lenderFee;
            uint256 cmsFee;
            uint256 ptnFee;
            (lenderFee, ptnFee, cmsFee) = hp.calculateRentFee(order.rentBid.collection, order.totalFee, cms);
            _pay(order.rentBid.payment, address(this), msg.sender, lenderFee);
            _pay(order.rentBid.payment, address(this), hp.getPatnerReceiver(order.rentBid.collection), ptnFee);
            _pay(order.rentBid.payment, address(this), hp.treasure(), cmsFee);
            rentalsByLender[msg.sender].remove(orderIdxes[i]);
            emit Claimed(msg.sender, orderIdxes[i], lenderFee, cmsFee, ptnFee);
        }
    }

    /// @notice check if a given token is rented or not
    function isRented(address collection, uint256 tokenId) public override view returns (bool) {
        bytes32 tokenHash = RentFunHelper(helper).getTokenHash(collection, tokenId);
        uint256 rentalIdx = rentalIdxes[tokenHash];
        return rentalIdx != 0 && rentals[rentalIdx].endTime >= block.timestamp;
    }

    /// @notice check all alive rentals for a given renter.
    function getAliveRentals(address renter, address collection) public override view returns (Rental[] memory aliveRentals) {
        uint256[] memory rentIdxes = rentalsByRenter[RentFunHelper(helper).getRenterCollection(renter, collection)].values();
        uint256 count = 0;
        for(uint i = 0; i < rentIdxes.length; i++) {
            if (rentals[rentIdxes[i]].endTime >= block.timestamp) count++;
        }
        if (count == 0) return aliveRentals;
        aliveRentals = new Rental[](count);
        uint j = 0;

        for(uint i = 0; i < rentIdxes.length; i++) {
            RentOrder memory order = rentals[rentIdxes[i]];
            if (order.endTime >= block.timestamp) {
                aliveRentals[j++] = Rental(order.renter, order.vault, order.rentBid.collection,
                    order.rentBid.tokenId, order.rentBid.tokenAmount, order.startTime, order.endTime);
            }
        }
    }

    function getRentOrders(address lender) public override view returns (RentOrder[] memory orders) {
        uint256[] memory orderIdxes = rentalsByLender[lender].values();
        if (orderIdxes.length == 0) return orders;
        orders = new RentOrder[](orderIdxes.length);
        for(uint i = 0; i < orderIdxes.length; i++) {
            orders[i] = rentals[orderIdxes[i]];
        }
    }

    /// @notice pay ether or ERC20
    function _pay(address payment, address from, address to, uint256 amount) private {
        if (amount == 0) return;
        if (payment == address(0)) {
            _payEther(payable(to), amount);
        } else {
            if (from == address(this)) {
                ERC20(payment).transfer(to, amount);
            } else {
                ERC20(payment).safeTransferFrom(from, to, amount);
            }
        }
    }

    /// @notice pay ether
    function _payEther(address payable recipient, uint256 amount) private {
        if (amount == 0) return;
        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "SEND_ETHER_FAILED");
    }
}