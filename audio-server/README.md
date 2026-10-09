# 📻 Devi Agomoni - Background Audio Streaming Proxy (Render Deployment)

This is a lightweight Node.js streaming proxy that extracts pure audio (`audio/mp4`) from YouTube videos and streams it directly to mobile and desktop browsers with full **HTTP Range (seeking) support**.

This enables **100% native background audio playback with the phone screen locked/off** and ensures lock-screen media notifications never get dismissed.

---

## 🚀 How to Deploy on Render (Free in 2 Minutes)

### Method 1: Deploy from your GitHub Repository (Recommended)
1. Commit and push the `audio-server` folder to your GitHub repository (or create a dedicated repo named `deviagomoni-audio-server`).
2. Log in to **[dashboard.render.com](https://dashboard.render.com)**.
3. Click **New +** ➔ **Web Service**.
4. Connect your GitHub repository.
5. Set the following configuration options:
   * **Name**: `deviagomoni-audio-proxy`
   * **Root Directory**: `audio-server` (if deployed from the main monorepo, otherwise leave blank)
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Plan**: `Free`
6. Click **Deploy Web Service**!
7. Once deployed, Render will provide a free HTTPS URL like:
   ```
   https://deviagomoni-audio-proxy.onrender.com
   ```

---

## 🔗 Connecting to your Frontend

In your main `deviagomoni` frontend root:
1. Create or open `.env` or `.env.production`:
   ```env
   VITE_AUDIO_PROXY_URL=https://deviagomoni-audio-proxy.onrender.com
   ```
2. Build and deploy your frontend (`npm run build && firebase deploy`).

---

## 📡 API Endpoints

* **`GET /health`** - Server status & uptime check
* **`GET /api/stream/:videoId`** - Streams direct `audio/mp4` chunks with full `Range: bytes=` seek support
* **`GET /api/info/:videoId`** - Returns direct audio URL and stream metadata
