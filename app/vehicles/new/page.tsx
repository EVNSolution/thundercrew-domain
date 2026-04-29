import { PageHeader } from "@/components/layout/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
export default function NewVehiclePage() { return <div className="page-container"><PageHeader title="차량 등록" description="차량 ID는 DB가 자동 생성합니다. 차량번호, 모델, 상태, 위치와 배정 대상만 입력합니다." /><VehicleForm /></div>; }
