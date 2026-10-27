const BASE_URL = "/api";

function getToken() {
  return localStorage.getItem("hrms_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = data?.detail
      ? typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail)
      : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  // ---- Auth ----
  async login(email, password) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "Login failed");
    return data;
  },
  me: () => request("/auth/me"),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),

  // ---- Departments ----
  listDepartments: () => request("/departments/"),
  createDepartment: (payload) => request("/departments/", { method: "POST", body: payload }),

  // ---- Employees ----
  myProfile: () => request("/employees/me"),
  updateMyProfile: (payload) => request("/employees/me", { method: "PATCH", body: payload }),
  listEmployees: (departmentId) =>
    request(`/employees/${departmentId ? `?department_id=${departmentId}` : ""}`),
  createEmployee: (payload) => request("/employees/", { method: "POST", body: payload }),
  updateEmployee: (id, payload) => request(`/employees/${id}`, { method: "PATCH", body: payload }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: "DELETE" }),

  // ---- Recruitment ----
  listJobs: () => request("/recruitment/jobs"),
  listPublicJobs: () => request("/recruitment/careers/jobs"),
  createPublicApplication: (formData) => request("/recruitment/careers/applications", { method: "POST", body: formData, isForm: true }),
  submitPublicAssessment: (payload) => request("/recruitment/careers/assessment", { method: "POST", body: payload }),
  startPublicInterview: (interviewToken) => request("/recruitment/careers/interview/start", { method: "POST", body: { interview_token: interviewToken } }),
  answerPublicInterview: (interviewToken, answer) => request("/recruitment/careers/interview/answer", { method: "POST", body: { interview_token: interviewToken, answer } }),
  transcribePublicInterview: (interviewToken, audioBlob) => {
    const form = new FormData();
    form.append("interview_token", interviewToken);
    form.append("audio", audioBlob, audioBlob.type.includes("mp4") ? "response.mp4" : "response.webm");
    return request("/recruitment/careers/interview/transcribe", { method: "POST", body: form, isForm: true });
  },
  createJob: (payload) => request("/recruitment/jobs", { method: "POST", body: payload }),
  updateJobInterviewConfig: (id, payload) => request(`/recruitment/jobs/${id}/interview-config`, { method: "PATCH", body: payload }),
  listCandidates: () => request("/recruitment/candidates"),
  createCandidate: (payload) => request("/recruitment/candidates", { method: "POST", body: payload }),
  uploadCandidateResume: (candidateId, resume) => {
    const formData = new FormData();
    formData.append("resume", resume);
    return request(`/recruitment/candidates/${candidateId}/resume`, { method: "POST", body: formData, isForm: true });
  },
  listApplications: (jobId) =>
    request(`/recruitment/applications${jobId ? `?job_id=${jobId}` : ""}`),
  candidateFitReport: (jobId) => request(`/recruitment/jobs/${jobId}/candidate-fit`, { method: "POST" }),
  searchCandidateProfiles: (payload) => request("/assistant/candidates/search", { method: "POST", body: payload }),
  getAssessment: (jobId) => request(`/recruitment/assessment?job_id=${jobId}`),
  createApplication: (payload) => request("/recruitment/applications", { method: "POST", body: payload }),
  updateApplicationStage: (id, payload) =>
    request(`/recruitment/applications/${id}/stage`, { method: "PATCH", body: payload }),
  getInterviewEvaluation: (id) => request(`/interviews/${id}/evaluation`),

  // ---- Assistant (RAG) ----
  ask: (question) => request("/assistant/ask", { method: "POST", body: { question } }),
  uploadPolicyDoc: (formData) => request("/assistant/upload", { method: "POST", body: formData, isForm: true }),
};
