import React, { useState, useEffect } from 'react';
import { BANKS1, WheelPuzzle } from '../../data/banks1';
import { wheelSpin, jeopardyGrade, money, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const WheelGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [puzzles, setPuzzles] = useState<WheelPuzzle[]>([]);
  const [roundIndex, setRoundIndex] = useState<number>(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [guessed, setGuessed] = useState<Record<string, boolean>>({});
  const [bank, setBank] = useState<number>(0);
  const [totals, setTotals] = useState<Record<string, number>>({ You: 0, SpinQueen: 0, LuckyLucy: 0 });
  const [roundBanks, setRoundBanks] = useState<Record<string, number>>({ SpinQueen: 0, LuckyLucy: 0 });
  const [turn, setTurn] = useState<number>(0); // 0 = player, 1 = SpinQueen, 2 = LuckyLucy
  const [actionMsg, setActionMsg] = useState<string>('');
  const [spinValue, setSpinValue] = useState<number | string | null>(null);
  const [subAction, setSubAction] = useState<'idle' | 'consonant' | 'vowel' | 'solve'>('idle');
  const [letterInput, setLetterInput] = useState<string>('');
  const [solveInput, setSolveInput] = useState<string>('');
  const [misses, setMisses] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [pvpScores, setPvpScores] = useState<Record<string, number>>({});
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const VOWELS = 'aeiou';
  const BOTS = ['SpinQueen', 'LuckyLucy'];

  useEffect(() => {
    const list = BANKS1.wheel;
    if (!list || !list.length) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 1);
        QuizPVP.hostSet(Net, picked);
        startPuzzles(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !puzzles.length) {
            startPuzzles(d);
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
      const picked = pickN(list, 3);
      startPuzzles(picked);
    }
  }, []);

  const startPuzzles = (puzs: WheelPuzzle[]) => {
    setPuzzles(puzs);
    setRoundIndex(0);
    initRound(puzs[0]);
  };

  const initRound = (_puzzle: WheelPuzzle) => {
    setRevealed({});
    setGuessed({});
    setBank(0);
    setRoundBanks({ SpinQueen: 0, LuckyLucy: 0 });
    setTurn(0);
    setActionMsg('');
    setSpinValue(null);
    setSubAction('idle');
    setLetterInput('');
    setSolveInput('');
  };

  const currentPuzzle = puzzles[roundIndex];

  const isSolved = (curRevealed: Record<string, boolean>) => {
    if (!currentPuzzle) return false;
    const pl = currentPuzzle.puzzle.toLowerCase();
    for (let i = 0; i < pl.length; i++) {
      const l = pl[i];
      if (/[a-z]/.test(l) && !curRevealed[l]) return false;
    }
    return true;
  };

  const nextTurn = () => {
    if (mode === 'cpu') {
      const nxt = (turn + 1) % 3;
      setTurn(nxt);
      setSubAction('idle');
      setSpinValue(null);
      if (nxt > 0) {
        runBotTurn(BOTS[nxt - 1], nxt);
      }
    } else {
      setTurn(0);
      setSubAction('idle');
      setSpinValue(null);
    }
  };

  const handlePlayerSpin = () => {
    Sound.click();
    const seg = wheelSpin();
    setSpinValue(seg);

    if (seg === 'BANKRUPT') {
      setBank(0);
      Sound.lose();
      setActionMsg('💥 BANKRUPT! Round bank wiped.');
      setTimeout(nextTurn, 1400);
      return;
    }
    if (seg === 'LOSE A TURN') {
      Sound.beep(300, 0.2);
      setActionMsg('⏭ LOSE A TURN.');
      setTimeout(nextTurn, 1400);
      return;
    }

    setSubAction('consonant');
    setLetterInput('');
  };

  const handleGuessConsonant = () => {
    if (!currentPuzzle || typeof spinValue !== 'number') return;
    const l = letterInput.toLowerCase().trim();
    if (!/[a-z]/.test(l) || VOWELS.includes(l) || guessed[l]) {
      setActionMsg('Please enter an uncalled consonant.');
      return;
    }

    Sound.click();
    const newGuessed = { ...guessed, [l]: true };
    setGuessed(newGuessed);

    const pl = currentPuzzle.puzzle.toLowerCase();
    let count = 0;
    for (let i = 0; i < pl.length; i++) {
      if (pl[i] === l) count++;
    }

    if (count > 0) {
      const newRevealed = { ...revealed, [l]: true };
      setRevealed(newRevealed);
      const earned = spinValue * count;
      setBank((prev) => prev + earned);
      Sound.win();
      setActionMsg(`✅ ${count}× "${l.toUpperCase()}"! +${money(earned)}`);
      setSubAction('idle');
      setSpinValue(null);

      if (isSolved(newRevealed)) {
        handleRoundWon('You', bank + earned);
      }
    } else {
      setMisses((prev) => prev + 1);
      Sound.lose();
      setActionMsg(`❌ No "${l.toUpperCase()}".`);
      setTimeout(nextTurn, 1300);
    }
  };

  const handleBuyVowel = () => {
    if (bank < 250) {
      onToast('Need $250 in the round bank to buy a vowel');
      return;
    }
    Sound.click();
    setSubAction('vowel');
    setLetterInput('');
  };

  const handleGuessVowel = () => {
    if (!currentPuzzle) return;
    const l = letterInput.toLowerCase().trim();
    if (!VOWELS.includes(l) || guessed[l]) {
      setActionMsg('Please enter an uncalled vowel (A, E, I, O, U).');
      return;
    }

    Sound.click();
    setBank((prev) => prev - 250);
    const newGuessed = { ...guessed, [l]: true };
    setGuessed(newGuessed);

    const pl = currentPuzzle.puzzle.toLowerCase();
    if (pl.includes(l)) {
      const newRevealed = { ...revealed, [l]: true };
      setRevealed(newRevealed);
      Sound.win();
      setActionMsg(`✅ "${l.toUpperCase()}" is in the puzzle!`);
      setSubAction('idle');
      if (isSolved(newRevealed)) {
        handleRoundWon('You', bank - 250);
      }
    } else {
      Sound.lose();
      setActionMsg(`❌ No "${l.toUpperCase()}".`);
      setTimeout(nextTurn, 1300);
    }
  };

  const handleSolve = () => {
    if (!currentPuzzle) return;
    Sound.click();
    if (jeopardyGrade(solveInput, currentPuzzle.puzzle)) {
      handleRoundWon('You', bank);
    } else {
      setMisses((prev) => prev + 1);
      Sound.lose();
      setActionMsg('❌ Incorrect solution!');
      setTimeout(nextTurn, 1400);
    }
  };

  const runBotTurn = (botName: string, botIndex: number) => {
    setActionMsg(`🤖 ${botName} is thinking...`);
    setTimeout(() => {
      if (!currentPuzzle) return;
      const pl = currentPuzzle.puzzle.toLowerCase();
      let totalLetters = 0;
      let revCount = 0;
      for (let i = 0; i < pl.length; i++) {
        if (/[a-z]/.test(pl[i])) {
          totalLetters++;
          if (revealed[pl[i]]) revCount++;
        }
      }
      const frac = totalLetters ? revCount / totalLetters : 1;

      if (frac > 0.55 && Math.random() < 0.5) {
        if (Math.random() < 0.6) {
          handleRoundWon(botName, roundBanks[botName] || 500);
          return;
        }
        setActionMsg(`🤖 ${botName} attempted to solve, but was wrong!`);
        setTimeout(nextTurn, 1300);
        return;
      }

      // Spin
      const seg = wheelSpin();
      if (seg === 'BANKRUPT') {
        setRoundBanks((prev) => ({ ...prev, [botName]: 0 }));
        Sound.lose();
        setActionMsg(`💥 ${botName} hit BANKRUPT!`);
        setTimeout(nextTurn, 1400);
        return;
      }
      if (seg === 'LOSE A TURN') {
        Sound.beep(300, 0.2);
        setActionMsg(`⏭ ${botName} lost a turn.`);
        setTimeout(nextTurn, 1400);
        return;
      }

      // Pick popular consonant
      const freq = 'tnshrdlcmfwypvbgkqjxz';
      let pick = 't';
      for (let i = 0; i < freq.length; i++) {
        if (!guessed[freq[i]]) {
          pick = freq[i];
          break;
        }
      }

      setActionMsg(`🌀 ${botName} spins ${money(seg as number)} and calls "${pick.toUpperCase()}"...`);

      setTimeout(() => {
        setGuessed((prev) => ({ ...prev, [pick]: true }));
        let count = 0;
        for (let i = 0; i < pl.length; i++) {
          if (pl[i] === pick) count++;
        }

        if (count > 0) {
          const newRevealed = { ...revealed, [pick]: true };
          setRevealed(newRevealed);
          const earned = (seg as number) * count;
          setRoundBanks((prev) => ({ ...prev, [botName]: (prev[botName] || 0) + earned }));
          Sound.win();
          setActionMsg(`✅ ${count}× "${pick.toUpperCase()}" for ${botName}! (+${money(earned)})`);

          if (isSolved(newRevealed)) {
            handleRoundWon(botName, (roundBanks[botName] || 0) + earned);
          } else {
            setTimeout(nextTurn, 1400);
          }
        } else {
          Sound.lose();
          setActionMsg(`❌ No "${pick.toUpperCase()}".`);
          setTimeout(nextTurn, 1300);
        }
      }, 1000);
    }, 1100);
  };

  const handleRoundWon = (winnerName: string, wonAmount: number) => {
    Sound.win();
    setTotals((prev) => ({ ...prev, [winnerName]: prev[winnerName] + wonAmount }));
    setActionMsg(`🎉 ${winnerName} solved the puzzle: "${currentPuzzle?.puzzle}" (+${money(wonAmount)})`);

    setTimeout(() => {
      if (roundIndex + 1 < puzzles.length) {
        const nextR = roundIndex + 1;
        setRoundIndex(nextR);
        initRound(puzzles[nextR]);
      } else {
        finishGame(winnerName, wonAmount);
      }
    }, 2200);
  };

  const finishGame = (winnerName: string, wonAmount: number) => {
    setGameOver(true);
    const finalTotals = { ...totals, [winnerName]: totals[winnerName] + wonAmount };

    if (mode === 'pvp') {
      const score = Math.max(0, finalTotals.You - misses * 10);
      QuizPVP.submit(Net, score);
    } else {
      if (finalTotals.You > Math.max(finalTotals.SpinQueen, finalTotals.LuckyLucy)) {
        Sound.win();
        Wallet.recordWin('wheel').then((p) => onToast(`+${p} ⭐ banked!`));
      } else {
        Sound.lose();
      }
    }
  };

  const displayPuzzle = () => {
    if (!currentPuzzle) return '';
    const pl = currentPuzzle.puzzle;
    return pl
      .split('')
      .map((ch) => {
        const l = ch.toLowerCase();
        if (/[a-z]/.test(l)) {
          return revealed[l] ? ch.toUpperCase() : '▢';
        }
        return ch;
      })
      .join(' ');
  };

  if (!currentPuzzle) {
    return <div className="card center"><div className="muted">Loading Wheel of Fortune...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🎡 Wheel of Fortune — Round {roundIndex + 1} of {puzzles.length}</h2>

      {/* Board & Clue */}
      <div className="card center">
        <div className="muted" style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
          Category: {currentPuzzle.cat}
        </div>
        <div
          className="big"
          style={{
            letterSpacing: 2,
            lineHeight: 1.8,
            fontSize: 22,
            margin: '14px 0',
            wordBreak: 'break-word',
          }}
        >
          {displayPuzzle()}
        </div>

        {/* Scoreboard */}
        <div className="status" style={{ fontSize: 14 }}>
          <span><b>You:</b> {money(totals.You)} <span className="muted">({money(bank)})</span></span>
          {mode === 'cpu' && (
            <>
              <span style={{ margin: '0 8px' }}>·</span>
              <span><b>SpinQueen:</b> {money(totals.SpinQueen)}</span>
              <span style={{ margin: '0 8px' }}>·</span>
              <span><b>LuckyLucy:</b> {money(totals.LuckyLucy)}</span>
            </>
          )}
        </div>

        {actionMsg && <div className="turn-banner" style={{ marginTop: 8 }}>{actionMsg}</div>}
      </div>

      {/* Player Turn Controls */}
      {!gameOver && turn === 0 && (
        <div className="card">
          {subAction === 'idle' && (
            <div className="row">
              <button className="btn small grow" onClick={handlePlayerSpin}>
                🌀 SPIN
              </button>
              <button className="btn small grow" onClick={handleBuyVowel} disabled={bank < 250}>
                Buy Vowel ($250)
              </button>
              <button className="btn small grow secondary" onClick={() => setSubAction('solve')}>
                Solve Puzzle
              </button>
            </div>
          )}

          {subAction === 'consonant' && typeof spinValue === 'number' && (
            <div>
              <div className="status center" style={{ color: 'var(--gold2)' }}>
                Spun: <b>{money(spinValue)}</b> per consonant
              </div>
              <div className="row">
                <input
                  maxLength={1}
                  className="grow"
                  placeholder="Enter a consonant (e.g. T, R, S)..."
                  value={letterInput}
                  onChange={(e) => setLetterInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuessConsonant()}
                  autoFocus
                />
                <button className="btn small" onClick={handleGuessConsonant}>
                  Call Letter
                </button>
              </div>
            </div>
          )}

          {subAction === 'vowel' && (
            <div>
              <div className="status center">Choose a vowel ($250 deducted)</div>
              <div className="row">
                <input
                  maxLength={1}
                  className="grow"
                  placeholder="Vowel (A, E, I, O, U)..."
                  value={letterInput}
                  onChange={(e) => setLetterInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuessVowel()}
                  autoFocus
                />
                <button className="btn small" onClick={handleGuessVowel}>
                  Buy
                </button>
              </div>
            </div>
          )}

          {subAction === 'solve' && (
            <div>
              <div className="status center">Solve the puzzle:</div>
              <div className="row">
                <input
                  className="grow"
                  placeholder="Type the full solution..."
                  value={solveInput}
                  onChange={(e) => setSolveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSolve()}
                  autoFocus
                />
                <button className="btn small" onClick={handleSolve}>
                  Solve
                </button>
                <button className="btn small secondary" onClick={() => setSubAction('idle')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Over */}
      {gameOver && (
        <div className="card center">
          <h2>🏁 Final Totals</h2>
          <table className="lb">
            <tbody>
              {mode === 'pvp' && pvpDone ? (
                Object.keys(pvpScores).map((uid) => (
                  <tr key={uid} className={uid === Auth.user?.uid ? 'me' : ''}>
                    <td>{uid === Auth.user?.uid ? 'You' : 'Opponent'}</td>
                    <td>{money(pvpScores[uid])}</td>
                  </tr>
                ))
              ) : (
                Object.keys(totals).map((k) => (
                  <tr key={k} className={k === 'You' ? 'me' : ''}>
                    <td>{k}</td>
                    <td>{money(totals[k])}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status" style={{ marginTop: 12 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You win Wheel of Fortune! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent banked more points.</span>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>Waiting for opponent...</div>
            )
          ) : (
            <div className="status" style={{ marginTop: 12 }}>
              {totals.You > Math.max(totals.SpinQueen, totals.LuckyLucy) ? (
                <span className="ok">🏆 You win Wheel of Fortune!</span>
              ) : (
                <span className="err">😞 Better luck next spin!</span>
              )}
            </div>
          )}

          <button className="btn" style={{ marginTop: 12 }} onClick={() => startPuzzles(puzzles)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
