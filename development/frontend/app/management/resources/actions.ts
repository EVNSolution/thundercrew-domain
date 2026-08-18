"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  type FrontendRider,
  type ServiceOpsBikeEquipment,
  type ServiceOpsBikeOperationStatusHistory,
  type ServiceOpsRiderBikeContract,
  type ServiceOpsRiderEducationRecord
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * 자원 관리 재편(2단계)의 서버 액션 모음. 행 클릭 상세·단건 등록·매칭 생성 폼이 쓴다.
 *
 * 원칙: 여기의 검증은 화면 편의용이고 최종 심판은 백엔드다 — 용도↔직무↔계약 형태
 * 교차 검증은 RiderBikeContractCommandService 가 400 으로 거부한다.
 */

async function requireClient() {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  return client;
}

// ── 매칭 생성 ────────────────────────────────────────────────────────

export type CreateContractInput = {
  riderId: string;
  bikeId: string;
  startAt: string; // ISO
  /** 배송 계약: 구독/렌탈 + 인수/반납으로 템플릿을 찾는다. */
  category?: "SUBSCRIPTION" | "RENTAL";
  returnType?: "TAKEOVER" | "RETURN";
  /** 클리닝 계약: 직영/협력. 템플릿은 CUSTOM 계열을 자동 사용. */
  engagementType?: "DIRECT" | "PARTNER";
};

export async function createContractAction(input: CreateContractInput): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  try {
    // 템플릿 결정 — 배송은 (category, returnType) 매칭, 클리닝은 CUSTOM 첫 항목.
    // 엑셀 업로드(ContractBulkService)와 같은 규칙이어야 두 경로의 결과가 같다.
    const templates = await client.listContractTemplates({ page: 0, size: 200 });
    const template = input.engagementType
      ? templates.items.find((t) => t.category === "CUSTOM" && t.enabled)
      : templates.items.find(
          (t) => t.enabled && t.category === input.category && t.returnType === input.returnType
        );
    if (!template) {
      return { ok: false, message: "조건에 맞는 계약 템플릿이 없습니다." };
    }
    await client.createRiderBikeContract({
      riderId: input.riderId,
      bikeId: input.bikeId,
      contractTemplateId: template.id,
      startAt: input.startAt,
      engagementType: input.engagementType ?? null
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "계약 생성에 실패했습니다." };
  }
}

// ── 차량 상세 부속 데이터 ───────────────────────────────────────────

/** 차량의 활성 매칭 1건 (없으면 null). 상세의 "매칭 요약" 섹션용. */
export async function getActiveContractForBikeAction(
  bikeId: string
): Promise<ServiceOpsRiderBikeContract | null> {
  const client = await requireClient();
  // bikeId 서버 필터 — 전역 목록 첫 페이지만 훑으면 계약이 쌓였을 때 활성
  // 계약이 페이지 밖으로 밀려 "매칭 없음" 으로 오표시된다.
  const page = await client.listRiderBikeContracts({ page: 0, size: 200, bikeId });
  const now = Date.now();
  return (
    page.items.find(
      (c) => !c.terminatedAt && (!c.endAt || Date.parse(c.endAt) > now)
    ) ?? null
  );
}

/** 차량의 운영상태 변경 이력 (최근 n건). */
export async function listVehicleHistoryAction(
  bikeId: string
): Promise<ServiceOpsBikeOperationStatusHistory[]> {
  const client = await requireClient();
  const page = await client.listVehicleOperationStatusHistories({
    page: 0,
    size: 20,
    sort: "idx,desc",
    bikeId
  });
  return page.items;
}

// ── 함체 (장비 도메인 재사용) ───────────────────────────────────────

const BOX_TYPE_NAME = "함체";

export type BoxStatus = {
  /** 함체 장비 유형이 시드돼 있는가 (V63). 없으면 체크 UI 를 숨긴다. */
  available: boolean;
  /** 현재 부착돼 있으면 그 bike_equipment id, 아니면 null. */
  equipmentId: string | null;
  installedAt: string | null;
};

/**
 * 함체가 부착된 차량 id 집합 — 자원 관리 차량 표의 "함체" 컬럼용 벌크 조회.
 * 상세의 단건 조회(getBoxStatusAction)와 같은 정의(함체 유형 + removedAt null)
 * 라서 두 화면이 항상 같은 상태를 보여준다.
 *
 * null = 조회 실패(미구성 환경 포함) — 호출측은 "빈 목록(전부 미부착)" 과
 * 구분해 컬럼을 "—" 로 표시한다. 목록은 전 페이지를 순회한다 — 전역 첫
 * 페이지(idx 오름차순)만 보면 데이터가 쌓일수록 최신 부착 행을 놓친다.
 */
