import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { vehicles } from "@/lib/services/mock-data";

export default function VehiclesPage() {
  return <div className="page-container"><PageHeader title="차량 관리" description="차량 목록, 상태, 배정, 배터리와 위치 구조를 관리합니다." actionHref="/vehicles/new" actionLabel="차량 등록" /><div className="filter-bar"><input className="input" placeholder="차량번호 또는 모델 검색" /><select className="select"><option>전체 상태</option><option>운행 중</option><option>점검 필요</option></select><button className="button-ghost-mint">필터 적용</button></div><div className="table-card"><table className="table"><thead><tr><th>차량번호</th><th>모델</th><th>상태</th><th>배정</th><th>배터리</th><th>위치</th><th>상세</th></tr></thead><tbody>{vehicles.map((v) => <tr key={v.slug}><td>{v.plateNumber}</td><td>{v.model}</td><td><Badge tone={v.status === "운행 중" ? "active" : "outline"}>{v.status}</Badge></td><td>{v.riderName ?? v.assignmentStatus}</td><td>{v.batteryPercent}%</td><td>{v.locationLabel}</td><td><Link className="button-secondary" href={`/vehicles/${v.slug}`}>보기</Link></td></tr>)}</tbody></table></div></div>;
}
