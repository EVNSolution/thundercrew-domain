import { MapShell } from "@/components/dashboard/MapShell";

export default function MonitoringPage() {
  return (
    <section className="control-map-page" aria-label="지도 기반 관제">
      <MapShell />
    </section>
  );
}
