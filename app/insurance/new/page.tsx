import { PageHeader } from "@/components/layout/PageHeader";
import { InsuranceForm } from "@/components/insurance/InsuranceForm";
export default function NewInsurancePage() { return <div className="page-container"><PageHeader title="보험 등록" description="보험 ID는 자동 생성합니다. 대상은 라이더 이름/연락처 또는 차량번호로 선택합니다." /><InsuranceForm /></div>; }
