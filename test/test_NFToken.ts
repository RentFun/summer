import { expect } from "chai";
import { ethers } from "hardhat";
// import "@nomiclabs/hardhat-ethers";

describe("NFToken", () => {
    it("should deploy an NFToken", async function () {
        const [owner, otherAccount] = await ethers.getSigners();
        const ownerAddress = await owner.getAddress();
        const otherAccountAddress = await otherAccount.getAddress();
        console.log("owner", ownerAddress);
        console.log("otherAccount", otherAccountAddress);


        const NFTokenFactory = await ethers.getContractFactory("NFToken");
        const NFToken = await NFTokenFactory.deploy();
        await NFToken.deployed();

        await NFToken.mintCollectionNFT(ownerAddress, 1);
        const tokenOwner1 = await NFToken.ownerOf(1);
        expect(tokenOwner1).to.equal(ownerAddress);

        await NFToken.mintCollectionNFT(otherAccountAddress, 2);
        const tokenOwner2 = await NFToken.ownerOf(2);
        expect(tokenOwner2).to.equal(otherAccountAddress);
    });
});