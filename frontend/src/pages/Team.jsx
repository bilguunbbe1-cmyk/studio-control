import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { usePanels } from "../panels";
import { onEvent } from "../bus";
import { ErrorBanner, EmptyState, Avatar } from "../components";
import PageHeader from "../components/PageHeader";

export default function Team() {
  const [team, setTeam] = useState([]);
  const [error, setError] = useState("");
  const { openEmployee } = usePanels();

  const load = useCallback(async () => {
    try {
      setTeam(await api.getTeam());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onEvent("employees-changed", load), [load]);

  return (
    <div>
      <PageHeader title="Баг" subtitle="2026 оны 8-р сар" />
      <div style={{ marginTop: -12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Багийн ачаалал</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Идэвхтэй ажлын тоогоор автоматаар тооцоолсон.</p>
      </div>

      <ErrorBanner message={error} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {team.map((m) => (
          <button key={m.id} onClick={() => openEmployee(m.id)} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={m.name} photoUrl={m.photoUrl} size={34} />
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>{m.title}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }} className="plex-mono">{m.workloadPct}%</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>Ачаалал</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11 }}>{m.activeTasksCount} идэвхтэй ажил</div>
                <div style={{ fontSize: 11, color: m.overdueCount > 0 ? "var(--rust)" : "var(--teal)", fontWeight: 600 }}>
                  {m.overdueCount > 0 ? `${m.overdueCount} хоцорсон` : "Хэвийн"}
                </div>
              </div>
            </div>
          </button>
        ))}
        {team.length === 0 && <EmptyState>Мэдээлэл алга</EmptyState>}
      </div>
    </div>
  );
}
