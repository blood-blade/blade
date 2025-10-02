import { useEffect, useRef, useState, useCallback } from 'react';
import { VoiceRoom } from '@/lib/voice/voice-room';
import {
  VoiceRoomParticipant,
  VoiceRoomEvent,
  VoiceConnectionState,
} from '@/lib/voice/types';

export interface UseVoiceChatOptions {
  userId: string;
  roomId: string;
  onError?: (error: Error) => void;
}

export function useVoiceChat({
  userId,
  roomId,
  onError,
}: UseVoiceChatOptions) {
  const voiceRoomRef = useRef<VoiceRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceRoomParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>(
    VoiceConnectionState.DISCONNECTED
  );

  // Initialize voice room
  useEffect(() => {
    const voiceRoom = new VoiceRoom(userId, roomId);
    voiceRoomRef.current = voiceRoom;

    // Setup event handlers
    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_JOINED, (participant) => {
      setParticipants((prev) => [...prev, participant]);
    });

    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_LEFT, (participantId) => {
      setParticipants((prev) => prev.filter(p => p.id !== participantId));
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.PARTICIPANT_UPDATED, (participant) => {
      setParticipants((prev) =>
        prev.map(p => p.id === participant.id ? { ...p, ...participant } : p)
      );
    });

    voiceRoom.on(VoiceRoomEvent.STREAM_ADDED, (stream, participantId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(participantId, stream);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.STREAM_REMOVED, (participantId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
    });

    voiceRoom.on(VoiceRoomEvent.CONNECTION_STATE_CHANGED, (state) => {
      setConnectionState(state as VoiceConnectionState);
      setIsConnected(state === 'connected');
    });

    voiceRoom.on(VoiceRoomEvent.ERROR, (error) => {
      onError?.(error);
    });

    return () => {
      if (voiceRoomRef.current) {
        voiceRoomRef.current.leave();
        voiceRoomRef.current = null;
      }
    };
  }, [userId, roomId, onError]);

  // Join voice room
  const join = useCallback(async () => {
    if (voiceRoomRef.current) {
      try {
        await voiceRoomRef.current.join();
        setIsConnected(true);
      } catch (error) {
        onError?.(error as Error);
      }
    }
  }, [onError]);

  // Leave voice room
  const leave = useCallback(() => {
    if (voiceRoomRef.current) {
      voiceRoomRef.current.leave();
      setIsConnected(false);
      setParticipants([]);
      setRemoteStreams(new Map());
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (voiceRoomRef.current) {
      const newMuted = !isMuted;
      voiceRoomRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  return {
    isConnected,
    isMuted,
    participants,
    remoteStreams,
    connectionState,
    join,
    leave,
    toggleMute,
  };
}