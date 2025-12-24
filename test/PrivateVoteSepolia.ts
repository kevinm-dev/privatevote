import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";

type Signers = {
  voter: HardhatEthersSigner;
};

describe("PrivateVoteSepolia", function () {
  let signers: Signers;
  let contract: Contract;
  let contractAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("PrivateVote");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("PrivateVote", deployment.address);
    } catch (error) {
      (error as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw error;
    }

    const ethSigners = await ethers.getSigners();
    signers = { voter: ethSigners[0] };
  });

  it("creates a poll and submits a vote", async function () {
    this.timeout(4 * 40000);

    const pollCountBefore = await contract.pollCount();
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 60;
    const endTime = now + 3600;

    const createTx = await contract.createPoll("Sepolia Poll", ["Yes", "No"], startTime, endTime);
    await createTx.wait();

    const pollId = pollCountBefore;
    const encryptedChoice = await fhevm
      .createEncryptedInput(contractAddress, signers.voter.address)
      .add32(0)
      .encrypt();

    const voteTx = await contract.vote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await voteTx.wait();

    const hasVoted = await contract.hasVoted(pollId, signers.voter.address);
    expect(hasVoted).to.eq(true);
  });
});
