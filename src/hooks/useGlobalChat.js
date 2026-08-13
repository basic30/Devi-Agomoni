import { useState, useEffect, useRef } from 'react';

const CHAT_STORAGE_KEY = 'devi_paksha_global_chat_messages_v5';
const USER_NICKNAME_SESSION_KEY = 'devi_paksha_chat_nickname_session';

const INITIAL_MESSAGES = [
  {
    id: 'msg-init-1',
    sender: 'Pujo Lover #104',
    avatarColor: 'from-amber-400 to-red-500',
    text: 'শুভ আগমনী সবাইকে! 🌺',
    timestamp: '8:10 pm',
    isSystem: false,
  },
  {
    id: 'msg-init-2',
    sender: 'Dhak Beats #712',
    avatarColor: 'from-orange-400 to-amber-600',
    text: 'পুজো আসছে! কে কোথায় ঠাকুর দেখতে যাবেন? 🥁✨',
    timestamp: '8:12 pm',
    isSystem: false,
  },
  {
    id: 'msg-init-3',
    sender: 'Agamoni Fan #305',
    avatarColor: 'from-yellow-400 to-amber-500',
    text: 'মহালয়া শোনা হয়ে গেছে সকাল থেকে! আবহটাই অন্যরকম! ❤️',
    timestamp: '8:15 pm',
    isSystem: false,
  },
];

const AVATAR_GRADIENTS = [
  'from-amber-400 to-red-500',
  'from-orange-400 to-amber-600',
  'from-yellow-400 to-amber-500',
  'from-rose-400 to-orange-500',
  'from-yellow-500 to-red-600',
  'from-amber-300 to-orange-600',
];

function getRandomGradient() {
  return AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];
}

function generateAnonymousName() {
  const titles = ['Pujo Lover', 'Agamoni Fan', 'Dhak Beats', 'Kolkata Vibe', 'Shiuli Hawa', 'Pandal Hopper', 'Mahalaya Tune'];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${title} #${num}`;
}

export function getTabNickname() {
  try {
    let name = sessionStorage.getItem(USER_NICKNAME_SESSION_KEY);
    if (!name) {
      name = generateAnonymousName();
      sessionStorage.setItem(USER_NICKNAME_SESSION_KEY, name);
    }
    return name;
  } catch (e) {
    return generateAnonymousName();
  }
}

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
  const [nickname, setNickname] = useState(() => getTabNickname());
  const [avatarGradient] = useState(() => getRandomGradient());
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const broadcastChannelRef = useRef(null);

  // Helper to merge message cleanly without duplicates
  function mergeAndSaveMessage(newMsg) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      const updated = [...prev, newMsg];
      saveStoredMessages(updated);
      return updated;
    });
  }

  useEffect(() => {
    // 1. Vite Native WebSocket Bus (0 port errors, 0 connection warnings)
    if (import.meta.hot) {
      setIsLiveConnected(true);
      const handleViteMsg = (data) => {
        if (data && data.id && data.text && data.sender) {
          mergeAndSaveMessage(data);
        }
      };
      import.meta.hot.on('devi:chat-msg', handleViteMsg);
    }

    // 2. BroadcastChannel fallback for multi-tab support
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('devipaksha_global_chat_channel_v5');
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
          mergeAndSaveMessage(event.data.message);
        }
      };
    }

    // 3. Storage event listener
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
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  function sendMessage(text) {
    if (!text || !text.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sender: nickname,
      avatarColor: avatarGradient,
      text: text.trim(),
      timestamp: formatMsgTime(),
      isSystem: false,
    };

    // Save locally
    mergeAndSaveMessage(newMsg);

    // Send over Vite's native WebSocket connection (0 console errors)
    if (import.meta.hot) {
      try {
        import.meta.hot.send('devi:chat-msg', newMsg);
      } catch (e) {}
    }

    // Broadcast locally to tabs on same device
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
    try {
      sessionStorage.setItem(USER_NICKNAME_SESSION_KEY, clean);
    } catch (e) {}
  }

  return {
    messages,
    nickname,
    avatarGradient,
    isLiveConnected,
    sendMessage,
    updateNickname,
  };
}
