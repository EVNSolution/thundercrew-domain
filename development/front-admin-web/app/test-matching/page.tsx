import "@/app/test-matching/test-matching.css";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleSection } from "@/components/test-matching/VehicleSection";
import { RiderSection } from "@/components/test-matching/RiderSection";
import { MatchingSection } from "@/components/test-matching/MatchingSection";
import { loadTestMatchingData } from "@/lib/services/test-matching-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "차량·라이더 등록 테스트" };

export default async function TestMatchingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { vehicles, riders, matchings, notice } = await loadTestMatchingData();
  const error = params.error ?? null;

  return (
    <AppShell>
      <div className="tm-page">
        <h1 className="tm-title">차량·라이더 등록 테스트</h1>
        <p className="tm-subtitle">
          차량 등록 → 라이더 등록 → 차량·라이더 매칭 순서로 입력하세요.
          별도 테스트 DB를 사용하며 완료 후 운영 DB에 통합됩니다.
        </p>

        {notice && <div className="tm-notice">{notice}</div>}
        {error && (
          <div className="tm-error">
            {{
              "vehicle-create": "차량 등록 실패. 차량번호 중복 또는 입력 오류를 확인하세요.",
              "vehicle-delete": "차량 삭제 실패.",
              "rider-create": "라이더 등록 실패. 연락처 중복 또는 입력 오류를 확인하세요.",
              "rider-delete": "라이더 삭제 실패.",
              "matching-create": "매칭 등록 실패. 입력값을 확인하세요.",
              "matching-delete": "매칭 삭제 실패.",
            }[error] ?? "오류가 발생했습니다."}
          </div>
        )}

        <VehicleSection vehicles={vehicles} />
        <RiderSection riders={riders} />
        <MatchingSection matchings={matchings} vehicles={vehicles} riders={riders} />
      </div>
    </AppShell>
  );
}
