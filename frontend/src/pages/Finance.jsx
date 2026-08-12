import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent, emit } from "../bus";
import { fmt, fmtM, StatCard, ErrorBanner, EmptyState, useToast } from "../components";
import PageHeader from "../components/PageHeader";

export default function Finance() {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [undocumented, setUndocumented] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [error, setError] = useState("");
  const toast = useToast();
  const { openProject } = usePanels();

  const load = useCallback(async () => {
    try {
      const [s, p, u, pr] = await Promise.all([
        api.getFinanceSummary(),
        api.getFinanceProjects(),
        api.getUndocumentedExpenses(),
        api.getPaymentRequests("pending"),
      ]);
      setSummary(s);
      setProjects(p);
      setUndocumented(u);
      setPaymentRequests(pr);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onEvent("projects-changed", load), [load]);

  async function pay(id) {
    try {
      await api.payPaymentRequest(id);
      toast("Гүйлгээ шилжлээ");
      load();
      emit("projects-changed");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Санхүү" subtitle="2026 оны 8-р сар" />
      <ErrorBanner message={error} />

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Гэрээт орлого" value={fmtM(summary.contractedRevenue)} sub="НӨАТ-гүй" accent="var(--teal)" />
          <StatCard label="Орж ирсэн" value={fmtM(summary.received)} sub={`${Math.round((summary.received / summary.contractedRevenue) * 1000) / 10}% collection`} />
          <StatCard label="Авлага" value={fmtM(summary.receivable)} sub={`${fmtM(summary.overdueReceivable)} overdue`} accent="var(--rust)" />
          <StatCard label="Баримтгүй зардал" value={fmtM(summary.undocumentedExpenses)} sub={`${summary.undocumentedGapPct}% gap`} accent="var(--amber)" />
        </div>
      )}

      {paymentRequests.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Гүйлгээний хүсэлт</h2>
          <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>{paymentRequests.length} хүсэлт хүлээгдэж байна</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {paymentRequests.map((r) => (
              <div key={r.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{r.purpose}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>
                    {r.projectName} · {r.requestedBy} · {r.recipientName}{r.bank ? ` · ${r.bank}` : ""}{r.accountNumber ? ` ${r.accountNumber}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="plex-mono" style={{ fontWeight: 700 }}>₮{fmt(r.amount)}</span>
                  <button onClick={() => pay(r.id)} style={{ background: "var(--gold)", color: "#ffffff", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, whiteSpace: "nowrap" }}>
                    Илгээсэн ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Төслийн ашиг</h2>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>НӨАТ-гүй тооцоо</div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 16px", color: "var(--muted)", fontSize: 10, borderBottom: "1px solid var(--line)" }}>
          <span>ТӨСӨЛ</span><span>ОРЛОГО</span><span>ЗАРДАЛ</span><span>АШИГ</span><span>MARGIN</span>
        </div>
        {projects.map((p, i) => (
          <button key={p.id} onClick={() => openProject(p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", width: "100%", textAlign: "left", background: "transparent", padding: "12px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none", alignItems: "center" }}>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span className="plex-mono">{fmtM(p.revenue)}</span>
            <span className="plex-mono">{fmtM(p.cost)}</span>
            <span className="plex-mono" style={{ color: "var(--teal)" }}>{fmtM(p.profit)}</span>
            <span className="plex-mono">{p.marginPct}%</span>
          </button>
        ))}
        {projects.length === 0 && <div style={{ padding: 20 }}><EmptyState>Мэдээлэл алга</EmptyState></div>}
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Баримт дутуу</h2>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>Нийт {summary && fmtM(summary.undocumentedExpenses)}</div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {undocumented.map((u, i) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
            <div>
              <div style={{ fontWeight: 500 }}>{u.category}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{u.projectName}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="plex-mono">₮{fmt(u.amount)}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{u.createdAt?.slice(0, 10)}</div>
            </div>
          </div>
        ))}
        {undocumented.length === 0 && <div style={{ padding: 20 }}><EmptyState>Баримт дутуу зардал алга</EmptyState></div>}
      </div>
    </div>
  );
}
