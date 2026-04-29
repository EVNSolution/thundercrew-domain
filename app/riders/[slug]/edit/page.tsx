import { PageHeader } from "@/components/layout/PageHeader";
import { RiderForm } from "@/components/riders/RiderForm";
export default async function EditRiderPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <div className="page-container"><PageHeader title="라이더 수정" description="소속, 구역, 상태를 선택형 입력 중심으로 수정합니다." /><RiderForm mode="수정" cancelHref={`/riders/${slug}`} /></div>; }
