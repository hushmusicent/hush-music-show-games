import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { pressluckSpin, pressluckStartSpins, pressluckSimBot, pickN, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface TriviaQ {
  q: string;
  choices: string[];
  correct: number;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const PressLuckGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [questions, setQuestions] = useState<TriviaQ[]>([]);
  const [phase, setPhase] = useState<'earn' | 'board' | 'done'>('earn');
  const [qIndex, setQIndex] = useState<number>(0);
  const [spins, setSpins] = useState<number>(3);
  const [bank, setBank] = useState<number>(0);
  const [whammyCount, setWhammyCount] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [boardFace, setBoardFace] = useState<string>('❓');
  const [spinMessage, setSpinMessage] = useState<string>('');
  const [botBank, setBotBank] = useState<number | null>(null);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  useEffect(() => {
    const list = BANKS2.chase as TriviaQ[];
    if (!list || list.length < 3) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 3);
        QuizPVP.hostSet(Net, picked);
        startPressLuck(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !questions.length) {
            startPressLuck(d);
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
      startPressLuck(pickN(list, 3));
    }
  }, []);

  const startPressLuck = (qs: TriviaQ[]) => {
    setQuestions(qs);
    setPhase('earn');
    setQIndex(0);
    setSpins(pressluckStartSpins());
    setBank(0);
    setWhammyCount(0);
    setIsSpinning(false);
    setBoardFace('❓');
    setSpinMessage('');
    setBotBank(null);
  };

  const handleEarnAnswer = (choiceIdx: number) => {
    const q = questions[qIndex];
    if (choiceIdx === q.correct) {
      setSpins((prev) => prev + 1);
      Sound.win();
      onToast('✅ Correct! +1 spin earned');
    } else {
      Sound.lose();
      onToast(`❌ Wrong — was: ${q.choices[q.correct]}`);
    }

    if (qIndex + 1 < questions.length) {
      setQIndex((prev) => prev + 1);
    } else {
      setPhase('board');
    }
  };

  const handleSpinBoard = () => {
    if (isSpinning || spins <= 0) return;
    setIsSpinning(true);
    setSpins((prev) => prev - 1);
    Sound.click();

    let ticks = 0;
    const faces = ['💵', '💰', '💎', '💥', '⭐', '🎁'];

    const iv = setInterval(() => {
      ticks++;
      setBoardFace(faces[ticks % faces.length]);
      Sound.beep(300 + ticks * 60, 0.05, 'square');

      if (ticks >= 9) {
        clearInterval(iv);
        setIsSpinning(false);
        const r = pressluckSpin();

        if (r.type === 'whammy') {
          setBoardFace('💥');
          setBank(0);
          const nextWham = whammyCount + 1;
          setWhammyCount(nextWham);
          Sound.lose();
          setSpinMessage(`💥 WHAMMY! Bank wiped out (${nextWham}/4)`);

          if (nextWham >= 4) {
            setTimeout(finishGame, 1400);
            return;
          }
        } else if (r.type === 'bigbucks') {
          setBoardFace('💰');
          setBank((prev) => prev + (r.amount || 5000));
          setSpins((prev) => prev + 1);
          Sound.win();
          setSpinMessage(`💰 BIG BUCKS! +$${(r.amount || 5000).toLocaleString()} and +1 EXTRA SPIN!`);
        } else {
          setBoardFace('💵');
          const amt = r.amount || 500;
          setBank((prev) => prev + amt);
          Sound.win();
          setSpinMessage(`💵 +$${amt.toLocaleString()} banked!`);
        }
      }
    }, 110);
  };

  const handlePass = () => {
    Sound.click();
    finishGame();
  };

  const finishGame = () => {
    setPhase('done');

    if (mode === 'pvp') {
      QuizPVP.submit(Net, bank);
    } else {
      const botSim = pressluckSimBot(pressluckStartSpins() + questions.length);
      setBotBank(botSim.bank);
      if (bank > botSim.bank) {
        Sound.win();
        Wallet.recordWin('pressluck').then((p) => onToast(`+${p} ⭐ banked!`));
      } else {
        Sound.lose();
      }
    }
  };

  const currentQ = questions[qIndex];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🍀 Press Your Luck</h2>

      {/* Status Bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around' }}>
          <span>🌀 Spins: <b style={{ color: 'var(--gold2)' }}>{spins}</b></span>
          <span>💰 Bank: <b style={{ color: 'var(--green)' }}>${bank.toLocaleString()}</b></span>
          <span>💥 Whammies: <b style={{ color: 'var(--red)' }}>{whammyCount}/4</b></span>
        </div>
      </div>

      {/* Phase 1: Earn Spins */}
      {phase === 'earn' && currentQ && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">Earn Spins: Question {qIndex + 1} of {questions.length}</span>
            <span className="muted">Correct = +1 Spin</span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {currentQ.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {currentQ.choices.map((ch, idx) => (
              <button key={idx} className="btn secondary" onClick={() => handleEarnAnswer(idx)}>
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2: The Big Board */}
      {phase === 'board' && (
        <div className="card center">
          <div className="muted">THE BIG BOARD</div>
          <div style={{ fontSize: 50, margin: '16px 0', minHeight: 70 }}>
            {boardFace}
          </div>

          {spinMessage && <div className="turn-banner" style={{ margin: '8px 0' }}>{spinMessage}</div>}

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn grow"
              disabled={isSpinning || spins <= 0 || whammyCount >= 4}
              onClick={handleSpinBoard}
            >
              🌀 SPIN ({spins} left)
            </button>
            <button className="btn secondary grow" disabled={isSpinning} onClick={handlePass}>
              ✋ PASS & KEEP ${bank.toLocaleString()}
            </button>
          </div>
        </div>
      )}

      {/* Game Over */}
      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Final Results</h2>
          {whammyCount >= 4 ? (
            <div>
              <div className="big">💥💥💥💥</div>
              <div className="err" style={{ fontSize: 18, margin: '8px 0' }}>
                4 WHAMMIES — You're out!
              </div>
            </div>
          ) : (
            <div>
              <div className="muted">Final Banked:</div>
              <div className="big" style={{ color: 'var(--gold2)', margin: '10px 0' }}>
                ${bank.toLocaleString()}
              </div>
            </div>
          )}

          {mode === 'cpu' && botBank !== null && (
            <div className="msg" style={{ margin: '10px 0' }}>
              Computer Opponent Banked: <b>${botBank.toLocaleString()}</b>
              <div className={bank > botBank ? 'ok' : 'err'} style={{ marginTop: 4 }}>
                {bank > botBank ? '🎉 You beat the computer!' : '😞 Computer banked more.'}
              </div>
            </div>
          )}

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win Press Your Luck! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent had a higher bank.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startPressLuck(questions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
