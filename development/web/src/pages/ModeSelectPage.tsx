import { MODES, MODE_ORDER, type ModeId } from '../app-modes';
import { modeIcon } from '../components/icons';

const MODE_COPY: Record<ModeId, { blurb: string; accent: string; soft: string }> = {
  delivery: {
    blurb: '주문을 풀에 올리고 배송원이 잡는 방식입니다.',
    accent: 'var(--color-primary)',
    soft: 'var(--color-primary-soft)',
  },
  cleaning: {
    blurb: '서비스 시각을 예약하고 클리너를 배정합니다.',
    accent: 'var(--color-cleaning)',
    soft: 'var(--color-cleaning-soft)',
  },
  maintenance: {
    blurb: '용도와 무관하게 전 차량의 정비를 관리합니다.',
    accent: 'var(--color-success)',
    soft: 'var(--color-success-soft)',
  },
};

/**
 * 진입 모드 선택. 로그인 직후 한 번 보이고, 사이드바 하단 "전환"으로 다시 온다.
 * 카드 개수가 늘어도 잘리지 않도록 고정 높이를 쓰지 않는다.
 */
export function ModeSelectPage({ onSelect }: { onSelect: (mode: ModeId) => void }) {
  return (
    <div className="entry">
      <div className="entry-brand">
        <span className="entry-brand-mark" aria-hidden="true">
          T
        </span>
        <div className="entry-brand-copy">
          <h1>썬더크루</h1>
          <p>전기 이륜차 운영 관제</p>
        </div>
      </div>

      <p className="entry-ask">어느 업무로 들어가시겠습니까?</p>

      <div className="entry-cards">
        {MODE_ORDER.map((id) => {
          const copy = MODE_COPY[id];
          return (
            <button
              key={id}
              className="entry-card"
              type="button"
              onClick={() => onSelect(id)}
              style={
                {
                  '--entry-accent': copy.accent,
                  '--entry-accent-soft': copy.soft,
                } as React.CSSProperties
              }
            >
              <span className="entry-card-icon">{modeIcon(id)}</span>
              <h2>{MODES[id].label}</h2>
              <p>{copy.blurb}</p>
              <span className="entry-card-stat">화면 {MODES[id].menu.length}개 + 전역 3개</span>
            </button>
          );
        })}
      </div>

      <p className="entry-note">
        정비 품목은 (휠 × 엔진) 조합으로 결정되고 용도와 무관합니다. 그래서 정비는 배송·클리닝 안에
        두 벌 만들지 않고 별도 모드로 둡니다.
      </p>
    </div>
  );
}
