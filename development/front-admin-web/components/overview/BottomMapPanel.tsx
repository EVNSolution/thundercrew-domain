"use client";

import { useState } from "react";

import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import { StationsPanel } from "@/components/management/StationsPanel";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import type {
  FrontendVehicle,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { StationDataResult } from "@/lib/services/station-data";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";

type BottomTab = "vehicles" | "stations" | "tips";

export interface BottomMapPanelProps {
  // vehicles tab — VehiclesPanel 은 `data: VehicleDataResult` 전체를 받는다
  // (notice 뿐 아니라 source 필드까지 필요).
  vehicleData: VehicleDataResult;
  // 지도 헤더 필터로 이미 필터링된 차량 목록. 테이블은 이 목록만 렌더한다
  // (지도 필터 = 단일 소스). notice/source 는 vehicleData 에서 가져온다.
  visibleVehicles: ReadonlyArray<FrontendVehicle>;
  bikeActiveRiderById: Map<string, string>;
  riderInfoById: Map<string, { name: string; phone: string }>;
  deviceUidByBikeId: Map<string, string>;
  educationTypeByRiderId: Map<string, ServiceOpsRiderEducationType>;
  riderActiveContractById: Map<string, RiderActiveContractSummary>;
  riderActiveInsuranceByRiderId: Map<string, ServiceOpsRiderInsurance>;
  insuranceOptions: ReadonlyArray<InsuranceOption>;
  // stations tab
  stationData: StationDataResult;
  // tips tab — placeholder for Task 8
  tipContent?: React.ReactNode;
}

/**
 * 전체화면 지도 하단에 고정되는 접이식 패널. 탭(차량/충전소/팁)을 누르면
 * 30vh 높이로 펼쳐지고, 같은 탭을 다시 누르거나 ▼ 버튼을 누르면 접힌다.
 *
 * 차량 탭은 읽기 전용 VehiclesPanel 만 재사용하고, 충전소 탭은 StationsPanel
 * 을 재사용한다. 팁 탭은 Task 8 에서 TipsPanel 이
 * `tipContent` 로 주입되기 전까지 placeholder 만 표시한다.
 */
export function BottomMapPanel(props: BottomMapPanelProps) {
  const [activeTab, setActiveTab] = useState<BottomTab>("vehicles");
  const [panelOpen, setPanelOpen] = useState(false);

  const handleTabClick = (tab: BottomTab) => {
    if (activeTab === tab && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveTab(tab);
      setPanelOpen(true);
    }
  };

  return (
    <div className={`bottom-map-panel${panelOpen ? " bottom-map-panel--open" : ""}`}>
      <div className="bottom-map-panel-tabbar">
        {(["vehicles", "stations", "tips"] as BottomTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bottom-map-panel-tab${activeTab === tab && panelOpen ? " is-active" : ""}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab === "vehicles" ? "차량" : tab === "stations" ? "충전소" : "팁"}
          </button>
        ))}
        {panelOpen && (
          <button
            type="button"
            className="bottom-map-panel-collapse"
            onClick={() => setPanelOpen(false)}
            aria-label="패널 닫기"
          >
            ▼
          </button>
        )}
      </div>
      {panelOpen && (
        <div className="bottom-map-panel-content">
          {activeTab === "vehicles" && (
            <>
              {props.vehicleData.notice && (
                <p className="notice" role="status">{props.vehicleData.notice}</p>
              )}
              <VehiclesPanel
                data={{ ...props.vehicleData, vehicles: [...props.visibleVehicles] }}
                bikeActiveRiderById={props.bikeActiveRiderById}
                riderInfoById={props.riderInfoById}
                deviceUidByBikeId={props.deviceUidByBikeId}
                educationTypeByRiderId={props.educationTypeByRiderId}
                riderActiveContractById={props.riderActiveContractById}
                riderActiveInsuranceByRiderId={props.riderActiveInsuranceByRiderId}
                insuranceOptions={props.insuranceOptions}
              />
            </>
          )}
          {activeTab === "stations" && (
            <>
              {props.stationData.notice && (
                <p className="notice" role="status">{props.stationData.notice}</p>
              )}
              <StationsPanel data={props.stationData} />
            </>
          )}
          {activeTab === "tips" && (
            props.tipContent ?? (
              <div className="bottom-map-panel-placeholder">팁 기능 준비 중</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
