import { notFound } from "next/navigation";

import { updateStationAction } from "@/app/stations/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { StationForm } from "@/components/stations/StationForm";
import { loadStationDetail } from "@/lib/services/station-data";

const statusMessage: Record<string, string> = {
  "save-error": "스테이션 수정에 실패했습니다. 필수값, 좌표 범위, 백엔드 연결 상태를 확인하세요."
};

export default async function EditStationPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadStationDetail(slug);

  if (!detail) {
    notFound();
  }

  const updateAction = updateStationAction.bind(null, slug);

  return (
    <div className="page-container">
      <PageHeader title="스테이션 수정" description="스테이션 기본 정보만 수정합니다. 재고 수량 변경은 상세 화면의 전용 영역을 사용합니다." />
      <StationForm
        action={updateAction}
        cancelHref={`/stations/${slug}`}
        defaultValues={{
          address: detail.station.address,
          latitude: detail.station.latitude,
          longitude: detail.station.longitude,
          memo: detail.station.memo,
          name: detail.station.name,
          stationStatus: detail.station.stationStatus
        }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
