const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("sc_token");
}

async function request(path, { method = "GET", body, auth = true, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Алдаа гарлаа");
  }
  return data;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (email, password, name) =>
    request("/api/auth/register", { method: "POST", body: { email, password, name }, auth: false }),
  me: () => request("/api/auth/me"),

  getOverview: () => request("/api/overview"),

  getProjects: (params) => request(`/api/projects${qs(params)}`),
  createProject: (payload) => request("/api/projects", { method: "POST", body: payload }),
  getProject: (id) => request(`/api/projects/${id}`),
  updateProject: (id, payload) => request(`/api/projects/${id}`, { method: "PATCH", body: payload }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: "DELETE" }),
  adjustSpend: (id, delta) => request(`/api/projects/${id}/spend`, { method: "PATCH", body: { delta } }),
  toggleChecklistItem: (projectId, itemId, complete) =>
    request(`/api/projects/${projectId}/checklist/${itemId}`, { method: "PATCH", body: { complete } }),
  remindChecklist: (projectId) => request(`/api/projects/${projectId}/checklist/remind`, { method: "POST" }),
  addDeliverable: (projectId, payload) => request(`/api/projects/${projectId}/deliverables`, { method: "POST", body: payload }),
  updateDeliverable: (id, payload) => request(`/api/deliverables/${id}`, { method: "PATCH", body: payload }),
  deleteDeliverable: (id) => request(`/api/deliverables/${id}`, { method: "DELETE" }),
  addCostItem: (projectId, payload) => request(`/api/projects/${projectId}/cost-items`, { method: "POST", body: payload }),
  addReviewItem: (projectId, payload) => request(`/api/projects/${projectId}/review-items`, { method: "POST", body: payload }),
  setCostReceipt: (id, receiptStatus) => request(`/api/cost-items/${id}/receipt`, { method: "PATCH", body: { receiptStatus } }),
  getProjectFiles: (projectId) => request(`/api/projects/${projectId}/files`),
  uploadProjectFile: (projectId, category, file) => {
    const form = new FormData();
    form.append("category", category);
    form.append("file", file);
    return request(`/api/projects/${projectId}/files`, { method: "POST", body: form, isForm: true });
  },

  getTasks: (params) => request(`/api/tasks${qs(params)}`),
  createTask: (payload) => request("/api/tasks", { method: "POST", body: payload }),
  updateTaskStatus: (id, status) => request(`/api/tasks/${id}/status`, { method: "PATCH", body: { status } }),
  updateTaskStage: (id, stage) => request(`/api/tasks/${id}/stage`, { method: "PATCH", body: { stage } }),
  submitForReview: (id) => request(`/api/tasks/${id}/submit-for-review`, { method: "POST" }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),

  getDecisions: (status) => request(`/api/decisions${qs({ status })}`),
  approveDecision: (id) => request(`/api/decisions/${id}/approve`, { method: "POST" }),
  rejectDecision: (id) => request(`/api/decisions/${id}/reject`, { method: "POST" }),
  overrideDecision: (id) => request(`/api/decisions/${id}/override`, { method: "POST" }),

  getBlockers: () => request("/api/blockers"),
  resolveBlocker: (id) => request(`/api/blockers/${id}/resolve`, { method: "POST" }),

  createPaymentRequest: (payload) => request("/api/payment-requests", { method: "POST", body: payload }),
  getMyPaymentRequests: () => request("/api/payment-requests/mine"),
  getPaymentRequests: (status) => request(`/api/payment-requests${qs({ status })}`),
  payPaymentRequest: (id) => request(`/api/payment-requests/${id}/pay`, { method: "POST" }),

  getFinanceSummary: () => request("/api/finance/summary"),
  getFinanceProjects: () => request("/api/finance/projects"),
  getUndocumentedExpenses: () => request("/api/finance/undocumented"),

  getTeam: () => request("/api/team"),

  getEmployees: (params) => request(`/api/employees${qs(params)}`),
  createEmployee: (payload) => request("/api/employees", { method: "POST", body: payload }),
  getEmployee: (id) => request(`/api/employees/${id}`),
  updateEmployee: (id, payload) => request(`/api/employees/${id}`, { method: "PATCH", body: payload }),
  deleteEmployee: (id) => request(`/api/employees/${id}`, { method: "DELETE" }),
  setEmployeeBirthday: (id, month, day) => request(`/api/employees/${id}/birthday`, { method: "POST", body: { month, day } }),
  planEmployeeLeave: (id) => request(`/api/employees/${id}/leave/plan`, { method: "POST" }),
  registerLeave: (id, payload) => request(`/api/employees/${id}/leave`, { method: "POST", body: payload }),
  addContract: (id, payload) => request(`/api/employees/${id}/contracts`, { method: "POST", body: payload }),
  getEmployeeFiles: (id) => request(`/api/employees/${id}/files`),
  uploadEmployeeFile: (id, category, file) => {
    const form = new FormData();
    form.append("category", category);
    form.append("file", file);
    return request(`/api/employees/${id}/files`, { method: "POST", body: form, isForm: true });
  },

  getDeadlines: () => request("/api/deadlines"),
  search: (q) => request(`/api/search${qs({ q })}`),
  getNotifications: () => request("/api/notifications"),
};

export function setToken(token) {
  if (token) localStorage.setItem("sc_token", token);
  else localStorage.removeItem("sc_token");
}
export function hasToken() {
  return !!getToken();
}
