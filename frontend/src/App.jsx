import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api, setToken, hasToken } from "./api";
import { onEvent } from "./bus";
import Login from "./Login";
import Shell from "./Shell";
import { PanelProvider } from "./panels";
import Overview from "./pages/Overview";
import Projects from "./pages/Projects";
import MyWork from "./pages/MyWork";
import Production from "./pages/Production";
import Finance from "./pages/Finance";
import Team from "./pages/Team";
import Employees from "./pages/Employees";

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

  useEffect(() => onEvent("me-changed", () => {
    api.me().then((r) => setUser(r.user)).catch(() => {});
  }), []);

  if (checking) return null;
  if (!user) return <Login onAuthed={setUser} />;

  const canManage = user.role === "ceo" || user.role === "manager";
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <BrowserRouter>
      <PanelProvider user={user}>
        <Routes>
          <Route path="/" element={<Shell user={user} onLogout={logout} />}>
            <Route index element={<Overview user={user} />} />
            <Route path="projects" element={<Projects user={user} />} />
            <Route path="my-work" element={<MyWork user={user} />} />
            <Route path="production" element={<Production user={user} />} />
            <Route
              path="finance"
              element={canManage ? <Finance /> : <Navigate to="/" replace />}
            />
            <Route path="team" element={<Team user={user} />} />
            <Route path="employees" element={<Employees user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PanelProvider>
    </BrowserRouter>
  );
}
