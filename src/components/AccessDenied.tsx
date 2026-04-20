import { PageHeader, SectionCard } from "./UI";
import { navigate } from "../lib/router";

export function AccessDenied({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-grid compact-canvas">
      <PageHeader eyebrow="Restricted" title={title} description={description} />
      <SectionCard title="Need a higher approval level?" subtitle="Use the payments desk to raise requests upward through the reporting chain.">
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Open Payments Board</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/")}>Back to Dashboard</button>
        </div>
      </SectionCard>
    </div>
  );
}
