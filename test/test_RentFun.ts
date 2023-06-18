import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract, ContractFactory } from "ethers";
import {parseEther} from "ethers/lib/utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RentFun", () => {
    let NFToken: Contract;
    let WonderBird: Contract;
    let RentToken: Contract;
    let VaultManager: Contract;
    let RentFunHelper: Contract;
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
    let VaultManagerAddress: string;
    let RentFunHelperAddress: string;
    let RentFunAddress: string;
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

        const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
        VaultManager = await VaultManagerFactory.deploy();
        await VaultManager.deployed();
        VaultManagerAddress = VaultManager.address;

        const RentFunHelperFactory = await  ethers.getContractFactory("RentFunHelper");
        RentFunHelper = await RentFunHelperFactory.deploy(aliceAddr, VaultManagerAddress, WonderBirdAddress, bobAddr);
        await RentFunHelper.deployed();
        RentFunHelperAddress = RentFunHelper.address;

        const RentFunFactory = await ethers.getContractFactory("RentFun");
        RentFun = await RentFunFactory.deploy(RentFunHelperAddress);
        await RentFun.deployed();

        RentFunAddress = RentFun.address;
        console.log("RentFun", RentFunAddress);
        VaultFactory = await ethers.getContractFactory("Vault");
    });

    describe("vault", () => {
        it("should be able to lend and rent with eth", async () => {
            expect(await RentFunHelper.setPartner(NFTokenAddress, devAddr, 5000, [])).to.be.ok;

            expect(await VaultManager.create()).to.be.ok;
            const aliceVaults = await VaultManager.getVaults(aliceAddr);
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
            expect(await RentFunHelper.setPartner(NFTokenAddress, devAddr, 5000, [RentTokenAddress])).to.be.ok;

            // function setPartner(address collection, address receiver, uint16 share, address[] calldata payments)

            expect(await VaultManager.create()).to.be.ok;
            const aliceVaults = await VaultManager.getVaults(aliceAddr);
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
    });


});