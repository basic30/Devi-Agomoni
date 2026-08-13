import React, { useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { HeroBackground } from './components/HeroBackground';
import { TopNav } from './components/TopNav';
import { HeroTitle } from './components/HeroTitle';
import { PlayerBar } from './components/PlayerBar';
import { DeveloperModal } from './components/DeveloperModal';
import { PlaylistModal } from './components/PlaylistModal';
import { GlobalChatModal } from './components/GlobalChatModal';

export function AppContent() {
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-between overflow-hidden">
      <HeroBackground />

      <TopNav
        onOpenDeveloper={() => setIsDeveloperOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <HeroTitle />

      <PlayerBar onOpenPlaylist={() => setIsPlaylistOpen(true)} />

      <DeveloperModal open={isDeveloperOpen} onClose={() => setIsDeveloperOpen(false)} />

      <PlaylistModal open={isPlaylistOpen} onClose={() => setIsPlaylistOpen(false)} />

      <GlobalChatModal open={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </main>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
