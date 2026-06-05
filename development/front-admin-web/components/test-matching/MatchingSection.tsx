import {
  createTestMatchingAction,
  deleteTestMatchingAction,
} from "@/app/test-matching/actions";
import type {
  ServiceOpsTestMatching,
  ServiceOpsTestRider,
  ServiceOpsTestVehicle,
} from "@/lib/services/service-ops-api";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  CALL_DELIVERY: "콜배송",
  DESIGNATED_DELIVERY: "지정배송",
  COLLECTION_CARE: "수거케어",
  BATCH_COLLECTION: "일괄수거",
};
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "구독",
  RENTAL: "렌탈",
};
const HANDOVER_TYPE_LABELS: Record<string, string> = {
  TAKEOVER: "인수형",
  RETURN: "반납형",
};

export function MatchingSection({
  matchings,
  vehicles,
  riders,
}: {
  matchings: ServiceOpsTestMatching[];
  vehicles: ServiceOpsTestVehicle[];
  riders: ServiceOpsTestRider[];
}) {
  const invalidCount = matchings.filter((m) => m.validationStatus === "INVALID").length;
  const allValid = matchings.length > 0 && invalidCount === 0;

  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🔗 차량·라이더 매칭</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/matchings"
            className="tm-btn tm-btn-download"
            download="test_matchings.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {matchings.length > 0 && (
        <p className={`tm-matching-summary ${allValid ? "all-valid" : "has-invalid"}`}>
          {allValid
            ? `✅ 전체 ${matchings.length}개 정상`
            : `⚠️ ${matchings.length}개 중 ${invalidCount}개 오류`}
        </p>
      )}

      {matchings.length === 0 ? (
        <p className="tm-empty">등록된 매칭이 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">차량번호</th>
              <th scope="col">서비스유형</th>
              <th scope="col">라이더</th>
              <th scope="col">연락처</th>
              <th scope="col">계약</th>
              <th scope="col">인수방식</th>
              <th scope="col">시작일</th>
              <th scope="col">종료일</th>
              <th scope="col">검증</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {matchings.map((m, i) => {
              const isInvalid = m.validationStatus === "INVALID";
              return (
                <tr key={m.id} className={isInvalid ? "tm-row-invalid" : ""}>
                  <td>{i + 1}</td>
                  <td>{m.plateNumber}</td>
                  <td>{SERVICE_TYPE_LABELS[m.serviceType] ?? m.serviceType}</td>
                  <td>{m.riderName}</td>
                  <td>{m.phoneNumber}</td>
                  <td>{CONTRACT_TYPE_LABELS[m.contractType] ?? m.contractType}</td>
                  <td>{HANDOVER_TYPE_LABELS[m.handoverType] ?? m.handoverType}</td>
                  <td>{m.startDate}</td>
                  <td>{m.endDate}</td>
                  <td>
                    <span className={isInvalid ? "tm-invalid" : "tm-valid"}>
                      {m.validationMessage}
                    </span>
                  </td>
                  <td>
                    <form action={deleteTestMatchingAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="tm-btn tm-btn-danger">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="tm-add-form">
        <p className="tm-add-form-title">매칭 추가</p>
        <form action={createTestMatchingAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="m-vehicle">차량번호 *</label>
              <select id="m-vehicle" name="testVehicleId" required>
                <option value="">선택...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-service">서비스유형 *</label>
              <select id="m-service" name="serviceType" required defaultValue="CALL_DELIVERY">
                <option value="CALL_DELIVERY">콜배송</option>
                <option value="DESIGNATED_DELIVERY">지정배송</option>
                <option value="COLLECTION_CARE">수거케어</option>
                <option value="BATCH_COLLECTION">일괄수거</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-rider">라이더 *</label>
              <select id="m-rider" name="testRiderId" required>
                <option value="">선택...</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phoneNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-contract">계약형태 *</label>
              <select id="m-contract" name="contractType" required defaultValue="SUBSCRIPTION">
                <option value="SUBSCRIPTION">구독</option>
                <option value="RENTAL">렌탈</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-handover">인수방식 *</label>
              <select id="m-handover" name="handoverType" required defaultValue="TAKEOVER">
                <option value="TAKEOVER">인수형</option>
                <option value="RETURN">반납형</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-start">시작일 *</label>
              <input id="m-start" name="startDate" type="date" required />
            </div>
            <div className="tm-form-field">
              <label htmlFor="m-end">종료일 *</label>
              <input id="m-end" name="endDate" type="date" required />
            </div>
            <button type="submit" className="tm-btn tm-btn-primary">
              추가
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
