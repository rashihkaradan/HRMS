import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CandidateVoiceInterview from "../components/CandidateVoiceInterview";

const SESSION_KEY = "hrms_career_assessment";

export default function Careers() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssessment = location.pathname.endsWith("/assessment");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [assessmentSession, setAssessmentSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [answers, setAnswers] = useState({});
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", skills: "", years_experience: "" });
  const [resume, setResume] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [interviewSession, setInterviewSession] = useState(null);

  useEffect(() => {
    if (!isAssessment || !assessmentSession?.interviewToken) return;
    api.startPublicInterview(assessmentSession.interviewToken)
      .then(setInterviewSession)
      .catch((err) => setError(err.message));
  }, [isAssessment, assessmentSession?.interviewToken]);

  useEffect(() => {
    if (isAssessment) return;
    api.listPublicJobs().then(setJobs).catch((err) => setError(err.message));
  }, [isAssessment]);

  async function beginAssessment(event) {
    event.preventDefault();
    if (!selectedJob) return;
    setLoading(true);
    setError("");
    try {
      const application = new FormData();
      Object.entries({ ...form, job_id: selectedJob.id }).forEach(([key, value]) => {
        if (value !== "") application.append(key, value);
      });
      if (resume) application.append("resume", resume);
      const result = await api.createPublicApplication(application);
      const session = {
        applicationId: result.application_id,
        accessToken: result.access_token,
        jobTitle: result.job_title,
        questions: result.assessment,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setAssessmentSession(session);
      setAnswers({});
      setSelectedJob(null);
      navigate("/careers/assessment");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAssessment(event) {
    event.preventDefault();
    if (!assessmentSession) return;
    setLoading(true);
    setError("");
    try {
      const submission = await api.submitPublicAssessment({
        access_token: assessmentSession.accessToken,
        assessment_answers: assessmentSession.questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id] || "",
        })),
      });
      const updated = { ...assessmentSession, interviewToken: submission.interview_token };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      setAssessmentSession(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <span className="eyebrow">Personnel · Careers</span>
          <h1>{complete ? "Application submitted" : interviewSession ? "Your AI interview" : isAssessment ? "Your assessment" : "Open positions"}</h1>
        </div>
        <Link to="/login">HRMS sign in</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {complete ? (
        <section className="card">
          <h2>Thank you for applying.</h2>
          <p>Your application, assessment, and interview for {assessmentSession?.jobTitle || "this opening"} have been submitted.</p>
          <button className="btn btn-primary" onClick={() => { setComplete(false); setAssessmentSession(null); navigate("/careers"); }}>
            Browse other openings
          </button>
        </section>
      ) : interviewSession ? (
        <CandidateVoiceInterview
          initial={interviewSession}
          interviewToken={assessmentSession.interviewToken}
          onFinish={() => { sessionStorage.removeItem(SESSION_KEY); setComplete(true); }}
        />
      ) : isAssessment && assessmentSession?.interviewToken ? (
        <section className="card"><p>Starting your interview…</p></section>
      ) : isAssessment ? (
        assessmentSession ? (
          <section className="card">
            <p className="helper-text">Application for <strong>{assessmentSession.jobTitle}</strong> started. Complete the assessment below to submit it.</p>
            <form onSubmit={submitAssessment}>
              {assessmentSession.questions.map((question, index) => (
                <div className="field assessment-question" key={question.id}>
                  <label>{index + 1}. {question.category} — {question.prompt}</label>
                  <textarea
                    rows={5}
                    maxLength={10000}
                    required
                    value={answers[question.id] || ""}
                    onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                    placeholder={`Answer in ${question.language || "your preferred language"}`}
                  />
                </div>
              ))}
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Submitting…" : "Submit application and assessment"}
              </button>
            </form>
          </section>
        ) : (
          <section className="card">
            <p>This assessment session is unavailable or expired. Choose an open position and apply again.</p>
            <Link className="btn btn-primary" to="/careers">View open positions</Link>
          </section>
        )
      ) : (
        <>
          <p className="helper-text">Explore our current openings. You can apply directly here, then complete the role-specific assessment.</p>
          {jobs.length === 0 ? (
            <section className="card"><div className="empty-state">No open positions at the moment. Please check back later.</div></section>
          ) : (
            <div className="career-list">
              {jobs.map((job) => (
                <section className="card career-card" key={job.id}>
                  <div>
                    <span className="eyebrow">Now hiring</span>
                    <h2>{job.title}</h2>
                    {job.description && <p>{job.description}</p>}
                    {job.required_skills && <p><strong>Skills:</strong> {job.required_skills}</p>}
                  </div>
                  <button className="btn btn-primary" onClick={() => { setError(""); setSelectedJob(job); }}>
                    Apply for this role
                  </button>
                </section>
              ))}
            </div>
          )}

          {selectedJob && (
            <div className="career-form-wrap">
              <section className="card">
                <div className="page-header">
                  <div><span className="eyebrow">Application</span><h2>{selectedJob.title}</h2></div>
                  <button className="btn btn-ghost" type="button" onClick={() => setSelectedJob(null)}>Cancel</button>
                </div>
                <p className="helper-text">Enter your details to start your application. You’ll go straight to the role assessment next.</p>
                <form onSubmit={beginAssessment}>
                  <div className="field"><label htmlFor="career-name">Full name</label><input id="career-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} minLength={2} maxLength={255} required /></div>
                  <div className="field"><label htmlFor="career-email">Email</label><input id="career-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="field"><label htmlFor="career-phone">Phone (optional)</label><input id="career-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="field"><label htmlFor="career-skills">Relevant skills (optional)</label><input id="career-skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Python, SQL, machine learning" /></div>
                  <div className="field"><label htmlFor="career-experience">Years of experience (optional)</label><input id="career-experience" type="number" min="0" max="80" step="0.5" value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} /></div>
                  <div className="field"><label htmlFor="career-resume">Resume (optional PDF, up to 10 MB)</label><input id="career-resume" type="file" accept="application/pdf,.pdf" onChange={(e) => setResume(e.target.files?.[0] || null)} /></div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Starting application…" : "Apply and continue to assessment"}</button>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
