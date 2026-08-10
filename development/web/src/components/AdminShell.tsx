import { useState, type ReactNode } from 'react';
import {
  GLOBAL_MENU,
  MODES,
  SETTINGS_MENU,
  type MenuItem,
  type ModeId,
  type ScreenId,
} from '../app-modes';
import { modeIcon, screenIcon } from './icons';

/** 모드별 액센트. 클린차량만 보조색을 쓰고 나머지는 기본 액센트를 따른다. */
const MODE_ACCENT: Record<ModeId, { accent: string; soft: string }> = {
  delivery: { accent: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
  cleaning: { accent: 'var(--color-cleaning)', soft: 'var(--color-cleaning-soft)' },
  maintenance: { accent: 'var(--color-success)', soft: 'var(--color-success-soft)' },
};

export function AdminShell({
  mode,
  screen,
  onNavigate,
  onSwitchMode,
  children,
}: {
  mode: ModeId;
  screen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onSwitchMode: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const definition = MODES[mode];
  const accent = MODE_ACCENT[mode];

  const renderTab = (item: MenuItem) => (
    <button
      key={item.screen}
      className="main-tab"
      type="button"
      onClick={() => onNavigate(item.screen)}
      aria-current={screen === item.screen ? 'page' : undefined}
      title={item.label}
    >
      <span className="tab-icon">{screenIcon(item.screen)}</span>
      <span className="tab-name">{item.label}</span>
    </button>
  );

  return (
    <div
      className={`page${collapsed ? ' is-collapsed' : ''}`}
      style={
        {
          '--mode-accent': accent.accent,
          '--mode-accent-soft': accent.soft,
        } as React.CSSProperties
      }
    >
      <nav className="left-tabs" aria-label="주 메뉴">
        <button className="sidebar-brand" type="button" onClick={() => onNavigate(definition.home)}>
          <span className="sidebar-brand-mark" aria-hidden="true">
            T
          </span>
          <span className="sidebar-brand-title">썬더크루</span>
        </button>

        <div className="nav-group">{definition.menu.map(renderTab)}</div>

        <div className="nav-divider" role="presentation" />

        <div className="nav-group">{GLOBAL_MENU.map(renderTab)}</div>

        <div className="nav-foot">
          <button
            className="mode-current"
            type="button"
            onClick={onSwitchMode}
            title={`현재 ${definition.label} — 다른 업무로 전환`}
          >
            <span className="tab-icon">{modeIcon(mode)}</span>
            <span className="mode-copy">
              <small>현재</small>
              <b>{definition.label}</b>
              <span>전환</span>
            </span>
          </button>
          {renderTab(SETTINGS_MENU)}
        </div>

        <button
          className="sidebar-rail"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          <span aria-hidden="true" />
        </button>
      </nav>

      {children}
    </div>
  );
}
