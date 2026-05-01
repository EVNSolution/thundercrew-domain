import { ControlMap } from "@/components/dashboard/ControlMap";
import { loadDashboardMapData } from "@/lib/services/dashboard-map-data";

export default async function DashboardPage() {
  const data = await loadDashboardMapData();

  return <ControlMap data={data} />;
}
