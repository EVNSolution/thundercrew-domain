import { PageHeader } from "@/components/layout/PageHeader";
import { StationForm } from "@/components/stations/StationForm";
export default function NewStationPage() { return <div className="page-container"><PageHeader title="스테이션 등록" description="스테이션 ID는 DB에서 자동 생성합니다. 운영자는 이름, 주소, 상태와 재고 수량만 입력합니다." /><StationForm /></div>; }
