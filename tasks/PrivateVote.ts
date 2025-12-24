import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the PrivateVote address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;
  const privateVote = await deployments.get("PrivateVote");
  console.log("PrivateVote address is " + privateVote.address);
});

task("task:create-poll", "Creates a new poll")
  .addParam("name", "Poll name")
  .addParam("options", "Pipe-separated list of options, e.g. \"Yes|No|Abstain\"")
  .addParam("start", "Start time (unix seconds)")
  .addParam("end", "End time (unix seconds)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const startTime = Number(taskArguments.start);
    const endTime = Number(taskArguments.end);
    if (!Number.isInteger(startTime) || !Number.isInteger(endTime)) {
      throw new Error("start and end must be unix timestamps");
    }

    const options = String(taskArguments.options)
      .split("|")
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    const deployment = await deployments.get("PrivateVote");
    const contract = await ethers.getContractAt("PrivateVote", deployment.address);

    const tx = await contract.createPoll(taskArguments.name, options, startTime, endTime);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Poll created on ${deployment.address}`);
  });

task("task:vote", "Votes on a poll with encrypted choice")
  .addParam("pollId", "Poll id")
  .addParam("option", "Option index (0-based)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const pollId = Number(taskArguments.pollId);
    const optionIndex = Number(taskArguments.option);
    if (!Number.isInteger(pollId) || !Number.isInteger(optionIndex)) {
      throw new Error("pollId and option must be integers");
    }

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("PrivateVote");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("PrivateVote", deployment.address);

    const encryptedChoice = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .add32(optionIndex)
      .encrypt();

    const tx = await contract.vote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Vote submitted for poll ${pollId}`);
  });

task("task:finalize", "Finalizes a poll and makes results public")
  .addParam("pollId", "Poll id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const pollId = Number(taskArguments.pollId);
    if (!Number.isInteger(pollId)) {
      throw new Error("pollId must be an integer");
    }

    const deployment = await deployments.get("PrivateVote");
    const contract = await ethers.getContractAt("PrivateVote", deployment.address);
    const tx = await contract.finalizePoll(pollId);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Poll ${pollId} finalized`);
  });
