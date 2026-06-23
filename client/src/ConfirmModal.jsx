import React from "react";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  onConfirm,
  onCancel,
  isDestructive = false,
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
        </div>
        <div style={styles.body}>
          <p style={styles.message}>{message}</p>
        </div>
        <div style={styles.footer}>
          <button style={styles.cancelBtn} className="interactive-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            style={isDestructive ? styles.confirmBtnDestructive : styles.confirmBtn}
            className="interactive-btn"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(28, 28, 30, 0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalContent: {
    background: "#fff",
    border: "1px solid var(--paper-shadow)",
    borderRadius: "var(--radius-md)",
    width: "90%",
    maxWidth: 400,
    boxShadow: "0 8px 32px rgba(28,28,30,0.12)",
    animation: "slideUp 0.2s ease-out",
    overflow: "hidden",
  },
  header: {
    padding: "1.5rem 1.5rem 0.5rem",
  },
  title: {
    fontSize: "1.25rem",
    color: "var(--ink)",
    margin: 0,
  },
  body: {
    padding: "0 1.5rem 1.5rem",
  },
  message: {
    color: "var(--ink-soft)",
    fontSize: "0.95rem",
    lineHeight: 1.5,
    margin: 0,
  },
  footer: {
    padding: "1rem 1.5rem",
    background: "var(--paper)",
    borderTop: "1px solid var(--paper-shadow)",
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--paper-shadow)",
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    color: "var(--ink-soft)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  confirmBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
    boxShadow: "0 1px 2px rgba(28,28,30,0.08)",
  },
  confirmBtnDestructive: {
    background: "var(--danger)",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
    boxShadow: "0 1px 2px rgba(28,28,30,0.08)",
  },
};
