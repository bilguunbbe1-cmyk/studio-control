import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent } from "../bus";
import { fmt, fmtM, StatCard, ErrorBanner, EmptyState } from "../components";
import PageHeader from "../components/PageHeader";

export default function Finance() {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [undocumented, setUndocumented] = useState([]);
  const [error, setError] = useState("");
  const { openProject } = usePanels();

  const load = useCallback(async () => {
    try {
      const [s, p, u] = await Promise.all([api.getFinanceSummary(), api.getFinanceProjects(), api.getUndocumentedExpenses()]);
      setSummary(s);
      setProjects(p);
      setUndocumented(u);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onEvent("projects-changed", load), [load]);

  return (
    <div>
      <PageHeader title="Санхүү" subtitle="2026 оны 8-р сар" />
      <ErrorBanner message={error} />

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Гэрээт орлого" value={fmtM(summary.contractedRevenue)} sub="НӨАТ-гүй" accent="var(--teal)" />
          <StatCard label="Орж ирсэн" value={fmtM(summary.received)} sub={`${Math.round((summary.received / summary.contractedRevenue) * 1000) / 10}% collection`} />
          <StatCard label="Авлага" value={fmtM(summary.receivable)} sub={`${fmtM(summary.overdueReceivable)} overdue`} accent="var(--rust)" />
          <StatCard label="Баримтгүй зардал" value={fmtM(summary.undocumentedExpenses)} sub={`${summary.undocumentedGapPct}% gap`} accent="var(--gold)" />
        </div>
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
