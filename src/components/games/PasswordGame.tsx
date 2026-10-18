import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { jeopardyGrade, passwordPoints, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface PasswordItem {
  word: string;
  clues: string[];
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const PasswordGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [words, setWords] = useState<PasswordItem[]>([]);
  const [wordIdx, setWordIdx] = useState<number>(0);
  const [usedClues, setUsedClues] = useState<number>(0);
  const [myPoints, setMyPoints] = useState<number>(0);
  const [botPoints, setBotPoints] = useState<number>(0);
  const [guessVal, setGuessVal] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [botStealMsg, setBotStealMsg] = useState<string>('');

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const BOT_NAME = 'PasswordPete';

  useEffect(() => {
    const list = BANKS2.password as PasswordItem[];
    if (!list || list.length < 5) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 5);
        QuizPVP.hostSet(Net, picked);
        startPassword(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !words.length) {
            startPassword(d);
          }
          if (r.state && r.state.scores && QuizPVP.allDone(r.state, r.seats || [])) {
            const w = QuizPVP.winnerUid(r.state.scores);
            const myUid = Auth.user?.uid || 'u_local';
            const won = w === myUid;
            setIWonPvp(won);
            setPvpDone(true);
            QuizPVP.award(won);
          }
        });
      }
    } else {
      startPassword(pickN(list, 5));
    }
  }, []);

  const startPassword = (picked: PasswordItem[]) => {
    setWords(picked);
    setWordIdx(0);
    setUsedClues(0);
    setMyPoints(0);
    setBotPoints(0);
    setGuessVal('');
    setStatusMsg('');
    setBotStealMsg('');
    setGameOver(false);
  };

  const currentW = words[wordIdx];

  const handleRevealClue = () => {
    if (usedClues < 3) {
      Sound.click();
      setUsedClues((prev) => prev + 1);
    }
  };

  const handleGuess = () => {
    if (!currentW || !guessVal.trim()) return;
    Sound.click();
    const g = guessVal.trim();

    if (jeopardyGrade(g, currentW.word)) {
      const pts = passwordPoints(usedClues);
      setMyPoints((prev) => prev + pts);
      Sound.win();
      onToast(`✅ Correct! "${currentW.word}" +${pts} pts`);
      advanceWord(pts, 0);
    } else {
      Sound.lose();
      if (mode === 'cpu') {
        // Chance of bot steal
        if (Math.random() < 0.15 + 0.25 * usedClues) {
          const pts = passwordPoints(usedClues);
          setBotPoints((prev) => prev + pts);
          setBotStealMsg(`😈 ${BOT_NAME} stole it! The password was "${currentW.word}".`);
          return;
        }
        setStatusMsg(`❌ Wrong! ${BOT_NAME} also missed — reveal another clue or guess again.`);
      } else {
        setStatusMsg('❌ Wrong guess — reveal another clue or try again.');
      }
    }
  };

  const advanceWord = (_userGain: number, _botGain: number) => {
    setGuessVal('');
    setStatusMsg('');
    setBotStealMsg('');
    setUsedClues(0);

    if (wordIdx + 1 < words.length) {
      setWordIdx((prev) => prev + 1);
    } else {
      setGameOver(true);
      if (mode === 'pvp') {
        QuizPVP.submit(Net, myPoints);
      } else {
        if (myPoints > botPoints) {
          Sound.win();
          Wallet.recordWin('password').then((p) => onToast(`+${p} ⭐ banked!`));
        } else {
          Sound.lose();
        }
      }
    }
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🔑 Password</h2>

      {!gameOver && currentW && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill gold">Word {wordIdx + 1} of {words.length}</span>
            <span>
              You: <b>{myPoints} pts</b> {mode === 'cpu' && <>· {BOT_NAME}: <b>{botPoints} pts</b></>}
            </span>
          </div>

          <div className="muted" style={{ margin: '8px 0' }}>
            Clues revealed: {usedClues}/3 · Currently worth <b>{passwordPoints(usedClues)} pts</b>
          </div>

          {/* Clues box */}
          <div style={{ margin: '10px 0' }}>
            {currentW.clues.map((clue, i) => (
              <div key={i} className="msg" style={{ margin: '4px 0' }}>
                {i < usedClues ? (
                  <span>💡 Clue {i + 1}: <b>{clue}</b></span>
                ) : (
                  <span className="muted">🔒 Clue {i + 1} hidden</span>
                )}
              </div>
            ))}
          </div>

          {statusMsg && <div className="turn-banner" style={{ margin: '8px 0' }}>{statusMsg}</div>}

          {botStealMsg ? (
            <div className="card center">
              <div className="err" style={{ fontSize: 16 }}>{botStealMsg}</div>
              <button className="btn" onClick={() => advanceWord(0, passwordPoints(usedClues))} style={{ marginTop: 10 }}>
                Next Word →
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginTop: 10 }}>
                <input
                  placeholder="Guess the secret password..."
                  value={guessVal}
                  onChange={(e) => setGuessVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                  autoFocus
                />
                <button className="btn small" onClick={handleGuess}>Guess</button>
              </div>

              {usedClues < 3 && (
                <button className="btn secondary" onClick={handleRevealClue} style={{ marginTop: 8 }}>
                  🔍 Reveal Clue {usedClues + 1} of 3
                </button>
              )}
            </>
          )}
        </div>
      )}

      {gameOver && (
        <div className="card center">
          <h2>🏁 Password Results</h2>
          <div className="big" style={{ margin: '12px 0' }}>
            You: {myPoints} pts {mode === 'cpu' && <>| {BOT_NAME}: {botPoints} pts</>}
          </div>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win Password! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent scored more points.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          ) : (
            <div className="status">
              {myPoints > botPoints ? (
                <span className="ok">🏆 You win Password!</span>
              ) : (
                <span className="err">😞 {BOT_NAME} scored more points.</span>
              )}
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startPassword(words)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
