import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";

export const dynamic = "force-dynamic";

export default function MatchingManagementPage() {
  return <MatchingManagementPanel exportUrl="/api/management/matching/export" />;
}
