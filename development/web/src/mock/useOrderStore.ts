import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, type OrderStoreState } from './order-store';

/** 배차·관제가 같은 주문 상태를 본다. */
export function useOrderStore(): OrderStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 경과 시간 표시용 시계. 주문의 `poolSince` 는 고정이고 "몇 분 지났나"만
 * 흐르므로, 스토어를 건드리지 않고 화면만 주기적으로 다시 그린다.
 */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
