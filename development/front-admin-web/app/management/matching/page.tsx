import { createServiceOpsApiClient } from "@/lib/services/service-ops-api";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";

export const dynamic = "force-dynamic";

export default function MatchingManagementPage() {
  const exportUrl = createServiceOpsApiClient().getMatchingExportUrl();
  return <MatchingManagementPanel exportUrl={exportUrl} />;
}
