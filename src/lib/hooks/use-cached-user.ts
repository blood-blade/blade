import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';

const userCache = new Map<string, User>();

export function useCachedUser(uid: string | null) {
  const [user, setUser] = useState<User | null>(() => uid ? userCache.get(uid) || null : null);
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (!uid) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cachedUser = userCache.get(uid);
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
    }

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (doc) => {
        if (doc.exists()) {
          const userData = { id: doc.id, ...doc.data() } as User;
          userCache.set(uid, userData); // Update cache
          setUser(userData);
        } else {
          userCache.delete(uid); // Remove from cache if deleted
          setUser(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching user:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { user, loading };
}