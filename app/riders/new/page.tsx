import { PageHeader } from "@/components/layout/PageHeader";
import { RiderForm } from "@/components/riders/RiderForm";
export default function NewRiderPage() { return <div className="page-container"><PageHeader title="라이더 등록" description="라이더 ID는 DB에서 자동 생성합니다. 사용자는 이름, 연락처, 소속과 담당 구역만 입력합니다." /><RiderForm /></div>; }
