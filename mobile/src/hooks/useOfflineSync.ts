import { useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateRecords } from '../api/attendance';
import { OFFLINE_QUEUE_KEY } from '../constants';
import { OfflineQueueItem, AttendanceRecord } from '../types';

export function useOfflineSync() {
  const processQueue = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;

      const queue: OfflineQueueItem[] = JSON.parse(raw);
      if (!queue.length) return;

      const failed: OfflineQueueItem[] = [];

      for (const item of queue) {
        try {
          await updateRecords(item.sessionId, { records: item.records });
        } catch {
          // Keep failed items for retry next time
          failed.push(item);
        }
      }

      if (failed.length === 0) {
        await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      } else {
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
      }
    } catch {
      // Queue processing failed — will retry on next connectivity change
    }
  }, []);

  useEffect(() => {
    // Subscribe to connectivity changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        processQueue();
      }
    });

    // Also try to process queue on mount (in case we're already online)
    NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable) {
        processQueue();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [processQueue]);

  const enqueueRecords = useCallback(
    async (sessionId: string, records: AttendanceRecord[]) => {
      try {
        const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue: OfflineQueueItem[] = raw ? JSON.parse(raw) : [];

        // Check if there's already an item for this session — merge/replace records
        const existingIndex = queue.findIndex((item) => item.sessionId === sessionId);
        const newItem: OfflineQueueItem = {
          id: `${sessionId}-${Date.now()}`,
          sessionId,
          records,
          timestamp: Date.now(),
        };

        if (existingIndex >= 0) {
          queue[existingIndex] = newItem;
        } else {
          queue.push(newItem);
        }

        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      } catch {
        // Failed to enqueue — records may be lost for this session
      }
    },
    []
  );

  const syncRecords = useCallback(
    async (sessionId: string, records: AttendanceRecord[]): Promise<boolean> => {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected && state.isInternetReachable) {
          await updateRecords(sessionId, { records });
          return true;
        } else {
          await enqueueRecords(sessionId, records);
          return false;
        }
      } catch {
        // Online but failed — queue for retry
        await enqueueRecords(sessionId, records);
        return false;
      }
    },
    [enqueueRecords]
  );

  return { syncRecords, processQueue };
}
