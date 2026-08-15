import React, { useState, useEffect, useRef } from 'react';
import { useTimeOfDay } from '../hooks/useTimeOfDay';

const BG_CONFIG = {
  midnight: {
    mobileAvif: '/bg-mobile/midnight-960.avif',
    avifSrcSet: '/bg/midnight-640.avif 640w, /bg/midnight-960.avif 960w, /bg/midnight-1280.avif 1280w, /bg/midnight-1600.avif 1600w, /bg/midnight-1920.avif 1920w, /bg/midnight-2560.avif 2560w, /bg/midnight-2740.avif 2740w',
    webpSrcSet: '/bg/midnight-640.webp 640w, /bg/midnight-960.webp 960w, /bg/midnight-1280.webp 1280w, /bg/midnight-1600.webp 1600w, /bg/midnight-1920.webp 1920w, /bg/midnight-2560.webp 2560w, /bg/midnight-2740.webp 2740w',
    fallbackSrc: '/bg/midnight-2740.webp',
  },
  earlyMorning: {
    mobileAvif: '/bg-mobile/early-morning-960.avif',
    avifSrcSet: '/bg/early-morning-640.avif 640w, /bg/early-morning-960.avif 960w, /bg/early-morning-1280.avif 1280w, /bg/early-morning-1600.avif 1600w, /bg/early-morning-1920.avif 1920w, /bg/early-morning-2560.avif 2560w, /bg/early-morning-2740.avif 2740w',
    webpSrcSet: '/bg/early-morning-640.webp 640w, /bg/early-morning-960.webp 960w, /bg/early-morning-1280.webp 1280w, /bg/early-morning-1600.webp 1600w, /bg/early-morning-1920.webp 1920w, /bg/early-morning-2560.webp 2560w, /bg/early-morning-2740.webp 2740w',
    fallbackSrc: '/bg/early-morning-2740.webp',
  },
  morning: {
    mobileAvif: '/bg-mobile/morning-960.avif',
    avifSrcSet: '/bg/morning-640.avif 640w, /bg/morning-960.avif 960w, /bg/morning-1280.avif 1280w, /bg/morning-1600.avif 1600w, /bg/morning-1920.avif 1920w, /bg/morning-2560.avif 2560w, /bg/morning-2740.avif 2740w',
    webpSrcSet: '/bg/morning-640.webp 640w, /bg/morning-960.webp 960w, /bg/morning-1280.webp 1280w, /bg/morning-1600.webp 1600w, /bg/morning-1920.webp 1920w, /bg/morning-2560.webp 2560w, /bg/morning-2740.webp 2740w',
    fallbackSrc: '/bg/morning-2740.webp',
  },
  afternoon: {
    mobileAvif: '/bg-mobile/afternoon-960.avif',
    avifSrcSet: '/bg/afternoon-640.avif 640w, /bg/afternoon-960.avif 960w, /bg/afternoon-1280.avif 1280w, /bg/afternoon-1600.avif 1600w, /bg/afternoon-1920.avif 1920w, /bg/afternoon-2560.avif 2560w, /bg/afternoon-2740.avif 2740w',
    webpSrcSet: '/bg/afternoon-640.webp 640w, /bg/afternoon-960.webp 960w, /bg/afternoon-1280.webp 1280w, /bg/afternoon-1600.webp 1600w, /bg/afternoon-1920.webp 1920w, /bg/afternoon-2560.webp 2560w, /bg/afternoon-2740.webp 2740w',
    fallbackSrc: '/bg/afternoon-2740.webp',
  },
  evening: {
    mobileAvif: '/bg-mobile/evening-960.avif',
    avifSrcSet: '/bg/evening-640.avif 640w, /bg/evening-960.avif 960w, /bg/evening-1280.avif 1280w, /bg/evening-1600.avif 1600w, /bg/evening-1920.avif 1920w, /bg/evening-2560.avif 2560w, /bg/evening-2740.avif 2740w',
    webpSrcSet: '/bg/evening-640.webp 640w, /bg/evening-960.webp 960w, /bg/evening-1280.webp 1280w, /bg/evening-1600.webp 1600w, /bg/evening-1920.webp 1920w, /bg/evening-2560.webp 2560w, /bg/evening-2740.webp 2740w',
    fallbackSrc: '/bg/evening-2740.webp',
  },
  night: {
    mobileAvif: '/bg-mobile/night-960.avif',
    avifSrcSet: '/bg/night-640.avif 640w, /bg/night-960.avif 960w, /bg/night-1280.avif 1280w, /bg/night-1600.avif 1600w, /bg/night-1920.avif 1920w, /bg/night-2560.avif 2560w, /bg/night-2740.avif 2740w',
    webpSrcSet: '/bg/night-640.webp 640w, /bg/night-960.webp 960w, /bg/night-1280.webp 1280w, /bg/night-1600.webp 1600w, /bg/night-1920.webp 1920w, /bg/night-2560.webp 2560w, /bg/night-2740.webp 2740w',
    fallbackSrc: '/bg/night-2740.webp',
  },
};

