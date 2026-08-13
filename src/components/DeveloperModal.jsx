import React, { useState, useEffect } from 'react';
import { LinkedInIcon, InstagramIcon, UserPlaceholderIcon, CopyIcon, CheckIcon, CloseIcon } from './Icons';

export const DEVELOPERS = [
  {
    name: 'Snahasish Dey',
    photo: '/Dev image/snahasish.png',
    linkedin: 'https://www.linkedin.com/in/snahasish0914/',
    instagram: 'https://www.instagram.com/snahasish0915/',
  },
];

export const CONTACT_EMAIL = 'snahasishdey143@gmail.com';

function DevCard({ dev }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-center w-full max-w-xs mx-auto">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/10 shadow-inner">
        {dev.photo ? (
          <img src={dev.photo} alt={dev.name} className="h-full w-full object-cover" />
        ) : (
          <UserPlaceholderIcon />
        )}
      </div>

      <p className="text-sm font-semibold text-white">{dev.name}</p>

      <div className="flex items-center gap-2">
        <a
          href={dev.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${dev.name} on LinkedIn`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15 active:scale-95"
        >
          <LinkedInIcon />
        </a>

        <a
          href={dev.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${dev.name} on Instagram`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15 active:scale-95"
        >
          <InstagramIcon />
        </a>
      </div>
    </div>
  );
}

function ContactEmailButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CONTACT_EMAIL).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-5 flex flex-col items-center gap-1.5 border-t border-white/10 pt-5 text-center">
      <p className="text-[11px] text-white/50">Want to get in touch?</p>
      <button
        type="button"
        onClick={handleCopy}
        className="group/copy inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-4 pr-2 text-xs text-white/80 transition hover:bg-white/10 active:scale-95"
      >
        <span className="tabular-nums">{CONTACT_EMAIL}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
            copied
              ? 'bg-[#f1d449]/20 text-[#f1d449]'
              : 'bg-white/10 text-white/60 group-hover/copy:text-white/90'
          }`}
        >
          {copied ? <CheckIcon width="11" height="11" /> : <CopyIcon width="11" height="11" />}
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
    </div>
  );
}

export function DeveloperModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xl animate-overlay-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="
          relative w-full max-w-sm sm:max-w-md rounded-[32px] border border-white/15 bg-white/7 p-8
          backdrop-blur-2xl backdrop-saturate-150
          shadow-[0_20px_80px_rgba(0,0,0,0.6)]
          animate-overlay-scale-in
        "
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
        >
          <CloseIcon />
        </button>

        <h2 className="text-center font-tagline text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Made with Bhalobasha by
        </h2>

        <div className="mt-6 flex justify-center">
          {DEVELOPERS.map((dev) => (
            <DevCard key={dev.name} dev={dev} />
          ))}
        </div>

        <ContactEmailButton />
      </div>
    </div>
  );
}
