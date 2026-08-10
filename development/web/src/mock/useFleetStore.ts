import { useSyncExternalStore } from 'react';
import { getFleetSnapshot, subscribeFleet, type FleetState } from './fleet-store';

/** 관리 화면이 보는 차량·인력·계약 상태. */
export function useFleetStore(): FleetState {
  return useSyncExternalStore(subscribeFleet, getFleetSnapshot, getFleetSnapshot);
}
