import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { v100Pick, v100QuestionValue, mobEliminate, v100MobSplit, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface MobQ {
  q: string;
  choices: string[];
  correct: number;
  tier: number;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const OneVs100Game: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [questions, setQuestions] = useState<MobQ[]>([]);
  const [qIdx, setQIdx] = useState<number>(0);
  const [mobCount, setMobCount] = useState<number>(100);
  const [totalEliminated, setTotalEliminated] = useState<number>(0);
  const [winnings, setWinnings] = useState<number>(0);
  const [survivedCount, setSurvivedCount] = useState<number>(0);
  const [helps, setHelps] = useState<{ poll: boolean; ask: boolean; double: boolean }>({ poll: true, ask: true, double: true });
  const [isDoubled, setIsDoubled] = useState<boolean>(false);
  const [helpInfo, setHelpInfo] = useState<string>('');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [lost, setLost] = useState<boolean>(false);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  useEffect(() => {
    const list = BANKS2.v100 as MobQ[];
    if (!list || list.length < 10) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = v100Pick(list);
        QuizPVP.hostSet(Net, picked);
        start1v100(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !questions.length) {
            start1v100(d);
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
      start1v100(v100Pick(list));
    }
  }, []);

  const start1v100 = (qs: MobQ[]) => {
    setQuestions(qs);
    setQIdx(0);
    setMobCount(100);
    setTotalEliminated(0);
    setWinnings(0);
    setSurvivedCount(0);
    setHelps({ poll: true, ask: true, double: true });
    setIsDoubled(false);
    setHelpInfo('');
    setGameOver(false);
    setLost(false);
  };

  const currentQ = questions[qIdx];

  const handleAnswer = (choiceIdx: number) => {
    if (!currentQ || gameOver) return;
    Sound.click();

    if (choiceIdx === currentQ.correct) {
      const eliminated = mobEliminate(mobCount, currentQ.tier);
      const newMob = Math.max(0, mobCount - eliminated);
      setMobCount(newMob);
      setTotalEliminated((prev) => prev + eliminated);
      setSurvivedCount((prev) => prev + 1);

      const val = v100QuestionValue(currentQ.tier) * (isDoubled ? 2 : 1);
      const earned = eliminated * val;
      const newWin = winnings + earned;
      setWinnings(newWin);
      setIsDoubled(false);
      setHelpInfo('');

      Sound.win();
      onToast(`✅ Correct! ${eliminated} mob members eliminated (+${money(earned)})`);

      if (newMob <= 0) {
        finishGame(false, newWin, survivedCount + 1, totalEliminated + eliminated);
      } else if (qIdx + 1 >= questions.length) {
        finishGame(false, newWin, survivedCount + 1, totalEliminated + eliminated);
      } else {
        setQIdx((prev) => prev + 1);
      }
    } else {
      Sound.lose();
      setLost(true);
      finishGame(true, winnings, survivedCount, totalEliminated);
    }
  };

  const handlePoll = () => {
    if (!currentQ || !helps.poll) return;
    Sound.click();
    setHelps((prev) => ({ ...prev, poll: false }));
    const sp = v100MobSplit(currentQ.tier);
    setHelpInfo(`📊 Mob Poll: ${sp[0]}% say "${currentQ.choices[currentQ.correct]}", with ${sp[1]}% and ${sp[2]}% on the others.`);
  };

  const handleAsk = () => {
    if (!currentQ || !helps.ask) return;
    Sound.click();
    setHelps((prev) => ({ ...prev, ask: false }));
    const wrongs = currentQ.choices.map((_, i) => i).filter((i) => i !== currentQ.correct);
    const wrongPick = wrongs[Math.floor(Math.random() * wrongs.length)];
    setHelpInfo(`🎤 Mob #34: "I'm sure it's ${currentQ.choices[currentQ.correct]}!"\n🎤 Mob #87: "No way, it has to be ${currentQ.choices[wrongPick]}!"`);
  };

  const handleDouble = () => {
    if (!helps.double) return;
    Sound.win();
    setHelps((prev) => ({ ...prev, double: false }));
    setIsDoubled(true);
    onToast('Double Dollars active for this question!');
  };

  const finishGame = (isLoss: boolean, finalWin: number, survived: number, elim: number) => {
    setGameOver(true);
    setLost(isLoss);

    if (mode === 'pvp') {
      QuizPVP.submit(Net, survived * 10000 + elim);
    } else {
      const pts = Math.max(1, Math.round(finalWin / 1000));
      if (!isLoss) {
        Wallet.add(pts, '1v100');
        Wallet.recordWin('1v100').then((p) => onToast(`+${p} ⭐ banked!`));
      } else if (finalWin > 0) {
        Wallet.add(pts, '1v100');
      }
    }
  };

  if (!currentQ) {
    return <div className="card center"><div className="muted">Loading 1 vs 100...</div></div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>💯 1 vs 100</h2>

      {/* Progress & Mob Health Bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around', marginBottom: 6 }}>
          <span>Question: <b>{qIdx + 1} / 10</b></span>
          <span>👥 Mob: <b style={{ color: 'var(--red)' }}>{mobCount} / 100</b></span>
          <span>💰 Bank: <b style={{ color: 'var(--gold2)' }}>{money(winnings)}</b></span>
        </div>
        <div style={{ background: '#222', borderRadius: 8, height: 12, overflow: 'hidden' }}>
          <div
            style={{
              width: `${mobCount}%`,
              height: '100%',
              backgroundColor: 'var(--gold)',
              borderRadius: 8,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {!gameOver && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="pill gold">
              {currentQ.tier === 1 ? '🟢 Easy' : currentQ.tier === 2 ? '🟡 Medium' : '🔴 Hard'}
            </span>
            <span className="muted">
              Value: {money(v100QuestionValue(currentQ.tier) * (isDoubled ? 2 : 1))} / mob member
              {isDoubled && ' (DOUBLED!)'}
            </span>
          </div>

          <div className="big" style={{ fontSize: 18, margin: '14px 0' }}>
            {currentQ.q}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {currentQ.choices.map((ch, idx) => (
              <button key={idx} className="btn secondary" onClick={() => handleAnswer(idx)}>
                {ch}
              </button>
            ))}
          </div>

          {/* Lifelines */}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small secondary grow" disabled={!helps.poll} onClick={handlePoll}>
              📊 Poll Mob
            </button>
            <button className="btn small secondary grow" disabled={!helps.ask} onClick={handleAsk}>
              🎤 Ask Mob
            </button>
            <button className="btn small secondary grow" disabled={!helps.double} onClick={handleDouble}>
              ✌️ Double $
            </button>
          </div>

          {helpInfo && (
            <div className="msg" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>
              {helpInfo}
            </div>
          )}
        </div>
      )}

      {gameOver && (
        <div className="card center">
          <h2>🏁 1 vs 100 Complete</h2>
          {mobCount <= 0 && !lost && (
            <div className="ok" style={{ fontSize: 20, margin: '10px 0' }}>
              👥💥 YOU BEAT THE ENTIRE MOB!
            </div>
          )}
          {lost && (
            <div className="err" style={{ fontSize: 18, margin: '10px 0' }}>
              ❌ Wrong answer! The Mob survives.
            </div>
          )}
          {!lost && mobCount > 0 && (
            <div className="ok" style={{ fontSize: 18, margin: '10px 0' }}>
              🎉 You survived all 10 questions!
            </div>
          )}

          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0' }}>
            Final Winnings: {money(winnings)}
          </div>
          <div className="muted">
            Questions survived: {survivedCount}/10 · Mob members knocked out: {totalEliminated}
          </div>

          {mode === 'pvp' && (
            pvpDone ? (
              <div className="status" style={{ marginTop: 12 }}>
                {iWonPvp ? (
                  <span className="ok">🏆 You eliminated more mob members! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent went further against the mob.</span>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => start1v100(questions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
