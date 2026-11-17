import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CandidateAccess() {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "", terms_accepted: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (register) {
        if (form.password !== form.confirm) throw new Error("Passwords do not match");
        const result = await api.registerCandidate(form);
        localStorage.setItem("hrms_token", result.access_token);
        await refreshUser();
      } else {
        const user = await login(form.email, form.password);
        if (user.role !== "CANDIDATE") throw new Error("Use the HR sign-in page for staff accounts");
      }
      navigate("/candidate", { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="login-screen"><div className="login-card">
    <span className="mark">Personnel Careers</span>
    <span className="sub">{register ? "Create your candidate account" : "Sign in to track your applications"}</span>
    <p className="helper-text"><Link to="/careers">Browse open positions</Link> · <Link to="/login">HR sign in</Link></p>
    {error && <div className="error-banner">{error}</div>}
    <form onSubmit={submit}>
      {register && <>
        <div className="field"><label>Full name</label><input required minLength={2} maxLength={255} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="field"><label>Mobile number</label><input required type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      </>}
      <div className="field"><label>Email address</label><input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <div className="field"><label>Password</label><input required minLength={10} type="password" autoComplete={register ? "new-password" : "current-password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
      {register && <>
        <div className="field"><label>Confirm password</label><input required minLength={10} type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></div>
        <label className="helper-text" style={{ display: "flex", gap: 8, marginBottom: 16 }}><input type="checkbox" checked={form.terms_accepted} onChange={e => setForm({ ...form, terms_accepted: e.target.checked })} required /> I accept the terms and conditions and privacy notice.</label>
      </>}
      <button className="btn btn-primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
    </form>
    <p className="helper-text" style={{ marginTop: 18 }}>{register ? "Already registered?" : "New to Personnel Careers?"} <button className="btn btn-ghost" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Sign in" : "Create an account"}</button></p>
    {register && <p className="helper-text">Email delivery is not configured on this deployment. Account verification and password reset links require an SMTP service.</p>}
  </div></div>;
}
