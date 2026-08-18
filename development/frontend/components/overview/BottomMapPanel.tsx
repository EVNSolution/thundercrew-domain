"use client";

import { useState } from "react";

import { NotificationBell } from "@/components/layout/NotificationBell";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import type { InsuranceOption } from "@/types/insurance-option";
import type {
  FrontendVehicle,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";

type BottomTab = "vehicles";

export interface BottomMapPanelProps {
  /** 패널 열림 상태 — 부모가 제어 (controlled). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // vehicles tab — VehiclesPanel 은 `data: VehicleDataResult` 전체를 받는다
  // (notice 뿐 아니라 source 필드까지 필요).
  vehicleData: VehicleDataResult;
  // 지도 헤더 필터로 이미 필터링된 차량 목록. 테이블은 이 목록만 렌더한다
  // (지도 필터 = 단일 소스). notice/source 는 vehicleData 에서 가져온다.
  visibleVehicles: ReadonlyArray<FrontendVehicle>;
  bikeActiveRiderById: Map<string, string>;
  riderInfoById: Map<string, { name: string; phone: string }>;
  educationTypeByRiderId: Map<string, ServiceOpsRiderEducationType>;
  riderActiveContractById: Map<string, RiderActiveContractSummary>;
  riderActiveInsuranceByRiderId: Map<string, ServiceOpsRiderInsurance>;
  /** riderId → 라이더 보험 자유 텍스트(기본/추가). 차량 패널 보험 컬럼에 사용. */
  riderInsuranceById?: Map<string, { primaryInsurance: string | null; addonInsurance: string | null }>;
  insuranceOptions: ReadonlyArray<InsuranceOption>;
}

/**
 * 전체화면 지도 하단에 고정되는 접이식 패널. 탭(차량/충전소/팁)을 누르면
 * 30vh 높이로 펼쳐지고, 같은 탭을 다시 누르거나 ▼ 버튼을 누르면 접힌다.
 *
 * 차량 탭은 읽기 전용 VehiclesPanel 을 재사용한다.
 * 을 재사용한다. 팁 탭은 Task 8 에서 TipsPanel 이
 * `tipContent` 로 주입되기 전까지 placeholder 만 표시한다.
 */
export function BottomMapPanel(props: BottomMapPanelProps) {
  const { open, onOpenChange } = props;
  const [activeTab, setActiveTab] = useState<BottomTab>("vehicles");

  const handleTabClick = (tab: BottomTab) => {
    if (activeTab === tab && open) {
      onOpenChange(false);
    } else {
      setActiveTab(tab);
      onOpenChange(true);
    }
  };

  return (
    <div className={`bottom-map-panel${open ? " bottom-map-panel--open" : ""}`}>
      <div className="bottom-map-panel-tabbar">
        {(["vehicles"] as BottomTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bottom-map-panel-tab${activeTab === tab && open ? " is-active" : ""}`}
            onClick={() => handleTabClick(tab)}
          >
            차량
          </button>
        ))}
        <div className="bottom-map-panel-bell">
          <NotificationBell />
        </div>
        {open && (
          <button
            type="button"
            className="bottom-map-panel-collapse"
            onClick={() => onOpenChange(false)}
            aria-label="패널 닫기"
          >
            ▼
          </button>
        )}
      </div>
      {open && (
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
                educationTypeByRiderId={props.educationTypeByRiderId}
                riderActiveContractById={props.riderActiveContractById}
                riderActiveInsuranceByRiderId={props.riderActiveInsuranceByRiderId}
                riderInsuranceById={props.riderInsuranceById}
                insuranceOptions={props.insuranceOptions}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
