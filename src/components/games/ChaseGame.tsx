import React, { useState, useEffect, useRef } from 'react';
import { BANKS2 } from '../../data/banks2';
import { chaseBotCorrect, money, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface ChaseQ {
  q: string;
  choices: string[];
  correct: number;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const ChaseGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [questions, setQuestions] = useState<ChaseQ[]>([]);
  const [phase, setPhase] = useState<'builder' | 'chase_board' | 'final_chase_prep' | 'final_chase_run' | 'done'>('builder');

  // Builder
  const [builderQIndex, setBuilderQIndex] = useState<number>(0);
  const [builderScore, setBuilderScore] = useState<number>(0);
  const [builderTimer, setBuilderTimer] = useState<number>(60);

  // Chase Board
  const [playerStep, setPlayerStep] = useState<number>(4);
  const [chaserStep, setChaserStep] = useState<number>(7);
  const [boardTurn, setBoardTurn] = useState<number>(0); // 0 = player, 1 = chaser
  const [boardFeedback, setBoardFeedback] = useState<string>('');
  const [chaseDifficulty, setChaseDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Final Chase
  const [finalHeadStart, setFinalHeadStart] = useState<number>(0);
  const [finalTimer, setFinalTimer] = useState<number>(60);
  const [chaserCatchUp, setChaserCatchUp] = useState<number>(0);
  const [finalResult, setFinalResult] = useState<string>('');

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const list = BANKS2.chase as ChaseQ[];
    if (!list || list.length < 15) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 15);
        QuizPVP.hostSet(Net, picked);
        startChase(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !questions.length) {
            startChase(d);
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
      startChase(pickN(list, 20));
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startChase = (qs: ChaseQ[]) => {
    setQuestions(qs);
    setBuilderQIndex(0);
    setBuilderScore(0);
    setBuilderTimer(60);
    setPhase('builder');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setBuilderTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleBuilderComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleBuilderAnswer = (choiceIdx: number) => {
    const q = questions[builderQIndex % questions.length];
    if (choiceIdx === q.correct) {
      setBuilderScore((prev) => prev + 1);
      Sound.win();
    } else {
      Sound.lose();
    }
    setBuilderQIndex((prev) => prev + 1);
  };

  const handleBuilderComplete = () => {
    const diff = builderScore > 8 ? 'hard' : builderScore > 5 ? 'medium' : 'easy';
    setChaseDifficulty(diff);
    setPlayerStep(4);
    setChaserStep(7);
    setBoardTurn(0);
    setBoardFeedback('');
    setPhase('chase_board');
  };

  /* Head-to-head board */
  const handleBoardPlayerAnswer = (choiceIdx: number) => {
    const q = questions[builderQIndex % questions.length];
    setBuilderQIndex((prev) => prev + 1);

    if (choiceIdx === q.correct) {
      const nextP = playerStep - 1;
      setPlayerStep(nextP);
      Sound.win();
      setBoardFeedback('✅ Correct! You step closer to the bank.');

      if (nextP <= 0) {
        // Escaped!
        handlePlayerEscaped();
        return;
      }
    } else {
      Sound.lose();
      setBoardFeedback(`❌ Wrong! Correct was: ${q.choices[q.correct]}`);
    }

    // Hand over to chaser
    setBoardTurn(1);
    setTimeout(runChaserTurn, 1200);
  };

  const runChaserTurn = () => {
    const isRight = chaseBotCorrect(chaseDifficulty);
    if (isRight) {
      setChaserStep((prev) => {
        const nextC = prev - 1;
        Sound.lose();
        setBoardFeedback('😈 Chaser is CORRECT and moves down a step!');
        if (nextC <= playerStep) {
          // Caught!
          handlePlayerCaught();
        }
        return nextC;
      });
    } else {
      Sound.win();
      setBoardFeedback('🛡️ Chaser MISSED! You stay ahead.');
    }
    setBoardTurn(0);
  };

  const handlePlayerCaught = () => {
    Sound.lose();
    setFinalResult('😈 CAUGHT! The Chaser eliminated you.');
    if (mode === 'pvp') {
      QuizPVP.submit(Net, builderScore * 100);
    }
    setPhase('done');
  };

  const handlePlayerEscaped = () => {
    Sound.win();
    if (mode === 'pvp') {
      QuizPVP.submit(Net, builderScore * 100 + 5000);
      setFinalResult('🏦 ESCAPED! You beat the board.');
      setPhase('done');
    } else {
      setFinalHeadStart(0);
      setFinalTimer(60);
      setPhase('final_chase_prep');
    }
  };

  /* Final Chase */
  const startFinalChase = () => {
    setPhase('final_chase_run');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFinalTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          runChaserFinalAttempt();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleFinalChaseAnswer = (choiceIdx: number) => {
    const q = questions[builderQIndex % questions.length];
    setBuilderQIndex((prev) => prev + 1);
    if (choiceIdx === q.correct) {
      setFinalHeadStart((prev) => prev + 1);
      Sound.win();
    } else {
      Sound.lose();
    }
  };

  const runChaserFinalAttempt = () => {
    const target = finalHeadStart + 1;
    let got = 0;
    const tries = finalHeadStart + 2;
    let stepCount = 0;

    const iv = setInterval(() => {
      if (chaseBotCorrect('hard')) got++;
      setChaserCatchUp(got);
      stepCount++;

      if (stepCount >= tries || got >= target) {
        clearInterval(iv);
        if (got >= target) {
          Sound.lose();
          setFinalResult('😈 Caught by the Chaser in the Final Chase!');
        } else {
          Sound.win();
          setFinalResult(`🏆 YOU BEAT THE CHASER! You banked ${money(builderScore * 1000)}!`);
          Wallet.recordWin('chase').then((p) => onToast(`+${p} ⭐ banked!`));
        }
        setPhase('done');
      }
    }, 500);
  };

  const currentQ = questions[builderQIndex % (questions.length || 1)];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🏃 The Chase</h2>

      {phase === 'builder' && currentQ && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill gold">Cash Builder: <b>{builderScore} correct</b> ({money(builderScore * 1000)})</span>
            <span className="pill" style={{ color: 'var(--gold2)' }}>⏱ {builderTimer}s</span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {currentQ.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {currentQ.choices.map((ch, idx) => (
              <button key={idx} className="btn secondary" onClick={() => handleBuilderAnswer(idx)}>
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'chase_board' && currentQ && (
        <div className="card center">
          <h3>The Chase Board</h3>
          <div className="muted">
            Bank: <b>{money(builderScore * 1000)}</b> · Escape to Step 0! Chaser difficulty: {chaseDifficulty}
          </div>

          {/* Steps visualization */}
          <div style={{ fontSize: 18, lineHeight: 2, margin: '14px 0' }}>
            {[7, 6, 5, 4, 3, 2, 1, 0].map((s) => (
              <div key={s} style={{ color: s === 0 ? 'var(--gold2)' : 'var(--text)' }}>
                {s === playerStep ? '🧍 ' : ''}
                {s === chaserStep ? '😈 ' : ''}
                {s !== playerStep && s !== chaserStep ? '· ' : ''}
                Step {s} {s === 0 ? '🏦 (Safe Bank)' : ''}
              </div>
            ))}
          </div>

          {boardFeedback && <div className="turn-banner" style={{ margin: '8px 0' }}>{boardFeedback}</div>}

          {boardTurn === 0 ? (
            <div>
              <div className="big" style={{ fontSize: 17, margin: '10px 0' }}>
                🧍 Your Question: {currentQ.q}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                {currentQ.choices.map((ch, idx) => (
                  <button key={idx} className="btn secondary" onClick={() => handleBoardPlayerAnswer(idx)}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="status">😈 Chaser is locking in an answer...</div>
          )}
        </div>
      )}

      {phase === 'final_chase_prep' && (
        <div className="card center">
          <h2>🏁 Final Chase — 60s Sprint</h2>
          <div className="muted" style={{ margin: '12px 0' }}>
            Answer as many questions as you can in 60s! Each correct gives you 1 step head start against the Chaser.
          </div>
          <button className="btn" onClick={startFinalChase}>Begin Final Chase</button>
        </div>
      )}

      {phase === 'final_chase_run' && currentQ && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill gold">Head Start: <b>{finalHeadStart} steps</b></span>
            <span className="pill" style={{ color: 'var(--gold2)' }}>⏱ {finalTimer}s</span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '12px 0' }}>
            {currentQ.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {currentQ.choices.map((ch, idx) => (
              <button key={idx} className="btn secondary" onClick={() => handleFinalChaseAnswer(idx)}>
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 The Chase Result</h2>
          <div className="big" style={{ margin: '12px 0' }}>{finalResult}</div>

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win the Chase match! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent went further.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startChase(questions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
