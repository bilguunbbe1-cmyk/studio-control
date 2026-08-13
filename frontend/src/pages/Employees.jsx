import { useEffect, useState, useCallback } from "react";
import { Cake, Sun, FileText, Wallet } from "lucide-react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent } from "../bus";
import { ErrorBanner, EmptyState, useToast, FieldRow, Avatar } from "../components";
import PageHeader from "../components/PageHeader";

function nextUpcomingBirthday(employees) {
  const withBirthday = employees.filter((e) => e.birthday);
  if (withBirthday.length === 0) return null;
  const today = new Date();
  const todayKey = today.getMonth() * 100 + today.getDate();
  return [...withBirthday].sort((a, b) => {
    const keyFor = (mmdd) => {
      const [m, d] = mmdd.split("-").map(Number);
      const key = (m - 1) * 100 + d;
      return key >= todayKey ? key : key + 1300; // wrap birthdays already passed this year to the back
    };
    return keyFor(a.birthday) - keyFor(b.birthday);
  })[0];
}

export default function Employees({ user }) {
  const isCeo = user.role === "ceo";
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { openEmployee } = usePanels();

  const load = useCallback(async () => {
    try {
      setEmployees(await api.getEmployees({ search: search || undefined, filter: filter === "all" ? undefined : filter }));
    } catch (err) {
      setError(err.message);
    }
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => onEvent("employees-changed", load), [load]);

  const missingContractCount = employees.filter((e) => e.contractStatus !== "Гэрээтэй").length;
  const leavePlanCount = employees.filter((e) => e.leaveStatus === "Төлөвлөөгүй").length;
  const upcomingBirthday = nextUpcomingBirthday(employees);

  return (
    <div>
      <PageHeader title="Ажилтнууд" subtitle="2026 оны 8-р сар" />
      <div style={{ marginTop: -12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Ажилтны бүртгэл</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Гэрээ, цалин, амралт, төрсөн өдөр нэг дор.</p>
      </div>

      <ErrorBanner message={error} />

      {isCeo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <ReminderCard icon={Cake} label="Ойрын төрсөн өдөр" value={upcomingBirthday ? `${upcomingBirthday.name} · ${upcomingBirthday.birthday}` : "Мэдээлэл алга"} />
          <ReminderCard icon={Sun} label="Амралт төлөвлөх" value={`${leavePlanCount} ажилтан бэлэн болсон`} />
          <ReminderCard icon={FileText} label="Гэрээний сануулга" value={`${missingContractCount} гэрээ шинэчлэх`} />
          <ReminderCard icon={Wallet} label="Дараагийн цалин" value="Сар бүрийн 20 · Урьдчилгаа" />
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ажилтны нэр, албан тушаал хайх..."
        style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "10px 14px", fontSize: 13, outline: "none", marginBottom: 14 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={`Идэвхтэй ${employees.length}`} />
          {isCeo && <FilterPill active={filter === "missing_contract"} onClick={() => setFilter("missing_contract")} label={`Гэрээ дутуу ${missingContractCount}`} />}
        </div>
        {isCeo && (
          <button onClick={() => setShowNew(true)} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, fontWeight: 600, padding: "8px 12px", borderRadius: 8 }}>
            ＋ Ажилтан нэмэх
          </button>
        )}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "10px 16px", color: "var(--muted)", fontSize: 10, borderBottom: "1px solid var(--line)" }}>
              <span>АЖИЛТАН</span><span>ХЭЛТЭС</span><span>ТӨРСӨН ӨДӨР</span><span>УТАС</span><span>ДАРААГИЙН АМРАЛТ</span><span>ГЭРЭЭ</span>
            </div>
            {employees.map((e, i) => (
              <button key={e.id} onClick={() => openEmployee(e.id)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", width: "100%", textAlign: "left", background: "transparent", padding: "12px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--line)" : "none", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={e.name} photoUrl={e.photoUrl} size={26} />
                  <span>
                    <div style={{ fontWeight: 500 }}>{e.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{e.title}</div>
                  </span>
                </span>
                <span>{e.department || "—"}</span>
                <span>{e.birthday || "—"}</span>
                <span className="plex-mono">{e.phone || "—"}</span>
                <span className="plex-mono">{e.nextLeaveCycleDate || "—"}</span>
                <span style={{ color: e.contractStatus === "Гэрээтэй" ? "var(--teal)" : e.contractStatus ? "var(--rust)" : "var(--muted)", fontWeight: 600 }}>{e.contractStatus || "—"}</span>
              </button>
            ))}
          </div>
        </div>
        {employees.length === 0 && <div style={{ padding: 20 }}><EmptyState>Ажилтан алга</EmptyState></div>}
      </div>

      {showNew && <NewEmployeeModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}

function ReminderCard({ icon: Icon, label, value }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={16} color="var(--gold)" style={{ marginTop: 2 }} />
      <div>
        <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{ background: active ? "var(--panel2)" : "var(--panel)", border: "1px solid var(--line)", color: active ? "var(--text)" : "var(--muted)", fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 20 }}>
      {label}
    </button>
  );
}

const LOGIN_ROLE_OPTIONS = [
  { value: "ceo", label: "CEO" },
  { value: "manager", label: "Менежер" },
  { value: "production", label: "Продакшн" },
];

function NewEmployeeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", title: "", city: "Улаанбаатар", department: "", phone: "", hireDate: "" });
  const [withLogin, setWithLogin] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "", role: "" });
  const [error, setError] = useState("");
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createEmployee({
        ...form,
        ...(withLogin ? { email: login.email, password: login.password, role: login.role } : {}),
      });
      toast(`${form.name} нэмэгдлээ`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 80, overflowY: "auto" }}>
      <form onSubmit={submit} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 360, margin: "20px 0" }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 16px" }}>Ажилтан нэмэх</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldRow label="Нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FieldRow label="Албан тушаал" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <FieldRow label="Хэлтэс" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required={false} />
          <FieldRow label="Утас" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required={false} />
          <FieldRow label="Хот" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required={false} />
          <FieldRow label="Ажилд орсон огноо" type="date" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} required={false} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} />
          Нэвтрэх эрх өгөх
        </label>

        {withLogin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <FieldRow label="И-мэйл" type="email" value={login.email} onChange={(v) => setLogin({ ...login, email: v })} />
            <FieldRow label="Нууц үг" value={login.password} onChange={(v) => setLogin({ ...login, password: v })} />
            <FieldRow label="Эрх" value={login.role} onChange={(v) => setLogin({ ...login, role: v })} options={LOGIN_ROLE_OPTIONS} />
          </div>
        )}

        {error && <div style={{ color: "var(--rust)", fontSize: 11, marginTop: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
          <button type="submit" style={{ background: "var(--gold)", color: "#ffffff", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Нэмэх</button>
        </div>
      </form>
    </div>
  );
}
