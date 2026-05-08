import { updateAdminNcpMapPreferenceAction } from "@/app/settings/actions";
import { Badge } from "@/components/ui/Badge";
import { loadAdminPreferences } from "@/lib/services/admin-preferences-data";

export default async function SettingsPage() {
  const preferences = await loadAdminPreferences();
  const ncpMapEnabled = preferences.data?.ncpMapEnabled ?? true;

  return (
    <div className="page-container">
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
    </div>
  );
}
