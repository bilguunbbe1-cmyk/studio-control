import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { api } from "../api";
import { FieldRow, useToast } from "../components";

export default function NewTaskModal({ open, onClose, onCreated }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ projectId: "", title: "", dueDate: "" });
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (open) api.getProjects().then(setProjects).catch(() => {});
  }, [open]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    try {
      const created = await api.createTask({ projectId: Number(form.projectId), title: form.title, dueDate: form.dueDate || undefined, selfAssign: true });
      toast(`${created.title} нэмэгдлээ`);
      setForm({ projectId: "", title: "", dueDate: "" });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 80 }}>
      <form onSubmit={submit} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Ажил нэмэх</h3>
          <button type="button" onClick={onClose} style={{ background: "transparent" }}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldRow
            label="Төсөл"
            value={form.projectId}
            onChange={(v) => setForm({ ...form, projectId: v })}
            options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
          />
          <FieldRow label="Ажлын нэр" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <FieldRow label="Хугацаа" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} required={false} />
        </div>
        {error && <div style={{ color: "var(--rust)", fontSize: 11, marginTop: 10 }}>{error}</div>}
        <button type="submit" style={{ background: "var(--gold)", color: "#ffffff", width: "100%", marginTop: 16, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Нэмэх <ArrowRight size={13} />
        </button>
      </form>
    </div>
  );
}
