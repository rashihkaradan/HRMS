import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const STAGES = ["APPLIED", "SCREENING", "RESUME_SHORTLISTED", "HR_SCREENING", "TECHNICAL_INTERVIEW", "MANAGERIAL_INTERVIEW", "FINAL_INTERVIEW", "OFFER", "OFFER_ACCEPTED", "BACKGROUND_VERIFICATION", "HIRED", "ON_HOLD", "OFFER_DECLINED", "WITHDRAWN", "REJECTED"];

export default function Applications() {
  const { canRecruit } = useAuth();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState([]);
  const [form, setForm] = useState({ job_id: "", candidate_id: "", notes: "" });
  const [answers, setAnswers] = useState({});
  const [reviewJobId, setReviewJobId] = useState("");
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [updatingStages, setUpdatingStages] = useState({});
  const [interviewReview, setInterviewReview] = useState(null);
  const [loadingInterviewReview, setLoadingInterviewReview] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [candidateRemarks, setCandidateRemarks] = useState({});
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ scheduled_at: "", round_name: "Technical interview", mode: "ONLINE", meeting_details: "" });

  async function load() {
    try {
      const [apps, j, c, summary] = await Promise.all([
        api.listApplications(),
        api.listJobs(),
        api.listCandidates(),
        api.recruitmentAnalytics(),
      ]);
      setApplications(apps);
      setJobs(j);
      setCandidates(c);
      setAnalytics(summary);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (canRecruit) load();
  }, [canRecruit]);

  function jobTitle(id) {
    return jobs.find((j) => j.id === id)?.title || `Job #${id}`;
  }
  function candidateName(id) {
    return candidates.find((c) => c.id === id)?.full_name || `Candidate #${id}`;
  }

  async function openApplicationModal() {
    setError("");
    try {
      setAssessment([]);
      setAnswers({});
      setShowModal(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJobChange(jobId) {
    setForm({ ...form, job_id: jobId });
    setAssessment([]);
    setAnswers({});
    if (!jobId) return;
    try {
      setAssessment(await api.getAssessment(jobId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createApplication({
        job_id: Number(form.job_id),
        candidate_id: Number(form.candidate_id),
        notes: form.notes || null,
        assessment_answers: assessment.map((question) => ({
          question_id: question.id,
          answer: answers[question.id] || "",
        })),
      });
      setForm({ job_id: "", candidate_id: "", notes: "" });
      setAnswers({});
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStageChange(id, stage) {
    const previous = applications.find((application) => application.id === id)?.stage;
    if (!previous || previous === stage) return;
    setError("");
    setApplications((current) => current.map((application) => application.id === id ? { ...application, stage } : application));
    setUpdatingStages((current) => ({ ...current, [id]: true }));
    try {
      await api.updateApplicationStage(id, { stage, candidate_remarks: candidateRemarks[id] || null });
      setCandidateRemarks((current) => ({ ...current, [id]: "" }));
    } catch (err) {
      setApplications((current) => current.map((application) => application.id === id ? { ...application, stage: previous } : application));
      setError(err.message);
    } finally {
      setUpdatingStages((current) => ({ ...current, [id]: false }));
    }
  }

  async function publishCandidateRemark(application) {
    const candidate_remarks = (candidateRemarks[application.id] || "").trim();
    if (!candidate_remarks) return;
    setError("");
    try {
      await api.updateApplicationStage(application.id, { stage: application.stage, candidate_remarks });
      setCandidateRemarks((current) => ({ ...current, [application.id]: "" }));
    } catch (err) { setError(err.message); }
  }

  async function submitInterviewSchedule(event) {
    event.preventDefault();
    try {
      await api.scheduleInterview(scheduleTarget.id, { ...scheduleForm, scheduled_at: new Date(scheduleForm.scheduled_at).toISOString() });
      setScheduleTarget(null);
      setScheduleForm({ scheduled_at: "", round_name: "Technical interview", mode: "ONLINE", meeting_details: "" });
    } catch (err) { setError(err.message); }
  }

  async function handleCandidateReview() {
    if (!reviewJobId) return;
    setReviewing(true);
    setReview(null);
    setError("");
    try {
      setReview(await api.candidateFitReport(Number(reviewJobId)));
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  }

  async function handleReviewInterview(application) {
    setError("");
    setLoadingInterviewReview(true);
    try {
      const result = await api.getInterviewEvaluation(application.id);
      setInterviewReview({ candidate: candidateName(application.candidate_id), job: jobTitle(application.job_id), result });
    }
    catch (err) { setError(err.message); }
    finally { setLoadingInterviewReview(false); }
  }

  if (!canRecruit) {
    return (
      <div className="card">
        <p>Applications are visible to recruiting roles only.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Pipeline · Applications</span>
          <h1>Applications</h1>
        </div>
        <button className="btn btn-primary" onClick={openApplicationModal}>
          + Log application
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {analytics && <section className="card" style={{ marginBottom: 18 }}><h2 className="section-title">Recruitment snapshot</h2><div className="stat-grid">
        {[["Applications", analytics.total_applications], ["Under review", analytics.under_review], ["Interviews", analytics.shortlisted], ["Offers", analytics.offers_released], ["Hired", analytics.hired], ["Rejected", analytics.rejected]].map(([label, value]) => <div className="stat-card" key={label}><div className="num">{value}</div><div className="label">{label}</div></div>)}
      </div></section>}

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="section-title">AI candidate evidence review</h2>
        <p className="helper-text">Compare each applicant’s assessment marks and job-related evidence with the role requirements. HR makes all hiring decisions.</p>
        <div className="chat-input-row">
          <select value={reviewJobId} onChange={(e) => setReviewJobId(e.target.value)} aria-label="Role to review">
            <option value="">Choose a job opening</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button className="btn btn-primary" type="button" onClick={handleCandidateReview} disabled={!reviewJobId || reviewing}>
            {reviewing ? "Reviewing records…" : "Review applicants"}
          </button>
        </div>
        {review && <div className="candidate-review" aria-live="polite">
          <h3>{review.job_title} · {review.applicant_count} applicant{review.applicant_count === 1 ? "" : "s"}</h3>
          <p className="helper-text">AI generated from the current database records. Verify each cited detail against the application.</p>
          {review.applicants?.length > 0 && <p className="helper-text">Reference: {review.applicants.map((person) => `Application #${person.application_id} — ${person.candidate_name}`).join(" · ")}</p>}
          <div className="candidate-review-text">{review.analysis}</div>
        </div>}
      </section>

      {applications.length === 0 ? (
        <div className="card">
          <div className="empty-state">No applications logged yet.</div>
        </div>
      ) : (
        <div className="kanban">
          {STAGES.map((stage) => (
            <div className="kanban-col" key={stage}>
              <h3>{stage.replace("_", " ")} · {applications.filter((a) => a.stage === stage).length}</h3>
              {applications
                .filter((a) => a.stage === stage)
                .sort((a, b) => (b.match_percentage ?? -1) - (a.match_percentage ?? -1))
                .map((a) => (
                  <div className="kanban-card" key={a.id}>
                    <div className="name">{candidateName(a.candidate_id)}</div>
                    <div style={{ color: "var(--ink-soft)" }}>{jobTitle(a.job_id)}</div>
                    <div className="helper-text" title={a.match_basis || "No match evidence available"}>
                      Match: <strong>{a.match_percentage == null ? "Not enough evidence" : `${a.match_percentage}%`}</strong>
                      {a.match_basis && <span> · {a.match_basis}</span>}
                    </div>
                    {a.assessment_submitted_at && <div className="helper-text">
                      {a.assessment_result
                        ? <button className="btn btn-ghost" type="button" onClick={() => setSelectedResult({ name: candidateName(a.candidate_id), job: jobTitle(a.job_id), jobId: a.job_id, result: a.assessment_result })}>
                            Marks: {a.assessment_result.total_score}/{a.assessment_result.max_score} · View feedback
                          </button>
                        : "Assessment submitted · scoring unavailable"}
                    </div>}
                    <div className="application-interview">
                      <button className="btn btn-ghost" type="button" onClick={() => setScheduleTarget({ id: a.id, candidate: candidateName(a.candidate_id), job: jobTitle(a.job_id) })}>Schedule interview</button>
                      {!a.assessment_submitted_at ? <span className="helper-text">Interview starts after the candidate submits the assessment</span>
                        : a.interview_session?.status === "completed" ? <button className="btn btn-ghost" type="button" disabled={loadingInterviewReview} onClick={() => handleReviewInterview(a)}>{loadingInterviewReview ? "Loading review…" : "View interview review"}</button>
                        : <span className="helper-text">Candidate interview {a.interview_session?.status === "in_progress" ? "in progress" : "starting after assessment"}</span>}
                    </div>
                    <select value={a.stage} disabled={updatingStages[a.id]} aria-label={`Stage for ${candidateName(a.candidate_id)}`} onChange={(e) => handleStageChange(a.id, e.target.value)}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="field" style={{ marginTop: 8 }}><label htmlFor={`candidate-remark-${a.id}`}>Candidate-visible update</label><textarea id={`candidate-remark-${a.id}`} rows={2} maxLength={2000} value={candidateRemarks[a.id] || ""} onChange={(e) => setCandidateRemarks((current) => ({ ...current, [a.id]: e.target.value }))} placeholder="Share a candidate-friendly update" /><button className="btn btn-ghost" type="button" onClick={() => publishCandidateRemark(a)}>Publish update</button></div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Log new application" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Job opening</label>
              <select value={form.job_id} onChange={(e) => handleJobChange(e.target.value)} required>
                <option value="">Select a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Candidate</label>
              <select value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} required>
                <option value="">Select a candidate…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes (optional)</label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="divider" />
            <h2 className="section-title">{form.job_id ? `${jobTitle(Number(form.job_id))} assessment` : "Application assessment"}</h2>
            <p className="helper-text">Select a job opening to load its role-specific assessment. Complete every question before saving.</p>
            {assessment.map((question, index) => (
              <div className="field assessment-question" key={question.id}>
                <label>{index + 1}. {question.category} — {question.prompt}</label>
                <textarea
                  rows={6}
                  value={answers[question.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  placeholder={`Answer in ${question.language || "your preferred language"}`}
                  required
                />
              </div>
            ))}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Log application"}
            </button>
          </form>
        </Modal>
      )}

      {scheduleTarget && <Modal title={`Schedule interview · ${scheduleTarget.candidate}`} onClose={() => setScheduleTarget(null)}><p className="helper-text">{scheduleTarget.job}</p><form onSubmit={submitInterviewSchedule}>
        <div className="field"><label>Interview date and time</label><input type="datetime-local" required value={scheduleForm.scheduled_at} onChange={e => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })} /></div>
        <div className="field"><label>Interview round</label><select value={scheduleForm.round_name} onChange={e => setScheduleForm({ ...scheduleForm, round_name: e.target.value })}>{["HR screening", "Technical interview", "Managerial interview", "Final interview"].map(round => <option key={round}>{round}</option>)}</select></div>
        <div className="field"><label>Interview mode</label><select value={scheduleForm.mode} onChange={e => setScheduleForm({ ...scheduleForm, mode: e.target.value })}><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option></select></div>
        <div className="field"><label>Meeting link or interview location</label><input value={scheduleForm.meeting_details} onChange={e => setScheduleForm({ ...scheduleForm, meeting_details: e.target.value })} /></div>
        <button className="btn btn-primary" type="submit">Schedule interview</button>
      </form></Modal>}

      {selectedResult && <Modal title={`${selectedResult.name} · ${selectedResult.job} assessment`} onClose={() => setSelectedResult(null)}>
        <h2 className="section-title">{selectedResult.result.total_score}/{selectedResult.result.max_score}</h2>
        <p>{selectedResult.result.summary}</p>
        {selectedResult.result.answers?.map((item) => {
          const question = jobs.find((j) => j.id === selectedResult.jobId)?.assessment_questions?.find((q) => q.id === item.question_id);
          return <div className="field" key={item.question_id}>
            <strong>{item.category} · {item.score}/{item.max_score}</strong>
            {question && <p>{question.prompt}</p>}
            <p>{item.feedback}</p>
          </div>;
        })}
      </Modal>}
      {interviewReview && <Modal title={`${interviewReview.candidate} · ${interviewReview.job} interview review`} className="modal-wide" onClose={() => setInterviewReview(null)}>
        <p>{interviewReview.result.rubric}</p>
        {interviewReview.result.responses.map((item, index) => <article className="field" key={index}>
          <strong>{index + 1}. {item.question}</strong>
          <p><b>Candidate response:</b> {item.answer}</p>
          <p><b>Skill assessed:</b> {item.skills_assessed.join(", ")}</p>
          <p><b>Evidence:</b> {item.evidence}</p>
          <p><b>Score:</b> Pending human review</p>
          <p><b>Review note:</b> {item.missing_information}</p>
        </article>)}
      </Modal>}
    </div>
  );
}
