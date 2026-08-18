"use client";

import { useState } from "react";

import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsRiderBikeContract
} from "@/lib/services/service-ops-api";

type ResourceTab = "ALL" | "VEHICLES" | "RIDERS" | "MATCHING";

const TABS: { value: ResourceTab; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "VEHICLES", label: "차량" },
  { value: "RIDERS", label: "라이더/클리너" },
  { value: "MATCHING", label: "매칭" }
];

/**
 * 자원 관리 클라이언트 골격 — 지도·업무 관리와 같은 필터 탭(pill) 문법.
 * 앵커 점프 내비 대신 탭이 패널을 거른다: 전체 = 3패널 화면 분할(--fill),
 * 단일 = 해당 패널만 페이지 스크롤.
 */
export function ResourcesClient({
  vehicles,
  riders,
  contracts,
  boxAttachedBikeIds,
  statusMessage
}: {
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
  contracts: ReadonlyArray<ServiceOpsRiderBikeContract>;
  boxAttachedBikeIds: ReadonlyArray<string> | null;
  statusMessage: string | null;
}) {
  const [tab, setTab] = useState<ResourceTab>("ALL");
  const show = (target: Exclude<ResourceTab, "ALL">) => tab === "ALL" || tab === target;

  return (
    <div
      className={`management-page resources-page${tab === "ALL" ? " management-page--fill" : ""}`}
    >
      <div className="operations-header">
        <div className="service-type-tabs" role="tablist" aria-label="자원 필터">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`service-type-tab${tab === t.value ? " is-active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {statusMessage ? (
        <p role="alert" className="mgmt-status-banner">
          {statusMessage}
        </p>
      ) : null}
      {show("VEHICLES") ? (
        <section id="mgmt-vehicles" className="management-anchor">
          <VehiclesManagementPanel
            vehicles={vehicles}
            riders={riders}
            contracts={contracts}
            boxAttachedBikeIds={boxAttachedBikeIds}
            exportUrl="/api/management/vehicles/export"
          />
        </section>
      ) : null}
      {show("RIDERS") ? (
        <section id="mgmt-riders" className="management-anchor">
          <RidersManagementPanel riders={riders} exportUrl="/api/management/riders/export" />
        </section>
      ) : null}
      {show("MATCHING") ? (
        <section id="mgmt-matching" className="management-anchor">
          <MatchingManagementPanel
            contracts={contracts}
            vehicles={vehicles}
            riders={riders}
            exportUrl="/api/management/matching/export"
          />
        </section>
      ) : null}
    </div>
  );
}
