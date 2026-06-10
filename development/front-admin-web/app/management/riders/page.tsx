import { createServiceOpsApiClient } from "@/lib/services/service-ops-api";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";

export const dynamic = "force-dynamic";

export default function RidersManagementPage() {
  const exportUrl = createServiceOpsApiClient().getRidersExportUrl();
  return <RidersManagementPanel exportUrl={exportUrl} />;
}
