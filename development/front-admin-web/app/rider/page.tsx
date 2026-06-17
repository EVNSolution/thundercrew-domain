import { redirect } from "next/navigation";

import { riderApiConfigured, riderGetMe, type RiderMe } from "@/lib/services/rider-api";
import { getRiderAccessToken } from "@/lib/services/rider-session";

import { logoutRiderAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RiderHomePage() {
  if (!riderApiConfigured()) {
    return <main style={{ padding: 24 }}>서버가 구성되지 않았습니다.</main>;
  }

  const accessToken = await getRiderAccessToken();
  if (!accessToken) {
    redirect("/rider/login");
  }

  let me: RiderMe;
  try {
    me = await riderGetMe(accessToken);
  } catch {
    redirect("/rider/login");
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>안녕하세요, {me.name} 님</h1>
      <dl style={{ marginTop: 16, lineHeight: 1.8 }}>
        <div>
          <dt style={{ display: "inline", color: "#6b7280" }}>전화번호 </dt>
          <dd style={{ display: "inline", margin: 0 }}>{me.phoneNumber}</dd>
        </div>
        {me.teamName ? (
          <div>
            <dt style={{ display: "inline", color: "#6b7280" }}>팀 </dt>
            <dd style={{ display: "inline", margin: 0 }}>{me.teamName}</dd>
          </div>
        ) : null}
        {me.areaName ? (
          <div>
            <dt style={{ display: "inline", color: "#6b7280" }}>지역 </dt>
            <dd style={{ display: "inline", margin: 0 }}>{me.areaName}</dd>
          </div>
        ) : null}
        <div>
          <dt style={{ display: "inline", color: "#6b7280" }}>배정 차량 </dt>
          <dd style={{ display: "inline", margin: 0 }}>{me.activeBikeId ?? "없음"}</dd>
        </div>
      </dl>
      <form action={logoutRiderAction} style={{ marginTop: 24 }}>
        <button type="submit">로그아웃</button>
      </form>
    </main>
  );
}
