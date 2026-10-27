import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const HR_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER"];
const RECRUIT_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "RECRUITER", "HR_MANAGER"];
const CAN_VIEW_EMPLOYEES = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "MANAGER"];

export default function Dashboard() {
  const { user, canRecruit } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  const userRole = user?.role;
  const isHR = HR_ROLES.includes(userRole);
  const canViewEmployees = CAN_VIEW_EMPLOYEES.includes(userRole);
  const canViewRecruitment = RECRUIT_ROLES.includes(userRole);

  useEffect(() => {
    async function load() {
      try {
        // Only fetch data the user's role is allowed to see
        const employeesPromise = canViewEmployees ? api.listEmployees() : Promise.resolve([]);
        const jobsPromise = canViewRecruitment ? api.listJobs() : Promise.resolve([]);
        const appsPromise = canRecruit ? api.listApplications() : Promise.resolve([]);

        const [employees, jobs, applications] = await Promise.all([
          employeesPromise,
          jobsPromise,
          appsPromise,
        ]);

        const openJobs = jobs.filter((j) => j.status === "OPEN").length;
        const activeEmployees = employees.filter((e) => e.employment_status === "ACTIVE").length;
        const inPipeline = applications.filter((a) => !["HIRED", "REJECTED"].includes(a.stage)).length;

        setStats({
          totalEmployees: employees.length,
          activeEmployees,
          openJobs,
          inPipeline,
        });
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [canRecruit, canViewEmployees, canViewRecruitment]);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Record 001 · Overview</span>
          <h1>Good to see you, {user?.full_name?.split(" ")[0]}</h1>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Simplified dashboard for EMPLOYEE role */}
      {userRole === "EMPLOYEE" && (
        <div className="card">
          <div className="section-title">Your Quick Links</div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            Welcome! You can view your personal details on the{" "}
            <Link to="/my-profile" style={{ color: "var(--accent, #2563eb)", fontWeight: 600 }}>
              My Profile
            </Link>{" "}
            page.
          </p>
        </div>
      )}

      {/* Full stat cards for non-EMPLOYEE roles */}
      {userRole !== "EMPLOYEE" && stats && (
        <div className="stat-grid">
          {canViewEmployees && (
            <>
              <div className="stat-card">
                <div className="num">{stats.totalEmployees}</div>
                <div className="label">Total employees on file</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.activeEmployees}</div>
                <div className="label">Active status</div>
              </div>
            </>
          )}
          {canViewRecruitment && (
            <div className="stat-card">
              <div className="num">{stats.openJobs}</div>
              <div className="label">Open requisitions</div>
            </div>
          )}
          {canRecruit && (
            <div className="stat-card">
              <div className="num">{stats.inPipeline}</div>
              <div className="label">Candidates in pipeline</div>
            </div>
          )}
        </div>
      )}

      {userRole !== "EMPLOYEE" && (
        <div className="card">
          <div className="section-title">Where things live</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            <strong>Employees</strong> and <strong>Departments</strong> hold the personnel record —
            who's on staff, their role, and their manager. <strong>Job Openings</strong>,{" "}
            <strong>Candidates</strong>, and <strong>Applications</strong> form the recruitment
            pipeline. The <strong>HR Assistant</strong> answers policy questions from uploaded HR
            documents — it won't look up anyone's personal leave balance, only what's written in
            company policy.
          </p>
        </div>
      )}
    </div>
  );
}
