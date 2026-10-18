import React, { useState, useEffect, useRef } from 'react';
import { BANKS1, JeopardySet, JeopardyClue } from '../../data/banks1';
import { jeopardyGrade, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const JeopardyGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [boardSet, setBoardSet] = useState<JeopardySet | null>(null);
  const [cluesDone, setCluesDone] = useState<Record<number, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({ You: 0 });
  const [bots, setBots] = useState<string[]>(['BuzzerBetty', 'DailyDouble']);
  const [dailyDoubleIndex, setDailyDoubleIndex] = useState<number>(-1);
  const [phase, setPhase] = useState<'board' | 'dd' | 'clue' | 'reveal' | 'final_wager' | 'final_q' | 'game_over'>('board');
  const [activeClue, setActiveClue] = useState<{ clue: JeopardyClue; val: number; index: number } | null>(null);
  const [wager, setWager] = useState<number>(200);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [revealMsg, setRevealMsg] = useState<{ msg: string; answer: string }>({ msg: '', answer: '' });
  const [timerSecs, setTimerSecs] = useState<number>(12);
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [pvpScores, setPvpScores] = useState<Record<string, number>>({});
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const sets = BANKS1.jeopardy.sets;
    if (!sets || !sets.length) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = sets[Math.floor(Math.random() * sets.length)];
        QuizPVP.hostSet(Net, picked);
        initBoard(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !boardSet) {
            initBoard(d);
          }
          if (r.state && r.state.scores && QuizPVP.allDone(r.state, r.seats || [])) {
            const w = QuizPVP.winnerUid(r.state.scores);
            const myUid = Auth.user?.uid || 'u_local';
            const won = w === myUid;
            setIWonPvp(won);
            setPvpScores(r.state.scores);
            setPvpDone(true);
            QuizPVP.award(won);
          }
        });
      }
    } else {
      const picked = sets[Math.floor(Math.random() * sets.length)];
      initBoard(picked);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initBoard = (set: JeopardySet) => {
    setBoardSet(set);
    setScores(mode === 'cpu' ? { You: 0, BuzzerBetty: 0, DailyDouble: 0 } : { You: 0 });
    setBots(['BuzzerBetty', 'DailyDouble']);
    setDailyDoubleIndex(Math.floor(Math.random() * set.clues.length));
    setCluesDone({});
    setPhase('board');
  };

  const handleSelectClue = (clue: JeopardyClue, index: number) => {
    if (cluesDone[index]) return;
    Sound.click();
    if (index === dailyDoubleIndex) {
      const maxW = Math.max(1000, scores.You);
      setWager(Math.min(500, maxW));
      setActiveClue({ clue, val: clue.v, index });
      setPhase('dd');
    } else {
      startClue(clue, clue.v, index);
    }
  };

  const startClue = (clue: JeopardyClue, val: number, index: number) => {
    setActiveClue({ clue, val, index });
    setUserAnswer('');
    setTimerSecs(12);
    setPhase('clue');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAnswerTimeout(clue, val, index);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswerTimeout = (clue: JeopardyClue, val: number, index: number) => {
    botBuzz(clue, val, index, '⏱ Time is up!');
  };

  const handleUserAnswer = () => {
    if (!activeClue) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const { clue, val, index } = activeClue;
    const ok = jeopardyGrade(userAnswer, clue.a);

    if (ok) {
      setScores((prev) => ({ ...prev, You: prev.You + val }));
      setCluesDone((prev) => ({ ...prev, [index]: true }));
      Sound.win();
      setRevealMsg({ msg: `✅ Correct! +${money(val)}`, answer: clue.a });
      setPhase('reveal');
    } else {
      botBuzz(clue, val, index, `❌ Incorrect! -${money(val)}`);
    }
  };

  const botBuzz = (clue: JeopardyClue, val: number, index: number, userPrefixMsg: string) => {
    setCluesDone((prev) => ({ ...prev, [index]: true }));

    if (mode === 'cpu') {
      const order = [...bots].sort(() => Math.random() - 0.5);
      const p = Math.min(0.9, Math.max(0.3, 1.0 - val / 1400));
      const acc = Math.min(0.92, Math.max(0.35, 0.95 - val / 1300));

      for (const bot of order) {
        if (Math.random() < p) {
          if (Math.random() < acc) {
            setScores((prev) => ({ ...prev, [bot]: prev[bot] + val, You: prev.You - (userAnswer ? val : 0) }));
            Sound.lose();
            setRevealMsg({
              msg: `${userPrefixMsg} 🔔 ${bot} buzzes in — RIGHT! +${money(val)} to them.`,
              answer: clue.a,
            });
            setPhase('reveal');
            return;
          } else {
            setScores((prev) => ({ ...prev, [bot]: prev[bot] - val }));
          }
        }
      }
    }

    setScores((prev) => ({ ...prev, You: prev.You - val }));
    Sound.lose();
    setRevealMsg({ msg: `${userPrefixMsg} Minus ${money(val)}.`, answer: clue.a });
    setPhase('reveal');
  };

  const handleContinueFromReveal = () => {
    Sound.click();
    const remaining = boardSet?.clues.some((_, i) => !cluesDone[i]);
    if (remaining) {
      setPhase('board');
    } else {
      // Start Final Jeopardy
      const maxW = Math.max(1000, scores.You);
      setWager(Math.min(500, maxW));
      setPhase('final_wager');
    }
  };

  const handleFinalWager = () => {
    Sound.click();
    setUserAnswer('');
    setPhase('final_q');
  };

  const handleFinalAnswer = () => {
    if (!boardSet) return;
    const ok = jeopardyGrade(userAnswer, boardSet.final.a);
    const finalScores = { ...scores };
    finalScores.You = ok ? finalScores.You + wager : finalScores.You - wager;

    if (mode === 'cpu') {
      bots.forEach((b) => {
        const bw = Math.floor(Math.random() * Math.max(1000, finalScores[b]));
        finalScores[b] += Math.random() < 0.55 ? bw : -Math.min(bw, Math.max(0, finalScores[b]));
      });
    }

    setScores(finalScores);
    if (ok) Sound.win();
    else Sound.lose();

    if (mode === 'pvp') {
      QuizPVP.submit(Net, finalScores.You);
      setPhase('game_over');
    } else {
      const names = Object.keys(finalScores);
      let win = names[0];
      names.forEach((n) => {
        if (finalScores[n] > finalScores[win]) win = n;
      });
      const iWon = win === 'You' && finalScores.You > 0;
      if (iWon) {
        Wallet.recordWin('jeopardy').then((p) => onToast(`+${p} ⭐ banked!`));
      }
      setPhase('game_over');
    }
  };

  if (!boardSet) {
    return <div className="card center"><div className="muted">Loading board...</div></div>;
  }

  const values = [200, 400, 600, 800, 1000];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🧠 Jeopardy! — {boardSet.name}</h2>

      {/* Score line */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="status" style={{ display: 'flex', gap: 12, justifyContent: 'space-around', margin: 0 }}>
          {Object.keys(scores).map((k) => (
            <span key={k} style={{ color: k === 'You' ? 'var(--gold2)' : 'var(--text)' }}>
              <b>{k}:</b> {money(scores[k])}
            </span>
          ))}
        </div>
      </div>

      {phase === 'board' && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {boardSet.categories.map((cat, ci) => (
              <div key={ci} className="muted center" style={{ fontSize: 10, fontWeight: 700, padding: '4px 0' }}>
                {cat}
              </div>
            ))}
            {values.map((val) =>
              [0, 1, 2, 3, 4, 5].map((col) => {
                const idx = boardSet.clues.findIndex((c) => c.c === col && c.v === val);
                if (idx < 0) return <div key={`${col}-${val}`} />;
                const clue = boardSet.clues[idx];
                const done = cluesDone[idx];
                return (
                  <button
                    key={`${col}-${val}`}
                    className="btn small"
                    disabled={done}
                    onClick={() => handleSelectClue(clue, idx)}
                    style={{
                      margin: 2,
                      padding: '10px 1px',
                      fontSize: 12,
                      background: done ? 'var(--bg2)' : undefined,
                      color: done ? 'var(--muted)' : undefined,
                    }}
                  >
                    {done ? '✓' : `$${val}`}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {phase === 'dd' && activeClue && (
        <div className="card center">
          <h2>⭐ DAILY DOUBLE!</h2>
          <div className="muted">Wager up to {money(Math.max(1000, scores.You))}</div>
          <input
            type="number"
            value={wager}
            onChange={(e) => setWager(Math.max(5, Math.min(Math.max(1000, scores.You), parseInt(e.target.value) || 0)))}
            style={{ maxWidth: 200, margin: '12px auto' }}
          />
          <button className="btn" onClick={() => startClue(activeClue.clue, wager, activeClue.index)}>
            Lock In Wager
          </button>
        </div>
      )}

      {phase === 'clue' && activeClue && (
        <div className="card">
          <div className="muted" style={{ fontWeight: 700 }}>
            {boardSet.categories[activeClue.clue.c]} — {money(activeClue.val)}
          </div>
          <div className="big" style={{ fontSize: 19, margin: '12px 0' }}>
            {activeClue.clue.q}
          </div>
          <input
            placeholder="What/Who is..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserAnswer()}
            autoFocus
          />
          <div className="status">⏱ <span>{timerSecs}s</span></div>
          <button className="btn" onClick={handleUserAnswer}>Submit Answer</button>
        </div>
      )}

      {phase === 'reveal' && (
        <div className="card center">
          <div className="status" style={{ fontSize: 18 }}>{revealMsg.msg}</div>
          <div className="muted" style={{ margin: '8px 0' }}>Correct Answer: <b>{revealMsg.answer}</b></div>
          <button className="btn" onClick={handleContinueFromReveal}>Continue</button>
        </div>
      )}

      {phase === 'final_wager' && (
        <div className="card center">
          <h2>🏁 Final Jeopardy</h2>
          <div className="muted">Category: <b>{boardSet.final.cat}</b></div>
          <div className="muted" style={{ margin: '8px 0' }}>
            Wager up to {money(Math.max(1000, scores.You))}:
          </div>
          <input
            type="number"
            value={wager}
            onChange={(e) => setWager(Math.max(0, Math.min(Math.max(1000, scores.You), parseInt(e.target.value) || 0)))}
            style={{ maxWidth: 200, margin: '12px auto' }}
          />
          <button className="btn" onClick={handleFinalWager}>Lock In Wager</button>
        </div>
      )}

      {phase === 'final_q' && (
        <div className="card">
          <h2>🏁 {boardSet.final.cat}</h2>
          <div className="big" style={{ fontSize: 19, margin: '12px 0' }}>
            {boardSet.final.q}
          </div>
          <input
            placeholder="Final answer..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFinalAnswer()}
            autoFocus
          />
          <button className="btn" onClick={handleFinalAnswer}>Submit Final Answer</button>
        </div>
      )}

      {phase === 'game_over' && (
        <div className="card center">
          <h2>🏁 Final Results</h2>
          <table className="lb">
            <thead>
              <tr>
                <th>Player</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {mode === 'pvp' && pvpDone
                ? Object.keys(pvpScores).map((uid) => (
                    <tr key={uid} className={uid === Auth.user?.uid ? 'me' : ''}>
                      <td>{uid === Auth.user?.uid ? 'You' : 'Opponent'}</td>
                      <td>{money(pvpScores[uid])}</td>
                    </tr>
                  ))
                : Object.keys(scores).map((k) => (
                    <tr key={k} className={k === 'You' ? 'me' : ''}>
                      <td>{k}</td>
                      <td>{money(scores[k])}</td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status" style={{ marginTop: 12 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You win the PvP Match! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent scored higher.</span>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>Waiting for opponent to finish...</div>
            )
          ) : (
            <div className="status" style={{ marginTop: 12 }}>
              {scores.You > Math.max(scores.BuzzerBetty || 0, scores.DailyDouble || 0) && scores.You > 0 ? (
                <span className="ok">🏆 You win Jeopardy! Payout banked.</span>
              ) : (
                <span className="err">😞 You didn't finish first this time.</span>
              )}
            </div>
          )}

          <button className="btn" style={{ marginTop: 12 }} onClick={() => initBoard(boardSet)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
