import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { playlists, PLAYLIST_TABS } from '../data/playlists';
import { formatTimeLabel, getTrackCoverUrl, handleImageFallback } from './PlayerBar';
import { CloseIcon } from './Icons';

function TrackRow({ index, track, playlist, isActive, isPlaying, onSelect }) {
  const durationSec = track.end == null ? track.duration : track.end - (track.start ?? 0);
  const coverUrl = getTrackCoverUrl(track, playlist);
  const videoId = track.videoId || playlist.youtubeVideoId;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
        isActive ? 'bg-white/12' : 'hover:bg-white/7'
      }`}
    >
      <span
        className={`w-5 shrink-0 text-center text-xs tabular-nums ${
          isActive ? 'text-[#f1d449]' : 'text-white/40 group-hover:text-white/70'
        }`}
      >
        {isActive && isPlaying ? '♪' : String(index + 1).padStart(2, '0')}
      </span>

      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => handleImageFallback(e, videoId)}
            className="h-full w-full object-cover object-center"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-semibold ${isActive ? 'text-[#f1d449]' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="truncate text-[11px] text-white/60">{track.subtitle}</p>
      </div>

      {durationSec == null ? null : (
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {formatTimeLabel(durationSec)}
        </span>
      )}
    </button>
  );
}

export function PlaylistModal({ open, onClose }) {
  const { playlistKey, trackIndex, isPlaying, selectTrack } = usePlayer();
  const [selectedTab, setSelectedTab] = useState(playlistKey);

  useEffect(() => {
    if (open) {
      setSelectedTab(playlistKey);
    }
  }, [open, playlistKey]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const currentPl = playlists[selectedTab] || playlists[PLAYLIST_TABS[0]?.key] || playlists.durgaPuja;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xl animate-overlay-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="
          relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden
          rounded-[32px] border border-white/15 bg-white/7
          backdrop-blur-2xl backdrop-saturate-150
          shadow-[0_20px_80px_rgba(0,0,0,0.6)]
          animate-overlay-scale-in
        "
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-5">
          <h2 className="font-tagline text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Playlists
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Playlist Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {PLAYLIST_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTab(tab.key)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                selectedTab === tab.key
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Description */}
        <p className="px-5 pt-2 text-[11px] text-white/40">{currentPl.description}</p>

        {/* Scrollable Tracklist */}
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4 playlist-scroll">
          {currentPl.tracks.map((t, idx) => (
            <TrackRow
              key={t.id}
              index={idx}
              track={t}
              playlist={currentPl}
              isActive={selectedTab === playlistKey && idx === trackIndex}
              isPlaying={isPlaying}
              onSelect={() => selectTrack(selectedTab, idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
