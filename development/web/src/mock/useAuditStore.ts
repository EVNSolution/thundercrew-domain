import { useSyncExternalStore } from 'react';
import { getAuditSnapshot, subscribeAudit, type AuditState } from './audit-store';

export function useAuditStore(): AuditState {
  return useSyncExternalStore(subscribeAudit, getAuditSnapshot, getAuditSnapshot);
}