const PERIOD_BG_COLORS = {
  midnight: '#181124',
  earlyMorning: '#7b452d',
  morning: '#a36338',
  afternoon: '#ad6c3a',
  evening: '#aa6636',
  night: '#1c1524',
};

const FADE_DURATION_MS = 1500;
const SIZES_ATTR = '100vw';
const IMG_CLASS = 'absolute inset-0 h-full w-full object-cover object-center';

function PictureBackground({ periodKey, className }) {
  const config = BG_CONFIG[periodKey] || BG_CONFIG.midnight;
  return (
    <picture>
      <source media="(max-width: 639px)" type="image/avif" srcSet={config.mobileAvif} />
      <source type="image/avif" srcSet={config.avifSrcSet} sizes={SIZES_ATTR} />
      <source type="image/webp" srcSet={config.webpSrcSet} sizes={SIZES_ATTR} />
      <img src={config.fallbackSrc} alt="" aria-hidden="true" className={className} />
    </picture>
  );
}

export function HeroBackground() {
  const currentPeriod = useTimeOfDay();
  const [outgoingPeriod, setOutgoingPeriod] = useState(null);
  const activeKeyRef = useRef(currentPeriod.key);

  useEffect(() => {
    if (activeKeyRef.current === currentPeriod.key) return;

    const previousKey = activeKeyRef.current;
    activeKeyRef.current = currentPeriod.key;
    setOutgoingPeriod({ key: previousKey });

    const timeout = setTimeout(() => {
      setOutgoingPeriod(null);
    }, FADE_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [currentPeriod.key]);

  const backgroundKeys = Object.keys(BG_CONFIG).filter(
    (k) => k !== currentPeriod.key && k !== outgoingPeriod?.key
  );

  const containerBgColor = PERIOD_BG_COLORS[currentPeriod.key] || '#ab6a3b';

  return (
    <div
      className="hero-bg fixed inset-0 -z-10 transition-colors duration-1000"
      style={{ backgroundColor: containerBgColor }}
    >
      <PictureBackground key={currentPeriod.key} periodKey={currentPeriod.key} className={IMG_CLASS} />

      {outgoingPeriod && (
        <PictureBackground
          key={outgoingPeriod.key}
          periodKey={outgoingPeriod.key}
          className={`${IMG_CLASS} animate-[bg-fade-out_1.5s_ease-in-out_forwards]`}
        />
      )}

      {/* Hidden preloading images for all periods */}
      {backgroundKeys.map((key) => (
        <div key={key} className="absolute inset-0 opacity-0" aria-hidden="true">
          <PictureBackground periodKey={key} className={IMG_CLASS} />
        </div>
      ))}

      {/* Ambient gradient overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 to-black/10" />
    </div>
  );
}
