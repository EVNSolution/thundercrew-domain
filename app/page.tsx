import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-container">
      <section className="hero">
        <p className="hero-kicker">전기 이륜차 지도 관제 MVP</p>
        <h1 className="hero-title">운영의 중심은 지도 기반 관제 화면입니다.</h1>
        <p className="hero-description">
          차량·라이더·계약·보험·스테이션 관리는 좌측 사이드바의 운영 관리 하위 메뉴로 이동했습니다.
          첫 화면은 관제 지도를 배경으로 확장할 수 있는 구조를 우선합니다.
        </p>
        <div className="hero-actions">
          <Link className="button-primary" href="/dashboard">지도 관제 열기</Link>
          <Link className="button-secondary" href="/vehicles">운영 관리</Link>
        </div>
      </section>
    </div>
  );
}
