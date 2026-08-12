import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import { TASK_STATUS_META, ErrorBanner, EmptyState, useToast } from "../components";
import PageHeader from "../components/PageHeader";
import NewTaskModal from "../components/NewTaskModal";

const FILTERS = [
  { value: "all", label: "Бүгд" },
  { value: "not_started", label: "Эхлээгүй" },
  { value: "editing", label: "Edit хийж байна" },
  { value: "internal_review", label: "Дотоод хяналт" },
  { value: "awaiting_client", label: "Харилцагч хүлээж байна" },
  { value: "done", label: "Дууссан" },
];

export default function MyWork({ user }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setTasks(await api.getTasks({ scope: "mine" }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitForReview(id) {
    try {
      const res = await api.submitForReview(id);
      toast(`✓ ${res.message}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const visible = filter === "all"
    ? [...tasks].sort((a, b) => (a.status === "done") - (b.status === "done"))
    : tasks.filter((t) => t.status === filter);

  return (
    <div>
      <PageHeader title="Миний ажил" subtitle="2026 оны 8-р сар" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: -12, marginBottom: 20 }}>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Нэг дор зөвхөн хийх ёстой ажлууд харагдана.
        </p>
        <button onClick={() => setShowNew(true)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, fontWeight: 600, padding: "8px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Plus size={12} /> Ажил нэмэх
        </button>
      </div>
      <ErrorBanner message={error} />

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
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.3fr 1fr", padding: "10px 16px", color: "var(--muted)", fontSize: 10, borderBottom: "1px solid var(--line)" }}>
          <span>АЖИЛ</span><span>ХАРИУЦАГЧ</span><span>ХУГАЦАА</span><span>ТӨЛӨВ</span><span></span>
        </div>
        {visible.map((t, i) => {
          const meta = TASK_STATUS_META[t.status];
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.3fr 1fr", padding: "12px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none", alignItems: "center" }}>
              <span style={{ fontWeight: 500 }}>{t.title}</span>
              <span style={{ color: "var(--muted)" }}>
                <div>{t.projectClient || t.projectName}</div>
              </span>
              <span className="plex-mono">{t.dueTime ? `${t.dueDate} ${t.dueTime}` : t.dueDate || "—"}</span>
              <span style={{ color: meta.color, fontWeight: 600, fontSize: 11 }}>{meta.label}</span>
              <span style={{ textAlign: "right" }}>
                {t.status !== "internal_review" && t.status !== "done" && (
                  <button onClick={() => submitForReview(t.id)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--teal)", fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 6 }}>
                    Шалгуулах →
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {visible.length === 0 && <div style={{ padding: 20 }}><EmptyState>Ажил алга</EmptyState></div>}
      </div>

      <NewTaskModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
    </div>
  );
}
