import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const STATUS_OPTIONS = ["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"];

export default function Employees() {
  const { isHR } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    department_id: "",
    designation: "",
    manager_id: "",
    joining_date: "",
  });

  async function load() {
    try {
      const [emps, depts] = await Promise.all([api.listEmployees(), api.listDepartments()]);
      setEmployees(emps);
      setDepartments(depts);
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
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password || null,
        phone: form.phone || null,
        department_id: form.department_id ? Number(form.department_id) : null,
        designation: form.designation || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        joining_date: form.joining_date || null,
      };
      await api.createEmployee(payload);
      setForm({
        full_name: "",
        email: "",
        password: "",
        phone: "",
        department_id: "",
        designation: "",
        manager_id: "",
        joining_date: "",
      });
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id, employment_status) {
    try {
      await api.updateEmployee(id, { employment_status });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Filing · Personnel Records</span>
          <h1>Employees</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add employee
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {employees.length === 0 ? (
          <div className="empty-state">No employees on file yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.full_name}</td>
                  <td>{emp.email}</td>
                  <td>{deptName(emp.department_id)}</td>
                  <td>{emp.designation || "—"}</td>
                  <td>
                    {isHR ? (
                      <select
                        value={emp.employment_status}
                        onChange={(e) => handleStatusChange(emp.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <span className={`status-dot status-${emp.employment_status.toLowerCase()}`} />
                        {emp.employment_status.replace("_", " ")}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New employee" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Full name</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Password (new login only)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength="8"
                autoComplete="new-password"
              />
              <small className="helper-text">Leave blank to link an existing login account with this email.</small>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Designation</label>
                <input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Joining date</label>
                <input
                  type="date"
                  value={form.joining_date}
                  onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save employee"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
