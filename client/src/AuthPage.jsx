import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !email.includes("@")) { setError("Please provide a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (mode === "signup" && !name.trim()) { setError("Please provide a name."); return; }

    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      {/* Decorative blobs */}
      <div style={styles.blob1} aria-hidden="true" />
      <div style={styles.blob2} aria-hidden="true" />

      <div style={styles.card} className="resp-card">
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span style={styles.brandName}>Write-Together</span>
        </div>

        <h1 style={styles.heading}>
          {mode === "login" ? "Welcome back" : "Start writing together"}
        </h1>
        <p style={styles.subheading}>
          {mode === "login"
            ? "Log in to pick up where you left off."
            : "Create an account to open your first room."}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <label style={styles.label}>
              Name
              <input
                style={styles.input}
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Your name"
                required
                autoFocus
              />
            </label>
          )}
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              required
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </label>

          {error && (
            <div style={styles.errorBanner}>
              <span style={styles.errorIcon}>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="interactive-btn"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p style={styles.switchLine}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={styles.switchBtn}
          >
            {mode === "login" ? "Create an account" : "Log in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  blob1: {
    position: "fixed",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
    top: -120,
    left: -100,
    filter: "blur(40px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob2: {
    position: "fixed",
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(14,165,233,0.15), transparent 70%)",
    bottom: -80,
    right: -80,
    filter: "blur(40px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 420,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(209,220,232,0.8)",
    borderRadius: "var(--radius-xl)",
    padding: "2.75rem 2.5rem",
    boxShadow: "0 24px 64px rgba(37,99,235,0.10), 0 4px 12px rgba(37,99,235,0.06)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: "2rem",
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a2333",
    letterSpacing: "-0.02em",
    fontFamily: "var(--font-display)",
  },
  heading: {
    fontSize: 26,
    marginBottom: 8,
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
  },
  subheading: {
    color: "var(--ink-soft)",
    fontSize: 14,
    marginTop: 0,
    marginBottom: "1.75rem",
    lineHeight: 1.55,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    fontSize: 13,
    color: "var(--ink)",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    letterSpacing: "0.01em",
  },
  input: {
    fontSize: 15,
    padding: "11px 14px",
    border: "1.5px solid var(--paper-shadow)",
    borderRadius: "var(--radius-sm)",
    background: "rgba(255,255,255,0.8)",
    color: "var(--ink)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    outline: "none",
  },
  errorBanner: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    border: "1px solid #fca5a5",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
  },
  submitBtn: {
    marginTop: 6,
    padding: "13px 0",
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(37,99,235,0.28)",
    transition: "all 0.2s ease",
  },
  switchLine: {
    marginTop: "1.75rem",
    fontSize: 14,
    color: "var(--ink-soft)",
    textAlign: "center",
  },
  switchBtn: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 14,
    fontWeight: 600,
    padding: 0,
    cursor: "pointer",
  },
};
