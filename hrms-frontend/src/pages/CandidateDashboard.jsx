import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STAGES = ["APPLIED", "SCREENING", "RESUME_SHORTLISTED", "HR_SCREENING", "INTERVIEW", "TECHNICAL_INTERVIEW", "MANAGERIAL_INTERVIEW", "FINAL_INTERVIEW", "OFFER", "OFFER_ACCEPTED", "BACKGROUND_VERIFICATION", "HIRED"];
const LABELS = { APPLIED: "Application submitted", SCREENING: "Application under review", RESUME_SHORTLISTED: "Resume shortlisted", HR_SCREENING: "HR screening", INTERVIEW: "Interview", TECHNICAL_INTERVIEW: "Technical interview", MANAGERIAL_INTERVIEW: "Managerial interview", FINAL_INTERVIEW: "Final interview", OFFER: "Offer released", OFFER_ACCEPTED: "Offer accepted", BACKGROUND_VERIFICATION: "Background verification", HIRED: "Hired", REJECTED: "Not selected", ON_HOLD: "On hold", WITHDRAWN: "Withdrawn", OFFER_DECLINED: "Offer declined" };

export default function CandidateDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("applications");
  const [profile, setProfile] = useState(null);
  const [apps, setApps] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobFilters, setJobFilters] = useState({ title: "", department: "", location: "", experience: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  async function refresh() {
    const [p, a, j, i] = await Promise.all([api.candidateProfile(), api.candidateApplications(), api.listPublicJobs(), api.candidateInterviews()]);
    setProfile(p); setApps(a); setJobs(j); setInterviews(i);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);

  async function apply() {
    const details = profile?.profile_data || {};
    if (!profile?.resume_path || !details.location || !details.education || !profile.skills) {
      setTab("profile");
      setError("Complete your profile and upload a resume before applying.");
      setSelectedJob(null);
      return;
    }
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await api.candidateApply(selectedJob.id);
      setMessage(`Application ${result.application_id} submitted for ${result.job_title}.`);
      await refresh(); setTab("applications"); setSelectedJob(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      const profile_data = Object.fromEntries(["location", "education", "experience", "previous_employment", "current_company", "current_salary", "expected_salary", "notice_period", "linkedin", "portfolio"].map(k => [k, data.get(k) || ""]));
      await api.updateCandidateProfile({ full_name: data.get("full_name"), phone: data.get("phone"), skills: data.get("skills"), years_experience: Number(data.get("years_experience")) || null, profile_data });
      setMessage("Profile saved."); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function uploadResume(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = formElement.elements.resume.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try { await api.uploadOwnResume(file); setMessage("Resume uploaded securely."); await refresh(); formElement.reset(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function downloadResume() {
    try { await api.downloadOwnResume(); }
    catch (e) { setError(e.message); }
  }

  const fmt = (value) => value ? new Date(value).toLocaleDateString() : "—";
  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(jobFilters.title.toLowerCase()) &&
    (!jobFilters.department || String(job.department_id || "") === jobFilters.department) &&
    (!jobFilters.location || (job.location || "").toLowerCase().includes(jobFilters.location.toLowerCase())) &&
    (!jobFilters.experience || (job.experience_required || "").toLowerCase().includes(jobFilters.experience.toLowerCase()))
  );
  return <div className="main">
    <header className="page-header"><div><span className="eyebrow">PERSONNEL · CAREER PORTAL</span><h1>Welcome, {user?.full_name?.split(" ")[0]}</h1><p className="helper-text">Your applications and recruitment updates, all in one place.</p></div><div style={{ display: "flex", gap: 12, alignItems: "center" }}><Link to="/careers">Career home</Link><button className="btn btn-ghost" onClick={logout}>Sign out</button></div></header>
    {error && <div className="error-banner">{error}</div>}{message && <div className="success-banner">{message}</div>}
    <nav className="tab-nav" style={{ marginBottom: 20 }}>{[["applications", "My applications"], ["jobs", "Browse jobs"], ["interviews", "Interviews"], ["profile", "My profile"]].map(([id, label]) => <button key={id} className={`btn ${tab === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {tab === "applications" && <div className="career-list">{apps.length ? apps.map(app => {
      const current = STAGES.indexOf(app.stage);
      return <section className="card" key={app.id}>
        <div className="page-header"><div><span className="eyebrow">{app.application_id} · Applied {fmt(app.applied_at)}</span><h2>{app.job_title}</h2></div><span className={`stamp stamp-${app.stage.toLowerCase()}`}>{LABELS[app.stage] || app.stage}</span></div>
        {current < 0 ? <p className="error-banner">This application is {LABELS[app.stage]?.toLowerCase() || app.stage.toLowerCase()}.</p> : <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(110px, 1fr))`, gap: 8, margin: "22px 0", overflowX: "auto" }}>{STAGES.map((stage, i) => <div key={stage} style={{ textAlign: "center", color: stage === app.stage ? "#2563eb" : i < current ? "#16845b" : "#87909f", borderTop: `4px solid ${stage === app.stage ? "#2563eb" : i < current ? "#16845b" : "#d9dee8"}`, paddingTop: 8, fontSize: 12 }}>{LABELS[stage]}{stage === app.stage ? " · Current" : ""}</div>)}</div>}
        <h3>Updates</h3>{app.history.length ? <ul>{app.history.map((item, i) => <li key={i}><strong>{LABELS[item.stage] || item.stage}</strong> · {fmt(item.changed_at)}{item.remarks && <div>{item.remarks}</div>}</li>)}</ul> : <p className="helper-text">No updates yet.</p>}
      </section>;
    }) : <section className="card"><div className="empty-state">No applications yet. Browse current openings when you’re ready.</div><button className="btn btn-primary" onClick={() => setTab("jobs")}>Explore jobs</button></section>}</div>}

    {tab === "interviews" && <div className="career-list">{interviews.length ? interviews.map(item => <section className="card" key={item.id}><span className="eyebrow">{item.round_name} · {item.status}</span><h2>{item.job_title}</h2><p><strong>Date and time:</strong> {new Date(item.scheduled_at).toLocaleString()}</p><p><strong>Mode:</strong> {item.mode}{item.meeting_details ? ` · ${item.meeting_details}` : ""}</p>{item.result && <p><strong>Result:</strong> {item.result}</p>}</section>) : <section className="card"><div className="empty-state">No interviews have been scheduled for your applications.</div></section>}</div>}

    {tab === "jobs" && <>{selectedJob && <section className="card" style={{ marginBottom: 16 }}><span className="eyebrow">APPLICATION REVIEW · JOB-{String(selectedJob.id).padStart(5, "0")}</span><h2>{selectedJob.title}</h2><p>{selectedJob.description}</p><p><strong>Location:</strong> {selectedJob.location || "Not specified"} · <strong>Employment:</strong> {selectedJob.employment_type || "Not specified"} · <strong>Experience:</strong> {selectedJob.experience_required || "Not specified"}</p><p><strong>Skills:</strong> {selectedJob.required_skills || "Not specified"}</p><p><strong>Vacancies:</strong> {selectedJob.vacancies} · <strong>Deadline:</strong> {fmt(selectedJob.application_deadline)}</p><p><strong>Profile:</strong> {profile?.full_name} · {profile?.email} · Resume {profile?.resume_path ? "attached" : "missing"}</p><p className="helper-text">Review your job and profile details. Your application will use your latest saved profile and resume.</p><button className="btn btn-primary" disabled={busy} onClick={apply}>{busy ? "Submitting…" : "Confirm and submit application"}</button> <button className="btn btn-ghost" onClick={() => setSelectedJob(null)}>Cancel</button> <button className="btn btn-ghost" onClick={() => setTab("profile")}>Edit profile</button></section>}<section className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
      <div className="field"><label>Search title</label><input value={jobFilters.title} onChange={e => setJobFilters({ ...jobFilters, title: e.target.value })} placeholder="Job title" /></div>
      <div className="field"><label>Department ID</label><input value={jobFilters.department} onChange={e => setJobFilters({ ...jobFilters, department: e.target.value })} placeholder="Any department" /></div>
      <div className="field"><label>Location</label><input value={jobFilters.location} onChange={e => setJobFilters({ ...jobFilters, location: e.target.value })} placeholder="Any location" /></div>
      <div className="field"><label>Experience</label><input value={jobFilters.experience} onChange={e => setJobFilters({ ...jobFilters, experience: e.target.value })} placeholder="e.g. 3+ years" /></div>
    </section><div className="career-list">{filteredJobs.length ? filteredJobs.map(job => <section className="card career-card" key={job.id}><div><span className="eyebrow">JOB-{String(job.id).padStart(5, "0")} · {job.status}</span><h2>{job.title}</h2><p>{job.description || "Explore this opportunity and apply through your candidate account."}</p><p>{[job.location, job.employment_type, job.experience_required].filter(Boolean).join(" · ")}</p>{job.required_skills && <p><strong>Skills:</strong> {job.required_skills}</p>}{job.responsibilities && <p><strong>Responsibilities:</strong> {job.responsibilities}</p>}{job.education_requirements && <p><strong>Education:</strong> {job.education_requirements}</p>}<p className="helper-text">{job.vacancies} opening{job.vacancies === 1 ? "" : "s"}{job.application_deadline ? ` · Apply by ${fmt(job.application_deadline)}` : ""}</p></div><button className="btn btn-primary" disabled={busy || apps.some(a => a.job_id === job.id)} onClick={() => setSelectedJob(job)}>{apps.some(a => a.job_id === job.id) ? "Applied" : "Apply now"}</button></section>) : <section className="card">No open positions match those filters.</section>}</div></>}

    {tab === "profile" && profile && <><section className="card"><h2>Candidate profile</h2><p className="helper-text">Complete your details to help recruiters review your application.</p><form onSubmit={saveProfile}>
      <div className="field"><label>Full name</label><input name="full_name" required defaultValue={profile.full_name} /></div><div className="field"><label>Email</label><input disabled value={profile.email} /></div><div className="field"><label>Mobile number</label><input name="phone" defaultValue={profile.phone || ""} /></div><div className="field"><label>Current location</label><input name="location" defaultValue={profile.profile_data?.location || ""} /></div><div className="field"><label>Education and qualifications</label><textarea name="education" defaultValue={profile.profile_data?.education || ""} /></div><div className="field"><label>Work experience</label><textarea name="experience" defaultValue={profile.profile_data?.experience || ""} /></div><div className="field"><label>Technical skills</label><textarea name="skills" defaultValue={profile.skills || ""} /></div><div className="field"><label>Previous employment</label><textarea name="previous_employment" defaultValue={profile.profile_data?.previous_employment || ""} /></div><div className="field"><label>Current company</label><input name="current_company" defaultValue={profile.profile_data?.current_company || ""} /></div><div className="field"><label>Current salary (optional)</label><input name="current_salary" defaultValue={profile.profile_data?.current_salary || ""} /></div><div className="field"><label>Expected salary (optional)</label><input name="expected_salary" defaultValue={profile.profile_data?.expected_salary || ""} /></div><div className="field"><label>Notice period</label><input name="notice_period" defaultValue={profile.profile_data?.notice_period || ""} /></div><div className="field"><label>Years of experience</label><input name="years_experience" type="number" min="0" max="80" step="0.5" defaultValue={profile.years_experience || ""} /></div><div className="field"><label>LinkedIn profile</label><input name="linkedin" type="url" defaultValue={profile.profile_data?.linkedin || ""} /></div><div className="field"><label>Portfolio URL</label><input name="portfolio" type="url" defaultValue={profile.profile_data?.portfolio || ""} /></div><button className="btn btn-primary" disabled={busy}>Save profile</button>
    </form></section><section className="card" style={{ marginTop: 16 }}><h2>Resume</h2><p className="helper-text">Upload a PDF, DOC, or DOCX file up to 10 MB.</p><form onSubmit={uploadResume}><div className="field"><label htmlFor="resume">Choose resume file</label><input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" required /></div><button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Upload resume"}</button>{profile.resume_path && <> <button type="button" className="btn btn-ghost" onClick={downloadResume}>Download current resume</button></>}</form></section></>}
  </div>;
}
