import React, { useState } from 'react';
import { Auth, Wallet, Backend, Voice, store, DAILY_BONUS } from '../../services/backend';
import { Sound } from '../../services/sound';

interface Props {
  onToast: (msg: string) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<Props> = ({ onToast, onLogout }) => {
  const user = Auth.user;
  const fbConfig = store.get<any>('fb_config', {});
  const [apiKey, setApiKey] = useState<string>(fbConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState<string>(fbConfig.authDomain || '');
  const [databaseURL, setDatabaseURL] = useState<string>(fbConfig.databaseURL || '');
  const [projectId, setProjectId] = useState<string>(fbConfig.projectId || '');
  const [appId, setAppId] = useState<string>(fbConfig.appId || '');
  const [workerUrl, setWorkerUrl] = useState<string>(store.get<string>('voice_worker', ''));

  const handleSaveFirebase = () => {
    Sound.click();
    const cfg = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      databaseURL: databaseURL.trim(),
      projectId: projectId.trim(),
      appId: appId.trim(),
    };
    store.set('fb_config', cfg);
    onToast('Firebase keys saved! Reload the app to connect.');
  };

  const handleSaveVoice = () => {
    Sound.click();
    store.set('voice_worker', workerUrl.trim());
    onToast('LiveKit token server URL saved!');
  };

  const handleClaimDaily = async () => {
    const success = await Wallet.claimDaily();
    if (success) {
      onToast(`🎁 Daily bonus claimed! +${DAILY_BONUS} ⭐`);
    } else {
      onToast('Daily bonus already claimed. Come back tomorrow!');
    }
  };

  const winsList = Object.keys(Wallet.wins)
    .filter((k) => Wallet.wins[k] > 0)
    .map((k) => `${k}: ${Wallet.wins[k]}`)
    .join(' · ') || 'No wins yet';

  return (
    <div>
      <h2>👤 Profile</h2>

      {/* User Info Card */}
      <div className="card">
        <div className="big">{user?.username || 'Player'}</div>
        <div className="muted">{user?.email || 'Demo Account'}</div>

        <div className="muted" style={{ marginTop: 8 }}>
          Player code: <span className="codechip">{user?.code || '------'}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="pill gold grow">⭐ {Wallet.balance.toLocaleString()} points</div>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          Wins: <b>{winsList}</b>
        </div>

        {Wallet.canDaily() && (
          <button className="btn" onClick={handleClaimDaily} style={{ marginTop: 12 }}>
            🎁 Claim daily +{DAILY_BONUS} ⭐
          </button>
        )}

        <button className="btn secondary" onClick={onLogout} style={{ marginTop: 10 }}>
          Log Out
        </button>
      </div>

      {/* Setup Card */}
      <div className="card">
        <h3>⚙️ Setup — Unlock Online Features</h3>

        <div className="msg" style={{ margin: '10px 0' }}>
          Firebase:{' '}
          {Backend.configured() ? (
            <span className="ok">connected ✅</span>
          ) : (
            <span className="err">not connected — demo mode (stored on device)</span>
          )}
          <br />
          Voice token server:{' '}
          {Voice.configured() ? (
            <span className="ok">URL saved ✅</span>
          ) : (
            <span className="err">no URL — voice disabled</span>
          )}
        </div>

        <label>Firebase apiKey</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIzaSy..."
        />

        <label>Firebase authDomain</label>
        <input
          value={authDomain}
          onChange={(e) => setAuthDomain(e.target.value)}
          placeholder="your-project.firebaseapp.com"
        />

        <label>Firebase databaseURL</label>
        <input
          value={databaseURL}
          onChange={(e) => setDatabaseURL(e.target.value)}
          placeholder="https://your-project-default-rtdb.firebaseio.com"
        />

        <label>Firebase projectId</label>
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="your-project"
        />

        <label>Firebase appId</label>
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="1:123456:web:abcdef"
        />

        <button className="btn" onClick={handleSaveFirebase}>
          Save Firebase Keys
        </button>

        <label style={{ marginTop: 14 }}>Cloudflare Worker URL (LiveKit Voice Token Server)</label>
        <input
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          placeholder="https://your-worker.workers.dev"
        />

        <button className="btn" onClick={handleSaveVoice}>
          Save Token Server URL
        </button>

        <button className="btn secondary" onClick={() => window.location.reload()} style={{ marginTop: 10 }}>
          Reload App
        </button>

        <div className="muted" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6 }}>
          <b>1.</b> Go to <b>console.firebase.google.com</b> → create a project (free <b>Spark</b> plan, no card needed) → Enable <b>Email/Password</b> Authentication → Create a <b>Realtime Database</b>.<br />
          <b>2.</b> Project settings → Your apps → Web app → copy the <b>firebaseConfig</b> values into the 5 fields above → Save.<br />
          <b>3.</b> Deploy your <b>Cloudflare Worker</b> token server (it mints LiveKit tokens using server-side env vars so secrets never leak).<br />
          <b>4.</b> Paste the worker URL above → Save.<br />
          <b>5.</b> Reload the app. Firebase enables persistent accounts, friends, and online PvP.
        </div>
      </div>
    </div>
  );
};
