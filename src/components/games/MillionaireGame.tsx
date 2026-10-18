import React, { useState, useEffect } from 'react';
import { BANKS1, MillionaireQuestion } from '../../data/banks1';
import { millionaireLadder, millionaireFifty, money, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const MillionaireGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [questions, setQuestions] = useState<MillionaireQuestion[]>([]);
  const [level, setLevel] = useState<number>(0);
  const [banked, setBanked] = useState<number>(0);
  const [lifelines, setLifelines] = useState<{ f: boolean; p: boolean; a: boolean }>({ f: false, p: false, a: false });
  const [disabledChoices, setDisabledChoices] = useState<number[]>([]);
  const [friendHint, setFriendHint] = useState<string>('');
  const [audiencePoll, setAudiencePoll] = useState<{ text: string; pct: number }[] | null>(null);
  const [gameState, setGameState] = useState<'playing' | 'correct_pause' | 'game_over'>('playing');
  const [gameOverReason, setGameOverReason] = useState<'won' | 'walked' | 'wrong'>('wrong');
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [pvpScores, setPvpScores] = useState<Record<string, number>>({});
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const LADDER = millionaireLadder();

  useEffect(() => {
    const list = BANKS1.millionaire;
    if (!list || !list.length) return;

    const buildQuiz = () => {
      let qs: MillionaireQuestion[] = [];
      for (let t = 1; t <= 3; t++) {
        const pool = list.filter((x) => x.tier === t);
        qs = qs.concat(pickN(pool, 5));
      }
      if (qs.length < 15) qs = pickN(list, 15);
      return qs;
    };

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const qs = buildQuiz();
        QuizPVP.hostSet(Net, qs);
        startGame(qs);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !questions.length) {
            startGame(d);
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
      startGame(buildQuiz());
    }
  }, []);

  const startGame = (qs: MillionaireQuestion[]) => {
    setQuestions(qs);
    setLevel(0);
    setBanked(0);
    setLifelines({ f: false, p: false, a: false });
    setDisabledChoices([]);
    setFriendHint('');
    setAudiencePoll(null);
    setGameState('playing');
  };

  const currentQ = questions[level];
  const currentVal = LADDER[level] || 1000000;

  const handleSelectAnswer = (idx: number) => {
    if (!currentQ || gameState !== 'playing') return;
    Sound.click();

    if (idx === currentQ.correct) {
      const nextBanked = currentVal;
      Sound.win();
      setBanked(nextBanked);
      if (level + 1 >= 15) {
        endGame('won', nextBanked);
      } else {
        setGameState('correct_pause');
      }
    } else {
      Sound.lose();
      const safe = level > 9 ? 32000 : level > 4 ? 1000 : 0;
      setBanked(safe);
      endGame('wrong', safe);
    }
  };

  const handleNextQuestion = () => {
    Sound.click();
    setLevel((prev) => prev + 1);
    setDisabledChoices([]);
    setFriendHint('');
    setAudiencePoll(null);
    setGameState('playing');
  };

  const handleWalkAway = () => {
    Sound.click();
    endGame('walked', banked);
  };

  const handleFiftyFifty = () => {
    if (!currentQ || lifelines.f) return;
    Sound.click();
    setLifelines((prev) => ({ ...prev, f: true }));
    const keep = millionaireFifty(currentQ.choices, currentQ.correct);
    const disable = [0, 1, 2, 3].filter((i) => !keep.includes(i));
    setDisabledChoices(disable);
  };

  const handlePhoneFriend = () => {
    if (!currentQ || lifelines.p) return;
    Sound.click();
    setLifelines((prev) => ({ ...prev, p: true }));
    const acc = currentQ.tier === 1 ? 0.85 : currentQ.tier === 2 ? 0.65 : 0.45;
    const pick = Math.random() < acc ? currentQ.correct : Math.floor(Math.random() * 4);
    setFriendHint(`"I'm pretty confident the answer is ${'ABCD'[pick]}!"`);
  };

  const handleAskAudience = () => {
    if (!currentQ || lifelines.a) return;
    Sound.click();
    setLifelines((prev) => ({ ...prev, a: true }));
    const pct = [0, 0, 0, 0];
    const main = 45 + Math.floor(Math.random() * 25);
    let rest = 100 - main;
    const others = [0, 1, 2, 3].filter((i) => i !== currentQ.correct);
    pct[currentQ.correct] = main;
    others.forEach((i2, k) => {
      const p = k === others.length - 1 ? rest : Math.floor(Math.random() * (rest + 1));
      pct[i2] = p;
      rest -= p;
    });

    const sum = pct.reduce((a, b) => a + b, 0) || 1;
    const result = currentQ.choices.map((t, i) => ({
      text: `${'ABCD'[i]}: ${t}`,
      pct: Math.round((pct[i] / sum) * 100),
    }));
    setAudiencePoll(result);
  };

  const endGame = (reason: 'won' | 'walked' | 'wrong', finalAmount: number) => {
    setGameOverReason(reason);
    setGameState('game_over');

    const score = level * 10000 + finalAmount;
    if (mode === 'pvp') {
      QuizPVP.submit(Net, score);
    } else {
      if (reason === 'won') {
        Wallet.recordWin('millionaire').then((p) => onToast(`+${p} ⭐ banked!`));
      }
    }
  };

  if (!currentQ) {
    return <div className="card center"><div className="muted">Loading Millionaire...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>💰 Who Wants to Be a Millionaire</h2>

      {gameState === 'playing' && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="pill gold">Question {level + 1} of 15</span>
              <span className="big" style={{ fontSize: 20, color: 'var(--gold2)' }}>
                {money(currentVal)}
              </span>
            </div>

            <div className="big" style={{ fontSize: 18, margin: '12px 0' }}>
              {currentQ.q}
            </div>

            {/* Answer buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              {currentQ.choices.map((ch, idx) => {
                const disabled = disabledChoices.includes(idx);
                return (
                  <button
                    key={idx}
                    className="btn secondary"
                    disabled={disabled}
                    onClick={() => handleSelectAnswer(idx)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      opacity: disabled ? 0.25 : 1,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <b style={{ color: 'var(--gold2)', marginRight: 8 }}>{'ABCD'[idx]}:</b> {ch}
                  </button>
                );
              })}
            </div>

            {/* Lifelines */}
            <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn small" disabled={lifelines.f} onClick={handleFiftyFifty}>
                50:50
              </button>
              <button className="btn small" disabled={lifelines.p} onClick={handlePhoneFriend}>
                📞 Phone a Friend
              </button>
              <button className="btn small" disabled={lifelines.a} onClick={handleAskAudience}>
                👥 Ask Audience
              </button>
              <button className="btn small secondary" onClick={handleWalkAway}>
                Walk Away ({money(banked)})
              </button>
            </div>

            {/* Lifeline results */}
            {friendHint && (
              <div className="msg" style={{ marginTop: 10 }}>
                <span className="who">📞 Phone-a-Friend:</span> {friendHint}
              </div>
            )}

            {audiencePoll && (
              <div className="msg" style={{ marginTop: 10 }}>
                <span className="who">👥 Audience Poll:</span>
                <div style={{ marginTop: 4 }}>
                  {audiencePoll.map((item, idx) => (
                    <div key={idx} style={{ margin: '3px 0', fontSize: 13 }}>
                      <span>{item.text} </span>
                      <span
                        style={{
                          display: 'inline-block',
                          height: 8,
                          backgroundColor: 'var(--gold)',
                          width: `${item.pct * 1.5}px`,
                          borderRadius: 3,
                          margin: '0 6px',
                        }}
                      />
                      <b>{item.pct}%</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="muted center" style={{ marginTop: 6 }}>
            Safe havens: <b>$1,000</b> (Q5) · <b>$32,000</b> (Q10)
          </div>
        </>
      )}

      {gameState === 'correct_pause' && (
        <div className="card center">
          <div className="big" style={{ color: 'var(--green)' }}>✅ Correct!</div>
          <div className="status" style={{ margin: '10px 0' }}>
            Current Bank: <b style={{ color: 'var(--gold2)' }}>{money(banked)}</b>
          </div>
          <button className="btn" onClick={handleNextQuestion}>
            Next Question for {money(LADDER[level + 1])} →
          </button>
        </div>
      )}

      {gameState === 'game_over' && (
        <div className="card center">
          {gameOverReason === 'won' && (
            <>
              <div className="big" style={{ color: 'var(--gold2)' }}>🏆 $1,000,000!</div>
              <div className="ok" style={{ fontSize: 18, margin: '8px 0' }}>YOU ARE A MILLIONAIRE!</div>
            </>
          )}

          {gameOverReason === 'walked' && (
            <>
              <div className="big">💰 Walked Away</div>
              <div className="status">
                You walked away with <b style={{ color: 'var(--gold2)' }}>{money(banked)}</b>!
              </div>
            </>
          )}

          {gameOverReason === 'wrong' && (
            <>
              <div className="big">❌ Game Over</div>
              <div className="status">
                Wrong answer. You leave with <b style={{ color: 'var(--gold2)' }}>{money(banked)}</b>.
              </div>
            </>
          )}

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status" style={{ marginTop: 12 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You win the Millionaire match! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent reached a higher tier.</span>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>Waiting for opponent...</div>
            )
          ) : null}

          <button className="btn" style={{ marginTop: 16 }} onClick={() => startGame(questions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
