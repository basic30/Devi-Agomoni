import { useState, useEffect, useRef } from 'react';
import {
  realtimeBus,
  getPersistentDeviceId,
  getPersistentNickname,
  setPersistentNickname,
  getPersistentAvatarColor,
} from '../utils/realtime';

const CHAT_STORAGE_KEY = 'devi_paksha_global_chat_messages_v6';

const INITIAL_MESSAGES = [
  {
    id: 'msg-init-1',
    senderId: 'system-1',
    sender: 'Pujo Lover #104',
    avatarColor: 'from-amber-400 to-red-500',
    text: 'শুভ শারদীয়া সবাইকে! 🌺',
    timestamp: '8:10 pm',
  },
  {
    id: 'msg-init-2',
    senderId: 'system-2',
    sender: 'Dhak Beats #712',
    avatarColor: 'from-orange-400 to-amber-600',
    text: 'পুজো আসছে! কে কোথায় ঠাকুর দেখতে যাবেন? 🥁✨',
    timestamp: '8:12 pm',
  },
  {
    id: 'msg-init-3',
    senderId: 'system-3',
    sender: 'Agamoni Fan #305',
    avatarColor: 'from-yellow-400 to-amber-500',
    text: 'মহালয়া শোনা হয়ে গেছে সকাল থেকে! আবহটাই অন্যরকম! ❤️',
    timestamp: '8:15 pm',
  },
];

function formatMsgTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

function getStoredMessages() {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return INITIAL_MESSAGES;
}

function saveStoredMessages(msgs) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
  } catch (e) {}
}

export function useGlobalChat() {
  const [messages, setMessages] = useState(() => getStoredMessages());
  const [deviceId] = useState(() => getPersistentDeviceId());
  const [nickname, setNickname] = useState(() => getPersistentNickname());
  const [avatarGradient] = useState(() => getPersistentAvatarColor());
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  const broadcastChannelRef = useRef(null);

  // Merge incoming message without duplicates
  function mergeAndSaveMessage(newMsg) {
    if (!newMsg || !newMsg.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      const updated = [...prev, newMsg];
      saveStoredMessages(updated);
      return updated;
    });
  }

  useEffect(() => {
    // 1. Subscribe to Global MQTT Realtime Bus (Cross-Device across all phones/laptops)
    const unsubscribeBus = realtimeBus.subscribe((event) => {
      if (event.type === 'STATUS') {
        setIsLiveConnected(event.connected);
      } else if (event.topic === 'devipaksha/chat/v4' && event.data) {
        mergeAndSaveMessage(event.data);
      }
    });

    // 2. BroadcastChannel for instant local tabs on same device
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('devipaksha_global_chat_channel_v6');
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
          mergeAndSaveMessage(event.data.message);
        }
      };
    }

    // 3. Sync localStorage across tabs
    function handleStorageChange(e) {
      if (e.key === CHAT_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        } catch (err) {}
      }
    }
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribeBus();
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  function sendMessage(text) {
    if (!text || !text.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      senderId: deviceId, // Permanent Device ID
      sender: nickname,   // Permanent Handle
      avatarColor: avatarGradient,
      text: text.trim(),
      timestamp: formatMsgTime(),
    };

    // Save locally
    mergeAndSaveMessage(newMsg);

    // Publish to Global MQTT Realtime Bus
    realtimeBus.publish('devipaksha/chat/v4', newMsg);

    // Broadcast to other tabs on same device
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
      } catch (e) {}
    }
  }

  function updateNickname(newName) {
    if (!newName || !newName.trim()) return;
    const clean = newName.trim();
    setNickname(clean);
    setPersistentNickname(clean);
  }

  return {
    messages,
    deviceId,
    nickname,
    avatarGradient,
    isLiveConnected,
    sendMessage,
    updateNickname,
  };
}
