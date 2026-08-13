# 🌺 দেবী আগমনী — Devi Agamoni

> **Celebrate Durga Puja with dynamic time-of-day visuals, Mahalaya broadcasts, 50 golden era classic Pujo songs, countdown, and real-time Global Adda live chat!**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase Hosting](https://img.shields.io/badge/Firebase-Hosting-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

---

## ✨ Features

### 🌄 Dynamic IST Time-of-Day Background System
- **6 Dynamic Time Periods**: Automatically adjusts backgrounds based on Indian Standard Time (`Asia/Kolkata`):
  - 🌌 **Midnight** (`00:00 - 03:59`)
  - 🌅 **Early Morning / ভোর বেলা** (`04:00 - 06:59`)
  - ☀️ **Morning** (`07:00 - 11:59`)
  - 🌤️ **Afternoon** (`12:00 - 15:59`)
  - 🌇 **Evening / গোধূলি** (`16:00 - 18:59`)
  - 🌙 **Night** (`19:00 - 23:59`)
- **Visual Effects**: High-resolution WebP/AVIF responsive image set, 1.5s smooth crossfades, SVG noise grain filter (`#hero-grain`), and ambient lighting gradients.

---

### 🎵 Curated Audio Player Engine
Powered by the YouTube iFrame API with ready-state queueing and custom playback controls:
1. **Durga Puja (106 Songs)**: Curated festive modern and popular Durga Puja tracks.
2. **Old Pujo Songs (50 Verified Classics)**: 50 golden era Bengali classics featuring Kishore Kumar, Supriti Ghosh, Hemanta Mukherjee, Sandhya Mukhopadhyay, Manna Dey, Asha Bhosle, Utpala Sen, Dwijen Mukhopadhyay, Pankaj Mullick, R.D. Burman, and more.
3. **Mahalaya (Full Original Broadcast)**: Birendra Krishna Bhadra's iconic full broadcast.
4. **Mahalaya Songs (19 Chapters)**: Timestamped chants and hymns.

---

### 💬 Global Adda (Anonymous Real-Time Live Chat)
- **Multi-Tab & Cross-Device Sync**: Built with native WebSockets and `BroadcastChannel` APIs for instant cross-tab and cross-device message delivery.
- **Bengali Festive Handles**: Auto-generates fun anonymous handles (e.g. `Pujo Lover #240`, `Agamoni Fan #885`) with custom handle editing.
- **Quick Reactions**: 1-tap festive emoji reactions (`🌺`, `🥁`, `🪔`, `🙏`, `✨`, `❤️`, `💛`).

---

### ⏰ Countdown & Live Presence Counter
- **Pujo Countdown**: Real-time days remaining until Durga Puja.
- **IST Live Clock**: 12-hour Kolkata time with animated pulsing colon (`:`).
- **Tab Presence Indicator**: Tracks active open browser tabs and users online.

---

### 📱 WhatsApp & Open Graph Rich Preview
- Pre-configured Open Graph tags, Twitter Cards, and thumbnail metadata for rich link previews when sharing on WhatsApp, Telegram, iMessage, and social media.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, TailwindCSS 3
- **Audio Engine**: YouTube iFrame Player API
- **Real-Time Sync**: WebSockets, BroadcastChannel API, LocalStorage Sync
- **Deployment**: Firebase Hosting (pre-configured `firebase.json`)

---

## 📁 Project Structure

```
devipaksha/
├── public/
├── src/
│   ├── components/
│   │   ├── DeveloperModal.jsx
│   │   ├── GlobalChatModal.jsx
│   │   ├── HeroBackground.jsx
│   │   ├── HeroTitle.jsx
│   │   ├── Icons.jsx
│   │   ├── PlayerBar.jsx
│   │   ├── PlaylistModal.jsx
│   │   └── TopNav.jsx
│   ├── context/
│   │   └── PlayerContext.jsx
│   ├── data/
│   │   └── playlists.js      # 50 Old Pujo Songs & full playlist data
│   ├── hooks/
│   │   ├── useGlobalChat.js  # Real-time WebSocket + BroadcastChannel sync
│   │   ├── usePresence.js
│   │   └── useTimeOfDay.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── firebase.json              # Firebase Hosting configuration
├── vite.config.js             # Vite config with native WebSocket chat plugin
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/devipaksha.git
   cd devipaksha
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 📦 Deployment (Firebase Hosting)

1. **Build the production bundle**:
   ```bash
   npm run build
   ```

2. **Login to Firebase**:
   ```bash
   npx firebase-tools login
   ```

3. **Deploy live**:
   ```bash
   npx firebase-tools deploy
   ```

---

## 👨‍💻 Developer & Credits

Made with **Bhalobasha** by **Snahasish**:
- **LinkedIn**: [https://www.linkedin.com/in/snahasish0914/](https://www.linkedin.com/in/snahasish0914/)
- **Instagram**: [https://www.instagram.com/snahasish0915/](https://www.instagram.com/snahasish0915/)

---

### 🌺 শুভ শারদীয়া ও দেবী আগমনী!
