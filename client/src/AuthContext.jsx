import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export function AuthProvider({ children }) {
  // On first load, check if we already have a token saved from a previous
  // session, so the user doesn't have to log in again every time they visit.
  const [token, setToken] = useState(() => sessionStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    sessionStorage.setItem("token", res.data.token);
    sessionStorage.setItem("user", JSON.stringify(res.data.user));
  };

  const signup = async (name, email, password) => {
    const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    sessionStorage.setItem("token", res.data.token);
    sessionStorage.setItem("user", JSON.stringify(res.data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  };

  const updateUser = (userData) => {
    setUser(userData);
    sessionStorage.setItem("user", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ token, user, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook so other components can just call useAuth() instead of
// importing useContext + AuthContext every time.
export function useAuth() {
  return useContext(AuthContext);
}

export { API_URL };
