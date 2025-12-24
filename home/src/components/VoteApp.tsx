import { useEffect, useMemo, useState } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { Header } from './Header';
import { PollCreate } from './PollCreate';
import { PollDetail } from './PollDetail';
import { PollList } from './PollList';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import type{ PollSummary } from './types';
import '../styles/VoteApp.css';

export function VoteApp() {
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: pollCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'pollCount',
    query: {
      refetchInterval: 10000,
    },
  });

  const totalPolls = pollCount ? Number(pollCount) : 0;
  const pollIds = useMemo(() => Array.from({ length: totalPolls }, (_, index) => index), [totalPolls]);

  const summaries = useReadContracts({
    contracts: pollIds.map((pollId) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getPollSummary',
      args: [BigInt(pollId)],
    })),
    allowFailure: true,
    query: {
      enabled: pollIds.length > 0,
      refetchInterval: 10000,
    },
  });

  const polls = useMemo(() => {
    if (!summaries.data) return [];
    return summaries.data
      .map((entry, index) => {
        if (!entry || entry.status !== 'success') return null;
        const result = entry.result as unknown as readonly [
          string,
          number | bigint,
          number | bigint,
          number | bigint,
          string,
          boolean,
          boolean,
        ];
        const [name, optionCount, startTime, endTime, creator, finalized, published] = result;
        const poll: PollSummary = {
          id: pollIds[index],
          name,
          optionCount: Number(optionCount),
          startTime: Number(startTime),
          endTime: Number(endTime),
          creator,
          finalized,
          published,
        };
        return poll;
      })
      .filter((poll): poll is PollSummary => poll !== null);
  }, [pollIds, summaries.data]);

  useEffect(() => {
    if (pollIds.length === 0) {
      setSelectedPollId(null);
      return;
    }
    if (selectedPollId === null || selectedPollId >= pollIds.length) {
      setSelectedPollId(pollIds[pollIds.length - 1]);
    }
  }, [pollIds, selectedPollId]);

  const selectedPoll = polls.find((poll) => poll.id === selectedPollId) ?? null;

  const activeCount = polls.filter((poll) => {
    const current = now / 1000;
    return current >= poll.startTime && current < poll.endTime && !poll.finalized;
  }).length;
  const endedCount = polls.filter((poll) => now / 1000 >= poll.endTime && !poll.finalized).length;

  return (
    <div className="vote-app">
      <Header />

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-tag">Confidential ballot box</p>
          <h2 className="hero-title">Encrypted choices. Unbiased tallies.</h2>
          <p className="hero-description">
            Every vote is encrypted with Zama FHE. Results stay private until the poll ends, then become publicly
            decryptable and verifiable on-chain.
          </p>
          <div className="hero-badges">
            <span className="hero-badge">{totalPolls} polls</span>
            <span className="hero-badge">{activeCount} live</span>
            <span className="hero-badge">{endedCount} awaiting finalize</span>
          </div>
        </div>
        <div className="hero-card">
          <h3>How it works</h3>
          <ul>
            <li>Creators set options and a time window.</li>
            <li>Voters submit encrypted choices.</li>
            <li>Anyone can finalize and reveal tallies after time ends.</li>
            <li>Decrypted results can be published on-chain with proofs.</li>
          </ul>
        </div>
      </section>

      <section className="workspace">
        <div className="panel panel-create">
          <PollCreate />
        </div>
        <div className="panel panel-list">
          <PollList polls={polls} selectedPollId={selectedPollId} onSelect={setSelectedPollId} now={now} />
        </div>
        <div className="panel panel-detail">
          <PollDetail poll={selectedPoll} now={now} />
        </div>
      </section>
    </div>
  );
}
