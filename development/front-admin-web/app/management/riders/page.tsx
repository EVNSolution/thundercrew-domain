import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";

export const dynamic = "force-dynamic";

export default function RidersManagementPage() {
  return <RidersManagementPanel exportUrl="/api/management/riders/export" />;
}
