import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function MyProfile() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", current_password: "", new_password: "" });

  useEffect(() => {
    async function load() {
      try {
        const data = await api.myProfile();
        setProfile(data);
        setForm((current) => ({ ...current, full_name: data.full_name, email: data.email, phone: data.phone || "" }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const data = await api.updateMyProfile({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        ...(form.new_password ? { current_password: form.current_password, new_password: form.new_password } : {}),
      });
      setProfile(data);
      setForm((current) => ({ ...current, current_password: "", new_password: "" }));
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <span className="eyebrow">Personnel · My Record</span>
            <h1>My Profile</h1>
          </div>
        </div>
        <div className="card">Loading…</div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div>
        <div className="page-header">
          <div>
            <span className="eyebrow">Personnel · My Record</span>
            <h1>My Profile</h1>
          </div>
        </div>
        <div className="error-banner">{error}</div>
        <div className="card">
          <p>Your user account is not linked to an employee record yet. Please contact HR.</p>
        </div>
      </div>
    );
  }

  const fields = [
    { label: "Full Name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone || "—" },
    { label: "Designation", value: profile.designation || "—" },
    { label: "Joining Date", value: profile.joining_date || "—" },
    { label: "Status", value: profile.employment_status?.replace("_", " ") || "—" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Personnel · My Record</span>
          <h1>My Profile</h1>
        </div>
      </div>

      <div className="card">
        <table>
          <tbody>
            {fields.map((f) => (
              <tr key={f.label}>
                <td style={{ fontWeight: 600, padding: "10px 24px 10px 0", color: "var(--ink-soft, #64748b)" }}>
                  {f.label}
                </td>
                <td style={{ padding: "10px 0" }}>{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Edit my details</h2>
        {saved && <div className="success-banner">Your profile has been updated.</div>}
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <h3 style={{ fontSize: 17, margin: "22px 0 14px" }}>Change password</h3>
          <div className="form-row">
            <div className="field">
              <label>Current password</label>
              <input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} autoComplete="current-password" />
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} minLength="8" autoComplete="new-password" />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
