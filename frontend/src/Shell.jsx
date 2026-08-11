import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, FolderKanban, ListChecks, Clapperboard, Wallet, Users, Contact2, LogOut, X } from "lucide-react";
import { ROLE_LABEL } from "./components";
import { api } from "./api";
import { ShellContext } from "./shellContext";
import { usePanels } from "./panels";
import NewProjectModal from "./components/NewProjectModal";

const ALL_NAV = [
  { to: "/", icon: LayoutGrid, label: "Тойм", roles: ["ceo", "manager", "production"] },
  { to: "/projects", icon: FolderKanban, label: "Төслүүд", roles: ["ceo", "manager", "production"] },
  { to: "/my-work", icon: ListChecks, label: "Миний ажил", roles: ["ceo", "manager", "production"] },
  { to: "/production", icon: Clapperboard, label: "Продакшн", roles: ["ceo", "manager", "production"] },
  { to: "/finance", icon: Wallet, label: "Санхүү", roles: ["ceo", "manager"] },
  { to: "/team", icon: Users, label: "Баг", roles: ["ceo", "manager", "production"] },
  { to: "/employees", icon: Contact2, label: "Ажилтнууд", roles: ["ceo", "manager", "production"] },
];

export default function Shell({ user, onLogout }) {
  const nav = ALL_NAV.filter((item) => item.roles.includes(user.role));
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const navigate = useNavigate();
  const { openProject, openEmployee } = usePanels();

  const shellValue = {
    user,
    openSearch: () => setSearchOpen(true),
    openNotifications: () => setNotifOpen(true),
    openNewProject: () => setNewProjectOpen(true),
  };

  return (
    <ShellContext.Provider value={shellValue}>
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex" }} className="text-sm">
        <aside style={{ background: "var(--panel)", borderRight: "1px solid var(--line)", width: 224 }} className="shrink-0 flex-col py-5 px-3 hidden md:flex">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 28 }}>
            <div style={{ background: "var(--gold)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#12141c", fontWeight: 700, fontSize: 12 }} className="plex-mono">
              VP
            </div>
            <div>
              <div style={{ fontWeight: 600, lineHeight: 1.1 }}>Viral Pixel</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>Project Control</div>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                style={({ isActive }) => ({
                  background: isActive ? "var(--panel2)" : "transparent",
                  color: isActive ? "var(--text)" : "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                })}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, padding: "16px 8px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ background: "var(--teal)", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#12141c", fontWeight: 600, fontSize: 11 }}>
              {user.name?.slice(0, 2).toUpperCase() || "ТА"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{ROLE_LABEL[user.role] || user.role}</div>
            </div>
            <button onClick={onLogout} title="Гарах" style={{ background: "transparent", color: "var(--muted)" }}>
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>

      <SearchPopover
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenProject={(id) => { setSearchOpen(false); openProject(id); }}
        onOpenEmployee={(id) => { setSearchOpen(false); openEmployee(id); }}
        onOpenTask={() => { setSearchOpen(false); navigate("/my-work"); }}
      />
      <NotificationsPopover open={notifOpen} onClose={() => setNotifOpen(false)} />
      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </ShellContext.Provider>
  );
}

function SearchPopover({ open, onClose, onOpenProject, onOpenEmployee, onOpenTask }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ projects: [], tasks: [], employees: [] });

  useEffect(() => {
    if (!open) { setQ(""); setResults({ projects: [], tasks: [], employees: [] }); return; }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setResults({ projects: [], tasks: [], employees: [] }); return; }
    const t = setTimeout(() => api.search(q).then(setResults).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", justifyContent: "center", paddingTop: "10vh" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000099" }} />
      <div style={{ position: "relative", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, width: "100%", maxWidth: 480, maxHeight: "60vh", overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Төсөл, ажил, ажилтан хайх..."
            style={{ flex: 1, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }}
          />
          <button onClick={onClose} style={{ background: "transparent" }}><X size={16} color="var(--muted)" /></button>
        </div>

        {results.projects.length === 0 && results.tasks.length === 0 && results.employees.length === 0 && q.trim() && (
          <div style={{ color: "var(--muted)", fontSize: 12, padding: 8 }}>Илэрц алга</div>
        )}

        {results.projects.map((p) => (
          <SearchRow key={`p${p.id}`} label={p.label} sub={p.sub} onClick={() => onOpenProject(p.id)} />
        ))}
        {results.tasks.map((t) => (
          <SearchRow key={`t${t.id}`} label={t.label} sub={t.sub} onClick={() => onOpenTask(t.id)} />
        ))}
        {results.employees.map((e) => (
          <SearchRow key={`e${e.id}`} label={e.label} sub={e.sub} onClick={() => onOpenEmployee(e.id)} />
        ))}
      </div>
    </div>
  );
}

function SearchRow({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 6, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span style={{ color: "var(--muted)" }}>{sub}</span>
    </button>
  );
}

function NotificationsPopover({ open, onClose }) {
  const [data, setData] = useState({ count: 0, items: [] });

  useEffect(() => {
    if (open) api.getNotifications().then(setData).catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 20, right: 20, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, width: 300, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Мэдэгдэл</h3>
          <button onClick={onClose} style={{ background: "transparent" }}><X size={14} color="var(--muted)" /></button>
        </div>
        {data.items.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>Мэдэгдэл алга</div>}
        {data.items.map((n) => (
          <div key={n.id} style={{ fontSize: 12, padding: "8px 0", borderTop: "1px solid var(--line)" }}>{n.text}</div>
        ))}
      </div>
    </div>
  );
}
