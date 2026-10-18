import React, { useState, useEffect } from 'react';
import { BANKS1, PriceItem } from '../../data/banks1';
import { priceBidWinner, money, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const PriceGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [phase, setPhase] = useState<'row' | 'row_result' | 'plinko' | 'showdown' | 'showcase' | 'pvp_bid' | 'done'>('row');
  const [userBid, setUserBid] = useState<string>('');
  const [winnings, setWinnings] = useState<number>(0);
  const [rowMsg, setRowMsg] = useState<{ actual: number; user: number; bots: { name: string; bid: number }[]; winner: string } | null>(null);

  // Plinko state
  const [plinkoPos, setPlinkoPos] = useState<number>(-1);
  const [chipsLeft, setChipsLeft] = useState<number>(3);
  const [chipResults, setChipResults] = useState<number[]>([]);
  const [isDropping, setIsDropping] = useState<boolean>(false);

  // Showdown state
  const [showdownSpins, setShowdownSpins] = useState<number[]>([]);
  const [botSpins, setBotSpins] = useState<number[]>([]);
  const [showdownDone, setShowdownDone] = useState<boolean>(false);
  const [showdownWon, setShowdownWon] = useState<boolean>(false);

  // Showcase state
  const [showcaseResult, setShowcaseResult] = useState<{ total: number; userBid: number; botBid: number; userWon: boolean } | null>(null);

  // PvP state
  const [pvpItemIndex, setPvpItemIndex] = useState<number>(0);
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [pvpScores, setPvpScores] = useState<Record<string, number>>({});
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const BOTS = ['BuzzerBetty', 'SpinQueen', 'LuckyLucy'];
  const PLINKO_SLOTS = [0, 100, 500, 10000, 500, 100, 0];

  useEffect(() => {
    const list = BANKS1.priceItems;
    if (!list || list.length < 6) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 6);
        QuizPVP.hostSet(Net, picked);
        startPriceGame(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !items.length) {
            startPriceGame(d);
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
      startPriceGame(pickN(list, 6));
    }
  }, []);

  const startPriceGame = (pickedItems: PriceItem[]) => {
    setItems(pickedItems);
    setWinnings(0);
    setUserBid('');
    setChipsLeft(3);
    setChipResults([]);
    setShowdownSpins([]);
    setBotSpins([]);
    setShowdownDone(false);
    setShowdownWon(false);
    setShowcaseResult(null);

    if (mode === 'pvp') {
      setPvpItemIndex(0);
      setPhase('pvp_bid');
    } else {
      setPhase('row');
    }
  };

  /* Contestant's Row */
  const handleRowBid = () => {
    if (!items.length) return;
    const it = items[0];
    const pb = Math.max(1, Math.round(parseFloat(userBid) || 0));
    Sound.click();

    const botBids = BOTS.map(() => Math.max(1, Math.round(it.price * (0.55 + Math.random() * 0.8))));
    const allBids = [pb, ...botBids];
    const w = priceBidWinner(allBids, it.price);

    let winnerName = 'You';
    if (w === 0) {
      setWinnings((prev) => prev + it.price);
      Sound.win();
    } else {
      winnerName = BOTS[w - 1];
      Sound.lose();
    }

    setRowMsg({
      actual: it.price,
      user: pb,
      bots: BOTS.map((b, i) => ({ name: b, bid: botBids[i] })),
      winner: winnerName,
    });
    setPhase('row_result');
  };

  /* Plinko */
  const handleDropPlinko = () => {
    if (isDropping || chipsLeft <= 0) return;
    setIsDropping(true);
    Sound.click();

    let pos = 3;
    let step = 0;

    const interval = setInterval(() => {
      pos = Math.max(0, Math.min(6, pos + (Math.random() < 0.5 ? -1 : 1)));
      setPlinkoPos(pos);
      Sound.beep(300 + step * 70, 0.06);
      step++;

      if (step >= 7) {
        clearInterval(interval);
        const winSlot = PLINKO_SLOTS[pos];
        setWinnings((prev) => prev + winSlot);
        setChipResults((prev) => [...prev, winSlot]);
        setChipsLeft((prev) => prev - 1);
        setIsDropping(false);

        if (winSlot > 0) Sound.win();
        else Sound.lose();
      }
    }, 200);
  };

  /* Showcase Showdown */
  const handleShowdownSpin = () => {
    Sound.click();
    const spin = Math.floor(Math.random() * 101);
    const updated = [...showdownSpins, spin];
    setShowdownSpins(updated);

    if (updated.length >= 2) {
      const b1 = Math.floor(Math.random() * 101);
      const b2 = Math.floor(Math.random() * 101);
      setBotSpins([b1, b2]);

      const pTotal = updated[0] + updated[1];
      const bTotal = b1 + b2;
      const pScore = pTotal <= 100 ? pTotal : -1;
      const bScore = bTotal <= 100 ? bTotal : -1;

      setShowdownDone(true);
      if (pScore >= bScore) {
        setWinnings((prev) => prev + 1000);
        setShowdownWon(true);
        Sound.win();
      } else {
        setShowdownWon(false);
        Sound.lose();
      }
    }
  };

  /* Showcase */
  const handleShowcaseBid = () => {
    const packageItems = items.slice(1, 4);
    const totalVal = packageItems.reduce((acc, it) => acc + it.price, 0);
    const pb = Math.max(1, Math.round(parseFloat(userBid) || 0));
    Sound.click();

    const botBid = Math.max(1, Math.round(totalVal * (0.7 + Math.random() * 0.5)));
    const pDiff = pb <= totalVal ? totalVal - pb : Infinity;
    const bDiff = botBid <= totalVal ? totalVal - botBid : Infinity;
    const userWon = pDiff <= bDiff;

    setShowcaseResult({
      total: totalVal,
      userBid: pb,
      botBid,
      userWon,
    });

    if (userWon) {
      setWinnings((prev) => prev + totalVal);
      Sound.win();
      Wallet.recordWin('price').then((p) => onToast(`🏆 You won The Price Is Right! +${p} ⭐`));
    } else {
      Sound.lose();
    }
    setPhase('done');
  };

  /* PvP Bid Flow */
  const handlePvpBid = () => {
    if (!items.length) return;
    const it = items[pvpItemIndex];
    const pb = Math.max(1, Math.round(parseFloat(userBid) || 0));
    Sound.click();

    let newTotal = winnings;
    if (Math.abs(pb - it.price) <= it.price * 0.2) {
      newTotal += it.price;
      setWinnings(newTotal);
      Sound.win();
      onToast(`🎉 Won! Price was ${money(it.price)}`);
    } else {
      Sound.lose();
      onToast(`Missed — price was ${money(it.price)}`);
    }

    setUserBid('');
    if (pvpItemIndex + 1 < 5) {
      setPvpItemIndex((prev) => prev + 1);
    } else {
      QuizPVP.submit(Net, Math.round(newTotal));
      setPhase('done');
    }
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🏷️ The Price Is Right</h2>

      {/* Total winnings bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="status" style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
          <span>Current Banked Winnings:</span>
          <b style={{ color: 'var(--gold2)', fontSize: 18 }}>{money(winnings)}</b>
        </div>
      </div>

      {/* 1. Contestant's Row */}
      {phase === 'row' && items[0] && (
        <div className="card center">
          <h3>🏷️ Contestant's Row</h3>
          <div className="muted">Closest bid without going over wins the item!</div>
          <div className="big" style={{ margin: '14px 0' }}>{items[0].name}</div>
          <input
            type="number"
            placeholder="Your bid in dollars ($)..."
            value={userBid}
            onChange={(e) => setUserBid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRowBid()}
            style={{ maxWidth: 220, margin: '8px auto' }}
            autoFocus
          />
          <button className="btn" onClick={handleRowBid}>Lock In Bid</button>
        </div>
      )}

      {/* Row Result */}
      {phase === 'row_result' && rowMsg && (
        <div className="card center">
          <h3>Contestant's Row Result</h3>
          <div className="msg" style={{ margin: '10px 0' }}>
            Actual price: <b>{money(rowMsg.actual)}</b><br />
            You: {money(rowMsg.user)}<br />
            {rowMsg.bots.map((b) => (
              <span key={b.name}>{b.name}: {money(b.bid)}<br /></span>
            ))}
          </div>
          <div className={rowMsg.winner === 'You' ? 'ok' : 'err'}>
            {rowMsg.winner === 'You' ? '🎉 You won the item and move on!' : `😞 ${rowMsg.winner} won the row.`}
          </div>
          <button className="btn" onClick={() => setPhase('plinko')} style={{ marginTop: 12 }}>
            Play Plinko →
          </button>
        </div>
      )}

      {/* 2. Plinko */}
      {phase === 'plinko' && (
        <div className="card center">
          <h3>🔴 Plinko</h3>
          <div className="muted">{chipsLeft} chips remaining — drop each one into the slots!</div>

          {/* Pegboard representation */}
          <div style={{ fontSize: 26, letterSpacing: 6, margin: '16px 0' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (i === plinkoPos ? '🔴' : '⚪')).join('')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, margin: '10px 0' }}>
            {PLINKO_SLOTS.map((s, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '6px 0',
                  fontSize: 12,
                  fontWeight: 700,
                  color: s >= 1000 ? 'var(--gold2)' : 'var(--text)',
                }}
              >
                {s >= 1000 ? `${s / 1000}k` : s}
              </div>
            ))}
          </div>

          {chipResults.length > 0 && (
            <div className="status">
              Chips dropped: {chipResults.map((val, i) => `[#${i + 1}: ${money(val)}]`).join(' ')}
            </div>
          )}

          {chipsLeft > 0 ? (
            <button className="btn" disabled={isDropping} onClick={handleDropPlinko}>
              {isDropping ? 'Chip falling...' : 'Drop Chip!'}
            </button>
          ) : (
            <button className="btn" onClick={() => setPhase('showdown')}>
              Showcase Showdown →
            </button>
          )}
        </div>
      )}

      {/* 3. Showcase Showdown */}
      {phase === 'showdown' && (
        <div className="card center">
          <h3>🎡 Showcase Showdown</h3>
          <div className="muted">Spin the wheel up to twice. Closest to 100 without busting wins $1,000!</div>

          <div className="status" style={{ margin: '14px 0', fontSize: 16 }}>
            {showdownSpins.length === 0 ? (
              <span>Spin the wheel!</span>
            ) : (
              <span>
                Your spins: {showdownSpins.join(' + ')}{' '}
                {showdownSpins.length === 2 && <b>= {showdownSpins[0] + showdownSpins[1]}</b>}
              </span>
            )}
            {botSpins.length > 0 && (
              <div>{BOTS[0]} spun: {botSpins.join(' + ')} = <b>{botSpins[0] + botSpins[1]}</b></div>
            )}
          </div>

          {!showdownDone ? (
            <button className="btn" onClick={handleShowdownSpin}>
              Spin Wheel ({showdownSpins.length + 1}/2)
            </button>
          ) : (
            <>
              <div className={showdownWon ? 'ok' : 'err'}>
                {showdownWon ? '🎉 You won the Showcase Showdown! +$1,000' : `😞 ${BOTS[0]} won the showdown.`}
              </div>
              <button className="btn" onClick={() => { setUserBid(''); setPhase('showcase'); }} style={{ marginTop: 12 }}>
                The Showcase →
              </button>
            </>
          )}
        </div>
      )}

      {/* 4. The Showcase */}
      {phase === 'showcase' && (
        <div className="card center">
          <h3>🌟 The Showcase</h3>
          <div className="muted">Here is your showcase package:</div>
          <div style={{ margin: '14px 0', textAlign: 'left', display: 'inline-block' }}>
            {items.slice(1, 4).map((it) => (
              <div key={it.name} style={{ margin: '4px 0' }}>🎁 <b>{it.name}</b></div>
            ))}
          </div>
          <div className="muted">Bid the total showcase value — closest without going over wins!</div>
          <input
            type="number"
            placeholder="Showcase total bid ($)..."
            value={userBid}
            onChange={(e) => setUserBid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleShowcaseBid()}
            style={{ maxWidth: 220, margin: '8px auto' }}
            autoFocus
          />
          <button className="btn" onClick={handleShowcaseBid}>Submit Showcase Bid</button>
        </div>
      )}

      {/* PvP Mode Bid Item */}
      {phase === 'pvp_bid' && items[pvpItemIndex] && (
        <div className="card center">
          <h3>🏷️ PvP Item {pvpItemIndex + 1} of 5</h3>
          <div className="big" style={{ margin: '12px 0' }}>{items[pvpItemIndex].name}</div>
          <div className="muted">Guess within 20% of the true price to win its value!</div>
          <input
            type="number"
            placeholder="Your estimate ($)..."
            value={userBid}
            onChange={(e) => setUserBid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePvpBid()}
            style={{ maxWidth: 220, margin: '8px auto' }}
            autoFocus
          />
          <button className="btn" onClick={handlePvpBid}>Submit Bid</button>
        </div>
      )}

      {/* Final Game Over */}
      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 The Price Is Right Over!</h2>
          {showcaseResult && (
            <div className="msg" style={{ margin: '12px 0' }}>
              Showcase Actual Value: <b>{money(showcaseResult.total)}</b><br />
              Your Bid: {money(showcaseResult.userBid)}<br />
              Opponent's Bid: {money(showcaseResult.botBid)}<br />
              <b>{showcaseResult.userWon ? '🎉 Showcase WON!' : 'Showcase Missed.'}</b>
            </div>
          )}

          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0' }}>
            Total Banked: {money(winnings)}
          </div>

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win the PvP match! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent won more items.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 12 }} onClick={() => startPriceGame(items)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
