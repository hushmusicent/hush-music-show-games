import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { feudMatch, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface MatchPrompt {
  prompt: string;
  answers: string[];
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const MatchGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [prompts, setPrompts] = useState<MatchPrompt[]>([]);
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [userMatches, setUserMatches] = useState<number>(0);
  const [botMatches, setBotMatches] = useState<number>(0);
  const [inputVal, setInputVal] = useState<string>('');
  const [roundResults, setRoundResults] = useState<{ name: string; answer: string; matched: boolean }[] | null>(null);
  const [roundReport, setRoundReport] = useState<string>('');
  const [gameOver, setGameOver] = useState<boolean>(false);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const CELEBS = ['Glitzy Gail', 'Captain Chuckles', 'Madame Zsa', 'Funky Fred', 'Sassy Sue', 'Professor Brain'];
  const JUNK = ['pickles', 'my homework', 'a sandwich', 'Tuesday', 'the moon', 'cheese'];

  useEffect(() => {
    const list = BANKS2.matchgame as MatchPrompt[];
    if (!list || list.length < 2) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 2);
        QuizPVP.hostSet(Net, picked);
        startMatch(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !prompts.length) {
            startMatch(d);
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
      startMatch(pickN(list, 2));
    }
  }, []);

  const startMatch = (list: MatchPrompt[]) => {
    setPrompts(list);
    setRoundIdx(0);
    setUserMatches(0);
    setBotMatches(0);
    setInputVal('');
    setRoundResults(null);
    setRoundReport('');
    setGameOver(false);
  };

  const handleLockIn = () => {
    if (!inputVal.trim() || !prompts[roundIdx]) return;
    const p = prompts[roundIdx];
    const userAns = inputVal.trim();
    Sound.click();

    const celebAnswers = CELEBS.map(() => {
      if (Math.random() < 0.7) {
        return p.answers[Math.floor(Math.random() * p.answers.length)];
      }
      return JUNK[Math.floor(Math.random() * JUNK.length)];
    });

    let matches = 0;
    const results = celebAnswers.map((ca, i) => {
      const isMatch = feudMatch(ca, userAns);
      if (isMatch) matches++;
      return { name: CELEBS[i], answer: ca, matched: isMatch };
    });

    const newTotalUser = userMatches + matches;
    setUserMatches(newTotalUser);
    setRoundResults(results);

    let report = `You matched ${matches} of 6 celebrities!`;
    if (mode === 'cpu') {
      const botAns = p.answers[Math.floor(Math.random() * p.answers.length)];
      let bm = 0;
      celebAnswers.forEach((ca) => {
        if (feudMatch(ca, botAns)) bm++;
      });
      setBotMatches((prev) => prev + bm);
      report += ` Rival answered "${botAns}" and matched ${bm}.`;
    }
    setRoundReport(report);

    if (matches > 0) Sound.win();
    else Sound.lose();
  };

  const handleNextRound = () => {
    Sound.click();
    setInputVal('');
    setRoundResults(null);
    setRoundReport('');

    if (roundIdx + 1 < prompts.length) {
      setRoundIdx((prev) => prev + 1);
    } else {
      setGameOver(true);
      if (mode === 'pvp') {
        QuizPVP.submit(Net, userMatches);
      } else {
        if (userMatches > botMatches) {
          Sound.win();
          Wallet.recordWin('matchgame').then((p) => onToast(`+${p} ⭐ banked!`));
        } else {
          Sound.lose();
        }
      }
    }
  };

  const currentP = prompts[roundIdx];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>✏️ Match Game</h2>

      {!gameOver && currentP && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill gold">Round {roundIdx + 1} of {prompts.length}</span>
            <span>Your Total Matches: <b>{userMatches}</b></span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {currentP.prompt}
          </div>

          {!roundResults ? (
            <div>
              <div className="muted">Fill in the blank — try to match what the celebrity panel writes!</div>
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  placeholder="Your blank..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLockIn()}
                  autoFocus
                />
                <button className="btn small" onClick={handleLockIn}>Lock In</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="turn-banner" style={{ margin: '8px 0' }}>{roundReport}</div>
              <table className="lb" style={{ margin: '10px 0' }}>
                <tbody>
                  {roundResults.map((res) => (
                    <tr key={res.name}>
                      <td style={{ width: 30 }}>{res.matched ? '✅' : '❌'}</td>
                      <td><b>{res.name}:</b> "{res.answer}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn" onClick={handleNextRound}>
                {roundIdx + 1 < prompts.length ? 'Next Round →' : 'View Final Match Results'}
              </button>
            </div>
          )}
        </div>
      )}

      {gameOver && (
        <div className="card center">
          <h2>🏁 Match Game Results</h2>
          <div className="big" style={{ margin: '12px 0' }}>
            You: {userMatches} matches {mode === 'cpu' && <>| Rival: {botMatches} matches</>}
          </div>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win Match Game! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent matched more celebrities.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          ) : (
            <div className="status">
              {userMatches > botMatches ? (
                <span className="ok">🏆 You win Match Game!</span>
              ) : (
                <span className="err">😞 Rival matched more celebrities.</span>
              )}
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startMatch(prompts)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
