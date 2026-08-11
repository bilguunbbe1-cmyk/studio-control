import { useEffect, useState, useCallback } from "react";
import {
  LayoutGrid, FolderKanban, CheckSquare, Film, Wallet, Users,
  Plus, ArrowRight, AlertTriangle, X, Check, ChevronRight, LogOut,
} from "lucide-react";
import { api, setToken, hasToken } from "./api";
import Login from "./Login";

const STATUS_META = {
  ontrack: { label: "Хэвийн", color: "var(--teal)" },
  risk: { label: "Эрсдэлтэй", color: "var(--gold)" },
  late: { label: "Хоцорсон", color: "var(--rust)" },
};

function fmt(n) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
}

const NAV = [
  { icon: LayoutGrid, label: "Тойм", active: true },
  { icon: FolderKanban, label: "Төслүүд" },
  { icon: CheckSquare, label: "Миний ажил" },
  { icon: Film, label: "Продакшн" },
  { icon: Wallet, label: "Санхүү" },
  { icon: Users, label: "Баг" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!hasToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!user) return <Login onAuthed={setUser} />;
  return <Dashboard user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

function Dashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [form, setForm] = useState({ name: "", client: "", budget: "" });
  const [activeProject, setActiveProject] = useState(null);
  const [log, setLog] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [p, a, d, s] = await Promise.all([
        api.getProjects(),
        api.getApprovals(),
        api.getDeadlines(),
        api.getSummary(),
      ]);
      setProjects(p);
      setApprovals(a);
      setDeadlines(d);
      setSummary(s);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function decide(id, decision) {
    const item = approvals.find((a) => a.id === id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    try {
      await api.decideApproval(id, decision);
      setLog((prev) => [{ ...item, decision }, ...prev].slice(0, 3));
      const s = await api.getSummary();
      setSummary(s);
    } catch (err) {
      setError(err.message);
      loadAll();
    }
  }

  async function updateSpent(id, delta) {
    try {
      const updated = await api.adjustSpend(id, delta);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      const s = await api.getSummary();
      setSummary(s);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addProject(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.budget) return;
    try {
      const created = await api.createProject({
        name: form.name,
        client: form.client,
        budget: Number(form.budget),
      });
      setProjects((prev) => [created, ...prev]);
      setForm({ name: "", client: "", budget: "" });
      setShowNewProject(false);
      const s = await api.getSummary();
      setSummary(s);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex" }} className="text-sm">
      {/* Sidebar */}
      <aside style={{ background: "var(--panel)", borderRight: "1px solid var(--line)", width: 224 }} className="shrink-0 flex-col py-5 px-3 hidden md:flex">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 32 }}>
          <div style={{ background: "var(--gold)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#12141c", fontWeight: 700, fontSize: 12 }} className="plex-mono">
            SC
          </div>
          <div>
            <div style={{ fontWeight: 600, lineHeight: 1.1 }}>Studio Control</div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>[Компанийн нэр]</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((item) => (
            <div key={item.label} style={{ background: item.active ? "var(--panel2)" : "transparent", color: item.active ? "var(--text)" : "var(--muted)", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8 }}>
              <item.icon size={16} />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, padding: "16px 8px 0", borderTop: "1px solid var(--line)" }}>
          <div style={{ background: "var(--teal)", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#12141c", fontWeight: 600, fontSize: 11 }}>
            {user.name?.slice(0, 2).toUpperCase() || "ТА"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>{user.role}</div>
          </div>
          <button onClick={onLogout} title="Гарах" style={{ background: "transparent", color: "var(--muted)" }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Өглөөний мэнд, {user.name?.split(" ")[0]} 👋</h1>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              Өнөөдөр анхаарах {approvals.length} зүйл байна.
            </p>
          </div>
          <button onClick={() => setShowNewProject(true)} style={{ background: "var(--gold)", color: "#12141c", display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
            <Plus size={14} /> Шинэ төсөл
          </button>
        </div>

        {error && (
          <div style={{ background: "#c9613f22", color: "var(--rust)", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Stat cards */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
            <StatCard label="Идэвхтэй төсөл" value={summary.projectCount} sub={`${summary.projectCount - summary.riskyCount} хэвийн · ${summary.riskyCount} эрсдэлтэй`} />
            <StatCard label="Нийт төсөв" value={`₮${fmt(summary.budget / 1e6)}М`} sub={`₮${fmt(summary.spent / 1e6)}М зарцуулсан`} accent="var(--teal)" />
            <StatCard label="Үлдэгдэл" value={`₮${fmt(summary.remaining / 1e6)}М`} sub="төсөвт үлдсэн" />
            <StatCard label="Margin" value={`${summary.marginPct}%`} sub="ашгийн хувь" accent="var(--gold)" />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }} className="lg-grid">
          {/* Projects */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Төслийн хяналт</h2>
              <span style={{ color: "var(--muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}>
                Эрсдэлтэй эхэнд <ChevronRight size={12} />
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...projects].sort((a, b) => (a.status === "ontrack" ? 1 : -1)).map((p) => {
                const pct = Math.round((p.spent / p.budget) * 100);
                const meta = STATUS_META[p.status];
                return (
                  <div key={p.id} onClick={() => setActiveProject(activeProject === p.id ? null : p.id)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Gauge pct={pct} color={meta.color} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }} className="plex-mono">
                        {pct}%
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.client} · {p.lead}</div>
                    </div>
                    <span style={{ background: `${meta.color}22`, color: meta.color, fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", padding: 24 }}>Төсөл алга. Шинээр үүсгэнэ үү.</div>
              )}
            </div>

            {activeProject && (
              <ProjectEditor
                project={projects.find((p) => p.id === activeProject)}
                onSpend={(delta) => updateSpent(activeProject, delta)}
                onClose={() => setActiveProject(null)}
              />
            )}
          </section>

          {/* Right column */}
          <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>Танаас шийдвэр хүлээж байна</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {approvals.length === 0 && (
                  <div style={{ color: "var(--muted)", border: "1px dashed var(--line)", fontSize: 12, borderRadius: 8, padding: 16, textAlign: "center" }}>
                    Хүлээгдэж буй хүсэлт алга
                  </div>
                )}
                {approvals.map((a) => (
                  <div key={a.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      {a.kind === "flag" ? <AlertTriangle size={14} color="var(--rust)" style={{ marginTop: 2, flexShrink: 0 }} /> : <Wallet size={14} color="var(--gold)" style={{ marginTop: 2, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{a.title}</div>
                        {a.amount != null && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }} className="plex-mono">₮{fmt(a.amount)}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => decide(a.id, "approved")} style={{ background: "#4fa9a022", color: "var(--teal)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "6px 0", borderRadius: 6 }}>
                        <Check size={12} /> Зөвшөөрөх
                      </button>
                      <button onClick={() => decide(a.id, "rejected")} style={{ background: "#c9613f22", color: "var(--rust)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "6px 0", borderRadius: 6 }}>
                        <X size={12} /> Татгалзах
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {log.length > 0 && (
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {log.map((l, i) => (
                    <div key={i}>{l.decision === "approved" ? "✓" : "✕"} {l.title}</div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>Ойрын хугацаа</h2>
              <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12 }}>
                {deadlines.map((d, i) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ background: "var(--panel2)", borderRadius: 6, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }} className="plex-mono">{d.due_date?.slice(8, 10)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                      <div style={{ color: "var(--muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.project} · {d.person}</div>
                    </div>
                  </div>
                ))}
                {deadlines.length === 0 && (
                  <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", padding: 16 }}>Хугацаа алга</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {showNewProject && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 50 }}>
          <form onSubmit={addProject} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Шинэ төсөл</h3>
              <button type="button" onClick={() => setShowNewProject(false)} style={{ background: "transparent" }}>
                <X size={16} color="var(--muted)" />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FieldRow label="Төслийн нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <FieldRow label="Харилцагч" value={form.client} onChange={(v) => setForm({ ...form, client: v })} />
              <FieldRow label="Төсөв (₮)" type="number" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} />
            </div>
            <button type="submit" style={{ background: "var(--gold)", color: "#12141c", width: "100%", marginTop: 16, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              Үүсгэх <ArrowRight size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Gauge({ pct, color, size = 60 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "var(--text)" }} className="plex-mono">{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function FieldRow({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 11 }}>{label}</span>
      <input required type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12, outline: "none" }} />
    </label>
  );
}

function ProjectEditor({ project, onSpend, onClose }) {
  if (!project) return null;
  const pct = Math.round((project.spent / project.budget) * 100);
  return (
    <div style={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{project.name} — зарцуулга тохируулах</div>
        <button onClick={onClose} style={{ background: "transparent" }}><X size={14} color="var(--muted)" /></button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 12 }} className="plex-mono">
        ₮{fmt(project.spent)} / ₮{fmt(project.budget)} ({pct}%)
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSpend(-500000)} style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>−₮500,000</button>
        <button onClick={() => onSpend(500000)} style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>+₮500,000</button>
      </div>
    </div>
  );
}
