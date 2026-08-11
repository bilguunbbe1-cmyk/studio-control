import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { api } from "../api";
import { FieldRow, useToast } from "../components";

export default function NewProjectModal({ open, onClose, onCreated }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: "", client: "", ownerEmployeeId: "", contractAmount: "", dueDate: "" });
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (open) api.getEmployees().then(setEmployees).catch(() => {});
  }, [open]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.contractAmount) return;
    try {
      const created = await api.createProject({
        name: form.name,
        client: form.client,
        ownerEmployeeId: form.ownerEmployeeId || undefined,
        contractAmount: Number(form.contractAmount),
        dueDate: form.dueDate || undefined,
      });
      toast(`${created.name} үүслээ`);
      setForm({ name: "", client: "", ownerEmployeeId: "", contractAmount: "", dueDate: "" });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 80 }}>
      <form onSubmit={submit} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Шинэ төсөл</h3>
          <button type="button" onClick={onClose} style={{ background: "transparent" }}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldRow label="Төслийн нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FieldRow label="Харилцагч" value={form.client} onChange={(v) => setForm({ ...form, client: v })} required={false} />
          <FieldRow
            label="Эзэмшигч"
            value={form.ownerEmployeeId}
            onChange={(v) => setForm({ ...form, ownerEmployeeId: v })}
            options={employees.map((e) => ({ value: String(e.id), label: `${e.name} — ${e.title}` }))}
            required={false}
          />
          <FieldRow label="Гэрээний дүн (₮)" type="number" value={form.contractAmount} onChange={(v) => setForm({ ...form, contractAmount: v })} />
          <FieldRow label="Дуусах огноо" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} required={false} />
        </div>
        {error && <div style={{ color: "var(--rust)", fontSize: 11, marginTop: 10 }}>{error}</div>}
        <button type="submit" style={{ background: "var(--gold)", color: "#12141c", width: "100%", marginTop: 16, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Үүсгэх <ArrowRight size={13} />
        </button>
      </form>
    </div>
  );
}
