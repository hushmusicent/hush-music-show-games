import React from 'react';
import { Sound } from '../services/sound';

export type NavTab = 'home' | 'friends' | 'leaderboard' | 'profile';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Games', icon: '🏠' },
    { id: 'friends', label: 'Friends', icon: '👥' },
    { id: 'leaderboard', label: 'Top 50', icon: '🏆' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <nav className="bottom">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={activeTab === t.id ? 'active' : ''}
          onClick={() => {
            Sound.ensure();
            Sound.click();
            onTabChange(t.id);
          }}
        >
          <span className="e">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
};
