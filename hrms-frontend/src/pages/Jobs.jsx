import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

export default function Jobs() {
  const { canRecruit } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingInterviewId, setEditingInterviewId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department_id: "",
    description: "",
    required_skills: "",
    interview_duration: 20,
    interview_language: "en-US",
    interview_plan_text: "",
  });

  async function load() {
    try {
      const [j, d] = await Promise.all([api.listJobs(), api.listDepartments()]);
      setJobs(j);
      setDepartments(d);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function deptName(id) {
    return departments.find((d) => d.id === id)?.name || "—";
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const interviewConfig = {
        interview_duration: Number(form.interview_duration),
        interview_language: form.interview_language,
        interview_question_plan: form.interview_plan_text.split("\n").map((q) => q.trim()).filter(Boolean).map((prompt, index) => ({ id: `interview-${index + 1}`, category: "Role interview", skill: "Role requirements", prompt })),
      };
      if (editingInterviewId) await api.updateJobInterviewConfig(editingInterviewId, interviewConfig);
      else await api.createJob({
        title: form.title,
        department_id: form.department_id ? Number(form.department_id) : null,
        description: form.description || null,
        required_skills: form.required_skills || null,
        ...interviewConfig,
      });
      setForm({ title: "", department_id: "", description: "", required_skills: "", interview_duration: 20, interview_language: "en-US", interview_plan_text: "" });
      setShowModal(false);
      setEditingInterviewId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function configureInterview(job) {
    setEditingInterviewId(job.id);
    setForm({
      title: job.title, department_id: String(job.department_id || ""),
      description: job.description || "", required_skills: job.required_skills || "",
      interview_duration: job.interview_duration || 20,
      interview_language: job.interview_language || "en-US",
      interview_plan_text: (job.interview_question_plan || []).map((item) => item.prompt).join("\n"),
    });
    setShowModal(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Pipeline · Requisitions</span>
          <h1>Job Openings</h1>
        </div>
        {canRecruit && (
          <button className="btn btn-primary" onClick={() => { setEditingInterviewId(null); setForm({ title: "", department_id: "", description: "", required_skills: "", interview_duration: 20, interview_language: "en-US", interview_plan_text: "" }); setShowModal(true); }}>
            + New opening
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {jobs.length === 0 ? (
          <div className="empty-state">No job openings posted yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Department</th>
                <th>Required skills</th>
                <th>Assessment</th>
                <th>Interview</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.title}</td>
                  <td>{deptName(j.department_id)}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{j.required_skills || "—"}</td>
                  <td>{j.assessment_questions?.length || 0} role-specific questions</td>
                  <td>{j.interview_question_plan?.length || 0} questions · {j.interview_duration || 20} min</td>
                  <td>
                    <span className={`stamp stamp-${j.status === "OPEN" ? "screening" : j.status === "CLOSED" ? "rejected" : "applied"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td>{canRecruit && <button type="button" className="btn btn-ghost" onClick={() => configureInterview(j)}>Configure interview</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editingInterviewId ? "Configure interview plan" : "New job opening"} onClose={() => { setShowModal(false); setEditingInterviewId(null); }}>
          <form onSubmit={handleCreate}>
            {!editingInterviewId && <><div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
            </div>
            <div className="field">
              <label>Department</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Required skills (comma-separated)</label>
              <input
                value={form.required_skills}
                onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
                placeholder="Python, FastAPI, PostgreSQL"
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div></>}
            <div className="field">
              <label>Interview plan (one approved question per line)</label>
              <textarea rows={5} value={form.interview_plan_text} onChange={(e) => setForm({ ...form, interview_plan_text: e.target.value })} placeholder="Optional: one question per line. Without a custom plan, questions use the role's posted skills and description." />
              <span className="helper-text">Custom questions are optional. The candidate can begin the interview immediately after submitting the assessment.</span>
            </div>
            <div className="field">
              <label>Interview duration (minutes)</label>
              <input type="number" min="5" max="120" value={form.interview_duration} onChange={(e) => setForm({ ...form, interview_duration: e.target.value })} required />
            </div>
            <div className="field">
              <label>Interview language</label>
              <select value={form.interview_language} onChange={(e) => setForm({ ...form, interview_language: e.target.value })}>
                <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="fr-FR">French</option><option value="es-ES">Spanish</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingInterviewId ? "Save interview plan" : "Post opening"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
