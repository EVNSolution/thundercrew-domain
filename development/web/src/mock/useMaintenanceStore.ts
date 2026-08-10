import { useSyncExternalStore } from 'react';
import {
  getMaintenanceSnapshot,
  subscribeMaintenance,
  type MaintenanceState,
} from './maintenance-store';

/** 정비 모드의 세 화면이 공유하는 품목·기록 상태. */
export function useMaintenanceStore(): MaintenanceState {
  return useSyncExternalStore(subscribeMaintenance, getMaintenanceSnapshot, getMaintenanceSnapshot);
}
