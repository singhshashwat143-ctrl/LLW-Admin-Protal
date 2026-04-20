import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function StudentsPage() {
  const { data } = useApi<any>("/api/students", { students: [] });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Students" title="Student management" description="Filter students by product, BDA, and date range, then inspect their profile, order history, webinar attendance, and WhatsApp lifecycle." />
      <SectionCard title="Student List">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Enrolled On</th>
                <th>Source</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="font-mono text-xs">{row.phone}</td>
                  <td>{row.email}</td>
                  <td>{row.enrolled_at ? formatDateTime(row.enrolled_at) : "-"}</td>
                  <td>{row.source}</td>
                  <td>{row.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
