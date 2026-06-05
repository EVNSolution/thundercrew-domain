import {
  createTestVehicleAction,
  deleteTestVehicleAction,
} from "@/app/test-matching/actions";
import type { ServiceOpsTestVehicle } from "@/lib/services/service-ops-api";

const BIKE_TYPE_LABELS: Record<string, string> = {
  TWO_WHEEL: "2륜",
  FOUR_WHEEL: "4륜",
};
const ENGINE_TYPE_LABELS: Record<string, string> = {
  ELECTRIC: "전기",
  ICE: "내연",
};

export function VehicleSection({
  vehicles,
}: {
  vehicles: ServiceOpsTestVehicle[];
}) {
  return (
    <section className="tm-section">
      <div className="tm-section-header">
        <h2 className="tm-section-title">🚲 차량 등록</h2>
        <div className="tm-section-actions">
          <a
            href="/api/test-matching/export/vehicles"
            className="tm-btn tm-btn-download"
            download="test_vehicles.xlsx"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <p className="tm-empty">등록된 차량이 없습니다.</p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>차량번호</th>
              <th>구분</th>
              <th>엔진</th>
              <th>IMEI</th>
              <th>등록일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={v.id}>
                <td>{i + 1}</td>
                <td>{v.plateNumber}</td>
                <td>{BIKE_TYPE_LABELS[v.bikeType] ?? v.bikeType}</td>
                <td>{ENGINE_TYPE_LABELS[v.engineType] ?? v.engineType}</td>
                <td>{v.imei ?? "—"}</td>
                <td>{v.createdAt.slice(0, 10)}</td>
                <td>
                  <form action={deleteTestVehicleAction}>
                    <input type="hidden" name="id" value={v.id} />
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
        <p className="tm-add-form-title">차량 추가</p>
        <form action={createTestVehicleAction}>
          <div className="tm-form-row">
            <div className="tm-form-field">
              <label htmlFor="v-plate">차량번호 *</label>
              <input id="v-plate" name="plateNumber" required placeholder="12가3456" />
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-bike-type">구분 *</label>
              <select id="v-bike-type" name="bikeType" required defaultValue="TWO_WHEEL">
                <option value="TWO_WHEEL">2륜</option>
                <option value="FOUR_WHEEL">4륜</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-engine">엔진 *</label>
              <select id="v-engine" name="engineType" required defaultValue="ELECTRIC">
                <option value="ELECTRIC">전기</option>
                <option value="ICE">내연</option>
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="v-imei">IMEI (15자리, 선택)</label>
              <input id="v-imei" name="imei" placeholder="123456789012345" maxLength={15} />
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
