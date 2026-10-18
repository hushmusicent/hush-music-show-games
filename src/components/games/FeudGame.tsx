import React, { useState, useEffect, useRef } from 'react';
import { BANKS2 } from '../../data/banks2';
import { feudMatch, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface SurveyAnswer {
  t: string;
  pts: number;
}

interface Survey {
  q: string;
  answers: SurveyAnswer[];
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const FeudGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [strikes, setStrikes] = useState<number>(0);
  const [roundPoints, setRoundPoints] = useState<number>(0);
  const [userTotal, setUserTotal] = useState<number>(0);
  const [botTotal, setBotTotal] = useState<number>(0);
  const [guessInput, setGuessInput] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [phase, setPhase] = useState<'round' | 'steal_result' | 'fast_intro' | 'fast_q' | 'done'>('round');

  // Fast Money state
  const [fastIdx, setFastIdx] = useState<number>(0);
  const [fastPoints, setFastPoints] = useState<number>(0);
  const [fastTimer, setFastTimer] = useState<number>(15);
  const fastTimerRef = useRef<any>(null);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [pvpScores, setPvpScores] = useState<Record<string, number>>({});
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const BOT_NAME = 'The Smiths';

  useEffect(() => {
    const list = BANKS2.feud as Survey[];
    if (!list || list.length < 8) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 3);
        QuizPVP.hostSet(Net, picked);
        startFeud(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !surveys.length) {
            startFeud(d);
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
      startFeud(pickN(list, 8));
    }

    return () => {
      if (fastTimerRef.current) clearInterval(fastTimerRef.current);
    };
  }, []);

  const startFeud = (pickedSurveys: Survey[]) => {
    setSurveys(pickedSurveys);
    setRoundIdx(0);
    setRevealed([]);
    setStrikes(0);
    setRoundPoints(0);
    setUserTotal(0);
    setBotTotal(0);
    setPhase('round');
    setFeedbackMsg('');
  };

  const currentSurvey = surveys[roundIdx];

  const handleGuess = () => {
    if (!currentSurvey || !guessInput.trim()) return;
    const v = guessInput.trim();
    Sound.click();

    let foundIdx = -1;
    currentSurvey.answers.forEach((a, i) => {
      if (revealed.includes(i)) return;
      if (feudMatch(v, a.t) && foundIdx < 0) {
        foundIdx = i;
      }
    });

    if (foundIdx >= 0) {
      const ans = currentSurvey.answers[foundIdx];
      const newRevealed = [...revealed, foundIdx];
      setRevealed(newRevealed);
      const newRp = roundPoints + ans.pts;
      setRoundPoints(newRp);
      Sound.win();
      setFeedbackMsg(`✅ "${ans.t}" — ${ans.pts} pts!`);
      setGuessInput('');

      if (newRevealed.length >= currentSurvey.answers.length) {
        // Board cleared
        setUserTotal((prev) => prev + newRp);
        onToast('Board cleared!');
        setTimeout(() => advanceRound(newRp, true), 1200);
      }
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      Sound.lose();
      setFeedbackMsg(`❌ Strike ${newStrikes}!`);
      setGuessInput('');

      if (newStrikes >= 3) {
        handleThreeStrikes();
      }
    }
  };

  const handleThreeStrikes = () => {
    if (mode === 'pvp') {
      setUserTotal((prev) => prev + roundPoints);
      setTimeout(() => advanceRound(roundPoints, false), 1400);
      return;
    }

    // Bot steal attempt
    const unrevealedCount = currentSurvey.answers.length - revealed.length;
    const botSuccess = Math.random() < Math.min(0.9, 0.25 + 0.12 * unrevealedCount);

    if (botSuccess) {
      setBotTotal((prev) => prev + roundPoints);
      Sound.lose();
      setFeedbackMsg(`😈 ${BOT_NAME} steals the round! +${roundPoints} pts to them.`);
    } else {
      setUserTotal((prev) => prev + roundPoints);
      Sound.win();
      setFeedbackMsg(`🛡️ Steal failed! You bank the ${roundPoints} pts.`);
    }
    setPhase('steal_result');
  };

  const advanceRound = (_banked: number, _cleared: boolean) => {
    if (roundIdx + 1 < (mode === 'pvp' ? surveys.length : 3)) {
      const nextR = roundIdx + 1;
      setRoundIdx(nextR);
      setRevealed([]);
      setStrikes(0);
      setRoundPoints(0);
      setFeedbackMsg('');
      setPhase('round');
    } else {
      if (mode === 'pvp') {
        setPhase('done');
        QuizPVP.submit(Net, userTotal + roundPoints);
      } else {
        setPhase('fast_intro');
      }
    }
  };

  /* Fast Money */
  const startFastMoney = () => {
    Sound.click();
    setFastIdx(0);
    setFastPoints(0);
    setPhase('fast_q');
    startFastQuestionTimer(0);
  };

  const startFastQuestionTimer = (idx: number) => {
    setFastTimer(15);
    if (fastTimerRef.current) clearInterval(fastTimerRef.current);
    fastTimerRef.current = setInterval(() => {
      setFastTimer((prev) => {
        if (prev <= 1) {
          clearInterval(fastTimerRef.current);
          handleFastAnswerTimeout(idx);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleFastAnswer = () => {
    if (fastTimerRef.current) clearInterval(fastTimerRef.current);
    const q = surveys[3 + fastIdx];
    if (!q) return;

    let matchIdx = -1;
    q.answers.forEach((a, i) => {
      if (feudMatch(guessInput.trim(), a.t)) {
        if (matchIdx < 0 || a.pts > q.answers[matchIdx].pts) matchIdx = i;
      }
    });

    const pts = matchIdx >= 0 ? q.answers[matchIdx].pts : 0;
    if (pts > 0) Sound.win();
    else Sound.lose();

    const newFast = fastPoints + pts;
    setFastPoints(newFast);
    setGuessInput('');

    if (fastIdx + 1 >= 5) {
      finishFastMoney(newFast);
    } else {
      setFastIdx((prev) => prev + 1);
      startFastQuestionTimer(fastIdx + 1);
    }
  };

  const handleFastAnswerTimeout = (_idx: number) => {
    Sound.lose();
    setGuessInput('');
    if (fastIdx + 1 >= 5) {
      finishFastMoney(fastPoints);
    } else {
      setFastIdx((prev) => prev + 1);
      startFastQuestionTimer(fastIdx + 1);
    }
  };

  const finishFastMoney = (totalFast: number) => {
    if (fastTimerRef.current) clearInterval(fastTimerRef.current);
    setPhase('done');
    if (totalFast >= 120) {
      Sound.win();
      Wallet.recordWin('feud').then((p) => onToast(`🏆 Family Feud Champion! +${p} ⭐`));
    } else {
      Sound.lose();
    }
  };

  if (!currentSurvey) {
    return <div className="card center"><div className="muted">Loading Family Feud...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>👪 Family Feud</h2>

      {phase === 'round' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">Round {roundIdx + 1} of {mode === 'pvp' ? surveys.length : 3}</span>
            <span>
              Strikes: <b style={{ color: 'var(--red)', fontSize: 16 }}>{'❌'.repeat(strikes) || 'None'}</b>
            </span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '10px 0' }}>
            {currentSurvey.q}
          </div>

          {/* Survey Board */}
          <table className="lb">
            <tbody>
              {currentSurvey.answers.map((ans, i) => {
                const isRev = revealed.includes(i);
                return (
                  <tr key={i}>
                    <td style={{ width: 28, color: 'var(--gold2)' }}>{i + 1}</td>
                    <td>{isRev ? ans.t : '________________________'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{isRev ? ans.pts : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <span className="status">Round pts: <b>{roundPoints}</b></span>
            <span>You: <b>{userTotal}</b> {mode === 'cpu' && <>· {BOT_NAME}: <b>{botTotal}</b></>}</span>
          </div>

          {feedbackMsg && <div className="turn-banner">{feedbackMsg}</div>}

          <div className="row" style={{ marginTop: 8 }}>
            <input
              placeholder="Your survey answer..."
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
              autoFocus
            />
            <button className="btn small" onClick={handleGuess}>Guess</button>
          </div>
        </div>
      )}

      {phase === 'steal_result' && (
        <div className="card center">
          <div className="status" style={{ fontSize: 18 }}>{feedbackMsg}</div>
          <button className="btn" onClick={() => advanceRound(roundPoints, false)} style={{ marginTop: 12 }}>
            Next Round →
          </button>
        </div>
      )}

      {phase === 'fast_intro' && (
        <div className="card center">
          <h2>⚡ Fast Money</h2>
          <div className="muted" style={{ margin: '12px 0' }}>
            5 rapid questions, 15 seconds each.<br />
            Top survey answers score big — reach <b>120 points</b> to win!
          </div>
          <button className="btn" onClick={startFastMoney}>Start Fast Money</button>
        </div>
      )}

      {phase === 'fast_q' && (
        <div className="card center">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="pill gold">Fast Money Question {fastIdx + 1} of 5</span>
            <span className="pill" style={{ color: 'var(--gold2)' }}>⏱ {fastTimer}s</span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {surveys[3 + fastIdx]?.q}
          </div>

          <div className="row">
            <input
              placeholder="Top answer..."
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFastAnswer()}
              autoFocus
            />
            <button className="btn small" onClick={handleFastAnswer}>Submit</button>
          </div>

          <div className="status" style={{ marginTop: 12 }}>
            Current Fast Money Points: <b>{fastPoints}</b>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Feud Complete!</h2>
          {mode === 'cpu' ? (
            <>
              <div className="big" style={{ color: 'var(--gold2)', margin: '8px 0' }}>
                Fast Money Total: {fastPoints} pts
              </div>
              <div className="status">
                {fastPoints >= 120 ? (
                  <span className="ok">🏆 YOU WON FAMILY FEUD FAST MONEY!</span>
                ) : (
                  <span className="err">Needed 120 pts to win — you got {fastPoints}.</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="big" style={{ margin: '8px 0' }}>
                Your Score: {userTotal} pts
              </div>
              {pvpDone ? (
                <div className="status">
                  {iWonPvp ? (
                    <span className="ok">🏆 You win the Family Feud match! (+{PVP_WIN} ⭐)</span>
                  ) : (
                    <span className="err">😞 Opponent scored more feud points.</span>
                  )}
                </div>
              ) : (
                <div className="muted">Waiting for opponent to finish...</div>
              )}
            </>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startFeud(surveys)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
