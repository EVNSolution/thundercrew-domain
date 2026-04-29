import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { insurancePolicies } from "@/lib/services/mock-data";
export default function InsurancePage() { return <div className="page-container"><PageHeader title="보험 관리" description="라이더 또는 차량 기준 보험 정보와 만료 예정 상태를 관리합니다." actionHref="/insurance/new" actionLabel="보험 등록" /><div className="table-card"><table className="table"><thead><tr><th>대상</th><th>구분</th><th>보험사</th><th>증권번호</th><th>기간</th><th>상태</th><th>상세</th></tr></thead><tbody>{insurancePolicies.map((p) => <tr key={p.slug}><td>{p.holderLabel}</td><td>{p.targetType}</td><td>{p.provider}</td><td>{p.policyNumber}</td><td>{p.startsAt} ~ {p.endsAt}</td><td><Badge tone={p.status === "정상" ? "active" : "outline"}>{p.status}</Badge></td><td><Link className="button-secondary" href={`/insurance/${p.slug}`}>보기</Link></td></tr>)}</tbody></table></div></div>; }
