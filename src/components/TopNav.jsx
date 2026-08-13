import React, { useState, useEffect } from 'react';
import { getTimePartsInIST } from '../hooks/useTimeOfDay';
import { usePresence } from '../hooks/usePresence';
import { SPOTIFY_PLAYLIST_URL, YOUTUBE_MUSIC_PLAYLIST_URL } from '../data/playlists';
import { SpotifyIcon, YouTubeMusicIcon, DeveloperIcon, ChatIcon } from './Icons';

const TARGET_PUJO_DATE = new Date('2026-10-16T00:00:00+05:30');
const ONE_DAY_MS = 86400000;

export function getDaysUntilPujo(currentDate = new Date()) {
  const diff = TARGET_PUJO_DATE.getTime() - currentDate.getTime();
  return Math.max(0, Math.ceil(diff / ONE_DAY_MS));
}

const PILL_CONTAINER_CLASS = `flex h-11 shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/7 p-1.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_6px_18px_rgba(0,0,0,0.08)] box-border`;
const PILL_BUTTON_CLASS = `grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/15 active:scale-95`;

function formatClockParts(date = new Date()) {
  const { hour, minute } = getTimePartsInIST(date);
  const period = hour >= 12 ? 'pm' : 'am';
  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  return {
    hours: String(h12),
    minutes: String(minute).padStart(2, '0'),
    period,
  };
}

export function ClockPill() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { hours, minutes, period } = formatClockParts(now);

  return (
    <div className={`${PILL_CONTAINER_CLASS} px-3.5 text-sm font-medium tabular-nums text-white`}>
      {hours}
      <span className="animate-blink">:</span>
      {minutes}
      <span className="ml-1.5 text-white/70">{period}</span>
    </div>
  );
}

export function PresenceCountdownPill() {
  const { count } = usePresence();
  const labelText = `${count} online`;
  const [days, setDays] = useState(() => getDaysUntilPujo());

  useEffect(() => {
    const interval = setInterval(() => setDays(getDaysUntilPujo()), 3600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`${PILL_CONTAINER_CLASS} px-3.5 text-sm font-medium text-white`}
      aria-live="polite"
      aria-label={labelText}
      title={labelText}
    >
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        <span className="absolute h-full w-full rounded-full bg-green-400 animate-online-pulse" />
        <span className="relative h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
      </span>

      <span className="ml-2 whitespace-nowrap tabular-nums">{labelText}</span>

      <span className="mx-3 hidden h-4 w-0.5 shrink-0 rounded-full bg-white/20 sm:inline-block" aria-hidden="true" />

      <span className="hidden whitespace-nowrap font-tagline text-white/70 sm:inline">
        <span className="tabular-nums text-white/90">{days}</span> days until Durga Pujo
      </span>
    </div>
  );
}

function ActionIconLink({ href, ariaLabel, icon }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={PILL_BUTTON_CLASS}>
      {icon}
    </a>
  );
}

export function TopNav({ onOpenDeveloper, onOpenChat }) {
  return (
    <nav className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pt-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:justify-normal sm:px-5">
      <div className="hidden sm:flex sm:justify-start">
        <ClockPill />
      </div>

      <div className="sm:flex sm:justify-center">
        <PresenceCountdownPill />
      </div>

      <div className="sm:flex sm:justify-end">
        <div className="flex items-center gap-2">
          <div className={PILL_CONTAINER_CLASS}>
            <button
              type="button"
              onClick={onOpenChat}
              aria-label="Global Anonymous Chat"
              title="Global Anonymous Chat"
              className={`${PILL_BUTTON_CLASS} text-[#f1d449] hover:bg-[#f1d449]/15`}
            >
              <ChatIcon />
            </button>
          </div>

          <div className={PILL_CONTAINER_CLASS}>
            <ActionIconLink
              href={YOUTUBE_MUSIC_PLAYLIST_URL}
              ariaLabel="Open the Durga Puja playlist on YouTube Music"
              icon={<YouTubeMusicIcon />}
            />
            <ActionIconLink
              href={SPOTIFY_PLAYLIST_URL}
              ariaLabel="Open the Durga Puja playlist on Spotify"
              icon={<SpotifyIcon />}
            />
          </div>

          <div className={PILL_CONTAINER_CLASS}>
            <button
              type="button"
              onClick={onOpenDeveloper}
              aria-label="About the developers"
              className={PILL_BUTTON_CLASS}
            >
              <DeveloperIcon />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
