import {
  VoiceRoom as VoiceRoomType,
  VoiceRoomParticipant,
  VoiceConnectionConfig,
  VoiceRoomEvent,
  VoiceRoomEventHandler,
  VoiceTopology,
  VoiceConnectionState,
} from './types';
import { SignalingMessage, SignalingMessageType } from './signaling-server';

const DEFAULT_CONFIG: VoiceConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  maxRetries: 3,
  reconnectDelay: 1000,
};

export class VoiceRoom {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private eventHandlers: Partial<{ [K in VoiceRoomEvent]: VoiceRoomEventHandler[K][] }> = {};
  private websocket: WebSocket | null = null;
  private topology: VoiceTopology = VoiceTopology.P2P;
  private retryCount: number = 0;
  private roomInfo: VoiceRoomType | null = null;
  private isSpeaking: boolean = false;

  constructor(
    private userId: string,
    private roomId: string,
    private config: VoiceConnectionConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Join the voice room
   */
  public async join() {
    try {
      await this.setupLocalStream();
      await this.connectToSignalingServer();
      await this.sendJoinRoom();
    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      throw formattedError;
    }
  }

  /**
   * Leave the voice room
   */
  public async leave() {
    try {
      this.sendLeaveRoom();
      this.cleanup();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Mute/unmute local audio
   */
  public setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });

      this.sendParticipantUpdate({ isMuted: muted });
    }
  }

  /**
   * Register event handler
   */
  public on<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]?.push(handler);
  }

  /**
   * Remove event handler
   */
  public off<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]) {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Setup local audio stream
   */
  private async setupLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Setup audio level detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(this.localStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.localStream) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const isSpeaking = average > 30; // Adjust threshold as needed

        if (isSpeaking !== this.isSpeaking) {
          this.isSpeaking = isSpeaking;
          this.sendParticipantUpdate({ isSpeaking });
        }

        requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      throw new Error('Failed to access microphone: ' + error);
    }
  }

  /**
   * Connect to signaling server
   */
  private async connectToSignalingServer() {
    return new Promise<void>((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice`;
      
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.retryCount = 0;
        resolve();
      };

      this.websocket.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.websocket.onclose = () => {
        if (this.retryCount < (this.config.maxRetries || 3)) {
          setTimeout(() => {
            this.retryCount++;
            this.connectToSignalingServer();
          }, this.config.reconnectDelay || 1000);
        } else {
          reject(new Error('Failed to connect to signaling server'));
        }
      };

      this.websocket.onerror = (event) => {
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(message: SignalingMessage) {
    switch (message.type) {
      case SignalingMessageType.JOIN_ROOM:
        if (message.payload.initiator) {
          this.createPeerConnection(message.targetId!, message.payload.mesh);
        }
        break;

      case SignalingMessageType.ROOM_INFO:
        this.handleRoomInfo(message.payload);
        break;

      case SignalingMessageType.OFFER:
        await this.handleOffer(message);
        break;

      case SignalingMessageType.ANSWER:
        await this.handleAnswer(message);
        break;

      case SignalingMessageType.ICE_CANDIDATE:
        await this.handleIceCandidate(message);
        break;

      case SignalingMessageType.ERROR:
        this.handleError(new Error(message.payload.error));
        break;
    }
  }

  /**
   * Handle room information updates
   */
  private handleRoomInfo(roomInfo: VoiceRoomType) {
    const prevParticipants = new Set(this.roomInfo?.participants.keys() || []);
    const newParticipants = new Set(roomInfo.participants.keys());

    // Handle left participants
    for (const participantId of prevParticipants) {
      if (!newParticipants.has(participantId)) {
        this.emit(VoiceRoomEvent.PARTICIPANT_LEFT, participantId);
      }
    }

    // Handle new participants
    for (const [participantId, participant] of roomInfo.participants.entries()) {
      if (!prevParticipants.has(participantId)) {
        this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, participant);
      }
    }

    this.roomInfo = roomInfo;

    // Update topology based on participant count
    this.updateTopology(roomInfo.participants.size);
  }

  /**
   * Create a new peer connection
   */
  private createPeerConnection(targetId: string, mesh: boolean = false) {
    const pc = new RTCPeerConnection(this.config);
    this.peerConnections.set(targetId, pc);

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.localStream && pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: SignalingMessageType.ICE_CANDIDATE,
          payload: event.candidate,
          targetId,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState);
      if (pc.connectionState === 'failed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      this.remoteStreams.set(targetId, stream);
      this.emit(VoiceRoomEvent.STREAM_ADDED, stream, targetId);
    };

    if (!mesh) {
      this.createOffer(pc, targetId);
    }

    return pc;
  }

  /**
   * Create and send an offer
   */
  private async createOffer(pc: RTCPeerConnection, targetId: string) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignalingMessage({
        type: SignalingMessageType.OFFER,
        payload: offer,
        targetId,
      });
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(message: SignalingMessage) {
    const pc = this.peerConnections.get(message.senderId) ||
               this.createPeerConnection(message.senderId);

    try {
      await pc.setRemoteDescription(message.payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignalingMessage({
        type: SignalingMessageType.ANSWER,
        payload: answer,
        targetId: message.senderId,
      });
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(message: SignalingMessage) {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(message.payload);
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(message: SignalingMessage) {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.addIceCandidate(message.payload);
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Handle peer connection failure
   */
  private async handlePeerConnectionFailure(targetId: string) {
    this.peerConnections.delete(targetId);
    this.remoteStreams.delete(targetId);
    this.emit(VoiceRoomEvent.STREAM_REMOVED, targetId);

    if (this.retryCount < (this.config.maxRetries || 3)) {
      this.retryCount++;
      await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay || 1000));
      this.createPeerConnection(targetId);
    }
  }

  /**
   * Update room topology based on participant count
   */
  private updateTopology(participantCount: number) {
    const newTopology = participantCount <= 2 
      ? VoiceTopology.P2P 
      : participantCount <= 4 
        ? VoiceTopology.MESH 
        : VoiceTopology.SFU;

    if (this.topology !== newTopology) {
      this.topology = newTopology;
      // Implement topology switch logic here if needed
    }
  }

  /**
   * Send message to signaling server
   */
  private sendSignalingMessage(message: Partial<SignalingMessage>) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        ...message,
        senderId: this.userId,
        roomId: this.roomId,
      }));
    }
  }

  /**
   * Send join room message
   */
  private sendJoinRoom() {
    this.sendSignalingMessage({
      type: SignalingMessageType.JOIN_ROOM,
    });
  }

  /**
   * Send leave room message
   */
  private sendLeaveRoom() {
    this.sendSignalingMessage({
      type: SignalingMessageType.LEAVE_ROOM,
    });
  }

  /**
   * Send participant update
   */
  private sendParticipantUpdate(update: Partial<VoiceRoomParticipant>) {
    this.sendSignalingMessage({
      type: SignalingMessageType.PARTICIPANT_UPDATED,
      payload: update,
    });
  }

  /**
   * Emit event to registered handlers
   */
  private emit<E extends VoiceRoomEvent>(event: E, ...args: Parameters<VoiceRoomEventHandler[E]>) {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      handlers.forEach(handler => {
        (handler as Function)(...args);
      });
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error) {
    console.error('VoiceRoom error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    this.emit(VoiceRoomEvent.ERROR, error);
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();

    // Clear remote streams
    this.remoteStreams.clear();

    // Close websocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    // Reset state
    this.roomInfo = null;
    this.retryCount = 0;
    this.topology = VoiceTopology.P2P;
  }
}