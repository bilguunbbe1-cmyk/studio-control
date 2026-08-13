import { createContext, useCallback, useContext, useState } from "react";
import { API_BASE } from "./api";

export function fmt(n) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
}

export function fmtM(n) {
  return `₮${(Number(n || 0) / 1e6).toFixed(1)} сая`;
}

export const STATUS_META = {
  ontrack: { label: "Хэвийн", color: "var(--teal)" },
  risk: { label: "Эрсдэлтэй", color: "var(--amber)" },
  late: { label: "Хоцорсон", color: "var(--rust)" },
};

export const TASK_STATUS_META = {
  not_started: { label: "Эхлээгүй", color: "var(--muted)" },
  editing: { label: "Edit хийж байна", color: "var(--amber)" },
  internal_review: { label: "Дотоод хяналт", color: "var(--teal)" },
  awaiting_client: { label: "Харилцагч хүлээж байна", color: "var(--rust)" },
  done: { label: "Дууссан", color: "var(--teal)" },
};

export const STAGE_META = {
  pre_production: { label: "Pre-production" },
  ready_to_shoot: { label: "Зураг авалтад бэлэн" },
  shooting: { label: "Зураг авалт" },
  edit: { label: "Edit" },
  client_review: { label: "Client review" },
  final: { label: "Final" },
};
export const STAGE_ORDER = ["pre_production", "ready_to_shoot", "shooting", "edit", "client_review", "final"];

export const RECEIPT_META = {
  has_receipt: { label: "Баримттай", color: "var(--teal)" },
  no_receipt: { label: "Баримтгүй", color: "var(--rust)" },
  pending: { label: "Pending", color: "var(--amber)" },
};

export function Gauge({ pct, color, size = 60 }) {
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

export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ color: "var(--muted)", fontSize: 11 }}>{label}</div>
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "var(--text)" }} className="plex-mono">{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function FieldRow({ label, value, onChange, type = "text", options, required = true }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: 11 }}>{label}</span>
      {options ? (
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12, outline: "none" }}
        >
          <option value="">Сонгох...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          required={required}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 12, outline: "none" }}
        />
      )}
    </label>
  );
}

export function ConfirmDialog({ title = "Устгах уу?", message, confirmLabel = "Устгах", danger = true, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 95 }}>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 340 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>{title}</h3>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 16px" }}>{message}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
          <button type="button" onClick={onConfirm} style={{ background: danger ? "var(--rust)" : "var(--gold)", color: "#ffffff", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function FormModal({ title, fields, submitLabel = "Хадгалах", onCancel, onSubmit }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""])));
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#00000099", zIndex: 95, overflowY: "auto" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
        style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 360, margin: "20px 0" }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>{title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              label={f.label}
              type={f.type || "text"}
              options={f.options}
              value={values[f.key]}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              required={f.required !== false}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12 }}>Цуцлах</button>
          <button type="submit" style={{ background: "var(--gold)", color: "#ffffff", flex: 1, padding: "9px 0", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export const BADGE_TINTS = {
  "var(--teal)": "#e7f6ef",
  "var(--amber)": "#fff2d8",
  "var(--rust)": "#fde9eb",
  "var(--gold)": "#eef2fb",
  "var(--muted)": "#eef1f6",
};

export function Avatar({ name, photoUrl, size = 26, bg = "var(--teal)" }) {
  const src = photoUrl && (photoUrl.startsWith("http") ? photoUrl : `${API_BASE}${photoUrl}`);
  const style = { width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: Math.round(size * 0.42), overflow: "hidden" };
  if (src) {
    return <img src={src} alt={name} style={{ ...style, objectFit: "cover" }} />;
  }
  return <span style={{ ...style, background: bg, color: "#ffffff" }}>{name?.[0]?.toUpperCase() || "?"}</span>;
}

export function Badge({ color, children }) {
  return (
    <span style={{ background: BADGE_TINTS[color] || "var(--panel2)", color, fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, flexShrink: 0 }}>
      {children}
    </span>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{ background: "#fde9eb", color: "var(--rust)", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
      {message}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{ color: "var(--muted)", border: "1px dashed var(--line)", fontSize: 12, borderRadius: 8, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}

export const ROLE_LABEL = { ceo: "CEO", manager: "Менежер", production: "Продакшн" };

// ---- Toast notifications ----
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 100 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", padding: "10px 16px", borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px #00000055" }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---- Right-side slide-over panel shell (used by Project + Employee detail panels) ----
export function SlideOver({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000099" }} />
      <div
        style={{
          position: "relative",
          background: "var(--bg)",
          borderLeft: "1px solid var(--line)",
          width: "100%",
          maxWidth: 560,
          height: "100%",
          overflowY: "auto",
          padding: "20px 24px 40px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20, overflowX: "auto" }}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          style={{
            background: "transparent",
            color: active === t.value ? "var(--text)" : "var(--muted)",
            fontWeight: active === t.value ? 600 : 400,
            fontSize: 12,
            padding: "8px 12px",
            borderBottom: active === t.value ? "2px solid var(--gold)" : "2px solid transparent",
            whiteSpace: "nowrap",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
