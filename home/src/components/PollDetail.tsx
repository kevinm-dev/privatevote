import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import type{ DecryptedResult, PollSummary } from './types';
import '../styles/PollDetail.css';

type PollDetailProps = {
  poll: PollSummary | null;
  now: number;
};

function formatTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString();
}

export function PollDetail({ poll, now }: PollDetailProps) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<DecryptedResult | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setSelectedOption(null);
    setActionError(null);
    setActionSuccess(null);
    setDecryptedResult(null);
  }, [poll?.id]);

  const pollId = poll ? BigInt(poll.id) : undefined;

  const { data: pollOptions } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPollOptions',
    args: pollId !== undefined ? [pollId] : undefined,
    query: {
      enabled: pollId !== undefined,
      refetchInterval: 10000,
    },
  });

  const { data: encryptedCounts } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedCounts',
    args: pollId !== undefined ? [pollId] : undefined,
    query: {
      enabled: pollId !== undefined,
      refetchInterval: 10000,
    },
  });

  const { data: publishedCounts } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPublishedCounts',
    args: pollId !== undefined ? [pollId] : undefined,
    query: {
      enabled: pollId !== undefined,
      refetchInterval: 10000,
    },
  });

  const { data: hasVoted } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasVoted',
    args: pollId !== undefined && address ? [pollId, address] : undefined,
    query: {
      enabled: pollId !== undefined && !!address,
      refetchInterval: 10000,
    },
  });

  const optionLabels = useMemo(() => (pollOptions ? Array.from(pollOptions) : []), [pollOptions]);
  const encryptedHandles = useMemo(() => {
    if (!encryptedCounts) return [];
    const counts = Array.from(encryptedCounts[0] ?? []);
    return poll ? counts.slice(0, poll.optionCount) : counts;
  }, [encryptedCounts, poll]);

  const publishedData = useMemo(() => {
    if (!publishedCounts || !poll) return null;
    const counts = Array.from(publishedCounts[0] ?? []);
    const published = Boolean(publishedCounts[2]);
    return {
      counts: counts
        .slice(0, poll.optionCount)
        .map((value) => (typeof value === 'bigint' ? Number(value) : value)),
      published,
    };
  }, [publishedCounts, poll]);

  if (!poll) {
    return (
      <div className="poll-detail">
        <div className="panel-header">
          <h3>Poll details</h3>
          <p>Select a poll to see encrypted results and cast a vote.</p>
        </div>
        <div className="empty-state">Pick a poll from the list to get started.</div>
      </div>
    );
  }

  const nowSeconds = now / 1000;
  const isLive = nowSeconds >= poll.startTime && nowSeconds < poll.endTime;
  const isEnded = nowSeconds >= poll.endTime;
  const isFinalized = poll.finalized;
  const isPublished = publishedData?.published ?? poll.published;

  const voteDisabled =
    !address || !instance || zamaLoading || !isLive || Boolean(hasVoted) || selectedOption === null || isVoting;
  const finalizeDisabled = !address || !signerPromise || !isEnded || isFinalized || isFinalizing;
  const decryptDisabled = !instance || !isFinalized || isDecrypting || encryptedHandles.length === 0;
  const publishDisabled =
    !address ||
    !signerPromise ||
    !isFinalized ||
    isPublished ||
    !decryptedResult ||
    isPublishing ||
    decryptedResult.counts.length === 0;

  const submitVote = async () => {
    if (!poll || selectedOption === null) return;
    if (!address || !signerPromise || !instance) {
      setActionError('Connect your wallet and wait for encryption to initialize.');
      return;
    }

    setIsVoting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .add32(selectedOption)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        setActionError('Signer not available.');
        return;
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.vote(poll.id, encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();
      setActionSuccess('Vote submitted. Your encrypted choice is recorded.');
    } catch (err) {
      console.error('Vote failed', err);
      setActionError(err instanceof Error ? err.message : 'Vote failed.');
    } finally {
      setIsVoting(false);
    }
  };

  const finalizePoll = async () => {
    if (!poll || !signerPromise) return;
    setIsFinalizing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const signer = await signerPromise;
      if (!signer) {
        setActionError('Signer not available.');
        return;
      }
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.finalizePoll(poll.id);
      await tx.wait();
      setActionSuccess('Poll finalized. Results are now publicly decryptable.');
    } catch (err) {
      console.error('Finalize failed', err);
      setActionError(err instanceof Error ? err.message : 'Finalize failed.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const decryptResults = async () => {
    if (!instance || encryptedHandles.length === 0) return;
    setIsDecrypting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await instance.publicDecrypt(encryptedHandles);
      const clearValues = result.clearValues as Record<string, bigint | number | string>;
      const counts = encryptedHandles.map((handle) => {
        const value = clearValues[handle];
        if (value === undefined || value === null) return 0;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'number') return value;
        return Number(value);
      });

      setDecryptedResult({
        counts,
        proof: result.decryptionProof as `0x${string}`,
      });
      setActionSuccess('Results decrypted locally. You can now publish them on-chain.');
    } catch (err) {
      console.error('Decrypt failed', err);
      setActionError(err instanceof Error ? err.message : 'Decrypt failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const publishResults = async () => {
    if (!poll || !decryptedResult || !signerPromise) return;
    setIsPublishing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const signer = await signerPromise;
      if (!signer) {
        setActionError('Signer not available.');
        return;
      }
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const clearCounts = decryptedResult.counts.map((value) => BigInt(value));
      const tx = await contract.publishResults(poll.id, clearCounts, decryptedResult.proof);
      await tx.wait();
      setActionSuccess('Results published on-chain with verification.');
    } catch (err) {
      console.error('Publish failed', err);
      setActionError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="poll-detail">
      <div className="panel-header">
        <h3>Poll details</h3>
        <p>Vote securely and reveal the verified tally after the timer ends.</p>
      </div>

      <div className="poll-meta-grid">
        <div>
          <span className="meta-label">Name</span>
          <p>{poll.name || `Poll #${poll.id}`}</p>
        </div>
        <div>
          <span className="meta-label">Window</span>
          <p>
            {formatTime(poll.startTime)} - {formatTime(poll.endTime)}
          </p>
        </div>
        <div>
          <span className="meta-label">Creator</span>
          <p>{poll.creator}</p>
        </div>
        <div>
          <span className="meta-label">Status</span>
          <p>{isPublished ? 'Published' : isFinalized ? 'Finalized' : isLive ? 'Live' : isEnded ? 'Ended' : 'Scheduled'}</p>
        </div>
      </div>

      <div className="poll-options">
        {optionLabels.length === 0 ? (
          <div className="empty-state">Options are loading...</div>
        ) : (
          optionLabels.map((option, index) => (
            <label
              key={`option-${index}`}
              className={`option-card ${selectedOption === index ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={`poll-${poll.id}`}
                value={index}
                checked={selectedOption === index}
                onChange={() => setSelectedOption(index)}
              />
              <span>{option}</span>
            </label>
          ))
        )}
      </div>

      <div className="action-grid">
        <button className="primary-button" onClick={submitVote} disabled={voteDisabled} type="button">
          {isVoting ? 'Submitting vote...' : hasVoted ? 'Vote recorded' : 'Submit encrypted vote'}
        </button>
        <button className="ghost-button" onClick={finalizePoll} disabled={finalizeDisabled} type="button">
          {isFinalizing ? 'Finalizing...' : 'Finalize poll'}
        </button>
        <button className="ghost-button" onClick={decryptResults} disabled={decryptDisabled} type="button">
          {isDecrypting ? 'Decrypting...' : 'Decrypt results'}
        </button>
        <button className="primary-button" onClick={publishResults} disabled={publishDisabled} type="button">
          {isPublishing ? 'Publishing...' : 'Publish results on-chain'}
        </button>
      </div>

      {(actionError || actionSuccess || zamaError || zamaLoading) && (
        <div className="form-messages">
          {actionError && <p className="form-message error">{actionError}</p>}
          {actionSuccess && <p className="form-message success">{actionSuccess}</p>}
          {zamaError && <p className="form-message error">{zamaError}</p>}
          {zamaLoading && <p className="form-message">Initializing encryption...</p>}
        </div>
      )}

      <div className="results-section">
        <h4>Results</h4>
        {isPublished && publishedData ? (
          <div className="results-grid">
            {publishedData.counts.map((count, index) => (
              <div key={`published-${index}`} className="result-card">
                <span>{optionLabels[index] ?? `Option ${index + 1}`}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : decryptedResult ? (
          <div className="results-grid">
            {decryptedResult.counts.map((count, index) => (
              <div key={`decrypted-${index}`} className="result-card pending">
                <span>{optionLabels[index] ?? `Option ${index + 1}`}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="results-placeholder">
            {isFinalized ? 'Decrypt results to reveal tallies.' : 'Results unlock after the poll ends.'}
          </p>
        )}
      </div>
    </div>
  );
}
