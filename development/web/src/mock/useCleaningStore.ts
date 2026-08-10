import { useSyncExternalStore } from 'react';
import { getCleaningSnapshot, subscribeCleaning, type CleaningState } from './cleaning-store';

/** 클리닝 관제·배차·이력이 공유하는 예약 상태. */
export function useCleaningStore(): CleaningState {
  return useSyncExternalStore(subscribeCleaning, getCleaningSnapshot, getCleaningSnapshot);
}
