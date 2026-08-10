import type { ReactElement } from 'react';
import type { ModeId, ScreenId } from '../app-modes';

/**
 * 인라인 SVG 아이콘. 장식용 아이콘은 두지 않고(DSV 금지 규칙),
 * 사이드바 메뉴와 모드 구분에만 쓴다. currentColor 를 따라간다.
 */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function DeliveryIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <circle cx="6" cy="17.5" r="2.5" />
      <circle cx="18" cy="17.5" r="2.5" />
      <path d="M8.5 17.5h7" />
      <path d="M6 15V9h6l3 4h3" />
      <path d="M9 6h4" />
    </svg>
  );
}

export function CleaningIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M9 3h6l1 5H8l1-5Z" />
      <path d="M8 8h8v4a4 4 0 0 1-8 0V8Z" />
      <path d="M12 16v5" />
    </svg>
  );
}

export function WrenchIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6L21 12l-9 9-3-3 9-9-1.9-1.9Z" />
      <path d="M6.5 17.5h.01" />
    </svg>
  );
}

export function MapPinIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function DispatchIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M4 6h10M4 12h16M4 18h7" />
      <path d="M17 15l3 3-3 3" />
    </svg>
  );
}

export function ClockIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

export function GridIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

export function ListIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AuditIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h5" />
    </svg>
  );
}

export function PulseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <path d="M3 13h4l2-5 3 9 2.5-6 1.5 2h5" />
    </svg>
  );
}

export function SettingsIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
    </svg>
  );
}

export function modeIcon(mode: ModeId): ReactElement {
  if (mode === 'cleaning') return <CleaningIcon />;
  if (mode === 'maintenance') return <WrenchIcon />;
  return <DeliveryIcon />;
}

export function screenIcon(screen: ScreenId): ReactElement {
  switch (screen) {
    case 'control':
      return <MapPinIcon />;
    case 'dispatch':
      return <DispatchIcon />;
    case 'records':
    case 'maintenance-records':
      return <ClockIcon />;
    case 'master-data':
      return <GridIcon />;
    case 'maintenance-vehicles':
      return <WrenchIcon />;
    case 'maintenance-items':
      return <ListIcon />;
    case 'audit':
      return <AuditIcon />;
    case 'diagnostics':
      return <PulseIcon />;
    case 'settings':
      return <SettingsIcon />;
  }
}