export async function listBoxAttachedBikeIdsAction(): Promise<string[] | null> {
  // 형제 로더(listVehiclesAction 등)와 같은 미구성 가드 — 이 액션 하나가
  // throw 하면 자원 관리 페이지 전체(Promise.all)가 죽는다.
  if (!serviceOpsApiConfigured()) return null;
  const client = await requireClient();
  try {
    const types = await client.listEquipmentTypes({ page: 0, size: 200 });
    const boxType = types.items.find((t) => t.name === BOX_TYPE_NAME && t.enabled);
    if (!boxType) return [];
    const ids = new Set<string>();
    const PAGE_SIZE = 200;
    const MAX_PAGES = 10;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const equipments = await client.listBikeEquipments({ page, size: PAGE_SIZE });
      for (const e of equipments.items) {
        if (e.equipmentTypeId === boxType.id && !e.removedAt && e.bikeId) ids.add(e.bikeId);
      }
      if (equipments.items.length < PAGE_SIZE) break;
    }
    return [...ids];
  } catch {
    return null;
  }
}

export async function getBoxStatusAction(bikeId: string): Promise<BoxStatus> {
  const client = await requireClient();
  const types = await client.listEquipmentTypes({ page: 0, size: 200 });
  const boxType = types.items.find((t) => t.name === BOX_TYPE_NAME && t.enabled);
  if (!boxType) {
    return { available: false, equipmentId: null, installedAt: null };
  }
  const equipments = await client.listBikeEquipments({ page: 0, size: 200, bikeId });
  const attached = equipments.items.find(
    (e: ServiceOpsBikeEquipment) => e.equipmentTypeId === boxType.id && !e.removedAt
  );
  return {
    available: true,
    equipmentId: attached?.id ?? null,
    installedAt: attached?.installedAt ?? null
  };
}

