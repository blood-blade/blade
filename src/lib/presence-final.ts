import { 
  ref, 
  onDisconnect, 
  set, 
  onValue, 
  Database,
  DatabaseReference,
  serverTimestamp as rtServerTimestamp 
} from 'firebase/database';
import { 
  doc, 
  updateDoc, 
  serverTimestamp as firestoreServerTimestamp,
  DocumentReference
} from 'firebase/firestore';
import { db } from './firebase';
import { getDatabase } from 'firebase/database';
import { firebaseApp } from './firebase-init';

// Initialize Realtime Database
const rtdb: Database = getDatabase(firebaseApp);

// Interface for presence data
interface PresenceData {
  state: 'online' | 'offline';
  lastChanged: object | null;
  lastHeartbeat: object | null;
  connectedAt?: object;
}

class PresenceManager {
  private presenceRef: DatabaseReference | null = null;
  private userDocRef: DocumentReference | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupFn: (() => void) | null = null;
  private uid: string | null = null;

  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor() {
    // Bind methods
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.presenceRef || !this.uid) return;

    try {
      await set(this.presenceRef, {
        state: 'online',
        lastChanged: rtServerTimestamp(),
        lastHeartbeat: rtServerTimestamp()
      });

      if (this.userDocRef) {
        await updateDoc(this.userDocRef, {
          status: 'online',
          lastSeen: firestoreServerTimestamp()
        });
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(this.sendHeartbeat, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleVisibilityChange(): Promise<void> {
    if (!this.presenceRef || !this.userDocRef) return;

    const isVisible = document.visibilityState === 'visible';
    const state = isVisible ? 'online' : 'offline';

    try {
      if (isVisible) {
        this.startHeartbeat();
      } else {
        this.stopHeartbeat();
      }

      await Promise.all([
        set(this.presenceRef, {
          state,
          lastChanged: rtServerTimestamp(),
          lastHeartbeat: isVisible ? rtServerTimestamp() : null
        }),
        updateDoc(this.userDocRef, {
          status: state,
          lastSeen: firestoreServerTimestamp()
        })
      ]);
    } catch (error) {
      console.error('Error updating visibility status:', error);
    }
  }

  private handleBeforeUnload = (): void => {
    if (!this.presenceRef || !this.uid) return;

    // Use sendBeacon for more reliable offline status updates
    try {
      const offlineData = JSON.stringify({
        state: 'offline',
        lastChanged: { '.sv': 'timestamp' },
        lastHeartbeat: null
      });

      // Construct the RTDB URL using the project ID
      const databaseURL = `https://${firebaseApp.options.projectId}-default-rtdb.firebaseio.com`;
      const url = `${databaseURL}/status/${this.uid}.json`;
      navigator.sendBeacon(url, offlineData);

      // Also try to update Firestore
      const firestoreData = JSON.stringify({
        fields: {
          status: { stringValue: 'offline' },
          lastSeen: { timestampValue: new Date().toISOString() }
        }
      });

      navigator.sendBeacon(
        `https://firestore.googleapis.com/v1/projects/${firebaseApp.options.projectId}/databases/(default)/documents/users/${this.uid}`,
        firestoreData
      );
    } catch (error) {
      console.error('Error in beforeunload handler:', error);
    }
  }

  public async initialize(uid: string): Promise<void> {
    if (!uid) throw new Error('UID is required');

    // Cleanup any existing presence
    this.cleanup();

    this.uid = uid;
    this.presenceRef = ref(rtdb, `/status/${uid}`);
    this.userDocRef = doc(db, 'users', uid);

    const connectedRef = ref(rtdb, '.info/connected');

    try {
      if (!this.presenceRef) {
        throw new Error('Presence reference not initialized');
      }

      // Set up disconnect hook first
      await onDisconnect(this.presenceRef).set({
        state: 'offline',
        lastChanged: rtServerTimestamp(),
        lastHeartbeat: null
      });

      // Listen for connection state changes
      const unsubscribeConnection = onValue(connectedRef, async (snapshot) => {
        const isConnected = snapshot.val();
        
        if (isConnected === false) {
          this.stopHeartbeat();
          return;
        }

        try {
          if (!this.presenceRef || !this.userDocRef) {
            throw new Error('References not initialized');
          }

          await Promise.all([
            set(this.presenceRef, {
              state: 'online',
              lastChanged: rtServerTimestamp(),
              lastHeartbeat: rtServerTimestamp(),
              connectedAt: rtServerTimestamp()
            }),
            updateDoc(this.userDocRef, {
              status: 'online',
              lastSeen: firestoreServerTimestamp()
            })
          ]);

          this.startHeartbeat();
        } catch (error) {
          console.error('Error updating online status:', error);
        }
      });

      // Set up event listeners
      if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        // Additional cleanup on page hide
        document.addEventListener('pagehide', this.handleBeforeUnload);
        // Cleanup on freeze (mobile browsers)
        if ('onfreeze' in document) {
          document.addEventListener('freeze', this.handleBeforeUnload);
        }
      }

      // Store cleanup function
      this.cleanupFn = () => {
        unsubscribeConnection();
        this.stopHeartbeat();
        
        if (typeof window !== 'undefined') {
          document.removeEventListener('visibilitychange', this.handleVisibilityChange);
          window.removeEventListener('beforeunload', this.handleBeforeUnload);
          document.removeEventListener('pagehide', this.handleBeforeUnload);
          if ('onfreeze' in document) {
            document.removeEventListener('freeze', this.handleBeforeUnload);
          }
        }

        // Create an array to store cleanup tasks
        const cleanupTasks: Array<Promise<void>> = [];

        // Only add presence update if we have a valid reference
        if (this.presenceRef) {
          cleanupTasks.push(
            set(this.presenceRef, {
              state: 'offline',
              lastChanged: rtServerTimestamp(),
              lastHeartbeat: null
            })
          );
        }

        // Only add user document update if we have a valid reference
        const userDocRef = this.userDocRef;
        if (userDocRef) {
          cleanupTasks.push(
            updateDoc(userDocRef, {
              status: 'offline',
              lastSeen: firestoreServerTimestamp()
            })
          );
        }

        // Execute all cleanup tasks and catch any errors
        if (cleanupTasks.length > 0) {
          Promise.all(cleanupTasks).catch(console.error);
        }
      };
    } catch (error) {
      console.error('Error initializing presence:', error);
      throw error;
    }
  }

  public cleanup(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
    this.uid = null;
    this.presenceRef = null;
    this.userDocRef = null;
    this.stopHeartbeat();
  }

  public async setOffline(): Promise<void> {
    if (!this.presenceRef || !this.userDocRef) return;

    this.stopHeartbeat();

    try {
      await Promise.all([
        set(this.presenceRef, {
          state: 'offline',
          lastChanged: rtServerTimestamp(),
          lastHeartbeat: null
        }),
        updateDoc(this.userDocRef, {
          status: 'offline',
          lastSeen: firestoreServerTimestamp()
        })
      ]);
    } catch (error) {
      console.error('Error setting offline status:', error);
    }
  }
}

// Create singleton instance
const presenceManager = new PresenceManager();

// Export functions that match the previous API
export const setupPresence = async (uid: string): Promise<(() => void) | void> => {
  await presenceManager.initialize(uid);
  return () => presenceManager.cleanup();
};

export const setOfflineStatus = async (uid: string): Promise<void> => {
  await presenceManager.setOffline();
};