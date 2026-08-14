import { useState, useEffect } from 'react';
import { realtimeBus, getPersistentDeviceId } from '../utils/realtime';

export function usePresence() {
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clientId = getPersistentDeviceId();
    const activeClients = new Map();
    activeClients.set(clientId, Date.now());

    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('devipaksha_global_presence_v4');
      } catch (e) {}
    }

    function handlePresenceEvent(data) {
      if (!data || !data.clientId) return;
      const now = Date.now();

      if (data.type === 'PRESENCE_PING') {
        activeClients.set(data.clientId, now);
      } else if (data.type === 'PRESENCE_BYE') {
        activeClients.delete(data.clientId);
      }
      pruneAndCount();
    }

    // Subscribe to global real-time bus
    const unsubscribeBus = realtimeBus.subscribe((event) => {
      if (event.topic === 'devipaksha/presence/v4' && event.data) {
        handlePresenceEvent(event.data);
      }
    });

    if (bc) {
      bc.onmessage = (e) => {
        if (e.data) handlePresenceEvent(e.data);
      };
    }

    function pruneAndCount() {
      const now = Date.now();
      for (const [id, lastSeen] of activeClients.entries()) {
        if (now - lastSeen > 6000) {
          activeClients.delete(id);
        }
      }
      setOnlineCount(Math.max(1, activeClients.size));
    }

    function sendPing() {
      const now = Date.now();
      activeClients.set(clientId, now);
      const payload = { type: 'PRESENCE_PING', clientId, timestamp: now };

      realtimeBus.publish('devipaksha/presence/v4', payload);
      if (bc) {
        try { bc.postMessage(payload); } catch (e) {}
      }
      pruneAndCount();
    }

    // Initial ping & recurring 2.5s heartbeat
    sendPing();
    const interval = setInterval(sendPing, 2500);

    function onUnload() {
      const byePayload = { type: 'PRESENCE_BYE', clientId };
      realtimeBus.publish('devipaksha/presence/v4', byePayload);
      if (bc) {
        try { bc.postMessage(byePayload); bc.close(); } catch (e) {}
      }
    }

    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(interval);
      unsubscribeBus();
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, []);

  return {
    count: onlineCount,
    localCount: onlineCount,
    globalCount: onlineCount,
  };
}
