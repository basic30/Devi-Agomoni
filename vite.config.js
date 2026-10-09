import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function globalChatPlugin() {
  return {
    name: 'global-chat-plugin',
    configureServer(server) {
      server.ws.on('devi:chat-msg', (data, client) => {
        // Broadcast message to all connected clients
        server.ws.send('devi:chat-msg', data);
      });

      // Local proxy for live YouTube playlist feeds
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/playlist-feed') {
          const playlistId = url.searchParams.get('id') || 'PLU7X6UN1WmZ4';
          try {
            const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`);
            if (feedRes.ok) {
              const xml = await feedRes.text();
              res.setHeader('Content-Type', 'application/xml');
              return res.end(xml);
            }
          } catch (e) { }
          res.statusCode = 502;
          return res.end('');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), globalChatPlugin()],
  server: {
    host: true,
  },
});
