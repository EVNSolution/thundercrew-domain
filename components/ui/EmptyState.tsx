import Link from "next/link";

export function EmptyState({ title, description, href, actionLabel }: { title: string; description: string; href: string; actionLabel: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">＋</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button-primary" href={href}>{actionLabel}</Link>
    </div>
  );
}
