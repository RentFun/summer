import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract, ContractFactory } from "ethers";
import {parseEther} from "ethers/lib/utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RentFun", () => {
    let NFToken: Contract;
    let RentToken: Contract;
    let alice: Signer;
    let bob: Signer;
    let carol: Signer;
    let dev: Signer;
    let aliceAddr: string;
    let bobAddr: string;
    let carolAddr: string;
    let devAddr: string;
    let RentFun: Contract;
    let NFTokenAddress: string;
    let RentTokenAddress: string;
    let RentFunAddress: string;
    const Hour = 60 * 60;
    let OwnerVaultFactory: ContractFactory;
    const AddressZero = ethers.constants.AddressZero;

    beforeEach(async () => {
        [alice, bob, carol, dev] = await ethers.getSigners();
        aliceAddr = await alice.getAddress();
        bobAddr = await bob.getAddress();
        carolAddr = await carol.getAddress();
        devAddr = await dev.getAddress();
        console.log("aliceAddr", aliceAddr);
        console.log("bobAddr", bobAddr);
        console.log("carolAddr", carolAddr);
        console.log("devAddr", devAddr);

        const NFTokenFactory = await ethers.getContractFactory("NFToken");
        NFToken = await NFTokenFactory.deploy();
        await NFToken.deployed();
        NFTokenAddress = NFToken.address;
        console.log("NFToken", NFTokenAddress);

        const RentTokenFactory = await ethers.getContractFactory("RentToken");
        RentToken = await RentTokenFactory.deploy(parseEther("10000"));
        await RentToken.deployed();
        RentTokenAddress = RentToken.address;
        console.log("RentToken", RentTokenAddress);
        expect(await RentToken.transfer(carolAddr, parseEther("10"))).to.be.ok;
        const carolRent = await RentToken.balanceOf(carolAddr);
        expect(carolRent).to.equal(parseEther("10"));

        const RentFunFactory = await ethers.getContractFactory("RentFun");
        RentFun = await RentFunFactory.deploy(aliceAddr);
        await RentFun.deployed();

        RentFunAddress = RentFun.address;
        console.log("RentFun", RentFunAddress);
        OwnerVaultFactory = await ethers.getContractFactory("Vault");

        expect(await RentFun.setPartners(NFTokenAddress, aliceAddr, 5000)).to.be.ok;
        expect(await RentFun.setUnitTime(Hour)).to.be.ok;
        expect(await RentFun.setCommission(1000)).to.be.ok;
        expect(await RentFun.setTreasure(devAddr)).to.be.ok;
    });

    // function lend(address contract_, uint256 tokenId, uint256 unitFee) external {

    describe("lend", () => {
        it("should reverted with the tokenID is not minted", async () => {
            await expect(RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
                "ERC721: invalid token ID"
            );
        });

        it("should reverted with the msg.sender is not the owner of the token", async () => {
            await NFToken.mintCollectionNFT(aliceAddr, 1);
            await NFToken.mintCollectionNFT(bobAddr, 2);
            await expect(RentFun.lend(NFTokenAddress, 2, AddressZero, 1000)).to.be.revertedWith(
                "ERC721: caller is not token owner or approved"
            );

            await expect(RentFun.connect(bob).lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
                "ERC721: caller is not token owner or approved"
            );

            // revert without approve
            await expect(RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
                "ERC721: caller is not token owner or approved"
            );
        });

        it("should be ok to delegate an NFToken after approved", async () => {
            await NFToken.mintCollectionNFT(aliceAddr, 1);
            await NFToken.mintCollectionNFT(bobAddr, 2);

            let nextTokenIdx = await RentFun.nextTokenIdx();
            expect(nextTokenIdx).to.equal(1);

            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
            expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.ok;
            const aliceVaultAddr = await RentFun.vaults(aliceAddr);
            console.log("aliceVaultAddr", aliceVaultAddr);
            let tokenOwner = await NFToken.ownerOf(1);
            expect(tokenOwner).to.equal(aliceVaultAddr);
            nextTokenIdx = await RentFun.nextTokenIdx();
            expect(nextTokenIdx).to.equal(2);

            const td1 = await RentFun.tokenDetails(1);
            expect(td1.contract_).to.equal(NFTokenAddress);
            expect(td1.tokenId).to.equal(1);
            expect(td1.depositor).to.equal(aliceAddr);
            expect(td1.unitFee).to.equal(1000);
            expect(td1.rentStatus).to.equal(1);

            expect(await NFToken.connect(bob).approve(RentFunAddress, 2)).to.be.ok;
            expect(await RentFun.connect(bob).lend(NFTokenAddress, 2, AddressZero, 3000)).to.be.ok;

            const bobVaultAddr = await RentFun.vaults(bobAddr);
            console.log("bobVaultAddr", bobVaultAddr);
            tokenOwner = await NFToken.ownerOf(2);
            expect(tokenOwner).to.equal(bobVaultAddr);
            nextTokenIdx = await RentFun.nextTokenIdx();
            expect(nextTokenIdx).to.equal(3);

            const td2 = await RentFun.tokenDetails(2);
            expect(td2.contract_).to.equal(NFTokenAddress);
            expect(td2.depositor).to.equal(bobAddr);
            expect(td2.unitFee).to.equal(3000);
            expect(td2.rentStatus).to.equal(1);
        });

        it("should reverted with token is rented while trying transferNFT", async () => {
            await NFToken.mintCollectionNFT(aliceAddr, 1);
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
            expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;
            let tokenOwner = await NFToken.ownerOf(1);
            const aliceVaultAddr = await RentFun.vaults(aliceAddr);
            expect(tokenOwner).to.equal(aliceVaultAddr);

            let isRented = await RentFun.isRented(NFTokenAddress, 1);
            expect(isRented).to.be.true;
            const OwnerVault = OwnerVaultFactory.attach(aliceVaultAddr);
            await expect(OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.revertedWith(
                "RentFun: Token is rented"
            );

            expect(await RentFun.cancelLend(NFTokenAddress, 1)).to.be.ok;
            expect(await OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.ok;
            tokenOwner = await NFToken.ownerOf(1);
            expect(tokenOwner).to.equal(aliceAddr);

            // transferNFT will fail if the token is rented
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
            expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;
            const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 1, 3, {value: parseEther("3")});
            expect(rentTx).to.be.ok;
            isRented = await RentFun.isRented(NFTokenAddress, 1);
            expect(isRented).to.be.true;
            expect(await RentFun.cancelLend(NFTokenAddress, 1)).to.be.ok;
            isRented = await RentFun.isRented(NFTokenAddress, 1);
            expect(isRented).to.be.true;
            await time.increase(3600*3);
            isRented = await RentFun.isRented(NFTokenAddress, 1);
            expect(isRented).to.be.false;
            expect(await OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.ok;
        });
    })

    describe("rent", () => {
        it("should reverted with token is not rentable", async () => {
            await expect(RentFun.connect(carol).rent(NFTokenAddress, 1, 3)).to.be.revertedWith(
                "Token is not rentable"
            );
        });

        it("should be ok to rent an delegated NFToken", async () => {
            // alice delegate a token
            await NFToken.mintCollectionNFT(aliceAddr, 1);
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
            expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;

            // no rent before
            let totalRentCount = await RentFun.totalRentCount();
            expect(totalRentCount).to.be.equal(0);
            // let carolFullRentals = await RentFun.getFullRentals(carolAddr, NFTokenAddress);
            // expect(carolFullRentals.length).to.equal(0);
            let carolAliveRentals = await RentFun.getAliveRentals(carolAddr, NFTokenAddress);
            expect(carolAliveRentals.length).to.equal(0);


            const carolBalanceBeforeRent = await carol.getBalance();
            // after a rent
            const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 1, 3, {value: parseEther("3")});
            expect(rentTx).to.be.ok;

            totalRentCount = await RentFun.totalRentCount();
            expect(totalRentCount).to.be.equal(1);
            const td1 = await RentFun.tokenDetails(1);
            expect(td1.lastRentIdx).to.be.equal(1);
            expect(td1.rentStatus).to.equal(2);

            const ptn = await RentFun.partners(NFTokenAddress);
            expect(ptn.feeReceiver).to.equal(aliceAddr);
            expect(ptn.commission).to.equal(5000);

            const aliceVaultAddr = await RentFun.vaults(aliceAddr);
            const rental = await RentFun.rentals(totalRentCount);
            expect(rental.renter).to.equal(carolAddr);
            expect(rental.contract_).to.equal(NFTokenAddress);
            expect(rental.tokenId).to.equal(1);
            expect(rental.vault).to.equal(aliceVaultAddr);

            // carolFullRentals = await RentFun.getFullRentals(carolAddr, NFTokenAddress);
            carolAliveRentals = await RentFun.getAliveRentals(carolAddr, NFTokenAddress);
            // expect(rental.toString()).to.equal(carolFullRentals[0].toString());
            expect(rental.toString()).to.equal(carolAliveRentals[0].toString());

            const carolBalanceAfterRent = await carol.getBalance();
            const before = carolBalanceBeforeRent.div(parseEther("1"));
            const after = carolBalanceAfterRent.div(parseEther("1"));
            expect(before.sub(after)).to.equal(3);
        });
    });

    describe("ERC20 token as payment mode", () => {
        it("should reverted with Payment contract is not supported trying to delegate an NFToken", async () => {
            await NFToken.mintCollectionNFT(aliceAddr, 1);
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
            await expect(RentFun.lend(NFTokenAddress, 1, RentTokenAddress, parseEther("1"))).to.be.revertedWith(
                "Payment contract is not supported"
            );
        });

        it("should be ok to take ERC20 token as payment", async () => {
            expect(await RentFun.addPayment(RentTokenAddress)).to.be.ok;
            await NFToken.mintCollectionNFT(bobAddr, 2);
            expect(await NFToken.connect(bob).approve(RentFunAddress, 2)).to.be.ok;
            await expect(RentFun.connect(bob).lend(NFTokenAddress, 2, RentTokenAddress, parseEther("1"))).to.be.ok;

            expect(await RentToken.connect(carol).approve(RentFunAddress, parseEther("10000"))).to.be.ok;
            let nextTokenIdx = await RentFun.nextTokenIdx();
            expect(nextTokenIdx).to.equal(2);
            const td1 = await RentFun.tokenDetails(1);
            expect(td1.payment).to.be.equal(RentTokenAddress);

            const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 2, 3);
            expect(rentTx).to.be.ok;

            const carolRent = await RentToken.balanceOf(carolAddr);
            expect(carolRent).to.equal(parseEther("7"));

            const bobRent = await RentToken.balanceOf(bobAddr);
            expect(bobRent).to.equal(parseEther("2.7"));

            const aliceRent = await RentToken.balanceOf(aliceAddr);
            expect(aliceRent).to.equal(parseEther("9990.15"));
        });
    });
})