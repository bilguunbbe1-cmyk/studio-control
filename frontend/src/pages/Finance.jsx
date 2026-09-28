import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent, emit } from "../bus";
import { fmt, fmtM, StatCard, ErrorBanner, EmptyState, FormModal, ConfirmDialog, useToast } from "../components";
import PageHeader from "../components/PageHeader";

const MODES = [
  { key: "all", label: "Бүх хугацаа" },
  { key: "year", label: "Жилээр" },
  { key: "month", label: "Сараар" },
  { key: "custom", label: "Өөрөө сонгох" },
];

const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayIso().slice(0, 7);
const monthLabel = (ym) => `${ym.slice(0, 4)} оны ${Number(ym.slice(5, 7))}-р сар`;

// Turns the filter UI state into { from, to } for the API, or null for all time.
function toRange(f) {
  if (f.mode === "year") return { from: `${f.year}-01-01`, to: `${f.year}-12-31` };
  if (f.mode === "month" && f.month) {
    const [y, m] = f.month.split("-").map(Number);
    return { from: `${f.month}-01`, to: `${f.month}-${pad(new Date(y, m, 0).getDate())}` };
  }
  if (f.mode === "custom" && f.from && f.to && f.from <= f.to) return { from: f.from, to: f.to };
  return null;
}

function periodLabel(f, range) {
  if (!range) return f.mode === "custom" ? "Эхлэх, дуусах огноогоо сонгоно уу" : "Бүх хугацаа";
  if (f.mode === "year") return `${f.year} он`;
  if (f.mode === "month") return monthLabel(f.month);
  return `${range.from} — ${range.to}`;
}

const inputStyle = { background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "6px 8px", fontSize: 12, outline: "none" };
const smallBtn = { background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" };
const iconBtn = { background: "var(--panel2)", width: 20, height: 20, borderRadius: 4 };

function PeriodFilter({ filter, setFilter }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2022; y--) years.push(y);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setFilter({ ...filter, mode: m.key })}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              fontWeight: filter.mode === m.key ? 600 : 400,
              background: filter.mode === m.key ? "var(--gold)" : "var(--panel2)",
              color: filter.mode === m.key ? "#ffffff" : "var(--text)",
              border: "1px solid var(--line)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      {filter.mode === "year" && (
        <select value={filter.year} onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })} style={inputStyle}>
          {years.map((y) => <option key={y} value={y}>{y} он</option>)}
        </select>
      )}
      {filter.mode === "month" && (
        <input type="month" value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} style={inputStyle} />
      )}
      {filter.mode === "custom" && (
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} style={inputStyle} />
          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} style={inputStyle} />
        </span>
      )}
    </div>
  );
}

function SectionTitle({ title, sub, extra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>{title}</h2>
        {sub && <div style={{ color: "var(--muted)", fontSize: 11 }}>{sub}</div>}
      </div>
      {extra}
    </div>
  );
}

function MonthlyTable({ months }) {
  const cols = "1.3fr 1fr 1fr 1fr 1fr 1fr";
  const totals = months.reduce(
    (t, m) => ({ contracted: t.contracted + m.contracted, received: t.received + m.received, costs: t.costs + m.costs, salaries: t.salaries + m.salaries, net: t.net + m.net }),
    { contracted: 0, received: 0, costs: 0, salaries: 0, net: 0 }
  );
  const row = (key, label, m, bold) => (
    <div key={key} style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", fontSize: 12, borderTop: "1px solid var(--line)", fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span>
      <span className="plex-mono">{fmtM(m.contracted)}</span>
      <span className="plex-mono">{fmtM(m.received)}</span>
      <span className="plex-mono">{fmtM(m.costs)}</span>
      <span className="plex-mono">{fmtM(m.salaries)}</span>
      <span className="plex-mono" style={{ color: m.net < 0 ? "var(--rust)" : "var(--teal)" }}>{fmtM(m.net)}</span>
    </div>
  );
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 620 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", color: "var(--muted)", fontSize: 10 }}>
            <span>САР</span><span>ГЭРЭЭТ ОРЛОГО</span><span>ОРЖ ИРСЭН</span><span>ЗАРДАЛ</span><span>ЦАЛИН</span><span>ҮЛДЭГДЭЛ</span>
          </div>
          {months.map((m) => row(m.month, monthLabel(m.month), m))}
          {months.length > 1 && row("total", "Нийт", totals, true)}
        </div>
      </div>
      {months.length === 0 && <div style={{ padding: 20 }}><EmptyState>Мэдээлэл алга</EmptyState></div>}
    </div>
  );
}

