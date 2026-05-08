import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { loadAdminPreferences } from "@/lib/services/admin-preferences-data";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";

export default async function MonitoringPage() {
  const [initial, preferences] = await Promise.all([
    loadDashboardMapState(),
    loadAdminPreferences()
  ]);
  // Default to true so callers without a configured backend keep the
  // production behaviour they had before Slice C-2.
  const ncpMapEnabled = preferences.data?.ncpMapEnabled ?? true;

  return (
    <section className="control-map-page" aria-label="지도 기반 관제">
      <DashboardCanvas initial={initial} ncpMapEnabled={ncpMapEnabled} />
    </section>
  );
}
