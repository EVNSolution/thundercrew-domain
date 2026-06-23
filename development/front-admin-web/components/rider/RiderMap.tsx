"use client";

import { useEffect, useRef } from "react";
import { loadNcpMapsSdk } from "@/lib/maps/load-ncp-sdk";
import type { RiderDispatchOrder, RiderVehicle } from "@/lib/services/rider-api";

type Props = { vehicle: RiderVehicle | null; orders: RiderDispatchOrder[] };

const SEOUL = { lat: 37.5665, lng: 126.978 };

export default function RiderMap({ vehicle, orders }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadNcpMapsSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        const naver = window.naver;
        if (!naver?.maps) return;

        const hasVehicle =
          vehicle?.currentLatitude != null && vehicle?.currentLongitude != null;
        const center = hasVehicle
          ? { lat: vehicle!.currentLatitude!, lng: vehicle!.currentLongitude! }
          : orders.length > 0
            ? { lat: orders[0].latitude, lng: orders[0].longitude }
            : SEOUL;

        const map = new naver.maps.Map(ref.current, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: 13,
        });

        const bounds = new naver.maps.LatLngBounds(
          new naver.maps.LatLng(center.lat, center.lng),
          new naver.maps.LatLng(center.lat, center.lng),
        );
        let anyPoint = false;

        orders.forEach((o, i) => {
          const pos = new naver.maps.LatLng(o.latitude, o.longitude);
          new naver.maps.Marker({
            position: pos,
            map,
            icon: {
              content: destPinSvg(i + 1),
              anchor: new naver.maps.Point(12, 28),
              size: new naver.maps.Size(24, 30),
            },
          });
          bounds.extend(pos);
          anyPoint = true;
        });

        if (hasVehicle) {
          const pos = new naver.maps.LatLng(
            vehicle!.currentLatitude!,
            vehicle!.currentLongitude!,
          );
          new naver.maps.Marker({
            position: pos,
            map,
            icon: {
              content: bikePinSvg(),
              anchor: new naver.maps.Point(14, 14),
              size: new naver.maps.Size(28, 28),
            },
          });
          bounds.extend(pos);
          anyPoint = true;
        }

        const totalPoints = orders.length + (hasVehicle ? 1 : 0);
        if (anyPoint && totalPoints > 1 && map.fitBounds) {
          map.fitBounds(bounds, 40);
        }
      })
      .catch(() => {
        // SDK load failure — map stays as empty grey box
      });

    return () => {
      cancelled = true;
    };
  }, [vehicle, orders]);

  const empty = (!vehicle || vehicle.currentLatitude == null) && orders.length === 0;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 260,
        borderRadius: 12,
        overflow: "hidden",
        background: "#e5e7eb",
      }}
    >
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {empty ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          표시할 위치가 없습니다
        </div>
      ) : null}
    </div>
  );
}

function destPinSvg(n: number): string {
  return `<div style="display:grid;place-items:center;width:24px;height:30px;color:#fff;font:700 11px sans-serif">
    <svg width="24" height="30" viewBox="0 0 24 30" style="position:absolute"><path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18C24 5.4 18.6 0 12 0z" fill="#2563eb"/></svg>
    <span style="position:relative;top:-3px">${n}</span></div>`;
}

function bikePinSvg(): string {
  return `<div style="width:28px;height:28px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;color:#fff;font:700 12px sans-serif">🛵</div>`;
}
