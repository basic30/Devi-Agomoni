import React, { useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ChevronDownIcon } from './Icons';

export function formatTimeLabel(seconds) {
  const totalSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getYouTubeMaxResCover(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeMediumResCover(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function getTrackCoverUrl(track, playlist) {
  if (track && track.cover) return track.cover;
  if (track && track.videoId) return getYouTubeMaxResCover(track.videoId);
  if (playlist && playlist.youtubeVideoId) return getYouTubeMaxResCover(playlist.youtubeVideoId);
  if (playlist && playlist.thumbnail) return playlist.thumbnail;
  return '/thumbnail.png';
}

export function handleImageFallback(e, videoId) {
  if (!e.target.dataset.fallenBack) {
    e.target.dataset.fallenBack = 'true';
    if (videoId) {
      e.target.src = getYouTubeMediumResCover(videoId);
    } else {
      e.target.src = '/thumbnail.png';
    }
  }
}

function PlaylistPillRow({ label, onOpen, isDhakPlaying, onToggleDhak }) {
  return (
    <div className="mb-2 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="
          inline-flex items-center gap-1.5 rounded-full px-3.5 py-1
          bg-white/8 backdrop-blur-2xl backdrop-saturate-150
          border border-[#f1d449]/35
          text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f1d449]
          shadow-[0_3px_15px_rgba(241,212,73,0.15)]
          transition hover:bg-[#f1d449]/15 active:scale-95
        "
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[#f1d449]/90">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="15" y2="12" />
          <line x1="4" y1="18" x2="11" y2="18" />
        </svg>
        {label}
        <ChevronDownIcon />
      </button>

      <button
        type="button"
        onClick={onToggleDhak}
        aria-label="Play Dhak Sound"
        className={`
          inline-flex items-center gap-1.5 rounded-full px-3 py-1
          backdrop-blur-2xl backdrop-saturate-150
          text-[11px] font-semibold uppercase tracking-[0.1em]
          transition active:scale-95
          ${
            isDhakPlaying
              ? 'bg-[#f1d449]/30 border-2 border-[#f1d449] text-[#f1d449] shadow-[0_0_18px_rgba(241,212,73,0.6)] animate-pulse'
              : 'bg-white/8 border border-[#f1d449]/35 text-[#f1d449] shadow-[0_3px_15px_rgba(241,212,73,0.15)] hover:bg-[#f1d449]/15'
          }
        `}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={isDhakPlaying ? 'animate-bounce' : ''}>
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        <span>DHAK</span>
      </button>
    </div>
  );
}

function TrackCover({ track, playlist, isPlaying, className }) {
  const coverUrl = getTrackCoverUrl(track, playlist);
  const videoId = track?.videoId || playlist?.youtubeVideoId;

  return (
    <div className={`relative shrink-0 overflow-hidden shadow-lg ring-1 ring-[#f1d449]/30 ${className}`}>
      <img
        src={coverUrl}
        alt={`${track?.title || 'Track'} - artwork`}
        referrerPolicy="no-referrer"
        onError={(e) => handleImageFallback(e, videoId)}
        className="h-full w-full object-cover object-center"
      />
      {isPlaying && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-0.5 px-2">
          <span className="w-1 bg-[#f1d449] rounded-full animate-[bounce_0.6s_infinite_100ms] h-4" />
          <span className="w-1 bg-[#f1d449] rounded-full animate-[bounce_0.6s_infinite_300ms] h-6" />
          <span className="w-1 bg-[#f1d449] rounded-full animate-[bounce_0.6s_infinite_200ms] h-3" />
        </div>
      )}
    </div>
  );
}

// Beautiful Gold Curved & Glowing Progress Line Component
function CurvedProgressBar({ barRef, progress, currentTime, duration, onClick, onPointerDown }) {
  return (
    <div>
      <div
        ref={barRef}
        className="group/bar relative h-3 w-full cursor-pointer flex items-center"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        {/* Background Track with Subtle Curve Glow */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15 backdrop-blur-sm">
          {/* Filled Progress Bar with Gold Theme Gradient */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-[#f1d449] to-yellow-300 shadow-[0_0_12px_rgba(241,212,73,0.8)] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Curved Gold Glowing Handle Thumb */}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#f1d449] shadow-[0_0_10px_rgba(241,212,73,1)] transition-transform duration-75 group-hover/bar:scale-125"
          style={{ left: `${progress}%` }}
        />
      </div>

      <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-white/70 font-medium">
        <span>{formatTimeLabel(currentTime)}</span>
        <span>{formatTimeLabel(duration)}</span>
      </div>
    </div>
  );
}

const SVG_PREV_PATH = "M6 6h2v12H6zm3.5 6l8.5 6V6z";
const SVG_NEXT_PATH = "M16 6h2v12h-2zm-2 6L5.5 6v12z";
const SVG_PAUSE_PATH = "M6 5h4v14H6zm8 0h4v14h-4z";
const SVG_PLAY_PATH = "M8 5v14l11-7z";
const SVG_SHUFFLE_PATH = "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.45 20 9.5V4h-5.5zm.35 11.09l1.41-1.41 2.25 2.25L20 14.5V20h-5.5l2.04-2.04-2.19-2.87z";
const SVG_REPEAT_PATH = "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z";

function PlayerControls({
  isPlaying,
  canSkip,
  playDisabled,
  isShuffle,
  isRepeat,
  onPrev,
  onPlayPause,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
}) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {/* Desktop Shuffle Button */}
      <button
        type="button"
        aria-label="Toggle Shuffle"
        onClick={onToggleShuffle}
        className={`hidden sm:grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 ${
          isShuffle
            ? 'text-[#f1d449] bg-[#f1d449]/20 drop-shadow-[0_0_8px_rgba(241,212,73,0.8)]'
            : 'text-white/70 hover:bg-white/15 hover:text-white'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={SVG_SHUFFLE_PATH} />
        </svg>
      </button>

      {/* Previous Track */}
      <button
        type="button"
        aria-label="Previous track"
        onClick={onPrev}
        disabled={!canSkip}
        className="grid h-8 w-8 place-items-center rounded-xl text-white/80 transition hover:bg-white/15 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={SVG_PREV_PATH} />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        onClick={onPlayPause}
        disabled={playDisabled}
        className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-400 via-[#f1d449] to-yellow-300 text-black shadow-[0_4px_20px_rgba(241,212,73,0.4)] transition hover:scale-105 active:scale-95 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={isPlaying ? SVG_PAUSE_PATH : SVG_PLAY_PATH} />
        </svg>
      </button>

      {/* Next Track */}
      <button
        type="button"
        aria-label="Next track"
        onClick={onNext}
        disabled={!canSkip}
        className="grid h-8 w-8 place-items-center rounded-xl text-white/80 transition hover:bg-white/15 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={SVG_NEXT_PATH} />
        </svg>
      </button>

      {/* Desktop Repeat Button */}
      <button
        type="button"
        aria-label="Toggle Repeat"
        onClick={onToggleRepeat}
        className={`hidden sm:grid h-8 w-8 place-items-center rounded-xl transition active:scale-95 ${
          isRepeat
            ? 'text-[#f1d449] bg-[#f1d449]/20 drop-shadow-[0_0_8px_rgba(241,212,73,0.8)]'
            : 'text-white/70 hover:bg-white/15 hover:text-white'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={SVG_REPEAT_PATH} />
        </svg>
      </button>
    </div>
  );
}

export function PlayerBar({ onOpenPlaylist }) {
  const {
    playlist,
    track,
    isPlaying,
    currentTime,
    duration,
    canSkip,
    isShuffle,
    isRepeat,
    isDhakPlaying,
    toggleShuffle,
    toggleRepeat,
    toggleDhak,
    goNext,
    goPrev,
    togglePlay,
    seekTo,
  } = usePlayer();
  const barRef = useRef(null);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isPlayDisabled = !track?.videoId && !playlist?.youtubeVideoId;

  function handleSeekFromEvent(e) {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seekTo(fraction);
  }

  function handleBarClick(e) {
    if (!isPlayDisabled) {
      handleSeekFromEvent(e);
    }
  }

  function handlePointerDown(e) {
    if (isPlayDisabled) return;
    handleSeekFromEvent(e);

    const onMove = (moveEv) => handleSeekFromEvent(moveEv);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div className="mb-[3vh] flex w-full justify-center px-4 sm:mb-[4vh] sm:px-6">
      <div className="w-full max-w-md">
        {/* Desktop Pill Row (Side by side) */}
        <div className="hidden sm:block">
          <PlaylistPillRow
            label={playlist?.pillLabel || 'PUJA RADIO'}
            onOpen={onOpenPlaylist}
            isDhakPlaying={isDhakPlaying}
            onToggleDhak={toggleDhak}
          />
        </div>

        {/* Mobile Pill Button (Centered) */}
        <div className="mb-2 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={onOpenPlaylist}
            className="
              inline-flex items-center gap-1.5 rounded-full px-3.5 py-1
              bg-white/10 backdrop-blur-2xl backdrop-saturate-150
              border border-[#f1d449]/35
              text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f1d449]
              shadow-[0_3px_15px_rgba(241,212,73,0.18)]
              transition hover:bg-[#f1d449]/20 active:scale-95
            "
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[#f1d449]/90">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="15" y2="12" />
              <line x1="4" y1="18" x2="11" y2="18" />
            </svg>
            {playlist?.pillLabel || 'DURGA PUJA'}
            <ChevronDownIcon />
          </button>
        </div>

        {/* Player Card */}
        <div
          className="
            group relative flex flex-col rounded-3xl
            bg-white/10 backdrop-blur-2xl backdrop-saturate-150
            border border-white/20
            shadow-[0_8px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.25)]
          "
        >
          {/* Main Player Row */}
          <div className="flex items-center gap-3.5 p-3.5">
            <TrackCover track={track} playlist={playlist} isPlaying={isPlaying} className="w-16 h-16 rounded-2xl" />

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="truncate text-[14px] font-semibold text-white drop-shadow-sm">{track?.title || ''}</p>
              <p className="truncate text-[11px] text-[#f1d449]/90 font-medium">{track?.subtitle || ''}</p>

              <div className="mt-2">
                <CurvedProgressBar
                  barRef={barRef}
                  progress={progress}
                  currentTime={currentTime}
                  duration={duration}
                  onClick={handleBarClick}
                  onPointerDown={handlePointerDown}
                />
              </div>
            </div>

            <PlayerControls
              isPlaying={isPlaying}
              canSkip={canSkip}
              playDisabled={isPlayDisabled}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
              onPrev={goPrev}
              onPlayPause={togglePlay}
              onNext={goNext}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
            />
          </div>

          {/* Mobile Bottom Action Controls Bar (Shuffle | Repeat | Dhak) */}
          <div className="flex items-center border-t border-white/10 px-3 py-2 sm:hidden">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`flex flex-1 items-center justify-center gap-1.5 text-[11px] font-medium transition active:scale-95 ${
                isShuffle ? 'text-[#f1d449] font-semibold drop-shadow-[0_0_8px_rgba(241,212,73,0.8)]' : 'text-white/70 hover:text-white'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d={SVG_SHUFFLE_PATH} />
              </svg>
              Shuffle
            </button>

            <span className="h-3 w-px bg-white/15" />

            <button
              type="button"
              onClick={toggleRepeat}
              className={`flex flex-1 items-center justify-center gap-1.5 text-[11px] font-medium transition active:scale-95 ${
                isRepeat ? 'text-[#f1d449] font-semibold drop-shadow-[0_0_8px_rgba(241,212,73,0.8)]' : 'text-white/70 hover:text-white'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d={SVG_REPEAT_PATH} />
              </svg>
              Repeat
            </button>

            <span className="h-3 w-px bg-white/15" />

            <button
              type="button"
              onClick={toggleDhak}
              className={`flex flex-1 items-center justify-center gap-1.5 text-[11px] font-semibold transition active:scale-95 ${
                isDhakPlaying ? 'text-[#f1d449] animate-pulse drop-shadow-[0_0_8px_rgba(241,212,73,0.8)]' : 'text-white/80 hover:text-white'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className={isDhakPlaying ? 'animate-bounce' : ''}>
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              Dhak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
