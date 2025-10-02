import { WebSocket } from 'ws';
import { NextApiRequest } from 'next';
import { Server } from 'socket.io';
import { VoiceSignalingServer } from '@/lib/voice/signaling-server';

const voiceSignalingServer = new VoiceSignalingServer();

export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    console.log('Starting Socket.io server...');
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        socket.disconnect();
        return;
      }

      // Create WebSocket wrapper for Socket.io
      // Create WebSocket wrapper for Socket.io with correct OPEN state value
      const ws = {
        send: (data: string) => socket.emit('message', data),
        on: (event: string, callback: (data: unknown) => void) => socket.on(event, callback),
        readyState: 1, // WebSocket.OPEN value
      };

      voiceSignalingServer.handleConnection(ws as any, userId);

      socket.on('disconnect', () => {
        ws.readyState = WebSocket.CLOSED;
      });
    });
  }

  res.end();
}