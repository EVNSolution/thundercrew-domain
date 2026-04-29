import { PageHeader } from "@/components/layout/PageHeader";
import { ContractForm } from "@/components/contracts/ContractForm";
export default function NewContractPage() { return <div className="page-container"><PageHeader title="계약 등록" description="계약 ID는 DB에서 자동 생성합니다. 계약 대상 라이더는 이름/연락처 기준으로 선택합니다." /><ContractForm /></div>; }
