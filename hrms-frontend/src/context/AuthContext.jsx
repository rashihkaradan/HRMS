import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("hrms_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("hrms_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { access_token } = await api.login(email, password);
    localStorage.setItem("hrms_token", access_token);
    const me = await api.me();
    setUser(me);
    return me;
  }

  function logout() {
    localStorage.removeItem("hrms_token");
    setUser(null);
  }

  async function refreshUser() {
    const currentUser = await api.me();
    setUser(currentUser);
    return currentUser;
  }

  const HR_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER"];
  const RECRUIT_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "RECRUITER", "HR_MANAGER"];

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isHR: user && HR_ROLES.includes(user.role),
    canRecruit: user && RECRUIT_ROLES.includes(user.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
