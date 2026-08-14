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

function PlaylistPillButton({ label, onOpen }) {
  return (
    <div className="mb-2 flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        className="
          inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
          bg-white/7 backdrop-blur-2xl backdrop-saturate-150
          border border-[#f1d449]/30
          text-xs font-semibold uppercase tracking-[0.15em] text-[#f1d449]
          shadow-[0_4px_20px_rgba(241,212,73,0.15)]
          transition hover:bg-[#f1d449]/15 active:scale-95
        "
      >
        {label}
        <ChevronDownIcon />
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

function PlayerControls({ isPlaying, canSkip, playDisabled, onPrev, onPlayPause, onNext }) {
  return (
    <div className="flex items-center gap-1">
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
    </div>
  );
}

export function PlayerBar({ onOpenPlaylist }) {
  const { playlist, track, isPlaying, currentTime, duration, canSkip, goNext, goPrev, togglePlay, seekTo } = usePlayer();
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
    <div className="mb-[4vh] flex w-full justify-center px-6">
      <div className="w-full max-w-md">
        <PlaylistPillButton label={playlist?.pillLabel || 'PUJA RADIO'} onOpen={onOpenPlaylist} />

        <div
          className="
            group relative flex items-center gap-3.5 rounded-3xl p-3.5
            bg-white/8 backdrop-blur-2xl backdrop-saturate-150
            border border-white/15
            shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]
          "
        >
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
            onPrev={goPrev}
            onPlayPause={togglePlay}
            onNext={goNext}
          />
        </div>
      </div>
    </div>
  );
}
