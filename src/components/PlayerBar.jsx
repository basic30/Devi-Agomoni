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
          border border-white/15
          text-xs font-semibold uppercase tracking-[0.15em] text-white/90
          shadow-[0_4px_20px_rgba(0,0,0,0.35)]
          transition hover:bg-white/12 active:scale-95
        "
      >
        {label}
        <ChevronDownIcon />
      </button>
    </div>
  );
}

function TrackCover({ track, playlist, className }) {
  const coverUrl = getTrackCoverUrl(track, playlist);
  const videoId = track?.videoId || playlist?.youtubeVideoId;

  if (coverUrl) {
    return (
      <div className={`shrink-0 overflow-hidden shadow-lg ring-1 ring-white/20 ${className}`}>
        <img
          src={coverUrl}
          alt={`${track?.title || 'Track'} - artwork`}
          referrerPolicy="no-referrer"
          onError={(e) => handleImageFallback(e, videoId)}
          className="h-full w-full object-cover object-center"
        />
      </div>
    );
  }

  return <div className={`shrink-0 overflow-hidden bg-white/10 shadow-lg ring-1 ring-white/20 ${className}`} />;
}

function ProgressBar({ barRef, progress, currentTime, duration, onClick, onPointerDown }) {
  return (
    <div>
      <div
        ref={barRef}
        className="group/bar relative h-2 w-full cursor-pointer"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-sm bg-white/20">
          <div className="h-full rounded-sm bg-white/90" style={{ width: `${progress}%` }} />
        </div>
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
          style={{ left: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-left text-[10px] tabular-nums text-white/60">
        {formatTimeLabel(currentTime)} / {formatTimeLabel(duration)}
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
    <div className="flex items-center gap-0.5">
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
        className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
            group relative flex items-stretch gap-3 rounded-3xl p-3
            bg-white/7 backdrop-blur-2xl backdrop-saturate-150
            border border-white/15
            shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]
          "
        >
          <TrackCover track={track} playlist={playlist} className="w-16 rounded-xl" />

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-[13px] font-semibold text-white drop-shadow-sm">{track?.title || ''}</p>
            <p className="truncate text-[11px] text-white/70">{track?.subtitle || ''}</p>

            <div className="mt-1.5">
              <ProgressBar
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
