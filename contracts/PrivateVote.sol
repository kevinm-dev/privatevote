// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateVote
/// @notice Encrypted voting with public result decryption after poll end.
contract PrivateVote is ZamaEthereumConfig {
    struct Poll {
        string name;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        address creator;
        uint8 optionCount;
        bool finalized;
        bool published;
        euint32[4] counts;
        uint32[4] publishedCounts;
    }

    Poll[] private _polls;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    event PollCreated(uint256 indexed pollId, address indexed creator, string name, uint64 startTime, uint64 endTime);
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollFinalized(uint256 indexed pollId, address indexed caller);
    event ResultsPublished(uint256 indexed pollId, address indexed caller);

    error InvalidPollId();
    error InvalidOptionCount();
    error InvalidTimeRange();
    error VotingNotStarted();
    error VotingEnded();
    error PollAlreadyFinalized();
    error AlreadyVoted();
    error PollNotEnded();
    error ResultsAlreadyPublished();
    error ResultsNotFinalized();
    error InvalidResultsLength();

    function pollCount() external view returns (uint256) {
        return _polls.length;
    }

    function createPoll(
        string calldata name,
        string[] calldata options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 pollId) {
        if (options.length < 2 || options.length > 4) {
            revert InvalidOptionCount();
        }
        if (endTime <= startTime) {
            revert InvalidTimeRange();
        }

        Poll storage poll = _polls.push();
        poll.name = name;
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.creator = msg.sender;
        poll.optionCount = uint8(options.length);

        for (uint256 i = 0; i < options.length; i++) {
            poll.options.push(options[i]);
        }

        pollId = _polls.length - 1;
        emit PollCreated(pollId, msg.sender, name, startTime, endTime);
    }

    function vote(uint256 pollId, externalEuint32 encryptedChoice, bytes calldata inputProof) external {
        Poll storage poll = _getPoll(pollId);
        if (block.timestamp < poll.startTime) {
            revert VotingNotStarted();
        }
        if (block.timestamp >= poll.endTime) {
            revert VotingEnded();
        }
        if (poll.finalized) {
            revert PollAlreadyFinalized();
        }
        if (_hasVoted[pollId][msg.sender]) {
            revert AlreadyVoted();
        }

        euint32 choice = FHE.fromExternal(encryptedChoice, inputProof);
        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);

        for (uint8 i = 0; i < poll.optionCount; i++) {
            ebool isSelected = FHE.eq(choice, FHE.asEuint32(i));
            euint32 increment = FHE.select(isSelected, one, zero);
            poll.counts[i] = FHE.add(poll.counts[i], increment);
            FHE.allowThis(poll.counts[i]);
        }

        _hasVoted[pollId][msg.sender] = true;
        emit VoteCast(pollId, msg.sender);
    }

    function finalizePoll(uint256 pollId) external {
        Poll storage poll = _getPoll(pollId);
        if (block.timestamp < poll.endTime) {
            revert PollNotEnded();
        }
        if (poll.finalized) {
            revert PollAlreadyFinalized();
        }

        poll.finalized = true;

        for (uint8 i = 0; i < poll.optionCount; i++) {
            FHE.makePubliclyDecryptable(poll.counts[i]);
            FHE.allow(poll.counts[i], msg.sender);
        }

        emit PollFinalized(pollId, msg.sender);
    }

    function publishResults(uint256 pollId, uint32[] calldata clearCounts, bytes calldata decryptionProof) external {
        Poll storage poll = _getPoll(pollId);
        if (!poll.finalized) {
            revert ResultsNotFinalized();
        }
        if (poll.published) {
            revert ResultsAlreadyPublished();
        }
        if (clearCounts.length != poll.optionCount) {
            revert InvalidResultsLength();
        }

        bytes32[] memory handles = new bytes32[](poll.optionCount);
        for (uint8 i = 0; i < poll.optionCount; i++) {
            handles[i] = euint32.unwrap(poll.counts[i]);
        }

        bytes memory cleartexts = abi.encode(clearCounts);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        for (uint8 i = 0; i < poll.optionCount; i++) {
            poll.publishedCounts[i] = clearCounts[i];
        }
        poll.published = true;

        emit ResultsPublished(pollId, msg.sender);
    }

    function getPollSummary(
        uint256 pollId
    )
        external
        view
        returns (
            string memory name,
            uint8 optionCount,
            uint64 startTime,
            uint64 endTime,
            address creator,
            bool finalized,
            bool published
        )
    {
        Poll storage poll = _getPoll(pollId);
        return (poll.name, poll.optionCount, poll.startTime, poll.endTime, poll.creator, poll.finalized, poll.published);
    }

    function getPollOptions(uint256 pollId) external view returns (string[] memory options) {
        Poll storage poll = _getPoll(pollId);
        return poll.options;
    }

    function getPollTimes(uint256 pollId) external view returns (uint64 startTime, uint64 endTime) {
        Poll storage poll = _getPoll(pollId);
        return (poll.startTime, poll.endTime);
    }

    function getEncryptedCounts(uint256 pollId) external view returns (euint32[4] memory counts, uint8 optionCount) {
        Poll storage poll = _getPoll(pollId);
        return (poll.counts, poll.optionCount);
    }

    function getEncryptedCount(uint256 pollId, uint8 index) external view returns (euint32) {
        Poll storage poll = _getPoll(pollId);
        if (index >= poll.optionCount) {
            revert InvalidOptionCount();
        }
        return poll.counts[index];
    }

    function getPublishedCounts(
        uint256 pollId
    ) external view returns (uint32[4] memory counts, uint8 optionCount, bool published) {
        Poll storage poll = _getPoll(pollId);
        return (poll.publishedCounts, poll.optionCount, poll.published);
    }

    function hasVoted(uint256 pollId, address voter) external view returns (bool) {
        if (pollId >= _polls.length) {
            return false;
        }
        return _hasVoted[pollId][voter];
    }

    function _getPoll(uint256 pollId) internal view returns (Poll storage poll) {
        if (pollId >= _polls.length) {
            revert InvalidPollId();
        }
        return _polls[pollId];
    }
}