export default function Finance({ user }) {
  const isCeo = user?.role === "ceo";
  const [filter, setFilter] = useState({ mode: "all", year: new Date().getFullYear(), month: thisMonth(), from: "", to: "" });
  const range = useMemo(() => (isCeo ? toRange(filter) : null), [isCeo, filter]);
  const waitingForCustom = isCeo && filter.mode === "custom" && !range;

  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [undocumented, setUndocumented] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [salaries, setSalaries] = useState({ payments: [], byEmployee: [] });
  const [employees, setEmployees] = useState([]);
  const [showSalaryList, setShowSalaryList] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast();
  const { openProject } = usePanels();

  const load = useCallback(async () => {
    if (waitingForCustom) return;
    try {
      const r = range || undefined;
      const [s, p, u, pr, mo, sal] = await Promise.all([
        api.getFinanceSummary(r),
        api.getFinanceProjects(r),
        api.getUndocumentedExpenses(r),
        isCeo ? api.getPaymentRequests("pending") : Promise.resolve([]),
        isCeo ? api.getFinanceMonthly(r) : Promise.resolve([]),
        isCeo ? api.getSalaryPayments(r) : Promise.resolve({ payments: [], byEmployee: [] }),
      ]);
      setSummary(s);
      setProjects(p);
      setUndocumented(u);
      setPaymentRequests(pr);
      setMonthly(mo);
      setSalaries(sal);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [isCeo, range, waitingForCustom]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onEvent("projects-changed", load), [load]);

  useEffect(() => {
    if (isCeo) api.getEmployees().then(setEmployees).catch(() => {});
  }, [isCeo]);

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

  function addSalary() {
    setFormModal({
      title: "Цалин бүртгэх",
      fields: [
        { key: "employeeId", label: "Ажилтан", options: employees.map((e) => ({ value: String(e.id), label: `${e.name} — ${e.title}` })) },
        { key: "paidAt", label: "Олгосон огноо", type: "date", defaultValue: todayIso() },
        { key: "amount", label: "Дүн (₮)", type: "number" },
        { key: "note", label: "Тэмдэглэл", required: false },
      ],
      submitLabel: "Бүртгэх",
      onSubmit: async (v) => {
        if (!v.employeeId || !v.paidAt || !Number(v.amount)) return;
        setFormModal(null);
        try {
          await api.addSalaryPayment({ employeeId: Number(v.employeeId), paidAt: v.paidAt, amount: Number(v.amount), note: v.note });
          toast("Цалин бүртгэгдлээ");
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function fillMonth() {
    setFormModal({
      title: "Сарын цалин үүсгэх",
      fields: [{ key: "month", label: "Сар (үндсэн цалингаар 5, 20-нд хагасаар)", type: "month", defaultValue: filter.mode === "month" ? filter.month : thisMonth() }],
      submitLabel: "Үүсгэх",
      onSubmit: async (v) => {
        if (!v.month) return;
        setFormModal(null);
        try {
          const r = await api.fillSalaryMonth(v.month);
          if (r.employeesWithSalary === 0) toast("Үндсэн цалин тохируулсан ажилтан алга");
          else toast(`${r.created} бичлэг үүслээ${r.skipped.length ? ` · ${r.skipped.length} ажилтан аль хэдийн бүртгэлтэй` : ""}`);
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function editSalary(p) {
    setFormModal({
      title: `Цалин засах — ${p.employeeName}`,
      fields: [
        { key: "paidAt", label: "Олгосон огноо", type: "date", defaultValue: p.paidAt },
        { key: "amount", label: "Дүн (₮)", type: "number", defaultValue: p.amount },
        { key: "note", label: "Тэмдэглэл", required: false, defaultValue: p.note || "" },
      ],
      onSubmit: async (v) => {
        if (!v.paidAt || !Number(v.amount)) return;
        setFormModal(null);
        try {
          await api.updateSalaryPayment(p.id, { paidAt: v.paidAt, amount: Number(v.amount), note: v.note });
          toast("Хадгалагдлаа");
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function removeSalary(p) {
    setConfirmState({
      message: `${p.employeeName} — ${p.paidAt} ₮${fmt(p.amount)} цалингийн бичлэгийг устгах уу?`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteSalaryPayment(p.id);
          toast("Устгагдлаа");
          load();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  const label = isCeo ? periodLabel(filter, range) : "Бүх хугацаа";
  const received = summary?.received || 0;

  return (
    <div>
      <PageHeader title="Санхүү" subtitle={label} />
      <ErrorBanner message={error} />

      {isCeo && <PeriodFilter filter={filter} setFilter={setFilter} />}
      {range && (
        <div style={{ color: "var(--muted)", fontSize: 11, margin: "-6px 0 16px" }}>
          Гэрээт орлого, авлага — гэрээний огноогоор · Орж ирсэн — орсон огноогоор · Зардал — зарцуулсан огноогоор
        </div>
      )}

      {summary && !waitingForCustom && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Гэрээт орлого" value={fmtM(summary.contractedRevenue)} sub="НӨАТ-гүй" accent="var(--teal)" />
          <StatCard label="Орж ирсэн" value={fmtM(summary.received)} sub={summary.contractedRevenue ? `${Math.round((summary.received / summary.contractedRevenue) * 1000) / 10}% collection` : "—"} />
          <StatCard label="Авлага" value={fmtM(summary.receivable)} sub={`${fmtM(summary.overdueReceivable)} overdue`} accent="var(--rust)" />
          <StatCard label="Нийт зардал" value={fmtM(summary.totalExpenses)} sub="бүх зардал" />
          <StatCard label="Баримттай зардал" value={fmtM(summary.documentedExpenses)} sub={`${summary.totalExpenses ? Math.round((summary.documentedExpenses / summary.totalExpenses) * 100) : 100}%`} accent="var(--teal)" />
          <StatCard label="Баримтгүй зардал" value={fmtM(summary.undocumentedExpenses)} sub={`${summary.undocumentedGapPct}% gap`} accent="var(--amber)" />
        </div>
      )}

      {isCeo && summary && !waitingForCustom && (
        <>
          <SectionTitle
            title="Цалингийн зардал"
            sub={`${label} · орж ирсэн мөнгөтэй харьцуулсан`}
            extra={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={fillMonth} style={smallBtn}>Сарын цалин үүсгэх</button>
                <button onClick={addSalary} style={smallBtn}><Plus size={12} /> Цалин</button>
              </div>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
            <StatCard label="Олгосон цалин" value={fmtM(summary.salaries)} sub={`${salaries.payments.length} олголт`} />
            <StatCard
              label="Орж ирсэн мөнгөний"
              value={summary.salaryPctOfReceived == null ? "—" : `${summary.salaryPctOfReceived}%`}
              sub={received ? "цалинд зарцуулсан" : "энэ хугацаанд орлого ороогүй"}
              accent="var(--amber)"
            />
            <StatCard
              label="Үлдэгдэл"
              value={fmtM(summary.remainingAfterCostsAndSalaries)}
              sub="Орж ирсэн − зардал − цалин"
              accent={summary.remainingAfterCostsAndSalaries < 0 ? "var(--rust)" : "var(--teal)"}
            />
          </div>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
            {salaries.byEmployee.map((e, i) => (
              <div key={`${e.employeeId}-${e.employeeName}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{e.employeeName}{e.employeeId == null && <span style={{ color: "var(--muted)", fontSize: 11 }}> (устгагдсан ажилтан)</span>}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>{e.count} олголт</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="plex-mono">₮{fmt(e.total)}</div>
                  {received > 0 && <div style={{ color: "var(--muted)", fontSize: 11 }}>{Math.round((e.total / received) * 1000) / 10}% орлогын</div>}
                </div>
              </div>
            ))}
            {salaries.byEmployee.length === 0 && (
              <div style={{ padding: 20 }}>
                <EmptyState>Энэ хугацаанд цалин бүртгэгдээгүй байна. "Сарын цалин үүсгэх" эсвэл "+ Цалин" дарж бүртгэнэ үү.</EmptyState>
              </div>
            )}
            {salaries.payments.length > 0 && (
              <button onClick={() => setShowSalaryList((v) => !v)} style={{ width: "100%", background: "var(--panel2)", color: "var(--muted)", fontSize: 11, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                {showSalaryList ? "Олголтуудыг нуух ▲" : `Бүх олголтыг харах (${salaries.payments.length}) ▼`}
              </button>
            )}
            {showSalaryList &&
              salaries.payments.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 12, borderTop: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.employeeName}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{p.paidAt}{p.note ? ` · ${p.note}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="plex-mono">₮{fmt(p.amount)}</span>
                    <button onClick={() => editSalary(p)} title="Засах" style={{ ...iconBtn, color: "var(--muted)" }}><Pencil size={10} style={{ margin: "auto" }} /></button>
                    <button onClick={() => removeSalary(p)} title="Устгах" style={{ ...iconBtn, color: "var(--rust)" }}><Trash2 size={10} style={{ margin: "auto" }} /></button>
                  </div>
                </div>
              ))}
          </div>

          {filter.mode !== "month" && (
            <>
              <SectionTitle title="Сар бүрээр" sub="Орж ирсэн − зардал − цалин = үлдэгдэл" />
              <MonthlyTable months={monthly} />
            </>
          )}
        </>
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
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }}>
        НӨАТ-гүй тооцоо{range ? " · энэ хугацаанд гэрээ байгуулсан төслүүд" : ""}
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 16px", color: "var(--muted)", fontSize: 10, borderBottom: "1px solid var(--line)" }}>
              <span>ТӨСӨЛ</span><span>ОРЛОГО</span><span>ЗАРДАЛ</span><span>АШИГ</span><span>MARGIN</span>
            </div>
            {projects.map((p, i) => (
              <button key={p.id} onClick={() => openProject(p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", width: "100%", textAlign: "left", background: "transparent", padding: "12px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none", alignItems: "center" }}>
                <span>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  {p.contractDate && <span style={{ display: "block", color: "var(--muted)", fontSize: 10 }} className="plex-mono">{p.contractDate}</span>}
                </span>
                <span className="plex-mono">{fmtM(p.revenue)}</span>
                <span className="plex-mono">{fmtM(p.cost)}</span>
                <span className="plex-mono" style={{ color: "var(--teal)" }}>{fmtM(p.profit)}</span>
                <span className="plex-mono">{p.marginPct}%</span>
              </button>
            ))}
          </div>
        </div>
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

      {formModal && <FormModal {...formModal} onCancel={() => setFormModal(null)} />}
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
    </div>
  );
}
