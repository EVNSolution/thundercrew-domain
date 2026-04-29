import Link from "next/link";

export function PageHeader({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <section className="page-header">
      <div>
        <p className="hero-kicker">Thundercrew Operations</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionHref && actionLabel ? <Link className="button-primary" href={actionHref}>{actionLabel}</Link> : null}
    </section>
  );
}
