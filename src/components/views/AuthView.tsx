import React, { useState } from 'react';
import { Auth, Backend, Wallet, Friends } from '../../services/backend';
import { Sound } from '../../services/sound';

interface Props {
  onSuccess: () => void;
  onToast: (msg: string) => void;
}

export const AuthView: React.FC<Props> = ({ onSuccess, onToast }) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    Sound.click();

    try {
      if (tab === 'login') {
        await Auth.login(email, password);
        await Wallet.load();
        Friends.setOnline(true);
        onToast('Welcome back!');
        onSuccess();
      } else if (tab === 'signup') {
        await Auth.signup(username, email, password);
        await Wallet.load();
        Friends.setOnline(true);
        onToast('Account created! +1,000 ⭐ starting points granted.');
        onSuccess();
      } else {
        await Auth.resetPassword(email);
        setSuccessMsg('Reset email sent — check your inbox.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: '20px auto 0' }}>
      <div className="card">
        <h2>🎙️ Welcome to Hush Music Show Games</h2>
        <div className="muted" style={{ marginBottom: 12 }}>
          16 classic TV game shows · Win points · Challenge friends
        </div>

        {!Backend.configured() && (
          <div className="msg" style={{ marginBottom: 14 }}>
            <b>Demo Mode:</b> Accounts are saved on this device. Connect your free Firebase keys in Profile → Setup to enable cross-device accounts, real friends, and online PvP.
          </div>
        )}

        <div className="betrow" style={{ marginBottom: 14 }}>
          <button
            className={tab === 'login' ? 'sel' : ''}
            onClick={() => {
              Sound.click();
              setTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Log In
          </button>
          <button
            className={tab === 'signup' ? 'sel' : ''}
            onClick={() => {
              Sound.click();
              setTab('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Sign Up
          </button>
          <button
            className={tab === 'forgot' ? 'sel' : ''}
            onClick={() => {
              Sound.click();
              setTab('forgot');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Forgot Password
          </button>
        </div>

        {tab === 'signup' && (
          <>
            <label>Username (3-16 letters, numbers or _)</label>
            <input
              value={username}
              maxLength={16}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ShowtimeSam"
            />
          </>
        )}

        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="player@example.com"
        />

        {tab !== 'forgot' && (
          <>
            <label>Password (6+ characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </>
        )}

        {errorMsg && <div className="err" style={{ marginTop: 8 }}>{errorMsg}</div>}
        {successMsg && <div className="ok" style={{ marginTop: 8 }}>{successMsg}</div>}

        <button className="btn" disabled={loading} onClick={handleSubmit} style={{ marginTop: 14 }}>
          {loading ? (
            'Processing...'
          ) : tab === 'login' ? (
            'Log In'
          ) : tab === 'signup' ? (
            'Create Account — Get 1,000 ⭐ Free'
          ) : (
            'Send Reset Email'
          )}
        </button>
      </div>
    </div>
  );
};
