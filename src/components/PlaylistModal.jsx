import React, { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { playlists, PLAYLIST_TABS } from '../data/playlists';
import { formatTimeLabel, getTrackCoverUrl, handleImageFallback } from './PlayerBar';
import { CloseIcon } from './Icons';
import { fetchLiveYouTubePlaylist } from '../utils/playlistFetcher';

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

      {durationSec == null || durationSec === 0 ? (
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {track.durationLabel || 'YouTube'}
        </span>
      ) : (
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {formatTimeLabel(durationSec)}
        </span>
      )}
    </button>
  );
}

export function PlaylistModal({ open, onClose }) {
  const { playlistKey, trackIndex, isPlaying, selectTrack, refreshLivePlaylist } = usePlayer();
  const [selectedTab, setSelectedTab] = useState(playlistKey);
  const [dynamicTracks, setDynamicTracks] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedTab(playlistKey);
    }
  }, [open, playlistKey]);

  const syncPlaylist = useCallback(async (tabKey) => {
    const pl = playlists[tabKey];
    if (pl && pl.sourceType === 'youtube_playlist' && pl.youtubePlaylistId) {
      setIsSyncing(true);
      try {
        let liveTracks = null;
        if (typeof refreshLivePlaylist === 'function') {
          liveTracks = await refreshLivePlaylist(tabKey);
        } else {
          liveTracks = await fetchLiveYouTubePlaylist(pl.youtubePlaylistId, pl.tracks);
          if (liveTracks && liveTracks.length > 0) {
            pl.tracks = liveTracks;
          }
        }
        if (liveTracks && liveTracks.length > 0) {
          setDynamicTracks((prev) => ({
            ...prev,
            [tabKey]: liveTracks,
          }));
        }
      } catch (e) {
        console.warn('Sync failed:', e);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [refreshLivePlaylist]);

  // Dynamically fetch any new songs from YouTube Music playlist whenever modal opens or tab changes
  useEffect(() => {
    if (!open) return;
    const pl = playlists[selectedTab];
    if (pl && pl.sourceType === 'youtube_playlist' && pl.youtubePlaylistId) {
      syncPlaylist(selectedTab);
    }
  }, [open, selectedTab, syncPlaylist]);

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
  const displayTracks = dynamicTracks[selectedTab] || currentPl.tracks || [];
  const isYouTubeLive = currentPl.sourceType === 'youtube_playlist';

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

        {/* Description & Live Sync Pill */}
        <div className="px-5 pt-2 flex items-center justify-between">
          <p className="text-[11px] text-white/40">{currentPl.description}</p>
          {isYouTubeLive && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isSyncing ? 'animate-ping' : ''}`} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-300">
                {isSyncing ? 'Syncing...' : `Live Synced (${displayTracks.length})`}
              </span>
              <button
                type="button"
                onClick={() => syncPlaylist(selectedTab)}
                disabled={isSyncing}
                title="Sync latest songs from YouTube playlist"
                className="ml-1 rounded-full p-1 text-white/40 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
              >
                <svg className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Tracklist */}
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4 playlist-scroll">
          {displayTracks.length === 0 && isSyncing ? (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-amber-200/90">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                <span>Live fetching songs from YouTube Music...</span>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse rounded-2xl bg-white/5 p-2">
                  <div className="h-11 w-11 rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-white/10" />
                    <div className="h-2.5 w-1/2 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm font-medium text-white/80">No tracks loaded yet</p>
              <p className="mt-1 text-xs text-white/40">Connect to YouTube Music to sync songs.</p>
              <button
                type="button"
                onClick={() => syncPlaylist(selectedTab)}
                className="mt-3 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition"
              >
                Sync Now
              </button>
            </div>
          ) : (
            displayTracks.map((t, idx) => (
              <TrackRow
                key={t.id || `track-${idx}`}
                index={idx}
                track={t}
                playlist={currentPl}
                isActive={selectedTab === playlistKey && idx === trackIndex}
                isPlaying={isPlaying}
                onSelect={() => selectTrack(selectedTab, idx)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
