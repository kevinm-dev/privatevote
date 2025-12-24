import { useMemo, useState, type FormEvent } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/PollCreate.css';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

function toDateTimeInputValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function PollCreate() {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();

  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startTime, setStartTime] = useState(() => toDateTimeInputValue(new Date()));
  const [endTime, setEndTime] = useState(() => toDateTimeInputValue(new Date(Date.now() + 3600000)));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAddOption = options.length < MAX_OPTIONS;
  const canRemoveOption = options.length > MIN_OPTIONS;

  const cleanedOptions = useMemo(
    () => options.map((option) => option.trim()).filter((option) => option.length > 0),
    [options],
  );

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, idx) => (idx === index ? value : option)));
  };

  const addOption = () => {
    if (canAddOption) {
      setOptions((prev) => [...prev, '']);
    }
  };

  const removeOption = (index: number) => {
    if (!canRemoveOption) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submitPoll = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!address || !signerPromise) {
      setError('Connect your wallet to create a poll.');
      return;
    }

    if (!name.trim()) {
      setError('Poll name is required.');
      return;
    }

    if (cleanedOptions.length < MIN_OPTIONS || cleanedOptions.length > MAX_OPTIONS) {
      setError('Polls must have between 2 and 4 options.');
      return;
    }

    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError('Provide a valid time window.');
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await signerPromise;
      if (!signer) {
        setError('Wallet signer is not available.');
        return;
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPoll(name.trim(), cleanedOptions, start, end);
      await tx.wait();

      setSuccess('Poll created. It will appear in the list shortly.');
      setName('');
      setOptions(['', '']);
    } catch (err) {
      console.error('Failed to create poll', err);
      setError(err instanceof Error ? err.message : 'Failed to create poll.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="poll-create">
      <div className="panel-header">
        <h3>Create a poll</h3>
        <p>Set a name, 2-4 options, and a voting window.</p>
      </div>
      <form onSubmit={submitPoll} className="poll-create-form">
        <label className="field">
          <span>Poll name</span>
          <input
            type="text"
            value={name}
            placeholder="e.g. Q4 roadmap pick"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <div className="field-group">
          <span>Options</span>
          <div className="option-list">
            {options.map((option, index) => (
              <div className="option-row" key={`option-${index}`}>
                <input
                  type="text"
                  value={option}
                  placeholder={`Option ${index + 1}`}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={!canRemoveOption}
                  className="ghost-button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addOption} className="ghost-button" disabled={!canAddOption}>
            Add option
          </button>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Start time</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>End time</span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </label>
        </div>

        {error && <p className="form-message error">{error}</p>}
        {success && <p className="form-message success">{success}</p>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating poll...' : 'Create poll'}
        </button>
      </form>
    </div>
  );
}
