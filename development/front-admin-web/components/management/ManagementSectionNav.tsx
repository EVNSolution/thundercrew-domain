const SECTIONS: { id: string; label: string }[] = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "라이더" },
  { id: "mgmt-matching", label: "매칭" },
  { id: "mgmt-dispatch", label: "배차" },
  { id: "mgmt-stroller", label: "유모차" },
  { id: "mgmt-baemin", label: "배민 콜" }
];

/** /management 상단 sticky 섹션 점프 내비 (앵커 링크). */
export function ManagementSectionNav() {
  return (
    <nav className="management-section-nav" aria-label="관리 섹션 이동">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="management-section-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}
