import { useEffect, useState, useCallback } from "react";
import { X, Check, Plus } from "lucide-react";
import { api } from "../api";
import { SlideOver, TabBar, Badge, STATUS_META, RECEIPT_META, fmtM, useToast, EmptyState } from "../components";

const TABS = [
  { value: "overview", label: "Тойм" },
  { value: "plan", label: "Төлөвлөгөө" },
  { value: "production", label: "Продакшн" },
  { value: "review", label: "Review" },
  { value: "finance", label: "Санхүү" },
  { value: "files", label: "Файл" },
];

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
  const toast = useToast();
  const canManage = user?.role === "ceo" || user?.role === "manager";

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setProject(await api.getProject(projectId));
    } catch (err) {
      setError(err.message);
    }
  }, [projectId]);

  useEffect(() => {
    setTab("overview");
    setProject(null);
    load();
  }, [projectId, load]);

  if (!projectId) return null;

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
    try {
      await api.addDeliverable(projectId, { title, totalCount: 1 });
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
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">{project.code} · {(project.client || "").toUpperCase()}</div>
            <button onClick={onClose} style={{ background: "transparent" }}><X size={18} color="var(--muted)" /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{project.name}</h2>
            <Badge color={STATUS_META[project.status].color}>{STATUS_META[project.status].label}</Badge>
          </div>

          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          <ErrorLine message={error} />

          {tab === "overview" && (
            <OverviewTab project={project} canManage={canManage} onToggle={toggleChecklist} onRemind={remind} />
          )}
          {tab === "plan" && <PlanTab project={project} canManage={canManage} onAdd={addDeliverable} />}
          {tab === "production" && <ProductionTab project={project} />}
          {tab === "review" && <ReviewTab project={project} />}
          {tab === "finance" && <FinanceTab project={project} canManage={canManage} onReceipt={setReceipt} />}
          {tab === "files" && <FilesTab project={project} canManage={canManage} onUpload={uploadFile} />}
        </>
      )}
    </SlideOver>
  );
}

function ErrorLine({ message }) {
  if (!message) return null;
  return <div style={{ color: "var(--rust)", fontSize: 11, marginBottom: 12 }}>{message}</div>;
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }} className="plex-mono">{value}</div>
    </div>
  );
}

function OverviewTab({ project, canManage, onToggle, onRemind }) {
  const doneCount = project.checklist.filter((c) => c.complete).length;
  const pct = project.checklist.length ? Math.round((doneCount / project.checklist.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Metric label="Явц" value={`${project.progressPct}%`} />
        <Metric label="Үлдсэн ажил" value={project.nextTasks.length} />
        {canManage && <Metric label="Зардал" value={fmtM(project.spent)} />}
        <Metric label="Баримт" value={`${project.documentationPct}%`} />
      </div>

      <SectionHeading title="Төсөл эхлэх checklist" sub={`${project.checklist.length}-аас ${doneCount} бүрдсэн`} extra={`${pct}%`} />
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 12 }}>
        {project.checklist.map((c, i) => (
          <div key={c.id} onClick={() => canManage && onToggle(c)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--line)" : "none", cursor: canManage ? "pointer" : "default", fontSize: 12 }}>
            <span>{c.label}</span>
            <span style={{ color: c.complete ? "var(--teal)" : "var(--rust)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              {c.complete ? <Check size={12} /> : "!"} {c.complete ? "Бүрэн" : "Дутуу"}
            </span>
          </div>
        ))}
      </div>
      {canManage && doneCount < project.checklist.length && (
        <button onClick={onRemind} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "8px 12px", borderRadius: 8, marginBottom: 24 }}>
          Дутуу зүйлсийг сануулах
        </button>
      )}

      <SectionHeading title="Одоо хийх зүйл" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

function PlanTab({ project, canManage, onAdd }) {
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
        {project.deliverables.map((d) => {
          const pct = d.totalCount ? Math.round((d.doneCount / d.totalCount) * 100) : 0;
          return (
            <div key={d.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ fontWeight: 500 }}>{d.title}</span>
                <span style={{ color: "var(--muted)" }} className="plex-mono">{d.doneCount} / {d.totalCount} дууссан {d.doneCount > 0 && `· ${pct}%`}</span>
              </div>
              <div style={{ background: "var(--panel2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, background: "var(--teal)", height: "100%" }} />
              </div>
            </div>
          );
        })}
        {project.deliverables.length === 0 && <EmptyState>Deliverable алга</EmptyState>}
      </div>
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

function ReviewTab({ project }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Edit pipeline</h3>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>{project.reviewItems.length} client feedback</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {project.reviewItems.map((r) => (
          <div key={r.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{r.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">{r.version} · {r.editor || "—"}</div>
            </div>
            <Badge color="var(--teal)">{REVIEW_STATUS_LABEL[r.reviewStatus] || r.reviewStatus}</Badge>
          </div>
        ))}
        {project.reviewItems.length === 0 && <EmptyState>Edit pipeline хоосон</EmptyState>}
      </div>
    </div>
  );
}

function FinanceTab({ project, canManage, onReceipt }) {
  if (!canManage) return <EmptyState>Санхүүгийн мэдээлэл боломжгүй.</EmptyState>;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Metric label="Гэрээний дүн" value={fmtM(project.contractAmount)} />
        <Metric label="Нийт зардал" value={fmtM(project.spent)} />
        <Metric label="Gross profit" value={fmtM(project.grossProfit)} />
        <Metric label="Margin" value={`${project.marginPct}%`} />
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Зардлын хяналт</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {project.costItems.map((c) => {
          const meta = RECEIPT_META[c.receiptStatus];
          return (
            <div key={c.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{c.category}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">₮{new Intl.NumberFormat("mn-MN").format(c.amount)}</div>
              </div>
              <select
                value={c.receiptStatus}
                onChange={(e) => onReceipt(c.id, e.target.value)}
                style={{ background: `${meta.color}22`, color: meta.color, border: "none", fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}
              >
                {Object.entries(RECEIPT_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          );
        })}
        {project.costItems.length === 0 && <EmptyState>Зардлын мөр алга</EmptyState>}
      </div>
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
