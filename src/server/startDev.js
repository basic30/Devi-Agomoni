import { spawn } from 'child_process';

console.log('🚀 Starting Devipaksha Web & Chat Server...');

// Start WebSocket Chat Server
const chatServer = spawn('node', ['src/server/chatServer.js'], { stdio: 'inherit', shell: true });

// Start Vite Dev Server with --host (accessible on local network & phones)
const viteDev = spawn('npx', ['vite', '--host'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  chatServer.kill();
  viteDev.kill();
  process.exit();
});
