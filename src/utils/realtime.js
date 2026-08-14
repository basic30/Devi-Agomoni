import mqtt from 'mqtt';

// Unique Device ID that persists forever in localStorage across refreshes and tab closures
export function getPersistentDeviceId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('devipaksha_persistent_user_id');
    if (!id) {
      id = 'usr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('devipaksha_persistent_user_id', id);
    }
    return id;
  } catch (e) {
    return 'usr_' + Math.random().toString(36).substring(2, 10);
  }
}

// Persistent Nickname in localStorage
export function getPersistentNickname() {
  if (typeof window === 'undefined') return 'Pujo Lover';
  try {
    let name = localStorage.getItem('devipaksha_persistent_user_name');
    if (!name) {
      const titles = ['Pujo Lover', 'Agamoni Fan', 'Dhak Beats', 'Kolkata Vibe', 'Shiuli Hawa', 'Pandal Hopper', 'Mahalaya Tune'];
      const title = titles[Math.floor(Math.random() * titles.length)];
      const num = Math.floor(100 + Math.random() * 900);
      name = `${title} #${num}`;
      localStorage.setItem('devipaksha_persistent_user_name', name);
    }
    return name;
  } catch (e) {
    return 'Pujo Lover #104';
  }
}

export function setPersistentNickname(name) {
  try {
    localStorage.setItem('devipaksha_persistent_user_name', name);
  } catch (e) {}
}

// Persistent Avatar Gradient
export function getPersistentAvatarColor() {
  const AVATAR_GRADIENTS = [
    'from-amber-400 to-red-500',
    'from-orange-400 to-amber-600',
    'from-yellow-400 to-amber-500',
    'from-rose-400 to-orange-500',
    'from-yellow-500 to-red-600',
    'from-amber-300 to-orange-600',
  ];
  if (typeof window === 'undefined') return AVATAR_GRADIENTS[0];
  try {
    let color = localStorage.getItem('devipaksha_avatar_gradient');
    if (!color) {
      color = AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];
      localStorage.setItem('devipaksha_avatar_gradient', color);
    }
    return color;
  } catch (e) {
    return AVATAR_GRADIENTS[0];
  }
}

// Global MQTT Realtime Connection Manager
class RealtimeBus {
  constructor() {
    this.client = null;
    this.listeners = new Set();
    this.connected = false;
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    try {
      const clientId = 'devipaksha_' + Math.random().toString(36).substring(2, 10);
      // Connect to HiveMQ Public WebSocket broker
      this.client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        clientId,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 5000,
        keepalive: 30,
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.client.subscribe(['devipaksha/presence/v4', 'devipaksha/chat/v4'], (err) => {
          if (!err) {
            this.notifyListeners({ type: 'STATUS', connected: true });
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.notifyListeners({ topic, data });
        } catch (e) {}
      });

      this.client.on('offline', () => {
        this.connected = false;
        this.notifyListeners({ type: 'STATUS', connected: false });
      });

      this.client.on('error', () => {
        this.connected = false;
      });
    } catch (err) {
      console.warn('RealtimeBus initialization notice:', err);
    }
  }

  publish(topic, data) {
    if (this.client && this.connected) {
      try {
        this.client.publish(topic, JSON.stringify(data));
      } catch (e) {}
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach((fn) => {
      try { fn(event); } catch (e) {}
    });
  }
}

export const realtimeBus = new RealtimeBus();
