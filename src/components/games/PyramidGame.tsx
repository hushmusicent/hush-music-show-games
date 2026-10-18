import React, { useState, useEffect, useRef } from 'react';
import { BANKS2 } from '../../data/banks2';
import { pyramidNorm, pyramidBotScore, fuzzy, pickN } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface PyramidList {
  title: string;
  items: { clue: string; answer: string }[];
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const PyramidGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [lists, setLists] = useState<PyramidList[]>([]);
  const [listIdx, setListIdx] = useState<number>(0);
  const [clueIdx, setClueIdx] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [userTotal, setUserTotal] = useState<number>(0);
  const [botTotal, setBotTotal] = useState<number>(0);
  const [timerSecs, setTimerSecs] = useState<number>(60);
  const [inputVal, setInputVal] = useState<string>('');
  const [phase, setPhase] = useState<'playing' | 'list_complete' | 'done'>('playing');

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const raw = BANKS2.pyramid as any[];
    if (!raw || !raw.length) return;

    const normalized = raw
      .map(pyramidNorm)
      .filter((l) => l.items && l.items.length >= 7)
      .map((l) => ({ title: l.title, items: l.items.slice(0, 7) }));

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(normalized, 3);
        QuizPVP.hostSet(Net, picked);
        startPyramid(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !lists.length) {
            startPyramid(d);
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
      startPyramid(pickN(normalized, 3));
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startPyramid = (picked: PyramidList[]) => {
    setLists(picked);
    setListIdx(0);
    setUserTotal(0);
    setBotTotal(0);
    startList(0, 0, picked);
  };

  const startList = (lIndex: number, currentTot: number, allLists: PyramidList[]) => {
    setListIdx(lIndex);
    setClueIdx(0);
    setCorrectCount(0);
    setTimerSecs(60);
    setInputVal('');
    setPhase('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeExpired(lIndex, currentTot, allLists);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGuess = () => {
    const curList = lists[listIdx];
    if (!curList || !inputVal.trim()) return;

    const curItem = curList.items[clueIdx];
    if (fuzzy(inputVal.trim(), curItem.answer)) {
      Sound.beep(880, 0.1);
      const nextCorrect = correctCount + 1;
      setCorrectCount(nextCorrect);
      setInputVal('');

      if (clueIdx + 1 >= curList.items.length) {
        completeList(nextCorrect);
      } else {
        setClueIdx((prev) => prev + 1);
      }
    } else {
      Sound.beep(200, 0.15, 'sawtooth');
      onToast('Not quite — keep trying or skip!');
    }
  };

  const handleSkip = () => {
    Sound.click();
    const curList = lists[listIdx];
    setInputVal('');
    if (clueIdx + 1 >= curList.items.length) {
      completeList(correctCount);
    } else {
      setClueIdx((prev) => prev + 1);
    }
  };

  const handleTimeExpired = (_lIndex: number, _currentTot: number, _allLists: PyramidList[]) => {
    Sound.lose();
    completeList(correctCount);
  };

  const completeList = (gotCount: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const bScore = pyramidBotScore();
    setBotTotal((prev) => prev + bScore);
    const newTot = userTotal + gotCount;
    setUserTotal(newTot);

    if (listIdx + 1 >= lists.length) {
      setPhase('done');
      if (mode === 'pvp') {
        QuizPVP.submit(Net, newTot);
      } else {
        if (newTot >= botTotal + bScore) {
          Sound.win();
          Wallet.recordWin('pyramid').then((p) => onToast(`+${p} ⭐ banked!`));
        } else {
          Sound.lose();
        }
      }
    } else {
      setPhase('list_complete');
    }
  };

  const currentList = lists[listIdx];
  const currentItem = currentList?.items[clueIdx];

  if (!currentList) {
    return <div className="card center"><div className="muted">Loading Pyramid...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🔺 The $100,000 Pyramid</h2>

      {/* Header bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around' }}>
          <span>List <b>{listIdx + 1} of {lists.length}</b></span>
          <span>⏱ <b style={{ color: 'var(--gold2)' }}>{timerSecs}s</b></span>
          <span>✅ <b>{correctCount} / 7</b></span>
          <span>Total: <b>{userTotal}</b></span>
        </div>
      </div>

      {phase === 'playing' && currentItem && (
        <div className="card center">
          <div className="muted">Category:</div>
          <h3 style={{ fontSize: 20, margin: '6px 0 14px' }}>{currentList.title}</h3>

          <div style={{ background: 'var(--bg2)', padding: 14, borderRadius: 12, margin: '12px 0' }}>
            <div className="muted" style={{ fontSize: 13 }}>Clue {clueIdx + 1} of 7:</div>
            <div className="big" style={{ fontSize: 20, margin: '8px 0', color: 'var(--gold2)' }}>
              {currentItem.clue}
            </div>
          </div>

          <div className="row">
            <input
              placeholder="What is the word..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
              autoFocus
            />
            <button className="btn small" onClick={handleGuess}>Guess</button>
            <button className="btn small secondary" onClick={handleSkip}>Skip</button>
          </div>
        </div>
      )}

      {phase === 'list_complete' && (
        <div className="card center">
          <h3>List {listIdx + 1} Complete!</h3>
          <div className="status" style={{ margin: '14px 0' }}>
            You guessed <b>{correctCount}</b> of 7 words!
          </div>
          <button className="btn" onClick={() => startList(listIdx + 1, userTotal, lists)}>
            Next List ▶
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Winner's Circle Complete!</h2>
          <div className="big" style={{ margin: '12px 0', color: 'var(--gold2)' }}>
            Your Score: {userTotal} words {mode === 'cpu' && <>| Computer: {botTotal} words</>}
          </div>

          {mode === 'pvp' ? (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win the Pyramid Winner's Circle! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent guessed more words.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          ) : (
            <div className="status">
              {userTotal >= botTotal ? (
                <span className="ok">🎉 You defeated the computer in the Winner's Circle!</span>
              ) : (
                <span className="err">😞 Computer guessed more words this time.</span>
              )}
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startPyramid(lists)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
