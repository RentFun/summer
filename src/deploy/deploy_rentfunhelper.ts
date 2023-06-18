import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (
    hre: HardhatRuntimeEnvironment,
) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("VaultManager", {
        from: deployer,
        args: ['0x3353b44be83197747eB6a4b3B9d2e391c2A357d5', '0x3353b44be83197747eB6a4b3B9d2e391c2A357d5', '0x1e18eAC63028C7696e6915B8ca7e066E24FF536a'],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ['RentFun'];
export default deploy;