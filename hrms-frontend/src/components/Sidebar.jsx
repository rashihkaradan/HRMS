import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard",   label: "Overview",      end: true },
  { to: "/careers",     label: "Careers" },
  { to: "/my-profile",   label: "My Profile" },
  { to: "/employees",    label: "Employees",     roles: ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "MANAGER"] },
  { to: "/departments",  label: "Departments",   roles: ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "MANAGER"] },
  { to: "/jobs",         label: "Job Openings",  roles: ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "RECRUITER"] },
  { to: "/candidates",   label: "Candidates",    roles: ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "RECRUITER"] },
  { to: "/applications", label: "Applications",  roles: ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "RECRUITER"] },
  { to: "/assistant",    label: "HR Assistant" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  // Filter menu items based on the current user's role
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="mark">Personnel</span>
        <span className="sub">HRMS Console</span>
      </div>

      <nav className="tab-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="who">
            {user.full_name}
            <br />
            <span className="role">{user.role.replace("_", " ")}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
