import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPrivateVote = await deploy("PrivateVote", {
    from: deployer,
    log: true,
  });

  console.log(`PrivateVote contract: `, deployedPrivateVote.address);
};
export default func;
func.id = "deploy_privateVote";
func.tags = ["PrivateVote"];
