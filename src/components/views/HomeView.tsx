import React from 'react';
import { Wallet, DAILY_BONUS } from '../../services/backend';
import { Sound } from '../../services/sound';

export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  tags?: string;
  pvp?: boolean;
}

export const GAME_ORDER = [
  'jeopardy',
  'wheel',
  'millionaire',
  'price',
  'feud',
  'chase',
  'matchgame',
  'password',
  'whatsmline',
  'hollywood',
  'deal',
  'pressluck',
  'pyramid',
  'weakestlink',
  '1v100',
  'fifthgrader',
];

export const GAME_META: Record<string, GameMeta> = {
  jeopardy: { id: 'jeopardy', name: 'Jeopardy!', icon: '🧠', tags: 'Game Show', pvp: true },
  wheel: { id: 'wheel', name: 'Wheel of Fortune', icon: '🎡', tags: 'Game Show', pvp: true },
  millionaire: { id: 'millionaire', name: 'Millionaire', icon: '💰', tags: 'Game Show', pvp: true },
  price: { id: 'price', name: 'The Price Is Right', icon: '🏷️', tags: 'Game Show', pvp: true },
  feud: { id: 'feud', name: 'Family Feud', icon: '👪', tags: 'Game Show', pvp: true },
  chase: { id: 'chase', name: 'The Chase', icon: '🏃', tags: 'Game Show', pvp: true },
  matchgame: { id: 'matchgame', name: 'Match Game', icon: '✏️', tags: 'Game Show', pvp: true },
  password: { id: 'password', name: 'Password', icon: '🔑', tags: 'Game Show', pvp: true },
  whatsmline: { id: 'whatsmline', name: "What's My Line?", icon: '🕵️', tags: 'Game Show', pvp: true },
  hollywood: { id: 'hollywood', name: 'Hollywood Game Night', icon: '🎬', tags: 'Game Show', pvp: true },
  deal: { id: 'deal', name: 'Deal or No Deal', icon: '💼', tags: 'Game Show', pvp: true },
  pressluck: { id: 'pressluck', name: 'Press Your Luck', icon: '🍀', tags: 'Game Show', pvp: true },
  pyramid: { id: 'pyramid', name: '$100,000 Pyramid', icon: '🔺', tags: 'Game Show', pvp: true },
  weakestlink: { id: 'weakestlink', name: 'Weakest Link', icon: '🔗', tags: 'Game Show', pvp: true },
  '1v100': { id: '1v100', name: '1 vs 100', icon: '💯', tags: 'Game Show', pvp: true },
  fifthgrader: { id: 'fifthgrader', name: '5th Grader', icon: '🎒', tags: 'Game Show', pvp: true },
};

interface Props {
  onSelectGame: (gameId: string) => void;
  onToast: (msg: string) => void;
  canClaimDaily: boolean;
  onDailyClaimed: () => void;
}

export const HomeView: React.FC<Props> = ({
  onSelectGame,
  onToast,
  canClaimDaily,
  onDailyClaimed,
}) => {
  const handleClaimDaily = async () => {
    const success = await Wallet.claimDaily();
    if (success) {
      onToast(`🎁 Daily bonus claimed! +${DAILY_BONUS} ⭐`);
      onDailyClaimed();
    }
  };

  return (
    <div>
      <h2>Choose a game show</h2>
      <div className="grid">
        {GAME_ORDER.map((id) => {
          const g = GAME_META[id];
          return (
            <div
              key={id}
              className="gamecard"
              onClick={() => {
                Sound.ensure();
                Sound.click();
                onSelectGame(id);
              }}
            >
              <div className="e">{g.icon}</div>
              <div className="n">{g.name}</div>
              <div className="t">
                {g.tags || 'Game Show'}{g.pvp ? ' · 🌐' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {canClaimDaily && (
        <button className="btn" onClick={handleClaimDaily} style={{ marginTop: 14 }}>
          🎁 Claim daily bonus: +{DAILY_BONUS} ⭐
        </button>
      )}
    </div>
  );
};
