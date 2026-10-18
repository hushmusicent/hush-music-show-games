import React, { useState, useEffect } from 'react';
import { GAME_META } from './HomeView';
import { Net, Voice, Auth } from '../../services/backend';
import { Sound } from '../../services/sound';

import { JeopardyGame } from '../games/JeopardyGame';
import { WheelGame } from '../games/WheelGame';
import { MillionaireGame } from '../games/MillionaireGame';
import { PriceGame } from '../games/PriceGame';
import { FeudGame } from '../games/FeudGame';
import { ChaseGame } from '../games/ChaseGame';
import { MatchGame } from '../games/MatchGame';
import { PasswordGame } from '../games/PasswordGame';
import { DealGame } from '../games/DealGame';
import { PressLuckGame } from '../games/PressLuckGame';
import { PyramidGame } from '../games/PyramidGame';
import { WeakestLinkGame } from '../games/WeakestLinkGame';
import { OneVs100Game } from '../games/OneVs100Game';
import { FifthGraderGame } from '../games/FifthGraderGame';
import { WhatsMyLineGame } from '../games/WhatsMyLineGame';
import { HollywoodGame } from '../games/HollywoodGame';

interface Props {
  gameId: string;
  onBack: () => void;
  onToast: (msg: string) => void;
  onVoiceStateChange: (active: boolean) => void;
}

