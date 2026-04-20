import { useEffect, useMemo, useState } from "react";
import { Badge, PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";

type Instructor = {
  id: string;
  name: string;
  email?: string;
  slug: string;
  market_type: string;
  languages: string[];
  bio?: string;
  photo_url?: string;
  experience_years?: number;
  speciality?: string;
  short_bio?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

const emptyForm = {
  id: "",
  name: "",
  email: "",
  slug: "",
  market_type: "INDIAN",
  languages: "ENGLISH",
  experience_years: 0,
  speciality: "Finance",
  short_bio: "",
  bio: "",
  photo_url: "",
  is_active: true,
};

export function InstructorsPage() {
  const { data, setData } = useApi<{ instructors: Instructor[] }>("/api/instructors", { instructors: [] });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showEditor, setShowEditor] = useState(false);

  const instructors = useMemo(() => {
    return data.instructors.filter((row) => {
      const haystack = `${row.name} ${row.email || ""} ${row.speciality || ""}`.toLowerCase();
      return !query || haystack.includes(query.toLowerCase());
    });
  }, [data.instructors, query]);

  useEffect(() => {
    const selected = data.instructors.find((item) => item.id === selectedId) ?? instructors[0];
    if (!selected) {
      setForm(emptyForm);
      return;
    }

      setSelectedId(selected.id);
      setForm({
      id: selected.id,
      name: selected.name || "",
      email: selected.email || "",
      slug: selected.slug || "",
      market_type: selected.market_type || "INDIAN",
      languages: selected.languages?.join(", ") || "ENGLISH",
      experience_years: Number(selected.experience_years || 0),
      speciality: selected.speciality || "Finance",
      short_bio: selected.short_bio || "",
      bio: selected.bio || "",
      photo_url: selected.photo_url || "",
      is_active: Boolean(selected.is_active ?? true),
    });
    setShowEditor(true);
  }, [data.instructors, instructors, selectedId]);

  async function save() {
    const payload = {
      name: form.name,
      email: form.email,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      market_type: form.market_type,
      languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean),
      experience_years: Number(form.experience_years || 0),
      speciality: form.speciality,
      short_bio: form.short_bio,
      bio: form.bio,
      photo_url: form.photo_url,
      is_active: form.is_active,
    };

    if (form.id) {
      const response = await api<{ instructor: Instructor }>(`/api/instructors/${form.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setData({
        instructors: data.instructors.map((row) => (row.id === form.id ? response.instructor : row)),
      });
      setShowEditor(false);
      return;
    }

    const response = await api<{ instructor: Instructor }>("/api/instructors", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setSelectedId(response.instructor.id);
    setData({ instructors: [response.instructor, ...data.instructors] });
    setShowEditor(false);
  }

  function startCreate() {
    setSelectedId("");
    setForm(emptyForm);
    setShowEditor(true);
  }

  function downloadResponses() {
    const csv = [
      "name,email,market_type,languages,speciality",
      ...data.instructors.map((row) => [
        row.name,
        row.email || "",
        row.market_type,
        row.languages?.join("|") || "",
        row.speciality || "",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "become-instructor-responses.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Teachers"
        title="Teacher management"
        description="Search teachers, inspect their bootcamp-facing metadata, and update or add new profiles from one admin screen."
        actions={
          <>
            <input className="input-dark min-w-[260px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
            <button className="btn-primary" type="button" onClick={startCreate}>Add Teacher</button>
            <button className="btn-secondary" type="button" onClick={downloadResponses}>Download Become Instructor Responses</button>
          </>
        }
      />

      <SectionCard title="Teachers" subtitle="List view inspired by the reference admin panel with search and profile selection.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Market</th>
                  <th>Speciality</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((row, index) => (
                  <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="font-medium text-[var(--text-strong)]">{row.name}</div>
                      <div className="text-sm text-[var(--text-secondary)]">{row.email || row.slug}</div>
                    </td>
                    <td>{row.market_type}</td>
                    <td>{row.speciality || "-"}</td>
                    <td>{row.updated_at ? formatDateTime(row.updated_at) : "-"}</td>
                    <td><Badge tone={row.is_active ? "green" : "red"}>{row.is_active ? "ACTIVE" : "INACTIVE"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </SectionCard>

      {showEditor ? (
        <div className="app-modal-backdrop">
          <div className="app-modal-card">
            <SectionCard title={form.id ? "Update Teacher" : "Add Teacher"} subtitle="Teacher form opens as an in-app card, same pattern as add class.">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input-dark" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="NAME *" />
                  <input className="input-dark" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="EMAIL" />
                </div>
                <textarea className="input-dark min-h-[140px]" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="BIO" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input-dark" type="number" value={form.experience_years} onChange={(event) => setForm({ ...form, experience_years: Number(event.target.value) })} placeholder="EXPERIENCE" />
                  <input className="input-dark" value={form.speciality} onChange={(event) => setForm({ ...form, speciality: event.target.value })} placeholder="CATEGORY" />
                  <select className="input-dark" value={form.market_type} onChange={(event) => setForm({ ...form, market_type: event.target.value })}>
                    <option>INDIAN</option>
                    <option>FOREX</option>
                    <option>BOTH</option>
                  </select>
                  <input className="input-dark" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} placeholder="LANGUAGES comma separated" />
                </div>
                <input className="input-dark" value={form.short_bio} onChange={(event) => setForm({ ...form, short_bio: event.target.value })} placeholder="SHORT BIO" />
                <input className="input-dark" value={form.photo_url} onChange={(event) => setForm({ ...form, photo_url: event.target.value })} placeholder="PHOTO URL" />
                <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                  Active profile
                </label>
                {form.photo_url ? <img src={form.photo_url} alt={form.name} className="h-20 w-20 rounded-full object-cover" /> : null}
                <div className="flex flex-wrap gap-3">
                  <button className="btn-secondary" type="button" onClick={() => setShowEditor(false)}>Cancel</button>
                  <button className="btn-primary" type="button" onClick={save}>{form.id ? "Update Teacher" : "Create Teacher"}</button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
