import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { deviceLabel, type DeviceDataResult } from "@/lib/services/device-data-core";
import { loadDeviceData } from "@/lib/services/device-data";
import type { BikeDeviceInstallation } from "@/types/domain";

const statusMessage: Record<string, string> = {
  created: "차량 단말 설치가 등록되었습니다.",
  deleted: "단말이 비활성 삭제 처리되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  removed: "차량 단말 설치가 제거 처리되었습니다.",
  updated: "단말 정보가 수정되었습니다."
};

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadDeviceData()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/devices/new"
        actionLabel="단말 등록"
        description="차량 단말과 바이크 설치 이력을 service-ops API 기준으로 관리합니다. 텔레메트리/current-state는 이 범위에서 제외합니다."
        title="단말 관리"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <section className="content-grid">
        <div>
          <DeviceTable data={data} />
        </div>
        <aside className="detail-panel">
          <h2>차량 단말 설치</h2>
          <p>차량번호와 단말 UID 기준 선택으로 설치/교체합니다. raw DB ID나 FK 값을 직접 입력하지 않습니다.</p>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <Link className="button-primary" href="/devices/installations/new">차량 단말 설치</Link>
          </div>
          <div className="detail-list" style={{ marginTop: 16 }}>
            {data.installations.map((installation) => (
              <div className="detail-row" key={installation.slug}>
                <span>{installation.bikeLabel}</span>
                <Link className="button-secondary" href={`/devices/installations/${installation.slug}`}>{installation.status}</Link>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function DeviceTable({ data }: { data: DeviceDataResult }) {
  if (!data.devices.length) {
    return (
      <EmptyState
        actionLabel="단말 등록"
        description="아직 등록된 단말이 없습니다. 단말 자체 UID부터 등록합니다."
        href="/devices/new"
        title="단말 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>단말 UID</th>
            <th>제조사/모델</th>
            <th>상태</th>
            <th>메모</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.devices.map((device) => (
            <tr key={device.slug}>
              <td>{device.deviceUid}</td>
              <td>{deviceLabel(device)}</td>
              <td><Badge tone={device.enabled ? "active" : "muted"}>{device.enabled ? "사용" : "비활성"}</Badge></td>
              <td>{device.memo ?? "-"}</td>
              <td><Link className="button-secondary" href={`/devices/${device.slug}`}>보기</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function installationTone(installation: BikeDeviceInstallation): "active" | "muted" | "outline" {
  return installation.status === "설치 중" ? "active" : "muted";
}
