import React from 'react';
import { Sound } from '../services/sound';
import { Voice } from '../services/backend';

interface Props {
  points: number;
  soundMuted: boolean;
  onToggleSound: () => void;
  voiceActive: boolean;
  micMuted: boolean;
  onToggleMic: () => void;
}

export const Header: React.FC<Props> = ({
  points,
  soundMuted,
  onToggleSound,
  voiceActive,
  micMuted,
  onToggleMic,
}) => {
  return (
    <header>
      <div className="logo">🎙️ HUSH MUSIC SHOW GAMES</div>
      <div className="pill gold" title="Your points">
        ⭐ {points.toLocaleString()}
      </div>
      <button
        className={`iconbtn ${soundMuted ? 'off' : ''}`}
        onClick={onToggleSound}
        title={soundMuted ? 'Unmute game sounds' : 'Mute game sounds'}
      >
        {soundMuted ? '🔇' : '🔊'}
      </button>
      {voiceActive && (
        <button
          className={`iconbtn ${micMuted ? 'off' : ''}`}
          onClick={onToggleMic}
          title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {micMuted ? '🚫' : '🎤'}
        </button>
      )}
    </header>
  );
};
