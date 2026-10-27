import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyProfile from "./pages/MyProfile";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import Jobs from "./pages/Jobs";
import Candidates from "./pages/Candidates";
import Applications from "./pages/Applications";
import Assistant from "./pages/Assistant";
import Careers from "./pages/Careers";

// Role groups for route access
const ALL_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "RECRUITER", "MANAGER", "EMPLOYEE"];
const HR_PLUS_MANAGER = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "MANAGER"];
const HR_PLUS_RECRUITER = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "RECRUITER"];

function Shell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/careers" element={<Careers />} />
      <Route path="/careers/assessment" element={<Careers />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Shell>
              <Dashboard />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Careers />} />
      <Route
        path="/my-profile"
        element={
          <ProtectedRoute>
            <Shell>
              <MyProfile />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute allowedRoles={HR_PLUS_MANAGER}>
            <Shell>
              <Employees />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/departments"
        element={
          <ProtectedRoute allowedRoles={HR_PLUS_MANAGER}>
            <Shell>
              <Departments />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute allowedRoles={HR_PLUS_RECRUITER}>
            <Shell>
              <Jobs />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates"
        element={
          <ProtectedRoute allowedRoles={HR_PLUS_RECRUITER}>
            <Shell>
              <Candidates />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications"
        element={
          <ProtectedRoute allowedRoles={HR_PLUS_RECRUITER}>
            <Shell>
              <Applications />
            </Shell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assistant"
        element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <Shell>
              <Assistant />
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
