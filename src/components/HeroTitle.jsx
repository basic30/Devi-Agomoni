import React, { useState, useEffect } from 'react';
import { getDaysUntilPujo } from './TopNav';

export function HeroTitle() {
  const [days, setDays] = useState(() => getDaysUntilPujo());

  useEffect(() => {
    const interval = setInterval(() => setDays(getDaysUntilPujo()), 3600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-[14vh] flex flex-col items-center px-6 text-center">
      <h1 className="font-bengali text-[5rem] font-normal leading-none text-[#f1d449] drop-shadow-[0_0_72px_rgba(0,0,0,0.57)] sm:text-[6.5rem] md:text-[8.75rem]">
        <span className="block">পুজো</span>
        <span className="mt-[14px] block sm:mt-[18px]">আসছে</span>
      </h1>

      <p className="mt-4 font-tagline text-xs font-medium text-white/70 drop-shadow-[0_0_20px_rgba(0,0,0,0.85)] sm:hidden">
        <span className="tabular-nums text-white/90">{days}</span> days until Durga Pujo
      </p>
    </div>
  );
}
