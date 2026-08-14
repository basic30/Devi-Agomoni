import { useState, useEffect } from 'react';

// Get or generate a unique persistent client ID for this device session
function getSessionClientId() {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('devipaksha_client_id');
  if (!id) {
    id = 'device-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    sessionStorage.setItem('devipaksha_client_id', id);
  }
  return id;
}

export function usePresence() {
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clientId = getSessionClientId();
    const activeClients = new Map();
    activeClients.set(clientId, Date.now());

    // 1. BroadcastChannel for local tabs on the same device
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('devipaksha_global_presence_v3');
      } catch (e) {}
    }

    // 2. Global WebSocket connection for different phones/devices across the internet
    let ws = null;
    const wsUrl = 'wss://free.piesocket.com/v3/devipaksha_global_presence_v3?api_key=VC44WJhWuMVAf92a02EKaJGqqwrvaJuTBelgUQXi&notify_self=1';

    function connectWebSocket() {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          sendPing();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handlePresenceMessage(data);
          } catch (e) {}
        };

        ws.onclose = () => {
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {}
    }

    connectWebSocket();

    if (bc) {
      bc.onmessage = (event) => {
        if (event.data) {
          handlePresenceMessage(event.data);
        }
      };
    }

    function handlePresenceMessage(data) {
      if (!data || !data.clientId) return;

      const now = Date.now();
      if (data.type === 'PRESENCE_PING' || data.type === 'PRESENCE_PONG') {
        activeClients.set(data.clientId, now);
        if (data.type === 'PRESENCE_PING' && data.clientId !== clientId) {
          broadcastMessage({ type: 'PRESENCE_PONG', clientId, timestamp: now });
        }
      } else if (data.type === 'PRESENCE_BYE') {
        activeClients.delete(data.clientId);
      }

      updateCount();
    }

    function broadcastMessage(msg) {
      const payload = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch (e) {}
      }
      if (bc) {
        try { bc.postMessage(msg); } catch (e) {}
      }
    }

    function sendPing() {
      const now = Date.now();
      activeClients.set(clientId, now);
      broadcastMessage({ type: 'PRESENCE_PING', clientId, timestamp: now });
      updateCount();
    }

    function updateCount() {
      const now = Date.now();
      for (const [id, lastSeen] of activeClients.entries()) {
        if (now - lastSeen > 6000) {
          activeClients.delete(id);
        }
      }
      setOnlineCount(Math.max(1, activeClients.size));
    }

    sendPing();
    const interval = setInterval(sendPing, 2500);

    function onUnload() {
      broadcastMessage({ type: 'PRESENCE_BYE', clientId });
      if (ws) {
        try { ws.close(); } catch (e) {}
      }
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
    }

    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, []);

  return {
    count: onlineCount,
    localCount: onlineCount,
    globalCount: onlineCount
  };
}
