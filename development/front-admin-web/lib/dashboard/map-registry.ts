"use client";

// External store that publishes the active NAVER Maps instance.
// MapShell sets the instance after creation; marker components read it via
// useSyncExternalStore so map readiness flows through React without forcing
// MapShell to call `setState` synchronously inside an effect body.

import type { NaverMapInstance } from "@/types/naver-maps";

let currentMap: NaverMapInstance | null = null;
const listeners = new Set<() => void>();

export function setRegisteredMap(map: NaverMapInstance | null): void {
  if (currentMap === map) return;
  currentMap = map;
  listeners.forEach((listener) => listener());
}

export function getRegisteredMap(): NaverMapInstance | null {
  return currentMap;
}

export function subscribeRegisteredMap(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
