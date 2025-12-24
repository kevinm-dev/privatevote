# PrivateVote

PrivateVote is a privacy-preserving voting dapp built on Zama FHEVM. It lets anyone create a vote with 2 to 4 options
and a start/end time, collect encrypted ballots during the voting window, and reveal results only after the vote ends.
After decryption, anyone can publish the verified results back on-chain.

## Project Overview

PrivateVote addresses a common gap in public voting systems: you often must choose between transparency and privacy.
This project keeps every ballot confidential while the vote is active and still delivers a verifiable, on-chain result
once the vote ends. The contract keeps only encrypted tallies during the vote and exposes decrypted totals only after
finalization.

## Problem It Solves

- Prevents early results from influencing voters by keeping tallies encrypted before the end time.
- Protects voter privacy by encrypting every ballot with FHE.
- Removes the need to trust a single administrator to reveal results.
- Provides on-chain verification of the published results.
- Keeps the process open: anyone can create a vote and anyone can finalize it after the end time.

## Advantages

- End-to-end privacy: ballots are encrypted at submission and remain encrypted in storage.
- Encrypted tallies: no intermediate result leakage.
- Permissionless finalization: anyone can click "end" after the deadline.
- Verifiable results: decrypted results can be verified and written on-chain.
- Simple setup: 2 to 4 options, clear time window, and a direct voting flow.

## How It Works

1. Create a vote with a name, 2 to 4 options, a start time, and an end time.
2. During the vote window, users submit encrypted ballots.
3. The contract maintains encrypted tallies only; no decryption occurs before the end time.
4. After the end time, anyone can finalize the vote to make the results public.
5. The public results can then be verified and published on-chain.

## Technology Stack

- Smart contracts: Solidity + Hardhat
- FHE: Zama FHEVM protocol
- Frontend: React + Vite
- Wallet: RainbowKit
- Contract reads: viem
- Contract writes: ethers
- Language: TypeScript

## Repository Layout

- `contracts/` Smart contracts
- `deploy/` Deployment scripts
- `tasks/` Hardhat tasks
- `test/` Contract tests
- `home/` Frontend app (React + Vite)
- `docs/` Zama integration references

## Prerequisites

- Node.js 20+
- npm

## Installation

```bash
npm install
```

## Environment Configuration (Deployments Only)

Create a `.env` file in the project root with:

```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

Notes:
- Use a private key for deployment. Do not use a mnemonic.
- Frontend does not use environment variables.

## Compile and Test

```bash
npm run compile
npm run test
```

## Local Development (Contracts)

Start a local FHEVM-ready node and deploy for contract testing:

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

## Deploy to Sepolia

After tasks and tests pass, deploy to Sepolia:

```bash
npx hardhat deploy --network sepolia
```

Optionally verify on Etherscan:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend Usage

The frontend lives in `home/` and connects to Sepolia. It expects the ABI generated from `deployments/sepolia`.

```bash
cd home
npm install
npm run dev
```

User flow in the UI:

- Connect wallet to Sepolia.
- Create a vote with a name, 2 to 4 options, and a time window.
- Cast an encrypted vote during the voting window.
- After the vote ends, click to finalize and reveal results.
- Publish the verified results on-chain.

## Security and Privacy Notes

- Ballots are encrypted end-to-end using FHE; plaintext votes are never stored on-chain.
- Tallies are encrypted during the vote and only decrypted after the end time.
- Finalization is permissionless; no trusted admin is required to reveal results.
- On-chain publication provides transparency and verification of the decrypted totals.

## Future Roadmap

- Support more flexible option counts and alternative voting methods.
- Add quorum, participation thresholds, and configurable rules.
- Improve indexing and analytics for large-scale elections.
- Expand to additional networks that support FHEVM.
- Formal security review and continuous fuzz testing.
- UX polish for mobile and multi-language support.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
