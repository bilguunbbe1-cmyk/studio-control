import { useEffect, useState, useCallback } from "react";
import { X, Check, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import { emit } from "../bus";
import { SlideOver, TabBar, Badge, FieldRow, STATUS_META, RECEIPT_META, BADGE_TINTS, fmtM, useToast, EmptyState } from "../components";
import PaymentRequestModal from "./PaymentRequestModal";

const FULL_TABS = [
  { value: "overview", label: "Тойм" },
  { value: "plan", label: "Төлөвлөгөө" },
  { value: "production", label: "Продакшн" },
  { value: "review", label: "Review" },
  { value: "finance", label: "Санхүү" },
  { value: "files", label: "Файл" },
];

const PRODUCTION_TABS = [
  { value: "plan", label: "Төлөвлөгөө" },
  { value: "production", label: "Продакшн" },
  { value: "review", label: "Review" },
];

const FULL_TABS_NO_FINANCE = FULL_TABS.filter((t) => t.value !== "finance");

const FILE_CATEGORY_HINT = {
  Commercial: "Brief, үнийн санал",
  Contract: "Гэрээ, хавсралт",
  Plan: "Timeline, content plan",
  Production: "Script, shot list, raw",
  Review: "Versions, feedback",
  Final: "Батлагдсан final",
  Finance: "Invoice, receipt",
};

export default function ProjectDetailPanel({ projectId, user, onClose }) {
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);
  const toast = useToast();
  const isProduction = user?.role === "production";
  const canEdit = user?.role === "ceo" || (user?.role === "manager" && project?.ownerEmployeeId === user?.employeeId);
  const tabs = isProduction ? PRODUCTION_TABS : canEdit ? FULL_TABS : FULL_TABS_NO_FINANCE;

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setProject(await api.getProject(projectId));
    } catch (err) {
      setError(err.message);
    }
  }, [projectId]);

  useEffect(() => {
    setTab(isProduction ? "plan" : "overview");
    setProject(null);
    setMenuOpen(false);
    setEditing(false);
    load();
  }, [projectId, load]);

  if (!projectId) return null;

  async function saveEdit(payload) {
    try {
      await api.updateProject(projectId, payload);
      toast("Хадгалагдлаа");
      setEditing(false);
      load();
      emit("projects-changed");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteProject() {
    if (!window.confirm(`"${project.name}" төслийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    try {
      await api.deleteProject(projectId);
      toast("Төсөл устгагдлаа");
      emit("projects-changed");
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCostItem() {
    const category = window.prompt("Зардлын ангилал:");
    if (!category) return;
    const amount = window.prompt("Дүн (₮):");
    if (!amount || Number.isNaN(Number(amount))) return;
    try {
      await api.addCostItem(projectId, { category, amount: Number(amount), receiptStatus: "pending" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addReviewItem() {
    const title = window.prompt("Гарчиг:");
    if (!title) return;
    try {
      await api.addReviewItem(projectId, { title, version: "v01", reviewStatus: "editing" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function bumpDeliverable(d, delta) {
    const doneCount = Math.max(0, Math.min(d.totalCount, d.doneCount + delta));
    try {
      await api.updateDeliverable(d.id, { doneCount });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function editDeliverable(d) {
    const title = window.prompt("Deliverable нэр:", d.title);
    if (!title) return;
    const totalCount = window.prompt("Нийт тоо:", d.totalCount);
    if (!totalCount || Number.isNaN(Number(totalCount))) return;
    try {
      await api.updateDeliverable(d.id, { title, totalCount: Number(totalCount) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeDeliverable(d) {
    if (!window.confirm(`"${d.title}"-г устгах уу?`)) return;
    try {
      await api.deleteDeliverable(d.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleChecklist(item) {
    try {
      await api.toggleChecklistItem(projectId, item.id, !item.complete);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remind() {
    try {
      const res = await api.remindChecklist(projectId);
      toast(`${res.remindedCount} дутуу зүйлийн сануулга илгээгдлээ`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addDeliverable() {
    const title = window.prompt("Deliverable нэр:");
    if (!title) return;
    const totalCount = window.prompt("Нийт тоо (жишээ нь Reel-ийн ширхэг):", "1");
    if (!totalCount || Number.isNaN(Number(totalCount)) || Number(totalCount) < 1) return;
    try {
      await api.addDeliverable(projectId, { title, totalCount: Number(totalCount) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setReceipt(id, receiptStatus) {
    try {
      await api.setCostReceipt(id, receiptStatus);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadFile(category, file) {
    if (!file) return;
    try {
      await api.uploadProjectFile(projectId, category, file);
      toast(`${file.name} нэмэгдлээ`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <SlideOver open={!!projectId} onClose={onClose}>
      {!project ? (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Ачааллаж байна...</div>
      ) : editing ? (
        <EditProjectForm project={project} onCancel={() => setEditing(false)} onSave={saveEdit} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">{project.code} · {(project.client || "").toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
              {canEdit && (
                <>
                  <button onClick={() => setMenuOpen((v) => !v)} style={{ background: "transparent" }}><MoreHorizontal size={16} color="var(--muted)" /></button>
                  {menuOpen && (
                    <div style={{ position: "absolute", top: 24, right: 24, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", zIndex: 5, minWidth: 140 }}>
                      <button onClick={() => { setMenuOpen(false); setEditing(true); }} style={{ background: "transparent", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={12} /> Засах
                      </button>
                      <button onClick={() => { setMenuOpen(false); deleteProject(); }} style={{ background: "transparent", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--rust)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Trash2 size={12} /> Устгах
                      </button>
                    </div>
                  )}
                </>
              )}
              <button onClick={onClose} style={{ background: "transparent" }}><X size={18} color="var(--muted)" /></button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{project.name}</h2>
            <Badge color={STATUS_META[project.status].color}>{STATUS_META[project.status].label}</Badge>
          </div>

          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          <ErrorLine message={error} />

          {tab === "overview" && (
            <OverviewTab project={project} canEdit={canEdit} onToggle={toggleChecklist} onRemind={remind} onRequestPayment={() => setShowPaymentRequest(true)} />
          )}
          {tab === "plan" && <PlanTab project={project} canManage={canEdit} onAdd={addDeliverable} onBump={bumpDeliverable} onEdit={editDeliverable} onRemove={removeDeliverable} />}
          {tab === "production" && <ProductionTab project={project} />}
          {tab === "review" && <ReviewTab project={project} canManage={canEdit} onAdd={addReviewItem} />}
          {tab === "finance" && <FinanceTab project={project} canEdit={canEdit} onReceipt={setReceipt} onAddCostItem={addCostItem} />}
          {tab === "files" && <FilesTab project={project} canManage={canEdit} onUpload={uploadFile} />}
        </>
      )}
      {showPaymentRequest && <PaymentRequestModal projectId={projectId} onClose={() => setShowPaymentRequest(false)} />}
    </SlideOver>
  );
}

function ErrorLine({ message }) {
  if (!message) return null;
  return <div style={{ color: "var(--rust)", fontSize: 11, marginBottom: 12 }}>{message}</div>;
}

function EditProjectForm({ project, onCancel, onSave }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    name: project.name,
    client: project.client || "",
    contractAmount: project.contractAmount ?? "",
    dueDate: project.dueDate || "",
  });

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Төсөл засах</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FieldRow label="Төслийн нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FieldRow label="Харилцагч" value={form.client} onChange={(v) => setForm({ ...form, client: v })} required={false} />
        <FieldRow
          label="Эзэмшигч"
          value={form.ownerEmployeeId ?? ""}
          onChange={(v) => setForm({ ...form, ownerEmployeeId: v })}
          options={employees.map((e) => ({ value: String(e.id), label: `${e.name} — ${e.title}` }))}
          required={false}
        />
        <FieldRow label="Гэрээний дүн (₮)" type="number" value={form.contractAmount} onChange={(v) => setForm({ ...form, contractAmount: v })} />
        <FieldRow label="Дуусах огноо" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} required={false} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
        <button
          onClick={() =>
            onSave({
              name: form.name,
              client: form.client,
              ownerEmployeeId: form.ownerEmployeeId !== undefined ? form.ownerEmployeeId || null : undefined,
              contractAmount: Number(form.contractAmount),
              dueDate: form.dueDate || null,
            })
          }
          style={{ background: "var(--gold)", color: "#ffffff", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}
        >
          Хадгалах
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }} className="plex-mono">{value}</div>
    </div>
  );
}

function ChecklistGroup({ items, canManage, onToggle }) {
  if (items.length === 0) return null;
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 12 }}>
      {items.map((c, i) => (
        <div key={c.id} onClick={() => canManage && onToggle(c)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--line)" : "none", cursor: canManage ? "pointer" : "default", fontSize: 12 }}>
          <span>{c.label}</span>
          <span style={{ color: c.complete ? "var(--teal)" : "var(--rust)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            {c.complete ? <Check size={12} /> : "!"} {c.complete ? "Бүрэн" : "Дутуу"}
          </span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ project, canEdit, onToggle, onRemind, onRequestPayment }) {
  const doneCount = project.checklist.filter((c) => c.complete).length;
  const pct = project.checklist.length ? Math.round((doneCount / project.checklist.length) * 100) : 0;
  const pending = project.checklist.filter((c) => !c.complete);
  const done = project.checklist.filter((c) => c.complete);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Metric label="Явц" value={`${project.progressPct}%`} />
        <Metric label="Үлдсэн ажил" value={project.nextTasks.length} />
        {project.spent !== undefined && <Metric label="Зардал" value={fmtM(project.spent)} />}
        <Metric label="Баримт" value={`${project.documentationPct}%`} />
      </div>

      <SectionHeading title="Төсөл эхлэх checklist" sub={`${project.checklist.length}-аас ${doneCount} бүрдсэн`} extra={`${pct}%`} />
      <ChecklistGroup items={pending} canManage={canEdit} onToggle={onToggle} />
      {done.length > 0 && (
        <>
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, margin: "12px 0 6px" }}>Дууссан</div>
          <ChecklistGroup items={done} canManage={canEdit} onToggle={onToggle} />
        </>
      )}
      {canEdit && doneCount < project.checklist.length && (
        <button onClick={onRemind} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "8px 12px", borderRadius: 8, marginBottom: 24 }}>
          Дутуу зүйлсийг сануулах
        </button>
      )}

      <SectionHeading title="Одоо хийх зүйл" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {project.nextTasks.map((t) => (
          <div key={t.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{t.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{t.assignee || "—"}{t.dueTime ? ` · ${t.dueDate === today() ? "Өнөөдөр" : t.dueDate} ${t.dueTime}` : t.dueDate ? ` · ${t.dueDate}` : ""}</div>
            </div>
          </div>
        ))}
        {project.nextTasks.length === 0 && <EmptyState>Одоогоор ажил алга</EmptyState>}
      </div>

      <button onClick={onRequestPayment} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, fontWeight: 600, padding: "8px 12px", borderRadius: 8, width: "100%" }}>
        ₮ Гүйлгээ хүсэх
      </button>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function SectionHeading({ title, sub, extra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{title}</h3>
        {sub && <div style={{ color: "var(--muted)", fontSize: 11 }}>{sub}</div>}
      </div>
      {extra && <div style={{ fontSize: 13, fontWeight: 700 }} className="plex-mono">{extra}</div>}
    </div>
  );
}

function DeliverableRow({ d, canManage, onBump, onEdit, onRemove }) {
  const pct = d.totalCount ? Math.round((d.doneCount / d.totalCount) * 100) : 0;
  const done = d.doneCount >= d.totalCount;
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 6, gap: 8 }}>
        <span style={{ fontWeight: 500 }}>{d.title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ color: "var(--muted)" }} className="plex-mono">{d.doneCount} / {d.totalCount} {d.doneCount > 0 && `· ${pct}%`}</span>
          {canManage && (
            <span style={{ display: "flex", gap: 2 }}>
              {!done && (
                <button onClick={() => onBump(d, 1)} title="+1 дуусгах" style={{ background: "var(--panel2)", color: "var(--teal)", width: 20, height: 20, borderRadius: 4, fontSize: 12, lineHeight: "20px" }}>+</button>
              )}
              {d.doneCount > 0 && (
                <button onClick={() => onBump(d, -1)} title="-1 буцаах" style={{ background: "var(--panel2)", color: "var(--muted)", width: 20, height: 20, borderRadius: 4, fontSize: 12, lineHeight: "20px" }}>−</button>
              )}
              <button onClick={() => onEdit(d)} title="Засах" style={{ background: "var(--panel2)", color: "var(--muted)", width: 20, height: 20, borderRadius: 4 }}><Pencil size={10} style={{ margin: "auto" }} /></button>
              <button onClick={() => onRemove(d)} title="Устгах" style={{ background: "var(--panel2)", color: "var(--rust)", width: 20, height: 20, borderRadius: 4 }}><Trash2 size={10} style={{ margin: "auto" }} /></button>
            </span>
          )}
        </span>
      </div>
      <div style={{ background: "var(--panel2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: "var(--teal)", height: "100%" }} />
      </div>
    </div>
  );
}

function PlanTab({ project, canManage, onAdd, onBump, onEdit, onRemove }) {
  const active = project.deliverables.filter((d) => d.doneCount < d.totalCount);
  const done = project.deliverables.filter((d) => d.doneCount >= d.totalCount);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Deliverable төлөвлөгөө</h3>
        {canManage && (
          <button onClick={onAdd} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Deliverable
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((d) => (
          <DeliverableRow key={d.id} d={d} canManage={canManage} onBump={onBump} onEdit={onEdit} onRemove={onRemove} />
        ))}
        {project.deliverables.length === 0 && <EmptyState>Deliverable алга</EmptyState>}
      </div>
      {done.length > 0 && (
        <>
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, margin: "16px 0 8px" }}>Дууссан</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((d) => (
              <DeliverableRow key={d.id} d={d} canManage={canManage} onBump={onBump} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProductionTab({ project }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
        {project.shootDate && <Metric label="Зураг авалт" value={project.shootDate} />}
        {project.callSheetTotal != null && <Metric label="Call sheet" value={`${project.callSheetDone}/${project.callSheetTotal} бүрдсэн`} />}
      </div>

      <SectionHeading title="Checklist" />
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 24 }}>
        {project.checklist.map((c, i) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--line)" : "none", fontSize: 12 }}>
            <span>{c.label}</span>
            <span style={{ color: c.complete ? "var(--teal)" : "var(--rust)", fontWeight: 600 }}>{c.complete ? "Бүрэн" : "Дутуу"}</span>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Raw file handoff</h3>
      <EmptyState>Одоогоор файл шилжүүлээгүй байна.</EmptyState>
    </div>
  );
}

const REVIEW_STATUS_LABEL = { editing: "Edit хийж байна", client_review: "Client review", approved: "Approved" };

function ReviewItemRow({ r }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{r.title}</div>
        <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">{r.version} · {r.editor || "—"}</div>
      </div>
      <Badge color={r.reviewStatus === "approved" ? "var(--teal)" : "var(--amber)"}>{REVIEW_STATUS_LABEL[r.reviewStatus] || r.reviewStatus}</Badge>
    </div>
  );
}

function ReviewTab({ project, canManage, onAdd }) {
  const active = project.reviewItems.filter((r) => r.reviewStatus !== "approved");
  const done = project.reviewItems.filter((r) => r.reviewStatus === "approved");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Edit pipeline</h3>
        {canManage && (
          <button onClick={onAdd} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Review
          </button>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>{project.reviewItems.length} client feedback</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((r) => <ReviewItemRow key={r.id} r={r} />)}
        {project.reviewItems.length === 0 && <EmptyState>Edit pipeline хоосон</EmptyState>}
      </div>
      {done.length > 0 && (
        <>
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, margin: "16px 0 8px" }}>Дууссан</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((r) => <ReviewItemRow key={r.id} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}

function CostItemRow({ c, canEdit, onReceipt }) {
  const meta = RECEIPT_META[c.receiptStatus];
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{c.category}</div>
        <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">₮{new Intl.NumberFormat("mn-MN").format(c.amount)}</div>
      </div>
      {canEdit ? (
        <select
          value={c.receiptStatus}
          onChange={(e) => onReceipt(c.id, e.target.value)}
          style={{ background: BADGE_TINTS[meta.color] || "var(--panel2)", color: meta.color, border: "none", fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}
        >
          {Object.entries(RECEIPT_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      ) : (
        <Badge color={meta.color}>{meta.label}</Badge>
      )}
    </div>
  );
}

function FinanceTab({ project, canEdit, onReceipt, onAddCostItem }) {
  const pending = project.costItems.filter((c) => c.receiptStatus !== "has_receipt");
  const documented = project.costItems.filter((c) => c.receiptStatus === "has_receipt");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Metric label="Гэрээний дүн" value={fmtM(project.contractAmount)} />
        <Metric label="Нийт зардал" value={fmtM(project.spent)} />
        <Metric label="Gross profit" value={fmtM(project.grossProfit)} />
        <Metric label="Margin" value={`${project.marginPct}%`} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Зардлын хяналт</h3>
        {canEdit && (
          <button onClick={onAddCostItem} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Зардал
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pending.map((c) => <CostItemRow key={c.id} c={c} canEdit={canEdit} onReceipt={onReceipt} />)}
        {project.costItems.length === 0 && <EmptyState>Зардлын мөр алга</EmptyState>}
      </div>
      {documented.length > 0 && (
        <>
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, margin: "16px 0 8px" }}>Баримттай</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documented.map((c) => <CostItemRow key={c.id} c={c} canEdit={canEdit} onReceipt={onReceipt} />)}
          </div>
        </>
      )}
    </div>
  );
}

function FilesTab({ project, canManage, onUpload }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {project.fileFolders.map((f) => (
        <label key={f.category} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, cursor: canManage ? "pointer" : "default" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{f.category}</div>
          <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 6 }}>{FILE_CATEGORY_HINT[f.category]}</div>
          <div style={{ fontSize: 11 }} className="plex-mono">
            {f.count} файл{f.missing > 0 && ` · ${f.missing} дутуу`}
          </div>
          {canManage && (
            <input type="file" style={{ display: "none" }} onChange={(e) => onUpload(f.category, e.target.files[0])} />
          )}
        </label>
      ))}
    </div>
  );
}
