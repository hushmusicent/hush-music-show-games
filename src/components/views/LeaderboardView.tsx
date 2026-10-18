import React, { useState, useEffect } from 'react';
import { Board, LeaderboardRow, Auth } from '../../services/backend';

export const LeaderboardView: React.FC = () => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    const top = await Board.top50();
    const rank = await Board.myRank();
    setRows(top);
    setMyRank(rank);
    setLoading(false);
  };

  return (
    <div>
      <h2>🏆 Top 50 Leaderboard</h2>

      <div className="card">
        {loading ? (
          <div className="muted center">Loading scores...</div>
        ) : (
          <>
            <table className="lb">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Player</th>
                  <th>⭐ Points</th>
                  <th style={{ textAlign: 'right' }}>Wins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = r.uid === Auth.user?.uid;
                  const winCount = r.wins ? Object.values(r.wins).reduce((a, b) => a + b, 0) : 0;
                  return (
                    <tr key={r.uid} className={isMe ? 'me' : ''}>
                      <td>{i + 1}</td>
                      <td><b>{r.username}</b></td>
                      <td>{(r.points || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{winCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="center" style={{ marginTop: 14 }}>
              {myRank ? (
                <span>Your rank: <b style={{ color: 'var(--gold2)' }}>#{myRank}</b></span>
              ) : (
                <span className="muted">Play games to enter the Top 50!</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
