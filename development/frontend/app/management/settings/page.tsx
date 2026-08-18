import { SettingsPanel } from "@/components/management/SettingsPanel";
import { getSettingsAction } from "@/app/management/settings/actions";

export const dynamic = "force-dynamic";

/** 설정 (4단계 §6) — 화면 테마(브라우저 로컬) + 운영 기준값(서버 전역). */
export default async function ManagementSettingsPage() {
  const initialValues = await getSettingsAction();
  return <SettingsPanel initialValues={initialValues} />;
}
