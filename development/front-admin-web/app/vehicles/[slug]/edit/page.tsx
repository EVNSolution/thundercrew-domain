import { PageHeader } from "@/components/layout/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
export default async function EditVehiclePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <div className="page-container"><PageHeader title="차량 수정" description="상태와 라이더 배정을 선택형 입력으로 수정합니다." /><VehicleForm mode="수정" cancelHref={`/vehicles/${slug}`} /></div>; }
