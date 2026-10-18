import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { wmlQuestions, wmlPanel, wmlNormOcc, wmlScore, fuzzy, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Occupation {
  name: string;
  answers: Record<string, string>;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const WhatsMyLineGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [currentOcc, setCurrentOcc] = useState<Occupation | null>(null);
  const [distractors, setDistractors] = useState<string[]>([]);
  const [questionsUsed, setQuestionsUsed] = useState<number>(0);
  const [askedQuestions, setAskedQuestions] = useState<Record<string, boolean>>({});
  const [lastAnswer, setLastAnswer] = useState<{ qText: string; isYes: boolean } | null>(null);
  const [phase, setPhase] = useState<'ask' | 'guess' | 'done'>('ask');
  const [won, setWon] = useState<boolean>(false);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const QUESTIONS = wmlQuestions();
  const PANEL = wmlPanel();

  useEffect(() => {
    const raw = BANKS2.whatsmline?.occupations as any[];
    if (!raw || !raw.length) return;
    const occs = raw.map(wmlNormOcc).filter((o) => o.name);
    setOccupations(occs);

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = occs[Math.floor(Math.random() * occs.length)];
        const dist = pickN(occs.filter((x) => x.name !== picked.name), 3).map((x) => x.name);
        QuizPVP.hostSet(Net, { occ: picked, others: dist });
        startWml(picked, dist);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !currentOcc) {
            startWml(d.occ, d.others);
          }
          if (r.state && r.state.scores && QuizPVP.allDone(r.state, r.seats || [])) {
            const w = QuizPVP.winnerUid(r.state.scores);
            const myUid = Auth.user?.uid || 'u_local';
            const wonMatch = w === myUid;
            setIWonPvp(wonMatch);
            setPvpDone(true);
            QuizPVP.award(wonMatch);
          }
        });
      }
    } else {
      const picked = occs[Math.floor(Math.random() * occs.length)];
      const dist = pickN(occs.filter((x) => x.name !== picked.name), 3).map((x) => x.name);
      startWml(picked, dist);
    }
  }, []);

  const startWml = (occ: Occupation, others: string[]) => {
    setCurrentOcc(occ);
    setDistractors(others);
    setQuestionsUsed(0);
    setAskedQuestions({});
    setLastAnswer(null);
    setPhase('ask');
    setWon(false);
  };

  const handleAskQuestion = (qId: string, qText: string) => {
    if (!currentOcc || askedQuestions[qId] || questionsUsed >= 10) return;
    Sound.click();

    const isYes = currentOcc.answers[qId] === 'yes';
    setAskedQuestions((prev) => ({ ...prev, [qId]: true }));
    setLastAnswer({ qText, isYes });
    Sound.beep(isYes ? 880 : 440, 0.12);

    const nod = PANEL[Math.floor(Math.random() * PANEL.length)];
    onToast(`🎩 ${nod}: "${isYes ? 'Yes, that is correct!' : 'No, that is not the case.'}"`);

    const nextUsed = questionsUsed + 1;
    setQuestionsUsed(nextUsed);

    if (nextUsed >= 10) {
      setTimeout(() => {
        onToast('That was your 10th question — time to guess their line!');
        setPhase('guess');
      }, 700);
    }
  };

  const handleGuessOccupation = (guessName: string) => {
    if (!currentOcc) return;
    Sound.click();

    const isRight = fuzzy(guessName, currentOcc.name);
    setWon(isRight);
    setPhase('done');

    const sc = isRight ? wmlScore(questionsUsed) : 0;
    if (isRight) {
      Sound.win();
    } else {
      Sound.lose();
    }

    if (mode === 'pvp') {
      QuizPVP.submit(Net, sc);
    } else if (isRight) {
      Wallet.add(sc, 'whatsmline');
      Wallet.recordWin('whatsmline').then((p) => onToast(`+${p} ⭐ banked!`));
    }
  };

  if (!currentOcc) {
    return <div className="card center"><div className="muted">Loading mystery guest...</div></div>;
  }

  const guessOptions = pickN([currentOcc.name, ...distractors], 4);

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🕵️ What's My Line?</h2>

      {/* Status Bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around', marginBottom: 4 }}>
          <span>Questions Asked: <b>{questionsUsed} / 10</b></span>
          <span>Mystery Guest: <b>???</b></span>
        </div>
        <div className="muted center" style={{ fontSize: 12 }}>
          🎩 Panel: {PANEL.join(' · ')}
        </div>
      </div>

      {phase === 'ask' && (
        <>
          {lastAnswer && (
            <div className="card center" style={{ background: 'var(--bg2)' }}>
              <div className="muted">{lastAnswer.qText}</div>
              <div
                className="big"
                style={{
                  color: lastAnswer.isYes ? 'var(--green)' : 'var(--red)',
                  margin: '8px 0',
                }}
              >
                {lastAnswer.isYes ? 'YES' : 'NO'}
              </div>
            </div>
          )}

          <div className="card">
            <div className="muted center" style={{ marginBottom: 10 }}>
              Select a question for the mystery guest:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {QUESTIONS.map(([qId, qText]) => {
                const asked = !!askedQuestions[qId];
                return (
                  <button
                    key={qId}
                    className="btn secondary small"
                    disabled={asked || questionsUsed >= 10}
                    onClick={() => handleAskQuestion(qId, qText)}
                    style={{
                      fontSize: 12,
                      padding: '8px 6px',
                      textAlign: 'left',
                      opacity: asked ? 0.35 : 1,
                    }}
                  >
                    {asked ? '✓ ' : ''}{qText}
                  </button>
                );
              })}
            </div>

            <button className="btn" style={{ marginTop: 14 }} onClick={() => setPhase('guess')}>
              🔍 Guess the Mystery Line Now
            </button>
          </div>
        </>
      )}

      {phase === 'guess' && (
        <div className="card center">
          <h3>What's their line?</h3>
          <div className="muted" style={{ margin: '8px 0' }}>
            Score if correct: <b>{wmlScore(questionsUsed)} pts</b> (fewer questions = more points)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, margin: '14px 0' }}>
            {guessOptions.map((opt) => (
              <button key={opt} className="btn secondary" onClick={() => handleGuessOccupation(opt)}>
                💼 {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <div className="muted">The Mystery Guest was:</div>
          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0' }}>
            💼 {currentOcc.name}
          </div>

          <div className="status">
            {won ? (
              <span className="ok">
                🎉 Correct! You identified the guest in {questionsUsed} question{questionsUsed === 1 ? '' : 's'} — Score {wmlScore(questionsUsed)}!
              </span>
            ) : (
              <span className="err">😞 Wrong guess! The mystery guest stumped you.</span>
            )}
          </div>

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status" style={{ marginTop: 10 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You guessed in fewer questions! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent was more efficient.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => {
              const picked = occupations[Math.floor(Math.random() * occupations.length)];
              const dist = pickN(occupations.filter((x) => x.name !== picked.name), 3).map((x) => x.name);
              startWml(picked, dist);
            }}
          >
            Next Mystery Guest
          </button>
        </div>
      )}
    </div>
  );
};
