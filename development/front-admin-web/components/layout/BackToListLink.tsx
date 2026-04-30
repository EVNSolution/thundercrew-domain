import Link from "next/link";

export function BackToListLink({ href, label = "목록으로" }: { href: string; label?: string }) {
  return (
    <Link aria-label={label} className="page-back-link" href={href}>
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
