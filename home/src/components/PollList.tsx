import type{ PollSummary } from './types';
import '../styles/PollList.css';

type PollListProps = {
  polls: PollSummary[];
  selectedPollId: number | null;
  onSelect: (pollId: number) => void;
  now: number;
};

function formatTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString();
}

function statusForPoll(poll: PollSummary, nowMs: number) {
  const now = nowMs / 1000;
  if (poll.published) {
    return { label: 'Published', tone: 'published' };
  }
  if (poll.finalized) {
    return { label: 'Finalized', tone: 'finalized' };
  }
  if (now < poll.startTime) {
    return { label: 'Scheduled', tone: 'scheduled' };
  }
  if (now >= poll.endTime) {
    return { label: 'Ended', tone: 'ended' };
  }
  return { label: 'Live', tone: 'live' };
}

export function PollList({ polls, selectedPollId, onSelect, now }: PollListProps) {
  return (
    <div className="poll-list">
      <div className="panel-header">
        <h3>Polls</h3>
        <p>Select a poll to vote or reveal results.</p>
      </div>
      {polls.length === 0 ? (
        <div className="empty-state">
          <p>No polls yet. Create the first encrypted vote on the left.</p>
        </div>
      ) : (
        <div className="poll-cards">
          {polls.map((poll) => {
            const status = statusForPoll(poll, now);
            return (
              <button
                key={`poll-${poll.id}`}
                className={`poll-card ${selectedPollId === poll.id ? 'selected' : ''}`}
                onClick={() => onSelect(poll.id)}
                type="button"
              >
                <div className="poll-card-header">
                  <span className="poll-name">{poll.name || `Poll #${poll.id}`}</span>
                  <span className={`poll-status ${status.tone}`}>{status.label}</span>
                </div>
                <p className="poll-meta">{poll.optionCount} options | Created by {poll.creator.slice(0, 8)}...</p>
                <div className="poll-times">
                  <span>Start: {formatTime(poll.startTime)}</span>
                  <span>End: {formatTime(poll.endTime)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
