import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/services/mock-data";
export default function ContractsPage() { return <div className="page-container"><PageHeader title="계약 관리" description="라이더 계약 목록, 등록, 상세와 계약 상태를 관리합니다." actionHref="/contracts/new" actionLabel="계약 등록" /><div className="table-card"><table className="table"><thead><tr><th>라이더</th><th>계약 유형</th><th>시작일</th><th>종료일</th><th>상태</th><th>구역</th><th>상세</th></tr></thead><tbody>{contracts.map((c) => <tr key={c.slug}><td>{c.riderName}</td><td>{c.contractType}</td><td>{c.startsAt}</td><td>{c.endsAt}</td><td><Badge tone={c.status === "활성" ? "active" : c.status === "초안" ? "muted" : "outline"}>{c.status}</Badge></td><td>{c.area}</td><td><Link className="button-secondary" href={`/contracts/${c.slug}`}>보기</Link></td></tr>)}</tbody></table></div></div>; }
