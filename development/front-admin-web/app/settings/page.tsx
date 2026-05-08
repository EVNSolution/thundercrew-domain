import { updateAdminNcpMapPreferenceAction } from "@/app/settings/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { loadAdminPreferences } from "@/lib/services/admin-preferences-data";

const statusMessage: Record<string, string> = {
  enabled: "지도 호출이 활성화되었습니다. 모니터링 화면에서 NCP Maps SDK 가 다시 로드됩니다.",
  disabled: "지도 호출이 비활성화되었습니다. 모니터링 화면이 NCP API 를 호출하지 않습니다.",
  "save-error": "어드민 설정 저장에 실패했습니다. 백엔드 연결 상태를 확인하세요."
};

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, preferences] = await Promise.all([
    searchParams,
    loadAdminPreferences()
  ]);
  const ncpMapEnabled = preferences.data?.ncpMapEnabled ?? true;
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        title="설정"
        description="어드민 운영자 본인의 운영 설정을 관리합니다. 계정에 저장되어 다른 브라우저/PC 에서도 동일하게 적용됩니다."
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {preferences.notice ? <p className="notice">{preferences.notice}</p> : null}

      <section className="card" aria-labelledby="settings-ncp-map-heading">
        <header className="card-header">
          <h2 id="settings-ncp-map-heading">지도 호출 (NCP Maps)</h2>
          <Badge tone={ncpMapEnabled ? "active" : "muted"}>
            {ncpMapEnabled ? "ON" : "OFF"}
          </Badge>
        </header>
        <p className="muted">
          모니터링 화면에서 NCP Maps SDK 호출 여부를 본인 계정 단위로 제어합니다.
          OFF 일 때는 SDK 자체가 로드되지 않아 NCP 빌링이 발생하지 않으며, 다른 어드민의 화면에는 영향이 없습니다.
        </p>
        <form action={updateAdminNcpMapPreferenceAction} className="settings-toggle-form">
          <input type="hidden" name="nextValue" value={ncpMapEnabled ? "false" : "true"} />
          <div className="form-actions">
            <button className="button-primary" type="submit">
              {ncpMapEnabled ? "지도 호출 OFF 로 전환" : "지도 호출 ON 으로 전환"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>환경변수</h2>
        <div className="detail-list">
          <div className="detail-row"><span>SERVICE_OPS_API_BASE_URL</span><strong>프론트 서버 액션용</strong></div>
          <div className="detail-row"><span>NEXT_PUBLIC_NCP_MAP_CLIENT_ID</span><strong>NCP Maps API 키 ID</strong></div>
          <div className="detail-row"><span>NEXT_PUBLIC_NCP_MAP_STYLE_ID_LIGHT / DARK</span><strong>NCP Maps style id</strong></div>
        </div>
        <p className="notice">
          secret 은 코드나 공개 문서에 저장하지 않습니다. <code>.env.local</code> 또는 배포 환경변수로만 다룹니다.
          서비스 API 토큰은 HTTP-only 쿠키에만 저장합니다.
        </p>
      </section>
    </div>
  );
}
