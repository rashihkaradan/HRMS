import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

export default function Departments() {
  const { isHR } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setDepartments(await api.listDepartments());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createDepartment({ name });
      setName("");
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Filing · Departments</span>
          <h1>Departments</h1>
        </div>
        {isHR && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add department
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {departments.length === 0 ? (
          <div className="empty-state">No departments on file yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}>
                    #{d.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New department" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="dept-name">Department name</label>
              <input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save department"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
