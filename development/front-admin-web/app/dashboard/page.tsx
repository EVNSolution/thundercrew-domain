import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";

export default async function MonitoringPage() {
  const initial = await loadDashboardMapState();

  return (
    <section className="control-map-page" aria-label="지도 기반 관제">
      <DashboardCanvas initial={initial} />
    </section>
  );
}
