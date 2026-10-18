import React, { useState, useEffect } from 'react';
import { dealCaseValues, dealShuffle, dealRoundOpens, bankerOffer, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const DealGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [values, setValues] = useState<number[]>([]);
  const [myCase, setMyCase] = useState<number>(-1);
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const [round, setRound] = useState<number>(0);
  const [toOpen, setToOpen] = useState<number>(6);
  const [phase, setPhase] = useState<'pick' | 'play' | 'offer' | 'final' | 'done'>('pick');
  const [bankerAmt, setBankerAmt] = useState<number>(0);
  const [wonAmount, setWonAmount] = useState<number>(0);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const ROUND_OPENS = dealRoundOpens();
  const ALL_VALUES = dealCaseValues().slice().sort((a, b) => a - b);

  useEffect(() => {
    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const sh = dealShuffle();
        QuizPVP.hostSet(Net, sh);
        startDeal(sh);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !values.length) {
            startDeal(d);
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
      startDeal(dealShuffle());
    }
  }, []);

  const startDeal = (vals: number[]) => {
    setValues(vals);
    setMyCase(-1);
    setOpened({});
    setRound(0);
    setToOpen(ROUND_OPENS[0]);
    setPhase('pick');
    setBankerAmt(0);
    setWonAmount(0);
  };

  const getRemainingValues = (includeMy: boolean = true) => {
    const rem: number[] = [];
    for (let i = 0; i < 26; i++) {
      if (!opened[i] && (includeMy || i !== myCase)) {
        rem.push(values[i]);
      }
    }
    return rem;
  };

  const handleCaseClick = (idx: number) => {
    Sound.click();
    if (phase === 'pick') {
      setMyCase(idx);
      setPhase('play');
      setRound(0);
      setToOpen(ROUND_OPENS[0]);
      return;
    }

    if (phase === 'play' && idx !== myCase && !opened[idx]) {
      const newOpened = { ...opened, [idx]: true };
      setOpened(newOpened);
      const val = values[idx];
      onToast(`Case ${idx + 1} held ${money(val)}`);

      if (val >= 100000) Sound.lose();
      else Sound.beep(520, 0.1);

      const nextToOpen = toOpen - 1;
      setToOpen(nextToOpen);

      if (nextToOpen <= 0) {
        // Calculate offer
        const rem = [];
        for (let i = 0; i < 26; i++) {
          if (!newOpened[i]) rem.push(values[i]);
        }
        const off = bankerOffer(rem, round);
        setBankerAmt(off);
        setPhase('offer');
      }
    }
  };

  const handleDeal = () => {
    Sound.win();
    finishGame(bankerAmt);
  };

  const handleNoDeal = () => {
    Sound.click();
    const nextR = round + 1;
    setRound(nextR);
    if (nextR >= ROUND_OPENS.length) {
      setPhase('final');
    } else {
      setToOpen(ROUND_OPENS[nextR]);
      setPhase('play');
    }
  };

  const handleKeepFinal = () => {
    Sound.win();
    finishGame(values[myCase]);
  };

  const handleSwapFinal = () => {
    Sound.win();
    let otherCase = -1;
    for (let i = 0; i < 26; i++) {
      if (!opened[i] && i !== myCase) {
        otherCase = i;
        break;
      }
    }
    finishGame(values[otherCase]);
  };

  const finishGame = (amount: number) => {
    setWonAmount(amount);
    setPhase('done');

    if (mode === 'pvp') {
      QuizPVP.submit(Net, Math.round(amount));
    } else {
      const pts = Math.max(1, Math.round(amount / 1000));
      Wallet.add(pts, 'deal');
      Wallet.recordWin('deal').then((p) => onToast(`🏆 Deal or No Deal won! +${p} ⭐`));
    }
  };

  if (!values.length) {
    return <div className="card center"><div className="muted">Setting up cases...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>💼 Deal or No Deal</h2>

      {/* Case Money Board Ladder */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
          {ALL_VALUES.map((val) => {
            let isGone = false;
            for (let i = 0; i < 26; i++) {
              if (opened[i] && values[i] === val) {
                isGone = true;
                break;
              }
            }
            return (
              <span
                key={val}
                style={{
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: isGone ? '#222' : 'var(--card2)',
                  color: isGone ? '#666' : 'var(--gold2)',
                  textDecoration: isGone ? 'line-through' : 'none',
                  border: isGone ? '1px solid transparent' : '1px solid var(--line)',
                }}
              >
                {money(val)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main Game Interface */}
      {phase === 'pick' && (
        <div className="card center">
          <div className="status">Pick <b>YOUR</b> case to keep until the end:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, margin: '14px 0' }}>
            {values.map((_, i) => (
              <button
                key={i}
                className="btn small"
                onClick={() => handleCaseClick(i)}
                style={{ padding: '12px 0', fontSize: 16 }}
              >
                💼 {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'play' && (
        <div className="card center">
          <div className="row" style={{ justifyContent: 'space-around', marginBottom: 10 }}>
            <span>Your case: <b style={{ color: 'var(--gold2)' }}>⭐ Case {myCase + 1}</b></span>
            <span>Open <b>{toOpen}</b> more {toOpen === 1 ? 'case' : 'cases'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {values.map((val, i) => {
              if (opened[i]) {
                return (
                  <div
                    key={i}
                    className="muted"
                    style={{
                      padding: '10px 0',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      fontSize: 11,
                      background: 'var(--bg2)',
                    }}
                  >
                    {money(val)}
                  </div>
                );
              }
              if (i === myCase) {
                return (
                  <div
                    key={i}
                    style={{
                      padding: '10px 0',
                      border: '2px solid var(--gold)',
                      borderRadius: 8,
                      color: 'var(--gold2)',
                      fontWeight: 800,
                    }}
                  >
                    ⭐
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  className="btn small"
                  onClick={() => handleCaseClick(i)}
                  style={{ padding: '10px 0' }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            Round {round + 1} of {ROUND_OPENS.length}
          </div>
        </div>
      )}

      {phase === 'offer' && (
        <div className="card center">
          <div className="muted">📞 The Banker offers:</div>
          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0', fontSize: 32 }}>
            {money(bankerAmt)}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn grow" onClick={handleDeal}>
              💰 DEAL
            </button>
            <button className="btn secondary grow" onClick={handleNoDeal}>
              NO DEAL
            </button>
          </div>
        </div>
      )}

      {phase === 'final' && (
        <div className="card center">
          <h3>Two cases remain!</h3>
          <div className="muted" style={{ margin: '8px 0' }}>
            Will you keep your original case or swap with the last remaining case?
          </div>
          <div className="row" style={{ margin: '14px 0' }}>
            <div className="grow">
              <div className="big">⭐</div>
              <div className="muted">Your Case ({myCase + 1})</div>
            </div>
            <div className="grow">
              <div className="big">💼</div>
              <div className="muted">Remaining Case</div>
            </div>
          </div>
          <div className="row">
            <button className="btn grow" onClick={handleKeepFinal}>
              KEEP MINE
            </button>
            <button className="btn secondary grow" onClick={handleSwapFinal}>
              SWAP CASES
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <div className="muted">You walked away with</div>
          <div className="big" style={{ color: 'var(--gold2)', fontSize: 34, margin: '12px 0' }}>
            {money(wonAmount)}
          </div>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You beat your opponent's case! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent walked away with more.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          ) : (
            <div className="status">
              <span className="ok">🎉 You banked {money(wonAmount)}!</span>
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startDeal(dealShuffle())}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
