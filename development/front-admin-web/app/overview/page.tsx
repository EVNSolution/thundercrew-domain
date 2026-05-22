import { redirect } from "next/navigation";

/**
 * `/overview` 는 단일-페이지 통합 이후 폐기되었고, 본문은 루트(`/`) 로
 * 이동했다. 외부 북마크 / 옛 서버 액션 redirect 가 한동안 살아 있을
 * 가능성이 있어 라우트는 유지하되 즉시 루트로 forward.
 *
 * `?tab=` 같은 query string 은 그대로 보존해 운영자가 라이더 탭 북마크를
 * 눌렀을 때 같은 탭이 열린 채로 루트가 뜨도록 한다.
 */
export const dynamic = "force-dynamic";

export default async function OverviewLegacyPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else {
      query.append(key, value);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/?${qs}` : "/");
}
