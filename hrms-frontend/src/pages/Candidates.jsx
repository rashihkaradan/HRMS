import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

export default function Candidates() {
  const { canRecruit } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    skills: "",
    years_experience: "",
  });

  async function load() {
    try {
      setCandidates(await api.listCandidates());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (canRecruit) load();
  }, [canRecruit]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createCandidate({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        skills: form.skills || null,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
      });
      setForm({ full_name: "", email: "", phone: "", skills: "", years_experience: "" });
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResumeUpload(candidateId, file) {
    if (!file) return;
    setError("");
    try {
      await api.uploadCandidateResume(candidateId, file);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!canRecruit) {
    return (
      <div className="card">
        <p>Candidate records are visible to recruiting roles only.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Pipeline · Candidates</span>
          <h1>Candidates</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add candidate
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {candidates.length === 0 ? (
          <div className="empty-state">No candidates on file yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Skills</th>
                <th>Experience</th>
                <th>Resume</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>{c.email}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{c.skills || "—"}</td>
                  <td>{c.years_experience != null ? `${c.years_experience} yrs` : "—"}</td>
                  <td><label className="btn btn-ghost resume-upload-label">{c.resume_path ? "Replace PDF" : "Upload PDF"}<input type="file" accept="application/pdf,.pdf" onChange={(e) => { handleResumeUpload(c.id, e.target.files?.[0]); e.target.value = ""; }} /></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New candidate" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required autoFocus />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Years of experience</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.years_experience}
                  onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Skills (comma-separated)</label>
              <input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="Python, FastAPI, React"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save candidate"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
