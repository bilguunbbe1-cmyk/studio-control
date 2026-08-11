import { useState } from "react";
import { api, setToken } from "./api";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [form, setForm] = useState({ email: "demo@studio.mn", password: "demo1234", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? api.login(form.email, form.password) : api.register(form.email, form.password, form.name);
      const { token, user } = await fn;
      setToken(token);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={submit} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ background: "var(--gold)", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#12141c", fontWeight: 700 }} className="plex-mono">
            SC
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Studio Control</div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>[Компанийн нэр]</div>
          </div>
        </div>

        <h1 style={{ fontSize: 16, margin: "0 0 16px" }}>
          {mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </h1>

        {mode === "register" && (
          <Field label="Нэр" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        )}
        <Field label="Имэйл" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Нууц үг" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />

        {error && (
          <div style={{ color: "var(--rust)", fontSize: 12, marginTop: 8 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ background: "var(--gold)", color: "#12141c", width: "100%", padding: "10px 0", borderRadius: 8, fontWeight: 600, fontSize: 13, marginTop: 16, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "..." : mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ background: "transparent", color: "var(--muted)", width: "100%", padding: "10px 0", fontSize: 12, marginTop: 4 }}
        >
          {mode === "login" ? "Шинэ хэрэглэгч бүртгүүлэх" : "Аль хэдийн бүртгэлтэй юу? Нэвтрэх"}
        </button>

        {mode === "login" && (
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 12, textAlign: "center" }}>
            Demo: demo@studio.mn / demo1234
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      <span style={{ color: "var(--muted)", fontSize: 11 }}>{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none" }}
      />
    </label>
  );
}
