import { useEffect, useState, useCallback } from "react";
import { Check, X, AlertTriangle, Wallet, Receipt, PlusCircle } from "lucide-react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent } from "../bus";
import { fmt, fmtM, STATUS_META, BADGE_TINTS, Gauge, StatCard, ErrorBanner, EmptyState, useToast } from "../components";
import PageHeader from "../components/PageHeader";
import Production from "./Production";

const DECISION_META = {
  budget: { icon: Wallet, color: "var(--gold)", label: "Төсөв батлах" },
  flag: { icon: AlertTriangle, color: "var(--rust)", label: "Дүрэм зөрчиж эхлүүлэх" },
  expense: { icon: Receipt, color: "var(--teal)", label: "Зардал батлах" },
  scope: { icon: PlusCircle, color: "var(--gold)", label: "Scope change" },
};

export default function Overview({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { openProject } = usePanels();

  const load = useCallback(async () => {
    try {
      setData(await api.getOverview());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onEvent("projects-changed", load), [load]);
  useEffect(() => onEvent("employees-changed", load), [load]);

  if (user.role === "production") return <Production user={user} />;

  return (
    <div>
      <PageHeader
        title={user.role === "ceo" ? `Өглөөний мэнд, ${user.name?.split(" ")[0]}` : "Өнөөдрийн төлөвлөгөө"}
        subtitle={
          data
            ? user.role === "ceo"
              ? `Өнөөдөр анхаарах ${data.decisions.length + (data.alert ? 1 : 0)} зүйл байна.`
              : `${data.todayPlan.taskCount} ажил, ${data.todayPlan.approvalCount} approval, ${data.todayPlan.missingDocCount} дутуу баримт`
            : ""
        }
      />
      <ErrorBanner message={error} />
      {!data ? null : user.role === "ceo" ? (
        <CeoOverview data={data} onOpenProject={openProject} onDecided={load} />
      ) : (
        <ManagerOverview data={data} onOpenProject={openProject} onPlanned={load} />
      )}
    </div>
  );
}

function CeoOverview({ data, onOpenProject, onDecided }) {
  const [log, setLog] = useState([]);
  const toast = useToast();

  async function decide(id, kind, action) {
    try {
      if (action === "approved") await api.approveDecision(id);
      else await api.rejectDecision(id);
      setLog((prev) => [{ id, action }, ...prev].slice(0, 3));
      toast(action === "approved" ? "Зөвшөөрлөө" : "Татгалзлаа");
      onDecided();
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <div>
      {data.alert && (
        <div style={{ background: "#fde9eb", border: "1px solid #f6c6cb", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--rust)", marginBottom: 4 }}>{data.alert.title}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>{data.alert.subtitle}</div>
          </div>
          <button onClick={() => onOpenProject(data.alert.projectId)} style={{ background: "var(--rust)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, whiteSpace: "nowrap" }}>
            Төслийг нээх →
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard label="Идэвхтэй төсөл" value={data.stats.activeProjects} sub={`${data.stats.ontrackCount} хэвийн · ${data.stats.riskyCount} эрсдэлтэй`} />
        <StatCard label="Энэ сарын орлого" value={fmtM(data.stats.revenueMonth)} sub={`${fmtM(data.stats.revenueReceived)} орж ирсэн`} accent="var(--teal)" />
        <StatCard label="Үлдэгдэл авлага" value={fmtM(data.stats.receivable)} sub={`${fmtM(data.stats.receivableOverdue)} хугацаа хэтэрсэн`} accent="var(--rust)" />
        <StatCard label="Нийт ашиг" value={fmtM(data.stats.totalProfit)} sub={`${data.stats.marginPct}% margin`} accent="var(--gold)" />
      </div>

      <div className="responsive-2col">
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Төслийн хяналт</h2>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>Эрсдэлтэй төслүүд эхэнд</div>
            </div>
          </div>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 480 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 16px", color: "var(--muted)", fontSize: 10, borderBottom: "1px solid var(--line)" }}>
                  <span>ТӨСӨЛ</span><span>ЯВЦ</span><span>ТӨСӨВ</span><span>ТӨЛӨВ</span>
                </div>
                {data.projectControl.map((p, i) => {
                  const meta = STATUS_META[p.status];
                  return (
                    <button key={p.id} onClick={() => onOpenProject(p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", width: "100%", textAlign: "left", background: "transparent", padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--line)" : "none", alignItems: "center", fontSize: 12 }}>
                      <span>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 11 }}>{p.client} · {p.lead}</div>
                      </span>
                      <span className="plex-mono">{p.progressPct}%</span>
                      <span className="plex-mono">{p.budgetSpentPct}% зарцуулсан</span>
                      <span><span style={{ background: BADGE_TINTS[meta.color] || "var(--panel2)", color: meta.color, fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}>{meta.label}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Танаас шийдвэр хүлээж байна</h2>
            <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>{data.decisions.length} хүсэлт</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.decisions.length === 0 && <EmptyState>Хүлээгдэж буй хүсэлт алга</EmptyState>}
              {data.decisions.map((d) => {
                const meta = DECISION_META[d.kind] || DECISION_META.expense;
                const Icon = meta.icon;
                return (
                  <div key={d.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Icon size={14} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{meta.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{d.title}</div>
                        {d.amount != null ? (
                          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }} className="plex-mono">₮{fmt(d.amount)}</div>
                        ) : d.reason ? (
                          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{d.reason}</div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => decide(d.id, d.kind, "approved")} style={{ background: BADGE_TINTS["var(--teal)"], color: "var(--teal)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "6px 0", borderRadius: 6 }}>
                        <Check size={12} /> Зөвшөөрөх
                      </button>
                      <button onClick={() => decide(d.id, d.kind, "rejected")} style={{ background: BADGE_TINTS["var(--rust)"], color: "var(--rust)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "6px 0", borderRadius: 6 }}>
                        <X size={12} /> Татгалзах
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Ашигт ажиллагаа</h2>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <LineStat label="Орлого" value={fmtM(data.profitability.revenue)} />
              <LineStat label="Шууд зардал" value={fmtM(data.profitability.directCosts)} />
              <LineStat label="Тогтмол зардал" value={fmtM(data.profitability.fixedCosts)} />
              <LineStat label="Цэвэр ашиг" value={fmtM(data.profitability.netProfit)} sub={`${data.profitability.marginPct}%`} accent />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Баримтын бүрдүүлэлт</h2>
            <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Нийт зардал {fmtM(data.documentation.totalCost)}</div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Gauge pct={data.documentation.pct} color="var(--teal)" />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }} className="plex-mono">{data.documentation.pct}%</div>
              </div>
              <div style={{ fontSize: 11 }}>
                <div style={{ color: "var(--muted)" }}>баримттай</div>
                <div className="plex-mono">{fmtM(data.documentation.documented)} баримттай</div>
                <div className="plex-mono" style={{ color: "var(--rust)" }}>{fmtM(data.documentation.undocumented)} баримтгүй</div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Ойрын хугацаа</h2>
            <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Дараагийн 7 хоног</div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12 }}>
              {data.deadlines.map((d, i) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                  <div style={{ background: "var(--panel2)", borderRadius: 6, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }} className="plex-mono">{d.dueDate?.slice(8, 10)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{d.project} · {d.person}</div>
                  </div>
                </div>
              ))}
              {data.deadlines.length === 0 && <EmptyState>Хугацаа алга</EmptyState>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LineStat({ label, value, sub, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent ? "var(--teal)" : "var(--text)" }} className="plex-mono">
        {value}{sub && <span style={{ color: "var(--gold)", marginLeft: 6 }}>{sub}</span>}
      </span>
    </div>
  );
}

function ManagerOverview({ data, onOpenProject, onPlanned }) {
  return (
    <div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>ӨНӨӨДРИЙН ТӨЛӨВЛӨГӨӨ</div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>{data.todayPlan.priorityText}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard label="Миний төсөл" value={data.stats.myProjectsCount} sub={`${data.stats.myProjectsLateCount} хоцорсон`} />
        <StatCard label="Өнөөдөр дуусах" value={data.stats.dueTodayCount} sub={`${data.stats.dueTodayUrgentCount} яаралтай`} accent="var(--rust)" />
        <StatCard label="Client approval" value={data.stats.clientApprovalCount} sub={`${data.stats.clientApprovalOldCount} нь 2+ өдөр`} />
        <StatCard label="Төсвийн эрсдэл" value={`${data.stats.budgetRiskPct}%`} sub="зарцуулсан" accent="var(--amber)" />
      </div>

      <div className="responsive-2col">
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Миний төслүүд</h2>
          <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Next action-аар эрэмбэлсэн</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.myProjects.map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <button key={p.id} onClick={() => onOpenProject(p.id)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 16, textAlign: "left", width: "100%" }}>
                  <span style={{ background: BADGE_TINTS[meta.color] || "var(--panel2)", color: meta.color, fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, flexShrink: 0 }}>{meta.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{p.nextAction ? `Дараагийн ажил: ${p.nextAction}` : "Дараагийн ажил алга"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }} className="plex-mono">{p.progressPct}%</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{p.dueDate}</div>
                  </div>
                </button>
              );
            })}
            {data.myProjects.length === 0 && <EmptyState>Танд оноогдсон төсөл алга</EmptyState>}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Төсөл эхлэхээс өмнө</h2>
          {data.checklist ? (
            <>
              <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 8 }}>{data.checklist.projectName}</div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12 }}>
                {data.checklist.items.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--line)" : "none", fontSize: 12 }}>
                    <span>{c.label}</span>
                    <span style={{ color: c.complete ? "var(--teal)" : "var(--rust)", fontWeight: 600 }}>{c.complete ? "Бүрэн" : "Дутуу"}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState>Checklist алга</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
