import React, { useState, useEffect, useRef } from 'react';
import { BANKS2 } from '../../data/banks2';
import {
  hollywoodCluePts,
  hollywoodWordPts,
  hollywoodFirePts,
  hollywoodTarget,
  hollywoodNormCeleb,
  hollywoodNormWord,
  hollywoodNormFire,
  fuzzy,
  pickN,
} from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const HollywoodGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [celebs, setCelebs] = useState<{ name: string; clues: string[] }[]>([]);
  const [words, setWords] = useState<{ word: string; hints: string[] }[]>([]);
  const [fireQs, setFireQs] = useState<{ q: string; choices: string[]; correct: number }[]>([]);

  const [phase, setPhase] = useState<'celeb' | 'words' | 'fire' | 'done'>('celeb');
  const [totalScore, setTotalScore] = useState<number>(0);

  // Round 1 Celeb state
  const [celebIdx, setCelebIdx] = useState<number>(0);
  const [cluesShown, setCluesShown] = useState<number>(1);
  const [celebInput, setCelebInput] = useState<string>('');

  // Round 2 Words state
  const [wordIdx, setWordIdx] = useState<number>(0);
  const [wordInput, setWordInput] = useState<string>('');
  const [wordTimer, setWordTimer] = useState<number>(60);

  // Round 3 Fire state
  const [fireIdx, setFireIdx] = useState<number>(0);
  const [fireTimer, setFireTimer] = useState<number>(60);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const TARGET = hollywoodTarget();

  useEffect(() => {
    const hw = BANKS2.hollywood || {};
    const normCelebs = (hw.celebClues || []).map(hollywoodNormCeleb).filter((x: any) => x.name);
    const normWords = (hw.wordBank || []).map(hollywoodNormWord).filter((x: any) => x.word);
    const normFire = (hw.quickFire || []).map(hollywoodNormFire).filter((x: any) => x.q);

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const payload = {
          celebs: pickN(normCelebs, 3),
          words: pickN(normWords, 12),
          fire: pickN(normFire, 15),
        };
        QuizPVP.hostSet(Net, payload);
        startHollywood(payload.celebs, payload.words, payload.fire);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !celebs.length) {
            startHollywood(d.celebs, d.words, d.fire);
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
      startHollywood(pickN(normCelebs, 3), pickN(normWords, 12), pickN(normFire, 15));
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startHollywood = (cList: any[], wList: any[], fList: any[]) => {
    setCelebs(cList);
    setWords(wList);
    setFireQs(fList);
    setTotalScore(0);
    setCelebIdx(0);
    setCluesShown(1);
    setCelebInput('');
    setPhase('celeb');
  };

  /* Round 1: Celebrity Clues */
  const handleCelebGuess = () => {
    const cb = celebs[celebIdx];
    if (!cb || !celebInput.trim()) return;
    Sound.click();

    if (fuzzy(celebInput.trim(), cb.name)) {
      const pts = hollywoodCluePts(cluesShown);
      setTotalScore((prev) => prev + pts);
      Sound.win();
      onToast(`🌟 Correct! ${cb.name} +${pts} pts!`);
      advanceCeleb();
    } else {
      Sound.beep(200, 0.15, 'sawtooth');
      if (cluesShown < cb.clues.length) {
        setCluesShown((prev) => prev + 1);
        onToast('Wrong — here is another clue:');
      } else {
        onToast(`That was ${cb.name}. Moving on!`);
        advanceCeleb();
      }
    }
  };

  const handleRevealMoreClue = () => {
    const cb = celebs[celebIdx];
    if (cluesShown < cb.clues.length) {
      Sound.click();
      setCluesShown((prev) => prev + 1);
    }
  };

  const advanceCeleb = () => {
    setCelebInput('');
    setCluesShown(1);
    if (celebIdx + 1 < celebs.length) {
      setCelebIdx((prev) => prev + 1);
    } else {
      // Transition to Round 2
      startRoundWords();
    }
  };

  /* Round 2: In Other Words */
  const startRoundWords = () => {
    setPhase('words');
    setWordIdx(0);
    setWordInput('');
    setWordTimer(60);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setWordTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          startRoundFire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleWordGuess = () => {
    const w = words[wordIdx];
    if (!w || !wordInput.trim()) return;

    if (fuzzy(wordInput.trim(), w.word)) {
      setTotalScore((prev) => prev + hollywoodWordPts());
      Sound.beep(880, 0.08);
      setWordInput('');
      advanceWord();
    } else {
      Sound.beep(200, 0.12, 'sawtooth');
      onToast('Keep guessing or skip!');
    }
  };

  const advanceWord = () => {
    setWordInput('');
    if (wordIdx + 1 < words.length) {
      setWordIdx((prev) => prev + 1);
    } else {
      startRoundFire();
    }
  };

  /* Round 3: Quick Fire */
  const startRoundFire = () => {
    setPhase('fire');
    setFireIdx(0);
    setFireTimer(60);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFireTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          finishHollywood();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleFireAnswer = (idx: number) => {
    const q = fireQs[fireIdx];
    if (!q) return;

    if (idx === q.correct) {
      setTotalScore((prev) => prev + hollywoodFirePts());
      Sound.beep(880, 0.06);
    } else {
      Sound.beep(200, 0.1, 'sawtooth');
    }

    if (fireIdx + 1 < fireQs.length) {
      setFireIdx((prev) => prev + 1);
    } else {
      finishHollywood();
    }
  };

  const finishHollywood = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('done');

    if (mode === 'pvp') {
      QuizPVP.submit(Net, totalScore);
    } else {
      if (totalScore >= TARGET) {
        Sound.win();
        Wallet.recordWin('hollywood').then((p) => onToast(`+${p} ⭐ banked!`));
      } else {
        Sound.lose();
      }
    }
  };

  const curCeleb = celebs[celebIdx];
  const curWord = words[wordIdx];
  const curFire = fireQs[fireIdx];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🎬 Hollywood Game Night</h2>

      {/* Progress & Target Score */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around' }}>
          <span>Phase: <b>{phase === 'celeb' ? '1. Celeb Clues' : phase === 'words' ? '2. In Other Words' : phase === 'fire' ? '3. Quick Fire' : 'Complete'}</b></span>
          <span>Score: <b style={{ color: 'var(--gold2)' }}>{totalScore}</b> / {TARGET} pts</span>
        </div>
      </div>

      {/* Round 1: Celeb Clues */}
      {phase === 'celeb' && curCeleb && (
        <div className="card center">
          <h3>🌟 Round 1: Celebrity Clues ({celebIdx + 1} of {celebs.length})</h3>
          <div className="muted" style={{ margin: '6px 0' }}>
            Fewer clues used = higher points! (300 / 200 / 100)
          </div>

          <div style={{ margin: '14px 0', textAlign: 'left' }}>
            {curCeleb.clues.slice(0, cluesShown).map((clue, i) => (
              <div key={i} className="msg" style={{ margin: '6px 0' }}>
                💡 Clue {i + 1}: <b>{clue}</b>
              </div>
            ))}
          </div>

          <div className="row">
            <input
              placeholder="Who is this celebrity?..."
              value={celebInput}
              onChange={(e) => setCelebInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCelebGuess()}
              autoFocus
            />
            <button className="btn small" onClick={handleCelebGuess}>Guess</button>
          </div>

          {cluesShown < curCeleb.clues.length && (
            <button className="btn small secondary" onClick={handleRevealMoreClue} style={{ marginTop: 8 }}>
              💡 Reveal Another Clue
            </button>
          )}
        </div>
      )}

      {/* Round 2: In Other Words */}
      {phase === 'words' && curWord && (
        <div className="card center">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">Round 2: In Other Words (+{hollywoodWordPts()} each)</span>
            <span className="pill" style={{ color: 'var(--gold2)' }}>⏱ {wordTimer}s</span>
          </div>

          <div className="muted">Guess the secret word:</div>
          <div className="big" style={{ margin: '14px 0', color: 'var(--gold2)' }}>
            Starts with "{curWord.word.charAt(0).toUpperCase()}" · {curWord.word.length} letters
          </div>

          <div className="row">
            <input
              placeholder="What is the word..."
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWordGuess()}
              autoFocus
            />
            <button className="btn small" onClick={handleWordGuess}>Guess</button>
            <button className="btn small secondary" onClick={advanceWord}>Skip</button>
          </div>
        </div>
      )}

      {/* Round 3: Quick Fire */}
      {phase === 'fire' && curFire && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">Round 3: Quick Fire Trivia (+{hollywoodFirePts()} each)</span>
            <span className="pill" style={{ color: 'var(--gold2)' }}>⏱ {fireTimer}s</span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {curFire.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {curFire.choices.map((ch, idx) => (
              <button key={idx} className="btn secondary" onClick={() => handleFireAnswer(idx)}>
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Complete */}
      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Hollywood Game Night Complete!</h2>
          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0' }}>
            Final Score: {totalScore} pts
          </div>
          <div className="muted">Target to win: {TARGET} pts</div>

          {mode === 'cpu' ? (
            <div className="status" style={{ marginTop: 12 }}>
              {totalScore >= TARGET ? (
                <span className="ok">🎉 You crushed the target — Hollywood Champion!</span>
              ) : (
                <span className="err">😞 Close! You needed {TARGET} pts to win.</span>
              )}
            </div>
          ) : (
            pvpDone ? (
              <div className="status" style={{ marginTop: 12 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You win Hollywood Game Night! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent had a higher score.</span>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>Waiting for opponent to finish...</div>
            )
          )}

          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => {
              const hw = BANKS2.hollywood || {};
              startHollywood(
                pickN((hw.celebClues || []).map(hollywoodNormCeleb), 3),
                pickN((hw.wordBank || []).map(hollywoodNormWord), 12),
                pickN((hw.quickFire || []).map(hollywoodNormFire), 15)
              );
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
