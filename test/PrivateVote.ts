import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = await ethers.getContractFactory("PrivateVote");
  const contract = (await factory.deploy()) as Contract;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("PrivateVote", function () {
  let signers: Signers;
  let contract: Contract;
  let contractAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture());
  });

  it("creates a poll, counts votes, and finalizes", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const now = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
    const startTime = now - 10;
    const endTime = now + 10;

    const createTx = await contract.createPoll("First Poll", ["Alpha", "Beta"], startTime, endTime);
    await createTx.wait();

    const pollId = 0;
    const encryptedChoiceA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(0)
      .encrypt();
    const encryptedChoiceB = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(1)
      .encrypt();

    await (await contract.connect(signers.alice).vote(pollId, encryptedChoiceA.handles[0], encryptedChoiceA.inputProof))
      .wait();
    await (await contract.connect(signers.bob).vote(pollId, encryptedChoiceB.handles[0], encryptedChoiceB.inputProof))
      .wait();

    await ethers.provider.send("evm_increaseTime", [20]);
    await ethers.provider.send("evm_mine", []);

    await (await contract.connect(signers.alice).finalizePoll(pollId)).wait();

    const result = await contract.getEncryptedCounts(pollId);
    const encryptedCounts = result[0] as string[];

    const count0 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCounts[0],
      contractAddress,
      signers.alice,
    );
    const count1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCounts[1],
      contractAddress,
      signers.alice,
    );

    expect(count0).to.eq(1);
    expect(count1).to.eq(1);
  });
});
