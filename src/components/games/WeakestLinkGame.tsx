import React, { useState, useEffect } from 'react';
import { BANKS2 } from '../../data/banks2';
import { weakestLinkBank, weakestLinkBots, weakestLinkBotSkill, weakestLinkBotVote, fuzzy, pickN, money } from '../../utils/gameLogic';
import { Sound } from '../../services/sound';
import { Wallet, Net, QuizPVP, Auth, PVP_WIN } from '../../services/backend';

interface LinkQuestion {
  q: string;
  a: string;
}

interface Teammate {
  n: string;
  me: boolean;
  c: number;
  w: number;
  skill: number;
}

interface Props {
  mode: 'cpu' | 'pvp';
  onToast: (msg: string) => void;
  onBack: () => void;
}

export const WeakestLinkGame: React.FC<Props> = ({ mode, onToast, onBack }) => {
  const [questions, setQuestions] = useState<LinkQuestion[]>([]);
  const [qIdx, setQIdx] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [chain, setChain] = useState<number>(0);
  const [roundBank, setRoundBank] = useState<number>(0);
  const [totalBank, setTotalBank] = useState<number>(0);
  const [team, setTeam] = useState<Teammate[]>([]);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [log, setLog] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState<string>('');
  const [phase, setPhase] = useState<'chain' | 'vote' | 'final_shootout' | 'done'>('chain');

  // Head-to-head state
  const [finalQIndex, setFinalQIndex] = useState<number>(0);
  const [finalMe, setFinalMe] = useState<number>(0);
  const [finalBot, setFinalBot] = useState<number>(0);
  const [isSuddenDeath, setIsSuddenDeath] = useState<boolean>(false);
  const [cpuWon, setCpuWon] = useState<boolean>(false);

  // PvP state
  const [pvpDone, setPvpDone] = useState<boolean>(false);
  const [iWonPvp, setIWonPvp] = useState<boolean>(false);

  useEffect(() => {
    const list = BANKS2.weakestlink as LinkQuestion[];
    if (!list || list.length < 12) return;

    if (mode === 'pvp' && Net.room) {
      if (Net.isHost()) {
        const picked = pickN(list, 10);
        QuizPVP.hostSet(Net, picked);
        startPvpGame(picked);
      } else {
        Net.onUpdate((r) => {
          const d = (r.state && r.state.items) || null;
          if (d && !questions.length) {
            startPvpGame(d);
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
      startCpuGame(pickN(list, 60));
    }
  }, []);

  const appendLog = (msg: string) => {
    setLog((prev) => [...prev.slice(-6), msg]);
  };

  const startCpuGame = (qs: LinkQuestion[]) => {
    setQuestions(qs);
    const initialTeam: Teammate[] = [
      { n: 'You', me: true, c: 0, w: 0, skill: 1 },
      ...weakestLinkBots().slice(0, 3).map((nm) => ({
        n: nm,
        me: false,
        c: 0,
        w: 0,
        skill: weakestLinkBotSkill(),
      })),
    ];
    setTeam(initialTeam);
    setRound(1);
    setChain(0);
    setRoundBank(0);
    setTotalBank(0);
    setTurnIndex(0);
    setQIdx(0);
    setLog(['— Round 1 — chain the answers!']);
    setPhase('chain');
  };

  const startPvpGame = (qs: LinkQuestion[]) => {
    setQuestions(qs);
    setChain(0);
    setTotalBank(0);
    setQIdx(0);
    setPhase('chain');
  };

  /* Player Bank */
  const handleBank = () => {
    if (chain > 0) {
      const amt = weakestLinkBank(chain);
      if (mode === 'pvp') {
        setTotalBank((prev) => prev + amt);
        appendLog(`🏦 You banked ${money(amt)}!`);
      } else {
        setRoundBank((prev) => prev + amt);
        appendLog(`🏦 You banked ${money(amt)}!`);
      }
      setChain(0);
      Sound.win();
    } else {
      onToast('Nothing in the chain to bank yet');
    }
  };

  /* Player Answer in Chain */
  const handlePlayerAnswer = () => {
    const q = questions[qIdx % questions.length];
    if (!q || !inputVal.trim()) return;
    const ok = fuzzy(inputVal.trim(), q.a);
    setInputVal('');

    if (ok) {
      const nextChain = Math.min(chain + 1, 8);
      setChain(nextChain);
      Sound.beep(760, 0.08);
      appendLog(`✅ You: Correct! (Chain ${nextChain})`);
      setTeam((prev) => prev.map((m) => (m.me ? { ...m, c: m.c + 1 } : m)));
    } else {
      setChain(0);
      Sound.beep(200, 0.15, 'sawtooth');
      appendLog(`❌ You: Wrong (was: ${q.a}) — Chain reset.`);
      setTeam((prev) => prev.map((m) => (m.me ? { ...m, w: m.w + 1 } : m)));
    }

    if (mode === 'pvp') {
      const nextQ = qIdx + 1;
      if (nextQ >= questions.length) {
        setPhase('done');
        QuizPVP.submit(Net, totalBank);
      } else {
        setQIdx(nextQ);
      }
    } else {
      advanceCpuTurn();
    }
  };

  const advanceCpuTurn = () => {
    const nextQ = qIdx + 1;
    setQIdx(nextQ);
    const nextTurn = (turnIndex + 1) % team.length;
    setTurnIndex(nextTurn);

    // If completed cycle of team questions
    if (nextQ % (team.length * 2) === 0) {
      finishChainRound();
    } else if (!team[nextTurn].me) {
      // Bot's turn
      runBotTurn(team[nextTurn]);
    }
  };

  const runBotTurn = (bot: Teammate) => {
    setTimeout(() => {
      const q = questions[qIdx % questions.length];
      if (!q) return;

      const ok = Math.random() < bot.skill;
      if (ok) {
        setChain((prev) => {
          const nextChain = Math.min(prev + 1, 8);
          appendLog(`✅ ${bot.n}: Correct! (Chain ${nextChain})`);
          Sound.beep(660, 0.06);
          return nextChain;
        });
        setTeam((prev) => prev.map((m) => (m.n === bot.n ? { ...m, c: m.c + 1 } : m)));
      } else {
        setChain(0);
        appendLog(`❌ ${bot.n}: Wrong (was: ${q.a}) — Chain reset.`);
        Sound.beep(200, 0.15, 'sawtooth');
        setTeam((prev) => prev.map((m) => (m.n === bot.n ? { ...m, w: m.w + 1 } : m)));
      }

      const nextQ = qIdx + 1;
      setQIdx(nextQ);
      const nextTurn = (turnIndex + 1) % team.length;
      setTurnIndex(nextTurn);

      if (nextQ % (team.length * 2) === 0) {
        finishChainRound();
      } else if (!team[nextTurn].me) {
        runBotTurn(team[nextTurn]);
      }
    }, 900);
  };

  const finishChainRound = () => {
    const newTot = totalBank + roundBank;
    setTotalBank(newTot);
    appendLog(`Round ${round} complete — banked ${money(roundBank)}.`);
    setRoundBank(0);
    setChain(0);

    if (team.length > 2) {
      setPhase('vote');
    } else {
      // Final Shootout!
      setPhase('final_shootout');
      setFinalQIndex(0);
      setFinalMe(0);
      setFinalBot(0);
      setIsSuddenDeath(false);
      appendLog('— HEAD TO HEAD FINAL: 5 questions each —');
    }
  };

  /* Voting Round */
  const handleVote = (targetName: string) => {
    Sound.click();
    const votes: Record<string, number> = {};
    team.forEach((m) => {
      if (!m.me) {
        const v = weakestLinkBotVote(team) || targetName;
        votes[v] = (votes[v] || 0) + 1;
      }
    });
    votes[targetName] = (votes[targetName] || 0) + 1;

    let votedOff = targetName;
    let maxV = -1;
    Object.keys(votes).forEach((nm) => {
      if (votes[nm] > maxV) {
        maxV = votes[nm];
        votedOff = nm;
      }
    });

    if (votedOff === 'You') {
      Sound.lose();
      setCpuWon(false);
      setPhase('done');
      appendLog('🗳 The team voted YOU off as the weakest link! Goodbye.');
      return;
    }

    onToast(`${votedOff} was voted off!`);
    Sound.lose();
    const updatedTeam = team.filter((m) => m.n !== votedOff);
    setTeam(updatedTeam);
    setRound((prev) => prev + 1);
    setTurnIndex(0);
    setPhase('chain');
    appendLog(`🗳 ${votedOff} was eliminated.`);
  };

  /* Final Head-to-Head */
  const handleFinalAnswer = () => {
    const q = questions[qIdx % questions.length];
    if (!q || !inputVal.trim()) return;
    const ok = fuzzy(inputVal.trim(), q.a);
    setInputVal('');

    let meScore = finalMe;
    if (ok) {
      meScore++;
      setFinalMe(meScore);
      Sound.beep(880, 0.1);
    } else {
      Sound.beep(200, 0.15, 'sawtooth');
    }

    // Bot finalist answer
    const botFinalist = team.find((m) => !m.me);
    const bOk = Math.random() < (botFinalist?.skill || 0.65);
    let botScore = finalBot;
    if (bOk) {
      botScore++;
      setFinalBot(botScore);
    }

    appendLog(`You: ${ok ? '✅' : '❌'} (${q.a}) · ${botFinalist?.n}: ${bOk ? '✅' : '❌'}`);

    const nextQ = qIdx + 2;
    setQIdx(nextQ);
    const nextFinalQ = finalQIndex + 1;
    setFinalQIndex(nextFinalQ);

    if (nextFinalQ >= 5) {
      if (meScore !== botScore) {
        const won = meScore > botScore;
        setCpuWon(won);
        setPhase('done');
        if (won) {
          Sound.win();
          Wallet.recordWin('weakestlink').then((p) => onToast(`+${p} ⭐ banked!`));
        } else {
          Sound.lose();
        }
      } else {
        setIsSuddenDeath(true);
        appendLog('— SUDDEN DEATH: Next point wins! —');
      }
    }
  };

  const currentQ = questions[qIdx % (questions.length || 1)];

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small secondary" onClick={onBack}>← Back to Game Menu</button>
      </div>

      <h2>🔗 Weakest Link</h2>

      {/* Ladder and Bank status */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-around', fontSize: 14 }}>
          <span>Round: <b>{round}</b></span>
          <span>🏦 Banked: <b style={{ color: 'var(--gold2)' }}>{money(totalBank)}</b></span>
          {mode === 'cpu' && <span>Round Bank: <b>{money(roundBank)}</b></span>}
        </div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => (
            <span
              key={lvl}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                background: chain >= lvl ? 'rgba(207, 143, 63, 0.3)' : 'var(--bg2)',
                color: chain >= lvl ? 'var(--gold2)' : 'var(--muted)',
                border: chain >= lvl ? '1px solid var(--gold)' : '1px solid var(--line)',
              }}
            >
              ${weakestLinkBank(lvl) / 1000}k
            </span>
          ))}
        </div>
      </div>

      {/* Log box */}
      <div className="card" style={{ padding: 10, minHeight: 65, fontSize: 13, background: 'var(--bg2)' }}>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Phase: Chain */}
      {phase === 'chain' && currentQ && (
        <div className="card center">
          {mode === 'pvp' || team[turnIndex]?.me ? (
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Your Question — Chain pays <b>{money(weakestLinkBank(chain + 1))}</b> if right:
              </div>
              <div className="big" style={{ fontSize: 18, margin: '12px 0' }}>
                {currentQ.q}
              </div>
              <div className="row">
                <input
                  placeholder="Your answer..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePlayerAnswer()}
                  autoFocus
                />
                <button className="btn small" onClick={handlePlayerAnswer}>Submit</button>
              </div>
              <button
                className="btn secondary"
                onClick={handleBank}
                style={{ marginTop: 8 }}
                disabled={chain <= 0}
              >
                🏦 BANK {money(weakestLinkBank(chain))}
              </button>
            </div>
          ) : (
            <div>
              <div className="muted">{team[turnIndex]?.n} is answering...</div>
              <div className="big" style={{ fontSize: 18, margin: '12px 0' }}>
                {currentQ.q}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase: Voting */}
      {phase === 'vote' && (
        <div className="card center">
          <h3>🗳 Vote off the Weakest Link</h3>
          <div className="muted">Who cost the team the most banks? Cast your vote:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, margin: '14px 0' }}>
            {team.filter((m) => !m.me).map((bot) => (
              <button key={bot.n} className="btn secondary" onClick={() => handleVote(bot.n)}>
                🗳 {bot.n} <span className="muted">({bot.c}✓ / {bot.w}✗)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase: Final Shootout */}
      {phase === 'final_shootout' && currentQ && (
        <div className="card center">
          <h3>{isSuddenDeath ? '⚡ SUDDEN DEATH' : `🎯 Final Shootout (Question ${finalQIndex + 1} of 5)`}</h3>
          <div className="status" style={{ margin: '8px 0' }}>
            You: <b>{finalMe}</b> · {team.find((m) => !m.me)?.n}: <b>{finalBot}</b>
          </div>
          <div className="big" style={{ fontSize: 18, margin: '12px 0' }}>
            {currentQ.q}
          </div>
          <div className="row">
            <input
              placeholder="Final answer..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFinalAnswer()}
              autoFocus
            />
            <button className="btn small" onClick={handleFinalAnswer}>Answer</button>
          </div>
        </div>
      )}

      {/* Phase: Game Over */}
      {phase === 'done' && (
        <div className="card center">
          <h2>🏁 Weakest Link Complete</h2>
          <div className="big" style={{ color: 'var(--gold2)', margin: '12px 0' }}>
            Banked Total: {money(totalBank)}
          </div>

          {mode === 'cpu' ? (
            <div className="status">
              {cpuWon ? (
                <span className="ok">🎉 You are NOT the weakest link — YOU WIN!</span>
              ) : (
                <span className="err">😞 You are the weakest link. Goodbye!</span>
              )}
            </div>
          ) : (
            pvpDone ? (
              <div className="status">
                {iWonPvp ? (
                  <span className="ok">🏆 You win the Weakest Link sprint! (+{PVP_WIN} ⭐)</span>
                ) : (
                  <span className="err">😞 Opponent banked more cash.</span>
                )}
              </div>
            ) : (
              <div className="muted">Waiting for opponent to finish...</div>
            )
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => startCpuGame(questions)}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};
