import { redirect } from "next/navigation";

import {
  riderApiConfigured,
  riderGetMe,
  riderGetDispatchOrders,
  riderGetVehicle,
  type RiderMe,
  type RiderDispatchOrder,
  type RiderVehicle,
} from "@/lib/services/rider-api";
import { getRiderAccessToken } from "@/lib/services/rider-session";

import { logoutRiderAction } from "./actions";
import RiderMap from "@/components/rider/RiderMap";

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

  let vehicle: RiderVehicle | null = null;
  let orders: RiderDispatchOrder[] = [];

  if (me.activeBikeId) {
    [vehicle, orders] = await Promise.all([
      riderGetVehicle(accessToken),
      riderGetDispatchOrders(accessToken),
    ]);
  }

  const connectionColor =
    vehicle?.connectionStatus === "ONLINE"
      ? "#16a34a"
      : vehicle?.connectionStatus === "OFFLINE"
        ? "#dc2626"
        : "#6b7280";

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      {/* 프로필 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          안녕하세요, {me.name} 님
        </h1>
        <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
          {me.phoneNumber}
          {me.teamName ? <span> · {me.teamName}</span> : null}
          {me.areaName ? <span> · {me.areaName}</span> : null}
        </div>
      </div>

      {me.activeBikeId ? (
        <>
          {/* 주행거리 카드 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
              주행거리
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
              {vehicle?.odometerKm != null ? `${vehicle.odometerKm} km` : "—"}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {vehicle?.plateNumber ? (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {vehicle.plateNumber}
                </span>
              ) : null}
              {vehicle?.connectionStatus ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: connectionColor,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {vehicle.connectionStatus}
                </span>
              ) : null}
            </div>
          </div>

          {/* 차량 위치 지도 */}
          <div style={{ marginBottom: 16 }}>
            <RiderMap vehicle={vehicle} orders={orders} />
          </div>

          {/* 내 업무 목록 */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              내 업무
            </h2>
            {orders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                현재 배정된 업무가 없습니다
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {orders.map((order) => (
                  <li
                    key={order.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "14px 16px",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            order.kind === "PICKUP" ? "#dbeafe" : "#dcfce7",
                          color:
                            order.kind === "PICKUP" ? "#1d4ed8" : "#15803d",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {order.kind === "PICKUP" ? "픽업" : "배달"}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {order.customerName}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                      {order.address}
                    </div>
                    {order.originAddress ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        출발지: {order.originAddress}
                      </div>
                    ) : null}
                    <a
                      href={`tel:${order.customerPhone}`}
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 13,
                        color: "#2563eb",
                        textDecoration: "none",
                      }}
                    >
                      {order.customerPhone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "#9ca3af",
            fontSize: 15,
          }}
        >
          배정된 차량이 없습니다
        </div>
      )}

      <form action={logoutRiderAction} style={{ marginTop: 32 }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#374151",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
