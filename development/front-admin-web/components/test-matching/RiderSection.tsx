import {
  createTestRiderAction,
  deleteTestRiderAction,
} from "@/app/test-matching/actions";
import type { ServiceOpsTestRider } from "@/lib/services/service-ops-api";

export function RiderSection({ riders }: { riders: ServiceOpsTestRider[] }) {
  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🧑 라이더 등록</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/riders"
            className="tm-btn tm-btn-download"
            download="test_riders.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {riders.length === 0 ? (
        <p className="tm-empty">등록된 라이더가 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">이름</th>
              <th scope="col">연락처</th>
              <th scope="col">교육이수</th>
              <th scope="col">팀</th>
              <th scope="col">등록일</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.phoneNumber}</td>
                <td>
                  {r.trainingStatus === "ONLINE" ? "🟢 온라인" :
                   r.trainingStatus === "OFFLINE" ? "🟡 오프라인" : "❌ 미완료"}
                </td>
                <td>{r.teamName ?? "—"}</td>
                <td>{r.createdAt.slice(0, 10)}</td>
                <td>
                  <form action={deleteTestRiderAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="tm-btn tm-btn-danger">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="tm-add-form">
        <p className="tm-add-form-title">라이더 추가</p>
        <form action={createTestRiderAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="r-name">이름 *</label>
              <input id="r-name" name="name" required placeholder="홍길동" />
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-phone">연락처 * (010-XXXX-XXXX)</label>
              <input
                id="r-phone"
                name="phoneNumber"
                required
                placeholder="010-1234-5678"
                pattern="010-\d{4}-\d{4}"
              />
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-training">교육이수 *</label>
              <select id="r-training" name="trainingStatus" required defaultValue="ONLINE">
                <option value="ONLINE">온라인</option>
                <option value="OFFLINE">오프라인</option>
                <option value="INCOMPLETE">미완료</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="r-team">팀 (선택)</label>
              <input id="r-team" name="teamName" placeholder="강남팀" />
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
