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
    this.customTopics = new Set();
    this.connected = false;
    this.pendingPublishes = [];
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
        const defaultTopics = ['devipaksha/presence/v4', 'devipaksha/chat/v4'];
        const allTopics = [...defaultTopics, ...Array.from(this.customTopics)];
        this.client.subscribe(allTopics, (err) => {
          if (!err) {
            this.notifyListeners({ type: 'STATUS', connected: true });
          }
        });

        if (this.pendingPublishes.length > 0) {
          const queue = [...this.pendingPublishes];
          this.pendingPublishes = [];
          queue.forEach(({ topic, data, options }) => {
            try {
              this.client.publish(topic, JSON.stringify(data), options);
            } catch (e) {}
          });
        }
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

  subscribeTopic(topic) {
    if (!topic) return;
    this.customTopics.add(topic);
    if (this.client && this.connected) {
      try {
        this.client.subscribe(topic);
      } catch (e) {}
    }
  }

  unsubscribeTopic(topic) {
    if (!topic) return;
    this.customTopics.delete(topic);
    if (this.client && this.connected) {
      try {
        this.client.unsubscribe(topic);
      } catch (e) {}
    }
  }

  publish(topic, data, options = {}) {
    if (this.client && this.connected) {
      try {
        this.client.publish(topic, JSON.stringify(data), options);
      } catch (e) {}
    } else {
      this.pendingPublishes.push({ topic, data, options });
      if (this.pendingPublishes.length > 25) {
        this.pendingPublishes.shift();
      }
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
