import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent } from "../bus";
import { fmtM, STATUS_META, Badge, ErrorBanner, EmptyState } from "../components";
import PageHeader from "../components/PageHeader";

const FILTERS = [
  { value: "all", label: "Бүгд" },
  { value: "risk", label: "Эрсдэлтэй" },
  { value: "late", label: "Хоцорсон" },
  { value: "ontrack", label: "Хэвийн" },
];

export default function Projects({ user }) {
  const [view, setView] = useState("active");
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { openProject } = usePanels();

  const load = useCallback(async () => {
    try {
      if (view === "finished") {
        setProjects(await api.getProjects({ finished: 1, search: search || undefined }));
      } else {
        setProjects(await api.getProjects({ status: filter === "all" ? undefined : filter, search: search || undefined }));
      }
    } catch (err) {
      setError(err.message);
    }
  }, [filter, search, view]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => onEvent("projects-changed", load), [load]);

  const counts = projects.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {});

  const byYear = {};
  if (view === "finished") {
    projects.forEach((p) => {
      const year = (p.completedAt || "").slice(0, 4) || "Тодорхойгүй";
      (byYear[year] = byYear[year] || []).push(p);
    });
  }
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <PageHeader title="Төслүүд" subtitle="2026 оны 8-р сар" />
      <ErrorBanner message={error} />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Төсөл, харилцагч хайх..."
        style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "10px 14px", fontSize: 13, outline: "none", marginBottom: 14 }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setView("active")}
          style={{ background: view === "active" ? "var(--gold)" : "var(--panel)", border: "1px solid var(--line)", color: view === "active" ? "#ffffff" : "var(--muted)", fontSize: 11, fontWeight: 600, padding: "7px 14px", borderRadius: 20 }}
        >
          Идэвхтэй
        </button>
        <button
          onClick={() => setView("finished")}
          style={{ background: view === "finished" ? "var(--gold)" : "var(--panel)", border: "1px solid var(--line)", color: view === "finished" ? "#ffffff" : "var(--muted)", fontSize: 11, fontWeight: 600, padding: "7px 14px", borderRadius: 20 }}
        >
          Дууссан
        </button>
      </div>

      {view === "active" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                background: filter === f.value ? "var(--panel2)" : "var(--panel)",
                border: "1px solid var(--line)",
                color: filter === f.value ? "var(--text)" : "var(--muted)",
                fontSize: 11,
                fontWeight: 600,
                padding: "7px 12px",
                borderRadius: 20,
              }}
            >
              {f.label}{f.value !== "all" && counts[f.value] ? ` ${counts[f.value]}` : ""}
            </button>
          ))}
        </div>
      )}

      {view === "active" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} onOpen={() => openProject(p.id)} />
          ))}
          {projects.length === 0 && <EmptyState>Төсөл алга.</EmptyState>}
        </div>
      ) : (
        <div>
          {years.map((year) => (
            <div key={year} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>{year}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {byYear[year].map((p) => (
                  <ProjectCard key={p.id} p={p} onOpen={() => openProject(p.id)} finished />
                ))}
              </div>
            </div>
          ))}
          {years.length === 0 && <EmptyState>Дууссан төсөл алга.</EmptyState>}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ p, onOpen, finished }) {
  const meta = STATUS_META[p.status];
  return (
    <button onClick={onOpen} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: "var(--muted)", fontSize: 10 }} className="plex-mono">{p.code}</span>
        {finished ? <Badge color="var(--teal)">Дууссан</Badge> : <Badge color={meta.color}>{meta.label}</Badge>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 14 }}>{p.client} · {p.lead}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <MiniStat label="Явц" value={`${p.progressPct}%`} />
        {p.spent !== undefined && <MiniStat label="Зардал" value={fmtM(p.spent)} />}
        <MiniStat label="Баримт" value={`${p.documentationPct}%`} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10, fontSize: 11 }}>
        {finished ? (
          <span style={{ color: "var(--muted)" }}>Дууссан: {p.completedAt}</span>
        ) : (
          <>
            <span style={{ color: "var(--rust)" }}>⌁ {p.missingTasksCount} дутуу ажил</span>
            <span style={{ color: "var(--muted)" }}>{p.dueDate} →</span>
          </>
        )}
      </div>
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700 }} className="plex-mono">{value}</div>
    </div>
  );
}
