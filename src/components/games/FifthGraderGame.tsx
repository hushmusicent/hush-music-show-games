import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { fifthGraderLadder, fifthGraderNorm, fifthGraderForGrade, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface GraderQ {
  grade: number;
  subject: string;
  q: string;
  choices: string[];
  correct: number;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const FifthGraderGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [allQuestions, setAllQuestions] = useState<GraderQ[]>([]);
  const [grade, setGrade] = useState<number>(1);
  const [winnings, setWinnings] = useState<number>(0);
  const [cheats, setCheats] = useState<{ peek: number; copy: number; save: number }>({ peek: 1, copy: 1, save: 1 });
  const [phase, setPhase] = useState<'subject' | 'question' | 'decide' | 'done'>('subject');
  const [activeQ, setActiveQ] = useState<GraderQ | null>(null);
  const [isPeeked, setIsPeeked] = useState<boolean>(false);
  const [isDroppedOut, setIsDroppedOut] = useState<boolean>(false);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const LADDER = fifthGraderLadder();

  useEffect(() => {
    const raw = BANKS2.fifthgrader as any[];
    if (!raw || !raw.length) return;
    const normed: GraderQ[] = fifthGraderNorm(raw);

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked: GraderQ[] = [];
        for (let g = 1; g <= 5; g++) {
          const q = fifthGraderForGrade(normed, g);
          if (q) picked.push(q);
        }
        QuizPVP.hostSet(Net, picked);
        startGrader(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !allQuestions.length) {
            startGrader(d);
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
      startGrader(normed);
    }
  }, []);

  const startGrader = (qs: GraderQ[]) => {
    setAllQuestions(qs);
    setGrade(1);
    setWinnings(0);
    setCheats({ peek: 1, copy: 1, save: 1 });
    setPhase('subject');
    setActiveQ(null);
    setIsPeeked(false);
    setIsDroppedOut(false);
  };

  const handleSelectSubject = (subj: string) => {
    let pool = allQuestions.filter((q) => q.grade === grade && q.subject === subj);
    if (!pool.length) pool = allQuestions.filter((q) => q.grade === grade);
    if (!pool.length) return;

    Sound.click();
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setActiveQ(picked);
    setIsPeeked(false);
    setPhase('question');
  };

  const handleAnswer = (choiceIdx: number) => {
    if (!activeQ) return;
    Sound.click();

    if (choiceIdx === activeQ.correct) {
      handleCorrect();
    } else if (cheats.save > 0) {
      setCheats((prev) => ({ ...prev, save: 0 }));
      Sound.win();
      onToast('💾 SAVED! Your classmate saved you from a wrong answer.');
      handleCorrect();
    } else {
      Sound.lose();
      onToast(`Wrong! Answer was: ${activeQ.choices[activeQ.correct]}`);
      setWinnings(0);
      setPhase('done');
    }
  };

  const handleCorrect = () => {
    const curWin = LADDER[grade - 1];
    setWinnings(curWin);
    Sound.win();

    if (grade >= 5) {
      finishGame(false, curWin);
    } else {
      setPhase('decide');
    }
  };

  const handlePeek = () => {
    if (cheats.peek <= 0) return;
    setCheats((prev) => ({ ...prev, peek: 0 }));
    setIsPeeked(true);
    Sound.win();
    onToast('👀 Peek: The correct answer is highlighted!');
  };

  const handleCopy = () => {
    if (cheats.copy <= 0) return;
    setCheats((prev) => ({ ...prev, copy: 0 }));
    Sound.win();
    onToast('📋 Copied! Correct answer locked in.');
    handleCorrect();
  };

  const handleDropOut = () => {
    Sound.click();
    setIsDroppedOut(true);
    finishGame(true, winnings);
  };

  const handleContinueNextGrade = () => {
    Sound.click();
    setGrade((prev) => prev + 1);
    setPhase('subject');
    setIsPeeked(false);
  };

  const finishGame = (dropped: boolean, finalAmount: number) => {
    setPhase('done');
    setIsDroppedOut(dropped);

    if (mode === 'pvp') {
      QuizPVP.submit(Net, finalAmount);
    } else {
      const pts = Math.max(1, Math.round(finalAmount / 1000));
      if (finalAmount > 0) {
        Wallet.add(pts, 'fifthgrader');
        if (!dropped && grade >= 5) {
          Wallet.recordWin('fifthgrader').then((p) => onToast(`🎓 Graduation Champion! +${p} ⭐`));
        }
      }
    }
  };

  const availableSubjects = Array.from(
    new Set(allQuestions.filter((q) => q.grade === grade).map((q) => q.subject))
  );

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🎒 Are You Smarter Than a 5th Grader?</h2>

      {/* Progress HUD */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around', marginBottom: 6 }}>
          <span>Grade: <b style={{ color: 'var(--gold2)' }}>{grade} / 5</b></span>
          <span>💰 Bank: <b>{money(winnings)}</b></span>
        </div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {LADDER.map((val, idx) => (
            <span
              key={val}
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: winnings >= val ? 'rgba(207, 143, 63, 0.3)' : 'var(--bg2)',
                color: winnings >= val ? 'var(--gold2)' : 'var(--muted)',
                border: winnings >= val ? '1px solid var(--gold)' : '1px solid var(--line)',
              }}
            >
              Grade {idx + 1} (${val / 1000}k)
            </span>
          ))}
        </div>
        <div className="muted center" style={{ fontSize: 12, marginTop: 6 }}>
          Cheats Left: 👀 Peek ({cheats.peek}) · 📋 Copy ({cheats.copy}) · 💾 Save ({cheats.save})
        </div>
      </div>

      {phase === 'subject' && (
        <div className="card center">
          <h3>Choose your Grade {grade} Subject</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '14px 0' }}>
            {availableSubjects.map((sub) => (
              <button key={sub} className="btn secondary" onClick={() => handleSelectSubject(sub)}>
                📚 {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'question' && activeQ && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">Grade {grade}: {activeQ.subject}</span>
            <span className="big" style={{ fontSize: 18, color: 'var(--gold2)' }}>
              {money(LADDER[grade - 1])}
            </span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {activeQ.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {activeQ.choices.map((ch, idx) => {
              const highlighted = isPeeked && idx === activeQ.correct;
              return (
                <button
                  key={idx}
                  className="btn secondary"
                  onClick={() => handleAnswer(idx)}
                  style={{
                    border: highlighted ? '2px solid var(--gold)' : '1px solid var(--line)',
                    boxShadow: highlighted ? '0 0 10px var(--gold)' : undefined,
                    color: highlighted ? 'var(--gold2)' : 'var(--text)',
                  }}
                >
                  {ch}
                </button>
              );
            })}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small secondary grow" disabled={cheats.peek <= 0} onClick={handlePeek}>
              👀 Peek
            </button>
            <button className="btn small secondary grow" disabled={cheats.copy <= 0} onClick={handleCopy}>
              📋 Copy
            </button>
          </div>
        </div>
      )}

      {phase === 'decide' && (
        <div className="card center">
          <div className="ok" style={{ fontSize: 20 }}>✅ Correct! You have {money(winnings)}!</div>
          <div className="muted" style={{ margin: '12px 0' }}>
            Will you drop out and take your money, or risk it on Grade {grade + 1} for {money(LADDER[grade])}?
          </div>
          <div className="row">
            <button className="btn secondary grow" onClick={handleDropOut}>
              💰 Drop Out & Keep {money(winnings)}
            </button>
            <button className="btn grow" onClick={handleContinueNextGrade}>
              Grade {grade + 1} ({money(LADDER[grade])}) →
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Final Report Card</h2>
          {!isDroppedOut && grade >= 5 && winnings > 0 && (
            <div>
              <div className="big">🎓</div>
              <div className="ok" style={{ fontSize: 20, margin: '8px 0' }}>
                YOU ARE SMARTER THAN A 5TH GRADER!
              </div>
            </div>
          )}
          {isDroppedOut && (
            <div className="muted" style={{ margin: '8px 0' }}>
              You chose to drop out with your winnings.
            </div>
          )}
          {winnings === 0 && (
            <div className="err" style={{ fontSize: 18, margin: '8px 0' }}>
              📚 You are NOT smarter than a 5th grader! (Sent back to 1st grade)
            </div>
          )}

          <div className="big" style={{ color: 'var(--gold2)', margin: '14px 0' }}>
            Final Bank: {money(winnings)}
          </div>

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You out-graded your opponent! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent climbed to a higher grade.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startGrader(allQuestions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
