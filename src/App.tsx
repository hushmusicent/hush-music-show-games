import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeView } from './components/views/HomeView';
import { FriendsView } from './components/views/FriendsView';
import { LeaderboardView } from './components/views/LeaderboardView';
import { ProfileView } from './components/views/ProfileView';
import { AuthView } from './components/views/AuthView';
import { GameView } from './components/views/GameView';
import { Auth, Wallet, Backend, Voice, Friends } from './services/backend';
import { Sound } from './services/sound';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(Auth.user);
  const [points, setPoints] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(Sound.muted);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    // Initialize backend
    Backend.init().then(() => {
      Auth.onAuth(async (u) => {
        setCurrentUser(u);
        if (u) {
          await Wallet.load();
          setPoints(Wallet.balance);
          Friends.setOnline(true);
        }
      });
    });

    Wallet.onChange(() => {
      setPoints(Wallet.balance);
    });

    const handleBeforeUnload = () => {
      Friends.setOnline(false);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const addToast = (text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [{ id, text }, ...prev]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleToggleSound = () => {
    const isMuted = Sound.toggle();
    setSoundMuted(isMuted);
  };

  const handleToggleMic = () => {
    const isMicMuted = Voice.toggleMic();
    setMicMuted(isMicMuted);
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveGameId(null);
    setActiveTab(tab);
  };

  const handleLogout = async () => {
    await Friends.setOnline(false);
    await Auth.logout();
    setCurrentUser(null);
    setActiveTab('home');
    setActiveGameId(null);
  };

  return (
    <div>
      <Header
        points={points}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
        voiceActive={voiceActive}
        micMuted={micMuted}
        onToggleMic={handleToggleMic}
      />

      <main>
        {/* Toast notifications */}
        {toasts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {toasts.map((t) => (
              <div key={t.id} className="msg">
                {t.text}
              </div>
            ))}
          </div>
        )}

        {!currentUser ? (
          <AuthView onSuccess={() => setActiveTab('home')} onToast={addToast} />
        ) : activeGameId ? (
          <GameView
            gameId={activeGameId}
            onBack={() => setActiveGameId(null)}
            onToast={addToast}
            onVoiceStateChange={(active) => setVoiceActive(active)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeView
                onSelectGame={(id) => setActiveGameId(id)}
                onToast={addToast}
                canClaimDaily={Wallet.canDaily()}
                onDailyClaimed={() => setPoints(Wallet.balance)}
              />
            )}
            {activeTab === 'friends' && <FriendsView onToast={addToast} />}
            {activeTab === 'leaderboard' && <LeaderboardView />}
            {activeTab === 'profile' && (
              <ProfileView onToast={addToast} onLogout={handleLogout} />
            )}
          </>
        )}
      </main>

      {currentUser && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
};
