import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="header-eyebrow">Encrypted voting protocol</p>
            <h1 className="header-title">PrivateVote</h1>
            <p className="header-subtitle">
              Create polls, vote with encrypted choices, and reveal results only after time ends.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
