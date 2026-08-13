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
    },
  };
}

export default defineConfig({
  plugins: [react(), globalChatPlugin()],
  server: {
    host: true,
  },
});
