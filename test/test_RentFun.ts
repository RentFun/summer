import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract, ContractFactory } from "ethers";
import {parseEther} from "ethers/lib/utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RentFun", () => {
    let NFToken: Contract;
    let WonderBird: Contract;
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
    let WonderBirdAddress: string;
    let RentTokenAddress: string;
    let RentFunAddress: string;
    const Hour = 60 * 60;
    let VaultFactory: ContractFactory;
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

        const WonderBirdFactory = await ethers.getContractFactory("WonderBird");
        WonderBird = await WonderBirdFactory.deploy();
        await WonderBird.deployed();
        WonderBirdAddress = WonderBird.address;
        console.log("WonderBird", WonderBirdAddress);

        const RentTokenFactory = await ethers.getContractFactory("RentToken");
        RentToken = await RentTokenFactory.deploy(parseEther("10000"));
        await RentToken.deployed();
        RentTokenAddress = RentToken.address;
        console.log("RentToken", RentTokenAddress);
        expect(await RentToken.transfer(carolAddr, parseEther("10"))).to.be.ok;
        const carolRent = await RentToken.balanceOf(carolAddr);
        expect(carolRent).to.equal(parseEther("10"));

        const RentFunFactory = await ethers.getContractFactory("RentFun");
        RentFun = await RentFunFactory.deploy(aliceAddr, bobAddr, WonderBirdAddress);
        await RentFun.deployed();

        RentFunAddress = RentFun.address;
        console.log("RentFun", RentFunAddress);
        VaultFactory = await ethers.getContractFactory("Vault");
    });

    describe("vault", () => {
        it("should be able to lend and rent with eth", async () => {
            expect(await RentFun.setPartner(NFTokenAddress, devAddr, 5000, [])).to.be.ok;

            expect(await RentFun.createVault()).to.be.ok;
            const aliceVaults = await RentFun.getVaults(aliceAddr);
            console.log('aliceVaults', aliceVaults);
            const vault = VaultFactory.attach(aliceVaults[0]);
            const owner = await vault.owner();
            expect(owner).to.equal(aliceAddr);

            await NFToken.mintCollectionNFT(aliceAddr, 1);
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;

            const token = {lender: aliceAddr, collection: NFTokenAddress, tokenId: 1, amount: 0,
                maxEndTime: 0, vault: aliceVaults[0]};
            const lendBid = {payment: AddressZero, fee: parseEther("0.05"), dayDiscount: 1000, weekDiscount: 2000};
            const lent = {token: token, lendBid: lendBid};

            expect(await RentFun.lend([lent])).to.be.ok;

            const rentBid = {collection: NFTokenAddress, tokenId: 1, payment: AddressZero,
                tokenAmount: 0, timeBase: 2, timeAmount: 3};
            expect(await RentFun.connect(carol).rent([rentBid], {value: parseEther("3.24")})).to.be.ok;

            const rented = await RentFun.isRented(NFTokenAddress, 1);
            expect(rented).to.true;

            let rentOrders = await RentFun.getRentOrders(aliceAddr);
            expect(rentOrders.length).to.equal(1);

            const funBalance = await ethers.provider.getBalance(RentFunAddress);
            expect(funBalance).to.equal(parseEther("3.24"));

            const bobRent = await bob.getBalance();
            const carolRent = await carol.getBalance();
            const devRent = await dev.getBalance();
            const aliceRent = await alice.getBalance();

            await WonderBird.mintCollectionNFT(aliceAddr, 1);
            await RentFun.claimRentFee(1);

            const bobRent1 = await bob.getBalance();
            const carolRent1 = await carol.getBalance();
            const devRent1 = await dev.getBalance();
            const aliceRent1 = await alice.getBalance();

            expect(bobRent1).to.equal(parseEther("0.1296").add(bobRent));
            expect(carolRent1).to.equal(carolRent);
            expect(devRent1).to.equal(parseEther("0.1296").add(devRent));
            expect(parseEther("2.9808").add(aliceRent).sub(aliceRent1).lte(parseEther("0.01"))).to.true;

            rentOrders = await RentFun.getRentOrders(aliceAddr);
            expect(rentOrders.length).to.equal(0);
        });

        it("should be able to lend and rent", async () => {
            expect(await RentFun.setPartner(NFTokenAddress, devAddr, 5000, [RentTokenAddress])).to.be.ok;

            // function setPartner(address collection, address receiver, uint16 share, address[] calldata payments)

            expect(await RentFun.createVault()).to.be.ok;
            const aliceVaults = await RentFun.getVaults(aliceAddr);
            console.log('aliceVaults', aliceVaults);
            const vault = VaultFactory.attach(aliceVaults[0]);
            const owner = await vault.owner();
            expect(owner).to.equal(aliceAddr);

            await NFToken.mintCollectionNFT(aliceAddr, 1);
            expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;

            const token = {lender: aliceAddr, collection: NFTokenAddress, tokenId: 1, amount: 0,
                maxEndTime: 0, vault: aliceVaults[0]};
            const lendBid = {payment: RentTokenAddress, fee: parseEther("0.05"), dayDiscount: 1000, weekDiscount: 2000};
            const lent = {token: token, lendBid: lendBid};

            expect(await RentFun.lend([lent])).to.be.ok;

            const rentBid = {collection: NFTokenAddress, tokenId: 1, payment: RentTokenAddress,
                tokenAmount: 0, timeBase: 2, timeAmount: 3};
            expect(await RentToken.connect(carol).approve(RentFunAddress, parseEther("10000"))).to.be.ok;
            expect(await RentFun.connect(carol).rent([rentBid])).to.be.ok;

            const rented = await RentFun.isRented(NFTokenAddress, 1);
            expect(rented).to.true;

            let rentOrders = await RentFun.getRentOrders(aliceAddr);
            expect(rentOrders.length).to.equal(1);

            const funRent = await RentToken.balanceOf(RentFunAddress);
            expect(funRent).to.equal(parseEther("3.24"));

            const bobRent = await RentToken.balanceOf(bobAddr);
            const carolRent = await RentToken.balanceOf(carolAddr);
            const devRent = await RentToken.balanceOf(devAddr);
            const aliceRent = await RentToken.balanceOf(aliceAddr);

            await WonderBird.mintCollectionNFT(aliceAddr, 1);
            await RentFun.claimRentFee(1);

            const bobRent1 = await RentToken.balanceOf(bobAddr);
            const carolRent1 = await RentToken.balanceOf(carolAddr);
            const devRent1 = await RentToken.balanceOf(devAddr);
            const aliceRent1 = await RentToken.balanceOf(aliceAddr);

            expect(bobRent1).to.equal(parseEther("0.1296").add(bobRent));
            expect(carolRent1).to.equal(carolRent);
            expect(devRent1).to.equal(parseEther("0.1296").add(devRent));
            expect(aliceRent1).to.equal(parseEther("2.9808").add(aliceRent));

            rentOrders = await RentFun.getRentOrders(aliceAddr);
            expect(rentOrders.length).to.equal(0);
        });

        // it("should reverted with the tokenID is not minted", async () => {
        //     await expect(RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
        //         "ERC721: invalid token ID"
        //     );
        // });

        // it("should reverted with the msg.sender is not the owner of the token", async () => {
        //     await NFToken.mintCollectionNFT(aliceAddr, 1);
        //     await NFToken.mintCollectionNFT(bobAddr, 2);
        //     await expect(RentFun.lend(NFTokenAddress, 2, AddressZero, 1000)).to.be.revertedWith(
        //         "ERC721: caller is not token owner or approved"
        //     );
        //
        //     await expect(RentFun.connect(bob).lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
        //         "ERC721: caller is not token owner or approved"
        //     );
        //
        //     // revert without approve
        //     await expect(RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.revertedWith(
        //         "ERC721: caller is not token owner or approved"
        //     );
        // });
        //
        // it("should be ok to delegate an NFToken after approved", async () => {
        //     await NFToken.mintCollectionNFT(aliceAddr, 1);
        //     await NFToken.mintCollectionNFT(bobAddr, 2);
        //
        //     let nextTokenIdx = await RentFun.nextTokenIdx();
        //     expect(nextTokenIdx).to.equal(1);
        //
        //     expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
        //     expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, 1000)).to.be.ok;
        //     const aliceVaultAddr = await RentFun.vaults(aliceAddr);
        //     console.log("aliceVaultAddr", aliceVaultAddr);
        //     let tokenOwner = await NFToken.ownerOf(1);
        //     expect(tokenOwner).to.equal(aliceVaultAddr);
        //     nextTokenIdx = await RentFun.nextTokenIdx();
        //     expect(nextTokenIdx).to.equal(2);
        //
        //     const td1 = await RentFun.tokenDetails(1);
        //     expect(td1.contract_).to.equal(NFTokenAddress);
        //     expect(td1.tokenId).to.equal(1);
        //     expect(td1.depositor).to.equal(aliceAddr);
        //     expect(td1.unitFee).to.equal(1000);
        //     expect(td1.rentStatus).to.equal(1);
        //
        //     expect(await NFToken.connect(bob).approve(RentFunAddress, 2)).to.be.ok;
        //     expect(await RentFun.connect(bob).lend(NFTokenAddress, 2, AddressZero, 3000)).to.be.ok;
        //
        //     const bobVaultAddr = await RentFun.vaults(bobAddr);
        //     console.log("bobVaultAddr", bobVaultAddr);
        //     tokenOwner = await NFToken.ownerOf(2);
        //     expect(tokenOwner).to.equal(bobVaultAddr);
        //     nextTokenIdx = await RentFun.nextTokenIdx();
        //     expect(nextTokenIdx).to.equal(3);
        //
        //     const td2 = await RentFun.tokenDetails(2);
        //     expect(td2.contract_).to.equal(NFTokenAddress);
        //     expect(td2.depositor).to.equal(bobAddr);
        //     expect(td2.unitFee).to.equal(3000);
        //     expect(td2.rentStatus).to.equal(1);
        // });
        //
        // it("should reverted with token is rented while trying transferNFT", async () => {
        //     await NFToken.mintCollectionNFT(aliceAddr, 1);
        //     expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
        //     expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;
        //     let tokenOwner = await NFToken.ownerOf(1);
        //     const aliceVaultAddr = await RentFun.vaults(aliceAddr);
        //     expect(tokenOwner).to.equal(aliceVaultAddr);
        //
        //     let isRented = await RentFun.isRented(NFTokenAddress, 1);
        //     expect(isRented).to.be.true;
        //     const OwnerVault = OwnerVaultFactory.attach(aliceVaultAddr);
        //     await expect(OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.revertedWith(
        //         "RentFun: Token is rented"
        //     );
        //
        //     expect(await RentFun.cancelLend(NFTokenAddress, 1)).to.be.ok;
        //     expect(await OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.ok;
        //     tokenOwner = await NFToken.ownerOf(1);
        //     expect(tokenOwner).to.equal(aliceAddr);
        //
        //     // transferNFT will fail if the token is rented
        //     expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
        //     expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;
        //     const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 1, 3, {value: parseEther("3")});
        //     expect(rentTx).to.be.ok;
        //     isRented = await RentFun.isRented(NFTokenAddress, 1);
        //     expect(isRented).to.be.true;
        //     expect(await RentFun.cancelLend(NFTokenAddress, 1)).to.be.ok;
        //     isRented = await RentFun.isRented(NFTokenAddress, 1);
        //     expect(isRented).to.be.true;
        //     await time.increase(3600*3);
        //     isRented = await RentFun.isRented(NFTokenAddress, 1);
        //     expect(isRented).to.be.false;
        //     expect(await OwnerVault.connect(alice).transferNFT(NFTokenAddress, 1, aliceAddr)).to.be.ok;
        // });
    });

    // describe("rent", () => {
    //     it("should reverted with token is not rentable", async () => {
    //         await expect(RentFun.connect(carol).rent(NFTokenAddress, 1, 3)).to.be.revertedWith(
    //             "Token is not rentable"
    //         );
    //     });
    //
    //     it("should be ok to rent an delegated NFToken", async () => {
    //         // alice delegate a token
    //         await NFToken.mintCollectionNFT(aliceAddr, 1);
    //         expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
    //         expect(await RentFun.lend(NFTokenAddress, 1, AddressZero, parseEther("1"))).to.be.ok;
    //
    //         // no rent before
    //         let totalRentCount = await RentFun.totalRentCount();
    //         expect(totalRentCount).to.be.equal(0);
    //         // let carolFullRentals = await RentFun.getFullRentals(carolAddr, NFTokenAddress);
    //         // expect(carolFullRentals.length).to.equal(0);
    //         let carolAliveRentals = await RentFun.getAliveRentals(carolAddr, NFTokenAddress);
    //         expect(carolAliveRentals.length).to.equal(0);
    //
    //
    //         const carolBalanceBeforeRent = await carol.getBalance();
    //         // after a rent
    //         const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 1, 3, {value: parseEther("3")});
    //         expect(rentTx).to.be.ok;
    //
    //         totalRentCount = await RentFun.totalRentCount();
    //         expect(totalRentCount).to.be.equal(1);
    //         const td1 = await RentFun.tokenDetails(1);
    //         expect(td1.lastRentIdx).to.be.equal(1);
    //         expect(td1.rentStatus).to.equal(2);
    //
    //         const ptn = await RentFun.partners(NFTokenAddress);
    //         expect(ptn.feeReceiver).to.equal(aliceAddr);
    //         expect(ptn.commission).to.equal(5000);
    //
    //         const aliceVaultAddr = await RentFun.vaults(aliceAddr);
    //         const rental = await RentFun.rentals(totalRentCount);
    //         expect(rental.renter).to.equal(carolAddr);
    //         expect(rental.contract_).to.equal(NFTokenAddress);
    //         expect(rental.tokenId).to.equal(1);
    //         expect(rental.vault).to.equal(aliceVaultAddr);
    //
    //         // carolFullRentals = await RentFun.getFullRentals(carolAddr, NFTokenAddress);
    //         carolAliveRentals = await RentFun.getAliveRentals(carolAddr, NFTokenAddress);
    //         // expect(rental.toString()).to.equal(carolFullRentals[0].toString());
    //         expect(rental.toString()).to.equal(carolAliveRentals[0].toString());
    //
    //         const carolBalanceAfterRent = await carol.getBalance();
    //         const before = carolBalanceBeforeRent.div(parseEther("1"));
    //         const after = carolBalanceAfterRent.div(parseEther("1"));
    //         expect(before.sub(after)).to.equal(3);
    //     });
    // });
    //
    // describe("ERC20 token as payment mode", () => {
    //     it("should reverted with Payment contract is not supported trying to delegate an NFToken", async () => {
    //         await NFToken.mintCollectionNFT(aliceAddr, 1);
    //         expect(await NFToken.approve(RentFunAddress, 1)).to.be.ok;
    //         await expect(RentFun.lend(NFTokenAddress, 1, RentTokenAddress, parseEther("1"))).to.be.revertedWith(
    //             "Payment contract is not supported"
    //         );
    //     });
    //
    //     it("should be ok to take ERC20 token as payment", async () => {
    //         expect(await RentFun.addPayment(RentTokenAddress)).to.be.ok;
    //         await NFToken.mintCollectionNFT(bobAddr, 2);
    //         expect(await NFToken.connect(bob).approve(RentFunAddress, 2)).to.be.ok;
    //         await expect(RentFun.connect(bob).lend(NFTokenAddress, 2, RentTokenAddress, parseEther("1"))).to.be.ok;
    //
    //         expect(await RentToken.connect(carol).approve(RentFunAddress, parseEther("10000"))).to.be.ok;
    //         let nextTokenIdx = await RentFun.nextTokenIdx();
    //         expect(nextTokenIdx).to.equal(2);
    //         const td1 = await RentFun.tokenDetails(1);
    //         expect(td1.payment).to.be.equal(RentTokenAddress);
    //
    //         const rentTx = await RentFun.connect(carol).rent(NFTokenAddress, 2, 3);
    //         expect(rentTx).to.be.ok;
    //
    //         const carolRent = await RentToken.balanceOf(carolAddr);
    //         expect(carolRent).to.equal(parseEther("7"));
    //
    //         const bobRent = await RentToken.balanceOf(bobAddr);
    //         expect(bobRent).to.equal(parseEther("2.7"));
    //
    //         const aliceRent = await RentToken.balanceOf(aliceAddr);
    //         expect(aliceRent).to.equal(parseEther("9990.15"));
    //     });
    // });
});