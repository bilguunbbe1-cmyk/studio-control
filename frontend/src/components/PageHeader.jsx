import { Search, Bell, Plus } from "lucide-react";
import { useShellActions } from "../shellContext";

export default function PageHeader({ title, subtitle }) {
  const { user, openSearch, openNotifications, openNewProject } = useShellActions();
  const canManage = user?.role === "ceo" || user?.role === "manager";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconBtn onClick={openSearch} title="Хайх">
          <Search size={15} />
        </IconBtn>
        <IconBtn onClick={openNotifications} title="Мэдэгдэл">
          <Bell size={15} />
        </IconBtn>
        {canManage && (
          <button
            onClick={openNewProject}
            style={{ background: "var(--gold)", color: "#ffffff", display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}
          >
            <Plus size={14} /> Шинэ төсөл
          </button>
        )}
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--muted)", width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </button>
  );
}
