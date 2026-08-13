import { useSyncExternalStore } from 'react';
import { getSettingsSnapshot, subscribeSettings, type SettingsState } from './settings-store';

export function useSettingsStore(): SettingsState {
  return useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
}
