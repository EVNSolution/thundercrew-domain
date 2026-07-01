export interface ManagementNavSection {
  id: string;
  label: string;
}

/** /management 그룹 페이지 상단 sticky 섹션 점프 내비 (앵커 링크). */
export function ManagementSectionNav({ sections }: { sections: ManagementNavSection[] }) {
  return (
    <nav className="management-section-nav" aria-label="관리 섹션 이동">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="management-section-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}
