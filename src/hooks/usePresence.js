import { useState, useEffect } from 'react';
import { getTimePartsInIST } from './useTimeOfDay';

const MIN_ONLINE = 201;
const MAX_ONLINE = 275;

function getHourRange(hour) {
  if (hour >= 0 && hour < 3) return [255, 275];
  if (hour >= 3 && hour < 4) return [225, 245];
  if (hour >= 4 && hour < 6) return [201, 220];
  if (hour >= 6 && hour < 12) return [220, 245];
  if (hour >= 12 && hour < 16) return [210, 235];
  if (hour >= 16 && hour < 20) return [235, 258];
  return [250, 270];
}

function clamp(val) {
  return Math.min(MAX_ONLINE, Math.max(MIN_ONLINE, val));
}

function getRandomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function usePresence() {
  const [localTabCount, setLocalTabCount] = useState(1);
  const [globalCount, setGlobalCount] = useState(() => {
    const { hour } = getTimePartsInIST();
    return getRandomInRange(getHourRange(hour));
  });

  // Track active local browser tabs via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel('devipaksha_presence_channel');
    const myTabId = Math.random().toString(36).substring(2, 9);
    const activeTabs = new Map();
    activeTabs.set(myTabId, Date.now());

    function pingOthers() {
      channel.postMessage({ type: 'PING', tabId: myTabId, time: Date.now() });
    }

    function cleanStaleTabs() {
      const now = Date.now();
      for (const [id, lastSeen] of activeTabs.entries()) {
        if (now - lastSeen > 4000) {
          activeTabs.delete(id);
        }
      }
      setLocalTabCount(activeTabs.size);
    }

    channel.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'PING') {
        activeTabs.set(event.data.tabId, event.data.time);
        setLocalTabCount(activeTabs.size);
      } else if (event.data.type === 'BYE') {
        activeTabs.delete(event.data.tabId);
        setLocalTabCount(activeTabs.size);
      }
    };

    pingOthers();
    const intervalId = setInterval(() => {
      pingOthers();
      cleanStaleTabs();
    }, 1500);

    function onUnload() {
      channel.postMessage({ type: 'BYE', tabId: myTabId });
      channel.close();
    }

    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', onUnload);
      channel.close();
    };
  }, []);

  // Organic simulated fluctuation for global counter
  useEffect(() => {
    let timerId;

    function scheduleNext() {
      const delay = (5 + Math.random() * 10) * 1000;
      timerId = setTimeout(() => {
        setGlobalCount(prev => {
          const { hour } = getTimePartsInIST();
          const [min, max] = getHourRange(hour);
          const stepSize = Math.random() < 0.85 ? (1 + Math.floor(Math.random() * 2)) : 3;
          let delta = Math.random() < 0.5 ? -stepSize : stepSize;

          if (prev < min) delta = Math.abs(delta);
          if (prev > max) delta = -Math.abs(delta);

          return clamp(prev + delta);
        });
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timerId);
  }, []);

  // Return local active tabs count (or global count if specified)
  return {
    count: localTabCount,
    localCount: localTabCount,
    globalCount: globalCount
  };
}
