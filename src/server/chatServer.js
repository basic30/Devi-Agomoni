import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

console.log(`[Devipaksha Chat Server] Running live on ws://0.0.0.0:${PORT}`);

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[Chat Server] Client connected from ${ip}`);

  ws.on('message', (message) => {
    try {
      const data = message.toString();
      // Broadcast message to all other connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(data);
        }
      });
    } catch (err) {
      console.error('[Chat Server] Broadcast error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[Chat Server] Client disconnected from ${ip}`);
  });
});
