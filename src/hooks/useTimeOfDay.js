import { useState, useEffect } from 'react';

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export function getTimePartsInIST(date = new Date()) {
  const parts = timeFormatter.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

export const TIME_PERIODS = [
  { key: 'midnight', label: 'Midnight', startHour: 0 },
  { key: 'earlyMorning', label: 'Early Morning', startHour: 4 },
  { key: 'morning', label: 'Morning', startHour: 7 },
  { key: 'afternoon', label: 'Afternoon', startHour: 12 },
  { key: 'evening', label: 'Evening', startHour: 16 },
  { key: 'night', label: 'Night', startHour: 19 }
];

export function getPeriodForHour(hour) {
  let period = TIME_PERIODS[0];
  for (const p of TIME_PERIODS) {
    if (hour >= p.startHour) {
      period = p;
    }
  }
  return period;
}

export function getCurrentTimePeriod(date = new Date()) {
  const { hour } = getTimePartsInIST(date);
  return getPeriodForHour(hour);
}

const CHECK_INTERVAL_MS = 30000;

export function useTimeOfDay() {
  const [period, setPeriod] = useState(() => getCurrentTimePeriod());

  useEffect(() => {
    const check = () => {
      const current = getCurrentTimePeriod();
      setPeriod(prev => (prev.key === current.key ? prev : current));
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return period;
}
