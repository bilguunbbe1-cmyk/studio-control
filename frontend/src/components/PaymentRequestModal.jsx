import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { api } from "../api";
import { FieldRow, useToast } from "../components";

export default function PaymentRequestModal({ projectId, onClose }) {
  const [form, setForm] = useState({ purpose: "", bank: "", accountNumber: "", recipientName: "", amount: "", hasReceipt: "yes" });
  const [error, setError] = useState("");
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createPaymentRequest({
        projectId,
        purpose: form.purpose,
        bank: form.bank,
        accountNumber: form.accountNumber,
        recipientName: form.recipientName,
        amount: Number(form.amount),
        hasReceipt: form.hasReceipt === "yes",
      });
      toast("Гүйлгээний хүсэлт илгээгдлээ");
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 90 }}>
      <form onSubmit={submit} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Гүйлгээ хүсэх</h3>
          <button type="button" onClick={onClose} style={{ background: "transparent" }}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldRow label="Гүйлгээний утга" value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} />
          <FieldRow label="Банк" value={form.bank} onChange={(v) => setForm({ ...form, bank: v })} required={false} />
          <FieldRow label="Данс" value={form.accountNumber} onChange={(v) => setForm({ ...form, accountNumber: v })} required={false} />
          <FieldRow label="Нэр" value={form.recipientName} onChange={(v) => setForm({ ...form, recipientName: v })} />
          <FieldRow label="Дүн (₮)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
          <FieldRow
            label="Баримт"
            value={form.hasReceipt}
            onChange={(v) => setForm({ ...form, hasReceipt: v })}
            options={[{ value: "yes", label: "Байгаа" }, { value: "no", label: "Байхгүй" }]}
          />
        </div>
        {error && <div style={{ color: "var(--rust)", fontSize: 11, marginTop: 10 }}>{error}</div>}
        <button type="submit" style={{ background: "var(--gold)", color: "#ffffff", width: "100%", marginTop: 16, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Илгээх <ArrowRight size={13} />
        </button>
      </form>
    </div>
  );
}
