import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { api } from "../api";
import { usePanels } from "../panels";
import { STAGE_META, STAGE_ORDER, ErrorBanner, EmptyState, useToast, ConfirmDialog, FormModal } from "../components";
import PageHeader from "../components/PageHeader";
import NewKanbanTaskModal from "../components/NewKanbanTaskModal";

const STAGE_OPTIONS = STAGE_ORDER.map((s) => ({ value: s, label: STAGE_META[s].label }));

export default function Production({ user }) {
  const [tasks, setTasks] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [newTaskStage, setNewTaskStage] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
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
    api.getEmployees().then(setEmployees).catch(() => {});
  }, [load]);

  function openMoveModal(t) {
    const idx = STAGE_ORDER.indexOf(t.stage);
    const nextStage = STAGE_ORDER[idx + 1] || t.stage;
    setMoveModal({
      taskId: t.id,
      fields: [
        { key: "stage", label: "Шат", options: STAGE_OPTIONS, defaultValue: nextStage },
        {
          key: "assigneeEmployeeId",
          label: "Хариуцагч (шилжүүлэх бол сонгоно уу)",
          options: employees.map((e) => ({ value: String(e.id), label: e.name })),
          defaultValue: t.assigneeEmployeeId ? String(t.assigneeEmployeeId) : "",
          required: false,
        },
      ],
      submitLabel: "Шилжүүлэх",
      onSubmit: async (v) => {
        setMoveModal(null);
        try {
          await api.updateTaskStage(t.id, {
            stage: v.stage,
            assigneeEmployeeId: v.assigneeEmployeeId ? Number(v.assigneeEmployeeId) : null,
          });
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function removeTask(id, title) {
    setConfirmState({
      message: `"${title}"-г устгах уу?`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteTask(id);
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
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

  const canTouch = (t) => user.role !== "production" || t.assigneeEmployeeId === user.employeeId;

  return (
    <div>
      <PageHeader title="Продакшн" subtitle="2026 оны 8-р сар" />
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -12, marginBottom: 20 }}>
        Файл хаана, хэн дээр, ямар шатанд байгааг нэг мөрөөр.
      </p>
      <ErrorBanner message={error} />

      {blockers.length > 0 && (
        <div style={{ background: "#fde9eb", border: "1px solid #f6c6cb", borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                  <div key={t.id} onClick={() => openProject(t.projectId)} style={{ position: "relative", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, opacity: canTouch(t) ? 1 : 0.55, cursor: "pointer" }}>
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTask(t.id, t.title); }}
                        style={{ position: "absolute", top: 6, right: 6, background: "transparent", color: "var(--muted)", padding: 2 }}
                        title="Устгах"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 4, paddingRight: 14 }}>{t.projectClient} / {t.projectName}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 8 }}>
                      Хариуцагч: {t.assignee || "—"}
                      {t.version ? ` · ${t.version}` : t.checklistTotal != null ? ` · Checklist ${t.checklistDone}/${t.checklistTotal}` : t.dueDate ? ` · ${t.dueDate}` : ""}
                    </div>
                    {(canManage || canTouch(t)) && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openMoveModal(t)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6 }}>
                          Шилжүүлэх →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && <EmptyState>Хоосон</EmptyState>}
                <button onClick={() => setNewTaskStage(stage)} style={{ background: "transparent", border: "1px dashed var(--line)", color: "var(--muted)", fontSize: 11, padding: "8px 0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Plus size={12} /> Нэмэх
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {newTaskStage && (
        <NewKanbanTaskModal
          stage={newTaskStage}
          canPickAssignee={canManage}
          onClose={() => setNewTaskStage(null)}
          onCreated={load}
        />
      )}
      {confirmState && (
        <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />
      )}
      {moveModal && (
        <FormModal
          title="Ажлыг шилжүүлэх"
          fields={moveModal.fields}
          submitLabel={moveModal.submitLabel}
          onSubmit={moveModal.onSubmit}
          onCancel={() => setMoveModal(null)}
        />
      )}
    </div>
  );
}
