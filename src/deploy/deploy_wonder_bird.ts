import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {MerkleTree} from "merkletreejs";
import { utils } from "ethers";

const whitelist = [
    '0xa7DeBb68F2684074Ec4354B68E36C34AF363Fd57',
    '0x38dF87028C451AD521B2FB1576732e9637A66e6f',
    '0xD2884241140347F16F21EAD8a766982363630670',
    '0x5dF922C896e9457A5CA59a568265dD8025B4D369',
    '0x3353b44be83197747eB6a4b3B9d2e391c2A357d5',
    '0x33a280189d3029a632d9f669775De2cDE666B590',
];

const { keccak256 } = utils;
let leaves = whitelist.map((addr) => keccak256(addr));
let merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });

const deploy_wonder_bird: DeployFunction = async function (
    hre: HardhatRuntimeEnvironment,
) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    const merkleRootHash = merkleTree.getHexRoot();
    console.log('merkleRootHash', merkleRootHash);

    await deploy("WonderBird", {
        from: deployer,
        args: ['ipfs://', merkleRootHash, '0x3353b44be83197747eB6a4b3B9d2e391c2A357d5'],
        log: true,
        deterministicDeployment: true,
    });
};

deploy_wonder_bird.tags = ['WonderBird']
export default deploy_wonder_bird;
