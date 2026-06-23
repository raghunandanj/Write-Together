import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Phrases the typewriter cycles through
const PHRASES = [
  "Write together, in real time.",
  "Collaborate without friction.",
  "Your ideas, shared instantly.",
  "One document, many minds.",
];

function useTypewriter(phrases, typingSpeed = 60, pauseMs = 1800, deleteSpeed = 35) {
  const [displayed, setDisplayed] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const current = phrases[phraseIndex];

    if (!deleting && charIndex < current.length) {
      timerRef.current = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, typingSpeed);
    } else if (!deleting && charIndex === current.length) {
      timerRef.current = setTimeout(() => setDeleting(true), pauseMs);
    } else if (deleting && charIndex > 0) {
      timerRef.current = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex - 1));
        setCharIndex((c) => c - 1);
      }, deleteSpeed);
    } else if (deleting && charIndex === 0) {
      setDeleting(false);
      setPhraseIndex((p) => (p + 1) % phrases.length);
    }

    return () => clearTimeout(timerRef.current);
  }, [charIndex, deleting, phraseIndex, phrases, typingSpeed, pauseMs, deleteSpeed]);

  return displayed;
}

// Generate stable particle data once
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 37 + 7) % 100}%`,
  size: ((i * 13 + 5) % 6) + 3,
  delay: `${(i * 1.1) % 14}s`,
  duration: `${((i * 7 + 12) % 10) + 12}s`,
  color: i % 3 === 0 ? "rgba(59,130,246,0.35)" : i % 3 === 1 ? "rgba(14,165,233,0.3)" : "rgba(99,102,241,0.25)",
}));

export default function LandingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const typed = useTypewriter(PHRASES);

  useEffect(() => {
    if (token) navigate("/dashboard", { replace: true });
  }, [token, navigate]);

  return (
    <div style={styles.page}>
      {/* Animated gradient background */}
      <div className="landing-bg" />

      {/* Floating particles */}
      <div style={styles.particleLayer} aria-hidden="true">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header style={styles.header} className="resp-header">
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span style={styles.brandName}>Write-Together</span>
        </div>
        <nav style={styles.nav}>
          <button style={styles.navLink} onClick={() => navigate("/login")}>Sign in</button>
          <button style={styles.ctaSmall} className="interactive-btn" onClick={() => navigate("/login")}>
            Get started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main style={styles.main} className="resp-padding">
        <section style={styles.hero}>
          <div style={styles.badge}>✦ Real-time collaboration</div>
          <h1 style={styles.headline} className="landing-headline resp-font-display">
            {typed}
            <span className="typewriter-cursor" aria-hidden="true" />
          </h1>
          <p style={styles.subheading}>
            A clean, fast collaborative editor. Create a room, invite your team, and write together — changes appear instantly for everyone.
          </p>
          <div style={styles.ctaGroup}>
            <button style={styles.primaryCta} className="interactive-btn" onClick={() => navigate("/login")}>
              Start writing free
            </button>
            <button style={styles.ghostCta} className="interactive-btn" onClick={() => navigate("/login")}>
              Join a room →
            </button>
          </div>
        </section>

        {/* Mock editor preview */}
        <div style={styles.previewCard} className="landing-preview">
          <div style={styles.previewBar}>
            <span style={{ ...styles.previewDot, background: "#f87171" }} />
            <span style={{ ...styles.previewDot, background: "#fbbf24" }} />
            <span style={{ ...styles.previewDot, background: "#34d399" }} />
            <span style={styles.previewTitle}>Team Roadmap Q3</span>
            <span style={styles.previewSaved}>✓ saved</span>
          </div>
          <div style={styles.previewContent}>
            <div style={styles.previewLine}>
              <span style={styles.previewH}>Q3 Goals</span>
            </div>
            <div style={{ ...styles.previewLine, marginTop: 12 }}>
              Launch new onboarding flow by end of July
              <span style={styles.previewCaret} />
            </div>
            <div style={styles.previewLine}>Migrate backend to new infra ✓</div>
            <div style={styles.previewLine}>Publish blog post on architecture</div>
            <div style={styles.previewAvatars}>
              {["A", "B", "C"].map((l, i) => (
                <div key={i} style={{ ...styles.previewAvatar, background: ["#3b82f6","#0ea5e9","#6366f1"][i], marginLeft: i > 0 ? -8 : 0 }}>
                  {l}
                </div>
              ))}
              <span style={styles.previewOnline}>3 writing now</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <section style={styles.features} className="landing-features">
          {[
            {
              icon: "⚡",
              title: "Real-time Sync",
              text: "Edits broadcast to everyone in the room the instant you type — zero lag, zero refresh.",
            },
            {
              icon: "🔒",
              title: "Controlled Access",
              text: "Share a room code, review join requests, and set read or write permissions per collaborator.",
            },
            {
              icon: "👁️",
              title: "Live Presence",
              text: "See who's in the document right now, who's typing, and what they last changed.",
            },
            {
              icon: "🕓",
              title: "Version History",
              text: "Take named snapshots at any time and restore any version in one click.",
            },
          ].map((f) => (
            <div key={f.title} style={styles.featureCard} className="feature-card">
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureText}>{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerBrand}>Write-Together</span>
        <span style={styles.footerNote}>Built for teams who move fast.</span>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflowX: "hidden",
  },
  particleLayer: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 1,
    overflow: "hidden",
  },
  header: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.25rem 3rem",
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(209,220,232,0.6)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
  },
  brandName: {
    fontSize: 17,
    fontWeight: 700,
    color: "#1a2333",
    letterSpacing: "-0.02em",
    fontFamily: "var(--font-display)",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  navLink: {
    background: "none",
    border: "none",
    color: "var(--ink-soft)",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "color 0.15s ease",
  },
  ctaSmall: {
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4rem 2rem 3rem",
    position: "relative",
    zIndex: 5,
  },
  hero: {
    textAlign: "center",
    maxWidth: 680,
    marginBottom: "3.5rem",
  },
  badge: {
    display: "inline-block",
    background: "rgba(37,99,235,0.09)",
    color: "var(--accent)",
    border: "1px solid rgba(37,99,235,0.18)",
    borderRadius: 99,
    padding: "5px 14px",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: "1.5rem",
    letterSpacing: "0.01em",
  },
  headline: {
    fontSize: "3.6rem",
    color: "#1a2333",
    lineHeight: 1.12,
    marginBottom: "1.25rem",
    minHeight: "4.5rem",
    fontFamily: "var(--font-display)",
  },
  subheading: {
    fontSize: "1.15rem",
    color: "var(--ink-soft)",
    marginBottom: "2.25rem",
    lineHeight: 1.65,
    maxWidth: 540,
    margin: "0 auto 2.25rem",
  },
  ctaGroup: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryCta: {
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "14px 28px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
    transition: "all 0.2s ease",
  },
  ghostCta: {
    background: "rgba(255,255,255,0.8)",
    color: "var(--accent)",
    border: "1.5px solid rgba(37,99,235,0.25)",
    borderRadius: "var(--radius-md)",
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    backdropFilter: "blur(4px)",
  },
  previewCard: {
    width: "100%",
    maxWidth: 640,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(209,220,232,0.8)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "0 20px 60px rgba(37,99,235,0.10), 0 4px 12px rgba(37,99,235,0.06)",
    overflow: "hidden",
    marginBottom: "4rem",
    backdropFilter: "blur(12px)",
  },
  previewBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "12px 18px",
    background: "rgba(240,244,248,0.9)",
    borderBottom: "1px solid var(--paper-shadow)",
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  previewTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-soft)",
    marginLeft: 8,
  },
  previewSaved: {
    fontSize: 11,
    color: "var(--success)",
    fontWeight: 500,
  },
  previewContent: {
    padding: "20px 24px",
  },
  previewLine: {
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    color: "var(--ink)",
    marginBottom: 8,
    lineHeight: 1.6,
  },
  previewH: {
    fontSize: 18,
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  previewCaret: {
    display: "inline-block",
    width: 2,
    height: 16,
    background: "var(--accent)",
    marginLeft: 3,
    verticalAlign: "middle",
    animation: "blink 1s step-end infinite",
    borderRadius: 1,
  },
  previewAvatars: {
    display: "flex",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid var(--paper-shadow)",
  },
  previewAvatar: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #fff",
  },
  previewOnline: {
    fontSize: 12,
    color: "var(--ink-soft)",
    marginLeft: 10,
    fontWeight: 500,
  },
  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "1.5rem",
    width: "100%",
    maxWidth: 900,
  },
  featureCard: {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(209,220,232,0.7)",
    borderRadius: "var(--radius-lg)",
    padding: "1.75rem",
    boxShadow: "0 2px 8px rgba(37,99,235,0.06)",
    backdropFilter: "blur(8px)",
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: "0.75rem",
  },
  featureTitle: {
    fontSize: "1.05rem",
    color: "var(--ink)",
    marginBottom: "0.5rem",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
  },
  featureText: {
    color: "var(--ink-soft)",
    lineHeight: 1.6,
    margin: 0,
    fontSize: 14,
  },
  footer: {
    position: "relative",
    zIndex: 5,
    display: "flex",
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    borderTop: "1px solid rgba(209,220,232,0.5)",
    background: "rgba(255,255,255,0.5)",
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--accent)",
    fontFamily: "var(--font-display)",
  },
  footerNote: {
    fontSize: 13,
    color: "var(--ink-soft)",
  },
};
