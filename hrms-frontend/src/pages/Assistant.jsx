import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

export default function Assistant() {
  const { isHR, canRecruit } = useAuth();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [candidateQuestion, setCandidateQuestion] = useState("");
  const [candidateSearch, setCandidateSearch] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!canRecruit) return;
    api.listJobs().then((openJobs) => setJobs(openJobs.filter((job) => job.status === "OPEN"))).catch((err) => setCandidateError(err.message));
  }, [canRecruit]);

  async function handleCandidateSearch(event) {
    event.preventDefault();
    if (!jobId) return;
    setCandidateLoading(true);
    setCandidateError("");
    setCandidateSearch(null);
    try {
      setCandidateSearch(await api.searchCandidateProfiles({
        job_id: Number(jobId),
        question: candidateQuestion.trim() || "Find applicants whose resume, skills, experience, and assessment evidence best align with this role.",
      }));
    } catch (err) {
      setCandidateError(err.message);
    } finally {
      setCandidateLoading(false);
    }
  }

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setAsking(true);
    setError("");
    try {
      const res = await api.ask(q);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources }]);
    } catch (err) {
      setError(err.message);
      setMessages((m) => m.slice(0, -1));
      setQuestion(q);
    } finally {
      setAsking(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }

  return (
    <div>
      {canRecruit && <section className="card candidate-search-card">
        <div className="page-header">
          <div>
            <span className="eyebrow">Recruiting · Chroma profile search</span>
            <h1>Find applicants for a role</h1>
          </div>
        </div>
        <p className="helper-text">Searches current applicants’ indexed resume text, skills, experience, and assessment answers. Profiles refresh from the HR database when you search.</p>
        {candidateError && <div className="error-banner">{candidateError}</div>}
        <form className="candidate-search-form" onSubmit={handleCandidateSearch}>
          <div className="field">
            <label htmlFor="candidate-role">Open role</label>
            <select id="candidate-role" value={jobId} onChange={(event) => setJobId(event.target.value)} required>
              <option value="">Select an open role</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="candidate-question">What evidence should HR focus on? (optional)</label>
            <input id="candidate-question" value={candidateQuestion} onChange={(event) => setCandidateQuestion(event.target.value)} placeholder="e.g. production SQL and dashboard experience" maxLength={1000} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!jobId || candidateLoading}>
            {candidateLoading ? "Searching profiles…" : "Search candidate resumes"}
          </button>
        </form>
        {candidateSearch && <div className="candidate-search-results" aria-live="polite">
          <h2>{candidateSearch.job_title}</h2>
          <p className="helper-text">{candidateSearch.indexed_profiles} applicant profile(s) are indexed for this role. Chroma retrieved {candidateSearch.retrieved_profiles || 0} relevant profile(s).</p>
          <div className="candidate-review-text">{candidateSearch.answer}</div>
          {candidateSearch.candidates?.map((candidate) => <details className="candidate-resume" key={candidate.application_id}>
            <summary>{candidate.candidate_name} · Application #{candidate.application_id} · Resume evidence</summary>
            <pre>{candidate.resume_text}</pre>
          </details>)}
          <p className="helper-text">Use this as a shortlist aid. Review the complete application and resume before making a hiring decision.</p>
        </div>}
      </section>}
      <div className="page-header">
        <div>
          <span className="eyebrow">Reference · HR Assistant</span>
          <h1>Ask about policy</h1>
        </div>
        {isHR && (
          <button className="btn btn-ghost" onClick={() => setShowUpload(true)}>
            + Upload policy document
          </button>
        )}
      </div>

      <div className="card">
        <p className="helper-text" style={{ marginBottom: 16 }}>
          Answers come only from HR documents that have been uploaded — this won't look up your
          personal leave balance or other employee-specific data.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-window" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-state">
              Ask something like "What is our work-from-home policy?"
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.text}
              {m.sources && m.sources.length > 0 && (
                <div className="sources">Source: {m.sources.join(", ")}</div>
              )}
            </div>
          ))}
          {asking && <div className="chat-msg assistant">Thinking…</div>}
        </div>

        <form className="chat-input-row" onSubmit={handleAsk}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a policy question…"
            disabled={asking}
          />
          <button className="btn btn-primary" type="submit" disabled={asking || !question.trim()}>
            Ask
          </button>
        </form>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}

function UploadModal({ onClose }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      formData.append("file", file);
      const res = await api.uploadPolicyDoc(formData);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Upload HR policy document" onClose={onClose}>
      {result ? (
        <div>
          <p style={{ fontSize: 13.5, marginBottom: 16 }}>
            Ingested <strong>{result.filename}</strong> — {result.chunks_ingested} chunks embedded.
            Saved as <strong>hrms/documents/{result.saved_as}</strong>. It's now searchable from the assistant.
          </p>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleUpload}>
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label>Document title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave Policy" required autoFocus />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="general">General</option>
              <option value="leave">Leave</option>
              <option value="wfh">Work from home</option>
              <option value="benefits">Benefits</option>
              <option value="conduct">Code of conduct</option>
              <option value="recruitment">Recruitment</option>
            </select>
          </div>
          <div className="field">
            <label>PDF file</label>
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting || !file}>
            {submitting ? "Uploading & embedding…" : "Upload"}
          </button>
        </form>
      )}
    </Modal>
  );
}
