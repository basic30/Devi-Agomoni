import React, { useState, useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { FriendGroupProvider } from './context/FriendGroupContext';
import { HeroBackground } from './components/HeroBackground';
import { TopNav } from './components/TopNav';
import { HeroTitle } from './components/HeroTitle';
import { PlayerBar } from './components/PlayerBar';
import { DeveloperModal } from './components/DeveloperModal';
import { PlaylistModal } from './components/PlaylistModal';
import { GlobalChatModal } from './components/GlobalChatModal';
import { FriendGroupModal } from './components/FriendGroupModal';

export function AppContent() {
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFriendGroupOpen, setIsFriendGroupOpen] = useState(false);
  const [initialInviteCode, setInitialInviteCode] = useState('');

  // Auto-detect invite code from URL (e.g. ?group=PUJA-8472 or ?join=PUJA-8472)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const groupCode = urlParams.get('group') || urlParams.get('join');
      if (groupCode) {
        setInitialInviteCode(groupCode.trim().toUpperCase());
        setIsFriendGroupOpen(true);
      }
    }
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-between overflow-hidden">
      <HeroBackground />

      <TopNav
        onOpenDeveloper={() => setIsDeveloperOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenFriendGroup={() => setIsFriendGroupOpen(true)}
      />

      <HeroTitle />

      <PlayerBar onOpenPlaylist={() => setIsPlaylistOpen(true)} />

      <DeveloperModal open={isDeveloperOpen} onClose={() => setIsDeveloperOpen(false)} />

      <PlaylistModal open={isPlaylistOpen} onClose={() => setIsPlaylistOpen(false)} />

      <GlobalChatModal open={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <FriendGroupModal
        open={isFriendGroupOpen}
        onClose={() => setIsFriendGroupOpen(false)}
        onOpenPlaylist={() => setIsPlaylistOpen(true)}
        initialCode={initialInviteCode}
      />
    </main>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <FriendGroupProvider>
        <AppContent />
      </FriendGroupProvider>
    </PlayerProvider>
  );
}