export async function setBoxAttachedAction(
  bikeId: string,
  attach: boolean,
  currentEquipmentId: string | null
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  try {
    if (attach) {
      const types = await client.listEquipmentTypes({ page: 0, size: 200 });
      const boxType = types.items.find((t) => t.name === BOX_TYPE_NAME && t.enabled);
      if (!boxType) return { ok: false, message: "함체 장비 유형이 없습니다." };
      // 멱등 가드 — 화면 상태가 낡았어도 이미 부착돼 있으면 중복 행을 만들지
      // 않는다.
      const current = await client.listBikeEquipments({ page: 0, size: 200, bikeId });
      if (current.items.some((e) => e.equipmentTypeId === boxType.id && !e.removedAt)) {
        return { ok: true };
      }
      await client.createBikeEquipment({
        bikeId,
        equipmentTypeId: boxType.id,
        equipmentLabel: BOX_TYPE_NAME,
        installedAt: new Date().toISOString(),
        // 함체는 소모 주기 관리 대상이 아니다 — 점검일을 먼 미래로 두어
        // 장비 임박/지연 계산에서 사실상 제외한다.
        managementDueDate: "2099-12-31"
      });
    } else {
      if (!currentEquipmentId) return { ok: false, message: "부착 기록이 없습니다." };
      await client.removeBikeEquipment(currentEquipmentId, {
        removedAt: new Date().toISOString(),
        memo: "자원 관리 함체 체크 해제"
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "함체 상태 변경 실패" };
  }
}

// ── 라이더 상세 부속 ────────────────────────────────────────────────

/**
 * 라이더/클리너 단건 조회 — 지도 차량 상세의 "라이더/클리너" 섹션이 직무·팀·
 * 등급·교육이수를 자원 관리와 같은 소스(riders API)에서 읽는다.
 */
export async function getRiderDetailAction(riderId: string): Promise<FrontendRider | null> {
  const client = await requireClient();
  try {
    return await client.getRider(riderId);
  } catch {
    return null;
  }
}

export async function listEducationRecordsAction(
  riderId: string
): Promise<ServiceOpsRiderEducationRecord[]> {
  const client = await requireClient();
  const page = await client.listRiderEducationRecordsByRider(riderId, { page: 0, size: 50 });
  return page.items;
}

export async function addEducationRecordAction(
  riderId: string,
  educationType: "ONLINE" | "OFFLINE",
  completedAt: string
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  try {
    await client.createRiderEducationRecord({ riderId, educationType, completedAt });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "교육 기록 추가 실패" };
  }
}

export async function deleteEducationRecordAction(
  recordId: string
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  try {
    await client.deleteRiderEducationRecord(recordId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "교육 기록 삭제 실패" };
  }
}

/** 등급 변경 — value 가 null 이면 미판정으로 되돌린다 (clearSkillLevel 플래그). */
export async function setRiderSkillAction(
  riderId: string,
  value: "BEGINNER" | "EXPERT" | null
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  try {
    await client.updateRider(
      riderId,
      value === null ? { clearSkillLevel: true } : { skillLevel: value }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "등급 변경 실패" };
  }
}

// ── 단건 등록 (자원 관리 다이얼로그) ────────────────────────────────
//
// 등록은 client-submit 으로 처리한다 — redirect 기반 form action 은 자원 관리
// 페이지의 props 갱신 흐름(router.refresh)과 어긋나므로 결과 객체를 돌려주고
// 호출측이 refresh 를 트리거한다.

export type ResourceVehicleCreateInput = {
  plateNumber: string;
  purpose?: "DELIVERY" | "CLEANING";
  engineType?: "ELECTRIC" | "ICE" | "LPG";
  modelName?: string | null;
  operationStatus: "READY" | "IN_SERVICE";
  imei?: string | null;
  terminalId?: string | null;
};

export async function createResourceVehicleAction(
  input: ResourceVehicleCreateInput
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  let newVehicleId: string;
  try {
    const bike = await client.createVehicle({
      plateNumber: input.plateNumber,
      vin: null,
      modelName: input.modelName ?? null,
      engineType: input.engineType,
      purpose: input.purpose,
      operationStatus: input.operationStatus,
      imei: input.imei ?? null,
      terminalId: input.terminalId ?? null
    });
    newVehicleId = bike.id ?? bike.slug;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "차량 등록 실패" };
  }

  // IMEI 가 입력된 경우 단말기 연동: 기존 device 재사용 또는 신규 생성 후 부착.
  // 차량 생성은 이미 성공한 상태이므로, 연동 실패는 별도 메시지로 알린다.
  if (input.imei) {
    try {
      let deviceId: string;
      const devicePage = await client.listDevices({ page: 0, size: 200 });
      const existing = devicePage.items.find((row) => row.deviceUid === input.imei);
      if (existing) {
        deviceId = existing.id;
      } else {
        const created = await client.createDevice({ deviceUid: input.imei, enabled: true });
        deviceId = created.id;
      }
      await client.createBikeDeviceInstallation({
        bikeId: newVehicleId,
        deviceId,
        installedAt: new Date().toISOString(),
        memo: "차량 등록 시 IMEI 연동"
      });
    } catch {
      return { ok: true, message: "차량은 등록됐지만 단말기 연동에 실패했습니다. 상세에서 다시 연동하세요." };
    }
  }
  return { ok: true };
}

export type ResourceRiderCreateInput = {
  name: string;
  phoneNumber: string;
  role?: "RIDER" | "CLEANER";
  teamName?: string | null;
  initialEducationType?: "ONLINE" | "OFFLINE" | null;
};

export async function createResourceRiderAction(
  input: ResourceRiderCreateInput
): Promise<{ ok: boolean; message?: string }> {
  const client = await requireClient();
  let riderId: string;
  try {
    const rider = await client.createRider({
      name: input.name,
      phoneNumber: input.phoneNumber,
      role: input.role,
      teamName: input.teamName ?? null
    });
    riderId = rider.id ?? rider.slug;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "라이더/클리너 등록 실패" };
  }

  // 등록 시 교육 여부를 골랐으면 completedAt=now 로 교육 기록을 남긴다 —
  // 목록의 교육이수 컬럼이 바로 켜지도록. 실패해도 등록 자체는 성공.
  if (input.initialEducationType) {
    try {
      await client.createRiderEducationRecord({
        riderId,
        educationType: input.initialEducationType,
        completedAt: new Date().toISOString()
      });
    } catch {
      return { ok: true, message: "라이더/클리너는 등록됐지만 교육 기록 저장에 실패했습니다." };
    }
  }
  return { ok: true };
}