export const GameView: React.FC<Props> = ({ gameId, onBack, onToast, onVoiceStateChange }) => {
  const [selectedMode, setSelectedMode] = useState<'cpu' | 'pvp' | null>(null);
  const [pvpState, setPvpState] = useState<'select' | 'waiting' | 'playing'>('select');
  const [joinCode, setJoinCode] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [chatLog, setChatLog] = useState<{ who: string; text: string }[]>([]);
  const [chatIn, setChatIn] = useState<string>('');
  const [voiceConnected, setVoiceConnected] = useState<boolean>(false);

  const meta = GAME_META[gameId] || { id: gameId, name: gameId, icon: '🎲' };

  useEffect(() => {
    return () => {
      Net.leave();
      Voice.leave();
      onVoiceStateChange(false);
    };
  }, []);

  const handleStartCpu = () => {
    Sound.click();
    setSelectedMode('cpu');
  };

  const handleCreateRoom = async () => {
    Sound.click();
    const code = await Net.create(gameId, 2);
    if (code) {
      setRoomCode(code);
      setPvpState('waiting');
      onToast(`Room created: ${code}`);

      Net.onUpdate((r) => {
        if (r.seats && r.seats.length >= 2) {
          setSelectedMode('pvp');
          setPvpState('playing');
        }
      });
    } else {
      onToast('Could not create room.');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    Sound.click();
    const ok = await Net.join(joinCode.trim());
    if (ok) {
      setRoomCode(joinCode.trim());
      await Net.push({ status: 'playing' });
      setSelectedMode('pvp');
      setPvpState('playing');
      onToast(`Joined room ${joinCode}!`);
    } else {
      onToast('Room not found or game already started');
    }
  };

  const handleSendChat = () => {
    if (!chatIn.trim()) return;
    Sound.click();
    const username = Auth.user?.username || 'You';
    const msg = { who: username, text: chatIn.trim() };
    setChatLog((prev) => [...prev, msg]);
    setChatIn('');

    if (Net.room) {
      Net.push({
        state: {
          ...(Net.room.state || {}),
          lastChat: msg,
        },
      });
    }
  };

  const handleJoinVoice = async () => {
    if (!roomCode) return;
    Sound.click();
    const ok = await Voice.join('shg-' + roomCode);
    if (ok) {
      setVoiceConnected(true);
      onVoiceStateChange(true);
      onToast('🎤 Voice connected — mic button in header');
    } else {
      onToast('Voice token server not configured. See Profile → Setup.');
    }
  };

  const renderGameComponent = () => {
    const props = {
      mode: selectedMode || 'cpu',
      onToast,
      onBack: () => setSelectedMode(null),
    };

    switch (gameId) {
      case 'jeopardy':
        return <JeopardyGame {...props} />;
      case 'wheel':
        return <WheelGame {...props} />;
      case 'millionaire':
        return <MillionaireGame {...props} />;
      case 'price':
        return <PriceGame {...props} />;
      case 'feud':
        return <FeudGame {...props} />;
      case 'chase':
        return <ChaseGame {...props} />;
      case 'matchgame':
        return <MatchGame {...props} />;
      case 'password':
        return <PasswordGame {...props} />;
      case 'deal':
        return <DealGame {...props} />;
      case 'pressluck':
        return <PressLuckGame {...props} />;
      case 'pyramid':
        return <PyramidGame {...props} />;
      case 'weakestlink':
        return <WeakestLinkGame {...props} />;
      case '1v100':
        return <OneVs100Game {...props} />;
      case 'fifthgrader':
        return <FifthGraderGame {...props} />;
      case 'whatsmline':
        return <WhatsMyLineGame {...props} />;
      case 'hollywood':
        return <HollywoodGame {...props} />;
      default:
        return <div className="card center"><div className="muted">Game not found</div></div>;
    }
  };

  if (selectedMode) {
    return (
      <div>
        {selectedMode === 'pvp' && (
          <div className="card" style={{ padding: '8px 12px', marginBottom: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill gold">🌐 Room #{roomCode}</span>
              {!voiceConnected && (
                <button className="btn small secondary" onClick={handleJoinVoice}>
                  🎤 Join Voice Chat
                </button>
              )}
            </div>
          </div>
        )}
        {renderGameComponent()}
      </div>
    );
  }

  return (
    <div>
      <button className="btn small secondary" onClick={onBack} style={{ marginBottom: 12 }}>
        ← All Games
      </button>

      <h2>{meta.icon} {meta.name}</h2>

      <div className="card center">
        <h3>Choose Mode</h3>
        <div className="row" style={{ margin: '14px 0' }}>
          <button className="btn grow" onClick={handleStartCpu}>
            🤖 Vs Computer
          </button>
          <button
            className="btn grow secondary"
            onClick={() => {
              Sound.click();
              setPvpState('select');
            }}
          >
            🌐 Vs Person (Online PvP)
          </button>
        </div>
      </div>

      {pvpState === 'select' && (
        <div className="card">
          <h3>Online PvP Room</h3>
          <div className="row" style={{ margin: '10px 0' }}>
            <button className="btn small grow" onClick={handleCreateRoom}>
              Create Room
            </button>
            <input
              className="grow"
              placeholder="4-digit code..."
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ margin: 0 }}
            />
            <button className="btn small" onClick={handleJoinRoom}>
              Join
            </button>
          </div>
          <div className="muted">
            Share the 4-digit code with your friend. Simultaneous quiz gameplay with real-time scoring!
          </div>
        </div>
      )}

      {pvpState === 'waiting' && (
        <div className="card center">
          <div className="turn-banner" style={{ fontSize: 16 }}>
            Room code: <span className="big" style={{ letterSpacing: 3 }}>{roomCode}</span><br />
            <span className="muted">Waiting for opponent to join...</span>
          </div>

          {!voiceConnected && (
            <button className="btn small secondary" onClick={handleJoinVoice} style={{ marginTop: 10 }}>
              🎤 Join Voice Chat Now
            </button>
          )}

          {/* Room chat */}
          <div style={{ marginTop: 14, textAlign: 'left' }}>
            <div className="muted" style={{ fontWeight: 700 }}>Room Chat</div>
            <div className="chatbox">
              {chatLog.length === 0 ? (
                <div className="muted" style={{ fontSize: 12 }}>No messages yet. Say hello!</div>
              ) : (
                chatLog.map((m, idx) => (
                  <div key={idx} className="msg" style={{ margin: '3px 0' }}>
                    <span className="who">{m.who}:</span> {m.text}
                  </div>
                ))
              )}
            </div>
            <div className="row">
              <input
                className="grow"
                placeholder="Say something to opponent..."
                value={chatIn}
                onChange={(e) => setChatIn(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button className="btn small" onClick={handleSendChat}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
