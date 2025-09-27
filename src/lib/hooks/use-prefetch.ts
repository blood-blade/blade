import { useMemo } from 'react';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface UsePrefetchOptions {
  enabled?: boolean;
  prefetchCount?: number;
}

export function usePrefetch() {
  const prefetchUserData = useMemo(() => async (uid: string, options: UsePrefetchOptions = {}) => {
    const { enabled = true, prefetchCount = 5 } = options;
    if (!enabled) return;

    try {
      // Prefetch user's recent conversations
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', uid),
        limit(prefetchCount)
      );
      
      // Prefetch user's settings
      const settingsDoc = doc(db, 'users', uid, 'settings', 'preferences');
      
      // Execute queries in parallel
      await Promise.all([
        getDocs(conversationsQuery),
        getDoc(settingsDoc)
      ]);
    } catch (error) {
      console.error('Error prefetching data:', error);
    }
  }, []);

  return { prefetchUserData };
}