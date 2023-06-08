// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

import "./Vault.sol";
import "./interfaces/IRentFun.sol";
import "./interfaces/IVaultCreator.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

contract RentFun is Ownable, IRentFun, IVaultCreator {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.UintSet;

    address private treasure;
    address private wonderBird;
    uint16 public commission = 1000;
    uint16 public vipCommission = 800;
    uint16 private constant commissionBase = 10000;
    uint256 private constant Hour = 3600;
    uint256 private constant Day = 86400;
    uint256 private constant Week = 604800;
    uint256 private constant DayHours = 24;
    uint256 private constant WeekHours = 168;

    mapping(address => EnumerableSet.AddressSet) private vaults;

    /// @notice A mapping pointing collection to its payments
    mapping(address => EnumerableSet.AddressSet) private clcPayments;

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
    /// @notice A mapping pointing token to its last rental
    /// dev rentalIdx -> rental
    mapping(uint256 => Rental) private rentals;
    /// @notice A mapping pointing token to its last LendRentBid
    /// dev rentalIdx -> RentOrder
    mapping(uint256 => RentOrder) private rentOrders;
    /// @notice A double mappings pointing renter to collection to rentIdxes
    /// dev renter -> collection -> rentIdxes
    mapping(address => mapping(address => EnumerableSet.UintSet)) private rentalsByAddr;
    /// @notice A mappings pointing lender to rent order indexes;
    mapping(address => EnumerableSet.UintSet) private rentOrdersByAddr;

    /// @notice A mapping pointing collection contract address to partner structs
    mapping(address => Partner) public partners;

    struct Partner {
        address receiver;
        uint16 share;
    }

    /// @notice Emitted on each token lent
    event TokenLent(address indexed lender, address indexed collection, uint256 tokenId, uint256 amount);

    /// @notice Emitted on each token rental
    event TokenRented(address indexed renter, address indexed collection,
        uint256 tokenId, uint256 startTime, uint256 endTime);

    /// @notice Emitted on each token lent cancel
    event LentCanceled(address indexed lender, address indexed collection, uint256 tokenId);

    constructor(address contractOwner, address treasure_, address wonderBird_) {
        _transferOwnership(contractOwner);
        treasure = treasure_;
        wonderBird = wonderBird_;
    }

    function lend(LendData[] calldata lents) external override {
        uint256 len = lents.length;
        if (len == 0) revert("RF01");

        for (uint8 i = 0; i < len; i++) {
            LendBid calldata bid = lents[i].lendBid;
            LendToken calldata token = lents[i].token;
            address clc = token.collection;
            uint256 tokenId = token.tokenId;
            bytes32 tokenHash = getTokenHash(clc, tokenId);
            require(token.lender == msg.sender && vaults[msg.sender].contains(token.vault), "RF02");
            require(token.amount == 0 && bid.dayDiscount < commissionBase && bid.weekDiscount < commissionBase, "RF03");
            require((bid.payment == address(0) && clcPayments[clc].length() == 0) ||
                clcPayments[clc].contains(bid.payment), "RF04");
            require(token.maxEndTime == 0 || token.maxEndTime > block.timestamp, "RF05");

            if (IERC721(clc).ownerOf(tokenId) != token.vault) {
                IERC721(clc).safeTransferFrom(msg.sender, token.vault, tokenId);
            }

            cancellations.remove(tokenHash);
            lendTokens[tokenHash] = token;
            lendBids[getPaymentHash(clc, tokenId, bid.payment)] = bid;
            emit TokenLent(msg.sender, clc, tokenId, token.amount);
        }
    }

    function rent(RentBid[] calldata rents) external payable override {
        uint256 len = rents.length;
        if (len == 0) revert("RF06");
        for (uint8 i = 0; i < len; i++) {
            RentBid calldata rentBid = rents[i];
            address clc = rentBid.collection;
            uint256 tokenId = rentBid.tokenId;
            bytes32 tokenHash = getTokenHash(clc, tokenId);
            bytes32 paymentHash = getPaymentHash(clc, tokenId, rentBid.payment);
            LendToken memory token = lendTokens[tokenHash];
            require(rentBid.timeAmount > 0 && rentBid.tokenAmount <= token.amount , "RF07");
            require(!cancellations.contains(tokenHash), "RF08");
            require(token.vault == IERC721(clc).ownerOf(tokenId), "RF09");
            require(rentBid.payment == lendBids[paymentHash].payment, "RF10");
            uint rentalFee;
            uint256 endTime;
            (rentalFee, endTime) = calculateRentFee(rentBid.timeBase, rentBid.timeAmount, lendBids[paymentHash]);
            uint256 startTime = block.timestamp;
            endTime = endTime.add(startTime);
            require(token.maxEndTime == 0 || token.maxEndTime >= endTime, "RF11");
            _pay(rentBid.payment, msg.sender, address(this), rentalFee);
            rentals[++totalRentCount] = Rental(msg.sender, token.vault, clc,
                tokenId, token.amount, startTime, endTime);
            rentalIdxes[tokenHash] = totalRentCount;
            rentOrders[totalRentCount] = RentOrder(rentBid, startTime, rentalFee);
            rentalsByAddr[msg.sender][clc].add(totalRentCount);
            rentOrdersByAddr[token.lender].add(totalRentCount);

            emit TokenRented(msg.sender, clc, tokenId, startTime, endTime);
        }
    }

    function cancelLend(bytes32[] calldata tokenHashes) external override {
        uint256 len = tokenHashes.length;
        if (len == 0) revert("RF12");
        for (uint8 i = 0; i < len; i++) {
            LendToken memory token = lendTokens[tokenHashes[i]];
            require(token.lender == msg.sender, "RF13");
            cancellations.add(tokenHashes[i]);
            emit LentCanceled(msg.sender, token.collection, token.tokenId);
        }
    }

    function claimRentFee(uint256 wbId) external override {
        uint256 cms = IERC721(wonderBird).ownerOf(wbId) == msg.sender ? vipCommission : commission;
        uint256[] memory orderIdxes = rentOrdersByAddr[msg.sender].values();
        for (uint8 i = 0; i < orderIdxes.length; i++) {
            RentOrder memory order = rentOrders[orderIdxes[i]];
            Partner memory ptn = partners[order.rentBid.collection];
            uint256 cmsFee = order.totalFee.mul(cms).div(commissionBase);
            uint256 ptnFee = cmsFee.mul(ptn.share).div(commissionBase);
            _pay(order.rentBid.payment, address(this), msg.sender, order.totalFee.sub(cmsFee));
            _pay(order.rentBid.payment, address(this), ptn.receiver, ptnFee);
            _pay(order.rentBid.payment, address(this), treasure, cmsFee.sub(ptnFee));
            rentOrdersByAddr[msg.sender].remove(orderIdxes[i]);
        }
    }

    /// @notice check if a given token is rented or not
    function isRented(address collection, uint256 tokenId) public override view returns (bool) {
        bytes32 tokenHash = getTokenHash(collection, tokenId);
        uint256 rentalIdx = rentalIdxes[tokenHash];
        return rentalIdx != 0 && rentals[rentalIdx].endTime >= block.timestamp;
    }

    /// @notice check all alive rentals for a given renter.
    function getAliveRentals(address renter, address collection) public override view returns (Rental[] memory aliveRentals) {
        uint256[] memory rentIdxes = rentalsByAddr[renter][collection].values();
        uint256 count = 0;
        for(uint i = 0; i < rentIdxes.length; i++) {
            if (rentals[rentIdxes[i]].endTime >= block.timestamp) count++;
        }
        if (count == 0) return aliveRentals;
        aliveRentals = new Rental[](count);
        uint j = 0;
        for(uint i = 0; i < rentIdxes.length; i++) {
            if (rentals[rentIdxes[i]].endTime >= block.timestamp) aliveRentals[j++] = rentals[rentIdxes[i]];
        }
    }

    function getRentOrders(address lender) public override view returns (RentOrder[] memory orders) {
        uint256[] memory orderIdxes = rentOrdersByAddr[lender].values();
        if (orderIdxes.length == 0) return orders;
        orders = new RentOrder[](orderIdxes.length);
        for(uint i = 0; i < orderIdxes.length; i++) {
            orders[i] = rentOrders[orderIdxes[i]];
        }
    }

    function getVaults(address owner) public override view returns (address[] memory result) {
        return vaults[owner].values();
    }

    /// @notice create a vault contract for each owner
    function createVault() external override {
        require(vaults[msg.sender].length() == 0, "RF14");
        Vault vlt = new Vault(address(this));
        vlt.transferOwnership(msg.sender);
        vaults[msg.sender].add(address(vlt));
    }

    function setPartner(address collection, address receiver, uint16 share, address[] calldata payments) external onlyOwner {
        require(share <= commissionBase, "RF15");
        partners[collection] = Partner(receiver, share);

        for (uint8 i = 0; i < payments.length; i++) {
            clcPayments[collection].add(payments[i]);
        }
    }

    /// @notice Commission setter
    function setCommission(uint16 commission_) external onlyOwner {
        require(commission_ <= commissionBase, "RF16");
        commission = commission_;
    }

    /// @notice treasure setter
    function setTreasure(address treasure_) external onlyOwner {
        treasure = treasure_;
    }

    function setVipCommission(uint16 vipCommission_) external onlyOwner {
        require(vipCommission_ <= commission, "RF17");
        vipCommission = vipCommission_;
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

    /// @dev Helper function to compute hash for a given token
    function getTokenHash(address collection, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(collection,  tokenId));
    }

    /// @dev Helper function to compute hash for a given token with a payment
    function getPaymentHash(address collection, uint256 tokenId, address payment) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(collection,  tokenId, payment));
    }

    function calculateRentFee(uint8 timeBase, uint8 amount, LendBid memory lendBid) private pure returns (uint256 price, uint256 duration) {
        if (timeBase == 1) {
            price = lendBid.fee;
            duration = Hour;
        } else if (timeBase == 2) {
            price = lendBid.fee.mul(DayHours).mul(commissionBase - lendBid.dayDiscount).div(commissionBase);
            duration = Day;
        } else if (timeBase == 3) {
            price = lendBid.fee.mul(WeekHours).mul(commissionBase - lendBid.weekDiscount).div(commissionBase);
            duration = Week;
        } else {
            revert("RF18");
        }

        return (price.mul(amount), duration.mul(amount));
    }

    receive() external payable {}
}