import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { api } from "../api";
import { usePanels } from "../panels";
import { STAGE_META, STAGE_ORDER, ErrorBanner, EmptyState, useToast } from "../components";
import PageHeader from "../components/PageHeader";

export default function Production({ user }) {
  const [tasks, setTasks] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [error, setError] = useState("");
  const toast = useToast();
  const { openProject } = usePanels();
  const canManage = user.role === "ceo" || user.role === "manager";

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([api.getTasks({}), api.getBlockers()]);
      setTasks(t.filter((x) => x.stage));
      setBlockers(b);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function move(id, stage) {
    try {
      await api.updateTaskStage(id, stage);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resolveBlocker(id) {
    try {
      await api.resolveBlocker(id);
      toast("Blocker шийдэгдлээ");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTask(stage) {
    const title = window.prompt("Ажлын нэр:");
    if (!title) return;
    const projectId = tasks[0]?.projectId;
    if (!projectId) return;
    try {
      await api.createTask({ projectId, title, stage });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const canTouch = (t) => user.role !== "production" || t.assigneeEmployeeId != null;

  return (
    <div>
      <PageHeader title="Продакшн" subtitle="2026 оны 8-р сар" />
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -12, marginBottom: 20 }}>
        Файл хаана, хэн дээр, ямар шатанд байгааг нэг мөрөөр.
      </p>
      <ErrorBanner message={error} />

      {blockers.length > 0 && (
        <div style={{ background: "#c9613f18", border: "1px solid #c9613f55", borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} color="var(--rust)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--rust)" }}>{blockers.length} blocker байна</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{blockers.map((b) => b.description).join(" · ")}</div>
            </div>
          </div>
          {canManage && (
            <button onClick={() => resolveBlocker(blockers[0].id)} style={{ background: "var(--rust)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6 }}>
              Шийдэх →
            </button>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(210px, 1fr))`, gap: 14, overflowX: "auto" }}>
        {STAGE_ORDER.map((stage) => {
          const colTasks = tasks.filter((t) => t.stage === stage);
          return (
            <div key={stage}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, margin: 0 }}>{STAGE_META[stage].label}</h2>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{colTasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
                {colTasks.map((t) => (
                  <div key={t.id} onClick={() => openProject(t.projectId)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, opacity: canTouch(t) ? 1 : 0.55, cursor: "pointer" }}>
                    <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 4 }}>{t.projectClient} / {t.projectName}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 8 }}>
                      Хариуцагч: {t.assignee || "—"}
                      {t.version ? ` · ${t.version}` : t.checklistTotal != null ? ` · Checklist ${t.checklistDone}/${t.checklistTotal}` : t.dueDate ? ` · ${t.dueDate}` : ""}
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                        {STAGE_ORDER.filter((s) => s !== stage).slice(0, 2).map((s) => (
                          <button key={s} onClick={() => move(t.id, s)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 9, padding: "3px 6px", borderRadius: 5 }}>
                            → {STAGE_META[s].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && <EmptyState>Хоосон</EmptyState>}
                {canManage && (
                  <button onClick={() => addTask(stage)} style={{ background: "transparent", border: "1px dashed var(--line)", color: "var(--muted)", fontSize: 11, padding: "8px 0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Plus size={12} /> Нэмэх
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
