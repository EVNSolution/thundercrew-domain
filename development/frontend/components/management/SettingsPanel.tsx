"use client";

import { useState, useTransition } from "react";

import { updateSettingsAction, type OperationalSettings } from "@/app/management/settings/actions";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * 설정 화면 (4단계 §6) — 두 성격의 설정을 한 화면에 모은다.
 *
 * 1) 화면 테마 — 이 브라우저에만 적용 (localStorage). 라이트/다크 토글 +
 *    액센트 색상. 액센트는 CSS 변수(--rm-accent/--baemin-mint) 오버라이드로,
 *    layout 부트스트랩이 첫 페인트 전에 복원한다.
 * 2) 운영 기준값 — 서버 전역 (app_settings). 완료 자동 추정·시간 배차가
 *    다음 틱/요청부터 새 값을 쓴다.
 */

const ACCENT_STORAGE_KEY = "thundercrew-accent";

const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "기본 (파랑)" },
  { value: "#2eb8a6", label: "민트" },
  { value: "#7c3aed", label: "보라" },
  { value: "#ea580c", label: "주황" },
  { value: "#e11d48", label: "로즈" }
];

function applyAccent(value: string) {
  const root = document.documentElement;
  if (value) {
    root.style.setProperty("--rm-accent", value);
    root.style.setProperty("--baemin-mint", value);
  } else {
    root.style.removeProperty("--rm-accent");
    root.style.removeProperty("--baemin-mint");
  }
}

const FIELDS: { key: string; label: string; help: string; min: number; max: number }[] = [
  {
    key: "dispatch.default-service-minutes",
    label: "클리닝 건별 소요시간 기본값 (분)",
    help: "시간 할당 폼·엑셀에서 소요분을 비웠을 때 쓰는 값",
    min: 5,
    max: 1440
  },
  {
    key: "dispatch.due-lead-minutes",
    label: "임박 알림 리드타임 (분)",
    help: "서비스 예정 N분 전에 운영자 벨 알림",
    min: 5,
    max: 720
  },
  {
    key: "dispatch.arrival-radius-m",
    label: "완료 추정 도착 반경 (m)",
    help: "목적지에서 이 반경 안에 들어오면 도착 판정 시작",
    min: 30,
    max: 2000
  },
  {
    key: "dispatch.arrival-stop-minutes",
    label: "완료 추정 정지 유지 시간 (분)",
    help: "반경 안 정지 상태가 이 시간 이상 유지되면 도착 감지 확정",
    min: 1,
    max: 60
  }
];

export function SettingsPanel({ initialValues }: { initialValues: OperationalSettings | null }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const f of FIELDS) {
      map[f.key] = initialValues?.[f.key] != null ? String(initialValues[f.key]) : "";
    }
    return map;
  });
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAccentChange = (value: string) => {
    setAccent(value);
    applyAccent(value);
    try {
      if (value) {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(ACCENT_STORAGE_KEY);
      }
    } catch {
      /* 저장 실패 시 이 세션만 적용 */
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);
    const payload: OperationalSettings = {};
    for (const f of FIELDS) {
      const parsed = Number.parseInt(values[f.key], 10);
      if (!Number.isFinite(parsed)) {
        setError(`${f.label} 값이 올바르지 않습니다.`);
        return;
      }
      payload[f.key] = parsed;
    }
    startTransition(async () => {
      const res = await updateSettingsAction(payload);
      if (res.ok) {
        setNotice("운영 기준값을 저장했습니다. 다음 판정 틱부터 적용됩니다.");
        if (res.values) {
          setValues((prev) => {
            const next = { ...prev };
            for (const f of FIELDS) {
              if (res.values![f.key] != null) next[f.key] = String(res.values![f.key]);
            }
            return next;
          });
        }
      } else {
        setError(res.message ?? "저장 실패");
      }
    });
  };

  return (
    <div className="management-page settings-page">
      <section className="management-panel">
        <div className="mgmt-panel-header">
          <div className="mgmt-panel-header-left">
            <span className="mgmt-panel-title">화면 테마</span>
          </div>
        </div>
        <p className="muted settings-help">이 브라우저에만 적용됩니다.</p>
        <div className="settings-theme-row">
          <span>라이트 / 다크</span>
          <ThemeToggle />
        </div>
        <div className="settings-theme-row">
          <span>액센트 색상</span>
          <div className="settings-accent-options" role="radiogroup" aria-label="액센트 색상">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value || "default"}
                type="button"
                role="radio"
                aria-checked={accent === p.value}
                className={`settings-accent-swatch${accent === p.value ? " is-active" : ""}`}
                style={p.value ? { background: p.value } : undefined}
                title={p.label}
                onClick={() => handleAccentChange(p.value)}
              >
                {p.value ? "" : "기본"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="management-panel">
        <div className="mgmt-panel-header">
          <div className="mgmt-panel-header-left">
            <span className="mgmt-panel-title">운영 기준값</span>
          </div>
        </div>
        <p className="muted settings-help">
          서버 전역 설정 — 완료 자동 추정과 시간 배차가 다음 판정부터 사용합니다.
        </p>
        <form className="settings-form" onSubmit={handleSave}>
          {FIELDS.map((f) => (
            <label key={f.key} className="settings-field">
              <span className="settings-field-label">{f.label}</span>
              <input
                type="number"
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                required
              />
              <span className="settings-field-help muted">
                {f.help} ({f.min}~{f.max})
              </span>
            </label>
          ))}
          {error ? <p role="alert" style={{ color: "red" }}>{error}</p> : null}
          {notice ? <p role="status" style={{ color: "#166534" }}>{notice}</p> : null}
          <div>
            <button type="submit" className="button-primary" disabled={isPending}>
              {isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
