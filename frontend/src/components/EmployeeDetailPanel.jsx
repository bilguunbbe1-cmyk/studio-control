import { useEffect, useState, useCallback } from "react";
import { X, MoreHorizontal, Trash2 } from "lucide-react";
import { api } from "../api";
import { emit } from "../bus";
import { SlideOver, TabBar, Badge, FieldRow, fmt, useToast, EmptyState } from "../components";

const FULL_TABS = [
  { value: "general", label: "Ерөнхий" },
  { value: "contract", label: "Хөдөлмөрийн гэрээ" },
  { value: "leave", label: "Амралт" },
  { value: "salary", label: "Цалин" },
  { value: "files", label: "Файл" },
];
const LIMITED_TABS = [{ value: "general", label: "Ерөнхий" }];

export default function EmployeeDetailPanel({ employeeId, user, onClose }) {
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState("general");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [grantingLogin, setGrantingLogin] = useState(false);
  const toast = useToast();
  const isCeo = user?.role === "ceo";

  const load = useCallback(async () => {
    if (!employeeId) return;
    try {
      setEmployee(await api.getEmployee(employeeId));
    } catch (err) {
      setError(err.message);
    }
  }, [employeeId]);

  useEffect(() => {
    setTab("general");
    setEmployee(null);
    setMenuOpen(false);
    setEditing(false);
    load();
  }, [employeeId, load]);

  if (!employeeId) return null;

  async function saveEdit(payload) {
    try {
      await api.updateEmployee(employeeId, payload);
      toast("Хадгалагдлаа");
      setEditing(false);
      load();
      emit("employees-changed");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveGrantLogin(payload) {
    try {
      await api.grantLogin(employeeId, payload);
      toast("Нэвтрэх эрх нэмэгдлээ");
      setGrantingLogin(false);
      load();
      emit("employees-changed");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteEmployee() {
    if (!window.confirm(`"${employee.name}"-ийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    try {
      await api.deleteEmployee(employeeId);
      toast("Ажилтан устгагдлаа");
      emit("employees-changed");
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function planLeave() {
    try {
      await api.planEmployeeLeave(employeeId);
      toast("Амралт төлөвлөгдлөө");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitBirthday() {
    const value = window.prompt("Төрсөн өдөр (сар-өдөр, ж: 09-18):");
    if (!value || !/^\d{1,2}-\d{1,2}$/.test(value)) return;
    const [month, day] = value.split("-");
    try {
      await api.setEmployeeBirthday(employeeId, month, day);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadFile(category, file) {
    if (!file) return;
    try {
      await api.uploadEmployeeFile(employeeId, category, file);
      toast(`${file.name} нэмэгдлээ`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const canSeeFull = employee?.canSeeFull !== false;
  const tabs = canSeeFull ? FULL_TABS : LIMITED_TABS;

  return (
    <SlideOver open={!!employeeId} onClose={onClose}>
      {!employee ? (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Ачааллаж байна...</div>
      ) : editing ? (
        <EditEmployeeForm employee={employee} onCancel={() => setEditing(false)} onSave={saveEdit} />
      ) : grantingLogin ? (
        <GrantLoginForm employee={employee} onCancel={() => setGrantingLogin(false)} onSave={saveGrantLogin} />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }} className="plex-mono">{employee.code} · Идэвхтэй ажилтан</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
              {isCeo && (
                <>
                  <button onClick={() => setMenuOpen((v) => !v)} style={{ background: "transparent" }}><MoreHorizontal size={16} color="var(--muted)" /></button>
                  {menuOpen && (
                    <div style={{ position: "absolute", top: 24, right: 24, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", zIndex: 5, minWidth: 140 }}>
                      <button onClick={() => { setMenuOpen(false); deleteEmployee(); }} style={{ background: "transparent", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--rust)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Trash2 size={12} /> Устгах
                      </button>
                    </div>
                  )}
                </>
              )}
              <button onClick={onClose} style={{ background: "transparent" }}><X size={18} color="var(--muted)" /></button>
            </div>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 2px" }}>{employee.name}</h2>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 20 }}>{employee.title}</div>

          <TabBar tabs={tabs} active={canSeeFull ? tab : "general"} onChange={setTab} />
          {error && <div style={{ color: "var(--rust)", fontSize: 11, marginBottom: 12 }}>{error}</div>}

          {!canSeeFull && <EmptyState>Энэ ажилтны дэлгэрэнгүй мэдээлэл зөвхөн тухайн хүн болон CEO-д харагдана.</EmptyState>}
          {canSeeFull && tab === "general" && <GeneralTab employee={employee} isCeo={isCeo} onSubmitBirthday={submitBirthday} onEdit={() => setEditing(true)} onGrantLogin={() => setGrantingLogin(true)} />}
          {canSeeFull && tab === "contract" && <ContractTab employee={employee} />}
          {canSeeFull && tab === "leave" && <LeaveTab employee={employee} isCeo={isCeo} onPlan={planLeave} />}
          {canSeeFull && tab === "salary" && <SalaryTab employee={employee} />}
          {canSeeFull && tab === "files" && <FilesTab employee={employee} isCeo={isCeo} onUpload={uploadFile} />}
        </>
      )}
    </SlideOver>
  );
}

function EditEmployeeForm({ employee, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: employee.name,
    title: employee.title,
    city: employee.city || "",
    department: employee.department || "",
    phone: employee.phone || "",
    hireDate: employee.hireDate || "",
    birthday: employee.birthday || "",
  });
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Ажилтны мэдээлэл засах</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FieldRow label="Нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FieldRow label="Албан тушаал" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <FieldRow label="Хэлтэс" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required={false} />
        <FieldRow label="Хот" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required={false} />
        <FieldRow label="Утас" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required={false} />
        <FieldRow label="Ажилд орсон огноо" type="date" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} required={false} />
        <FieldRow label="Төрсөн өдөр (MM-DD)" value={form.birthday} onChange={(v) => setForm({ ...form, birthday: v })} required={false} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
        <button onClick={() => onSave(form)} style={{ background: "var(--gold)", color: "#12141c", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Хадгалах</button>
      </div>
    </div>
  );
}

const LOGIN_ROLE_OPTIONS = [
  { value: "ceo", label: "CEO" },
  { value: "manager", label: "Менежер" },
  { value: "production", label: "Продакшн" },
];

function GrantLoginForm({ employee, onCancel, onSave }) {
  const [form, setForm] = useState({ email: "", password: "", role: "" });
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Нэвтрэх эрх өгөх</h2>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>{employee.name}-д нэвтрэх эрх үүсгэнэ.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <FieldRow label="И-мэйл" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <FieldRow label="Нууц үг" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <FieldRow label="Эрх" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={LOGIN_ROLE_OPTIONS} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
        <button onClick={() => onSave(form)} style={{ background: "var(--gold)", color: "#12141c", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Үүсгэх</button>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
      <div style={{ color: "var(--muted)", fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }} className="plex-mono">{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function GeneralTab({ employee, isCeo, onSubmitBirthday, onEdit, onGrantLogin }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 8 }}>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {employee.title} · {employee.city}{employee.hireDate ? ` · ${employee.hireDate}-нд ажилд орсон` : ""}{employee.phone ? ` · ${employee.phone}` : ""}
        </div>
        {isCeo && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", fontSize: 11, padding: "6px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>
              Мэдээлэл засах
            </button>
            {!employee.hasLogin && (
              <button onClick={onGrantLogin} style={{ background: "var(--gold)", color: "#12141c", fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>
                Нэвтрэх эрх өгөх
              </button>
            )}
          </div>
        )}
      </div>

      {!employee.birthday && (
        <div style={{ background: "var(--panel2)", border: "1px dashed var(--line)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Төрсөн өдөр бүртгэгдээгүй байна</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 8 }}>Сануулахын тулд сар, өдрийг оруулна уу. Он заавал биш.</div>
          {isCeo && <button onClick={onSubmitBirthday} style={{ background: "var(--gold)", color: "#12141c", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6 }}>Оруулах</button>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <Metric label="Ажилласан хугацаа" value={employee.tenure || "—"} sub={employee.hireDate ? `${employee.hireDate}-ээс` : "Огноо бүртгэгдээгүй"} />
        <Metric label="Дараагийн цалин" value={employee.salary.nextDisbursementDate || "—"} sub="Урьдчилгаа" />
        <Metric label="Амралтын цикл" value={employee.leave.nextCycleDate || "—"} sub={employee.leave.status} />
      </div>

      {employee.contract && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Хөдөлмөрийн гэрээ</div>
          <Row label="Гэрээний №" value={employee.contract.number} />
          <Row label="Эхэлсэн" value={employee.contract.startDate} />
          <Row label="Төлөв" value={employee.contract.status} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ContractTab({ employee }) {
  if (!employee.contract) return <EmptyState>Гэрээ бүртгэгдээгүй байна.</EmptyState>;
  const c = employee.contract;
  return (
    <div>
      <Badge color="var(--teal)">{c.status}</Badge>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 2px" }} className="plex-mono">{c.number}</h3>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 16 }}>{c.startDate}-нд байгуулсан · {c.term}</div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
        <Row label="Албан тушаал" value={employee.title} />
        <Row label="Ажилд орсон огноо" value={employee.hireDate} />
        <Row label="Туршилтын хугацаа" value={c.probationStatus} />
        <Row label="Ажлын хэлбэр" value={c.workType} />
        <Row label="Цалин олгох өдөр" value={`Сар бүрийн ${c.payrollDays}`} />
        <Row label="Дараагийн review" value={c.nextReviewDate || "—"} />
      </div>
    </div>
  );
}

function LeaveTab({ employee, isCeo, onPlan }) {
  const { leave } = employee;
  return (
    <div>
      <Row label="Ажилд орсон" value={employee.hireDate} />
      <Row label={`${leave.cycleLengthMonths} сарын цикл`} value={leave.nextCycleDate || "—"} />
      <Row label="Төлөв" value={leave.status} />

      {leave.status === "Төлөвлөөгүй" && (
        <div style={{ background: "var(--panel2)", border: "1px dashed var(--line)", borderRadius: 10, padding: 12, margin: "16px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{employee.name}-ийн амралтыг төлөвлөх шаардлагатай</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 8 }}>
            Компанийн {leave.cycleLengthMonths} сарын давтамжийн тохиргоогоор {leave.nextCycleDate}-ээс амралтын дараагийн цикл нээгдсэн.
          </div>
          {isCeo && (
            <button onClick={onPlan} style={{ background: "var(--gold)", color: "#12141c", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6 }}>Амралт төлөвлөх</button>
          )}
        </div>
      )}

      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 10px" }}>Амралтын түүх</h3>
      {leave.history.length === 0 ? (
        <EmptyState>Бүртгэлтэй амралт алга. Амралт батлагдахад энд хугацаа, хоног, орлох ажилтан харагдана.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {leave.history.map((h) => (
            <div key={h.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12 }}>
              {h.start_date} — {h.end_date} · {h.days} хоног
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SalaryTab({ employee }) {
  const { salary } = employee;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Metric
          label="Дараагийн олголт"
          value={salary.nextDisbursementDate || "—"}
          sub={salary.nextDisbursementPctOfBase ? `Урьдчилгаа · Үндсэн цалингийн ${salary.nextDisbursementPctOfBase}%` : "Урьдчилгаа"}
        />
        <Metric label="Дараагийн үлдэгдэл" value={salary.nextBalanceDate || "—"} sub="Сарын эцсийн тооцоо" />
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Цалингийн хуваарь</h3>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Сар бүр автоматаар</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {salary.schedule.map((s) => (
          <div key={s.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <div>
              <div className="plex-mono">{s.date}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{s.label}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {s.amount != null && <div className="plex-mono">₮{fmt(s.amount)}</div>}
              <div style={{ color: s.status === "Олгосон" ? "var(--teal)" : "var(--muted)", fontSize: 11 }}>{s.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesTab({ employee, isCeo, onUpload }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {employee.fileFolders.map((f) => (
        <label key={f.category} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, cursor: isCeo ? "pointer" : "default" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{f.category}</div>
          <div style={{ fontSize: 11 }} className="plex-mono">{f.count} файл</div>
          {isCeo && <input type="file" style={{ display: "none" }} onChange={(e) => onUpload(f.category, e.target.files[0])} />}
        </label>
      ))}
    </div>
  );
}
