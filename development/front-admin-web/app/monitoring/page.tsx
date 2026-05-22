import { redirect } from "next/navigation";

/**
 * `/monitoring` 은 단일 페이지 통합 이후 폐기되어 루트(`/`) 로 영구
 * 리다이렉트한다. 기존 북마크 / sidebar 링크 / 외부 공유 URL 이 그대로
 * 살아 있도록 라우트는 유지하되 내용은 즉시 이동.
 *
 * 지도 자체는 루트 페이지의 글로벌 "지도 보기" 토글로 이동했다.
 */
export default function MonitoringPage() {
  redirect("/");
}
