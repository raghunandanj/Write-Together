import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wraps any page that should only be visible to logged-in users.
// If there's no token, bounce back to the login/signup page instead
// of letting them see a broken dashboard or editor.
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
