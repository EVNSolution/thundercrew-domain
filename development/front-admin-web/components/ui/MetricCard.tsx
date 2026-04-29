export function MetricCard({ label, value, caption }: { label: string; value: string | number; caption: string }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-change">{caption}</p>
    </article>
  );
}
