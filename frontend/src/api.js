const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("sc_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Алдаа гарлаа");
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (email, password, name) =>
    request("/api/auth/register", { method: "POST", body: { email, password, name }, auth: false }),
  me: () => request("/api/auth/me"),

  getProjects: () => request("/api/projects"),
  createProject: (payload) => request("/api/projects", { method: "POST", body: payload }),
  adjustSpend: (id, delta) => request(`/api/projects/${id}/spend`, { method: "PATCH", body: { delta } }),

  getApprovals: () => request("/api/approvals"),
  decideApproval: (id, decision) =>
    request(`/api/approvals/${id}/decide`, { method: "POST", body: { decision } }),

  getDeadlines: () => request("/api/deadlines"),
  getSummary: () => request("/api/summary"),
};

export function setToken(token) {
  if (token) localStorage.setItem("sc_token", token);
  else localStorage.removeItem("sc_token");
}
export function hasToken() {
  return !!getToken();
}
