import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useAuth, API_URL } from "./AuthContext";
import ConfirmModal from "./ConfirmModal";

// ── Register custom fonts & sizes with Quill ──
const Font = Quill.import("formats/font");
Font.whitelist = ["inter", "lora", "merriweather", "playfair", "roboto-slab", "source-serif", "mono"];
Quill.register(Font, true);

const Size = Quill.import("attributors/style/size");
Size.whitelist = ["10px","11px","12px","13px","14px","16px","18px","20px","22px","24px","28px","32px","36px","48px","64px"];
Quill.register(Size, true);

const QUILL_MODULES = {
  toolbar: {
    container: [
      [{ font: Font.whitelist }],
      [{ size: Size.whitelist }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["blockquote", "code-block"],
      ["link"],
      ["clean"],
    ],
  },
};

const QUILL_FORMATS = ["font","size","bold","italic","underline","strike","color","background","list","bullet","align","blockquote","code-block","link"];

function colorForUser(userId) {
  const COLORS = ["#3b82f6","#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ef4444"];
  let h = 0;
  for (let i = 0; i < (userId||"").length; i++) h = (h + userId.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

export default function Editor() {
  const { id: documentId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [title, setTitle] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [presentUsers, setPresentUsers] = useState([]);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [typingUsers, setTypingUsers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [collaboratorsList, setCollaboratorsList] = useState([]);
  const [collabDropdownOpen, setCollabDropdownOpen] = useState(false);
  const [joinToasts, setJoinToasts] = useState([]);
  const [accessLevels, setAccessLevels] = useState({});
  const [myAccessLevel, setMyAccessLevel] = useState("read-write");
  const [snapshotsPanelOpen, setSnapshotsPanelOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotTitle, setSnapshotTitle] = useState("");
  const [lastEditInfo, setLastEditInfo] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState({ isOpen: false, versionId: null });
  const [isOwner, setIsOwner] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [requestsPanelOpen, setRequestsPanelOpen] = useState(false);
  const [pendingRequestsList, setPendingRequestsList] = useState([]);

  const socketRef = useRef(null);
  const debounceTimer = useRef(null);
  const reactQuillRef = useRef(null);
  const hasReceivedInitialPresence = useRef(false);
  const recentlyLeft = useRef({});
  const collabDropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (collabDropdownRef.current && !collabDropdownRef.current.contains(e.target)) setCollabDropdownOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchRequestsList = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents/${documentId}/requests`, { headers: { Authorization: `Bearer ${token}` } });
      setPendingRequestsList(res.data);
      setPendingRequestsCount(res.data.length);
    } catch { console.error("Failed to fetch requests"); }
  };

  const respondToRequest = async (userId, action, accessLevel = "read-write") => {
    try {
      await axios.post(`${API_URL}/documents/${documentId}/requests/${userId}/${action}`, { accessLevel }, { headers: { Authorization: `Bearer ${token}` } });
      if (action === "approve") {
        setAccessLevels((prev) => ({ ...prev, [userId]: accessLevel }));
        const u = pendingRequestsList.find((r) => r.user._id === userId)?.user;
        if (u) setCollaboratorsList((prev) => [...prev, u]);
      }
      setPendingRequestsList((prev) => prev.filter((r) => r.user._id !== userId));
      setPendingRequestsCount((prev) => Math.max(0, prev - 1));
    } catch { console.error(`Failed to ${action} request`); }
  };

  const changeAccessLevel = async (userId, newAccess) => {
    try {
      await axios.put(`${API_URL}/documents/${documentId}/collaborators/${userId}/access`, { accessLevel: newAccess }, { headers: { Authorization: `Bearer ${token}` } });
      setAccessLevels((prev) => ({ ...prev, [userId]: newAccess }));
    } catch { console.error("Failed to update access level"); }
  };

  useEffect(() => {
    axios.get(`${API_URL}/documents/${documentId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setTitle(res.data.title);
        setRoomCode(res.data.roomCode);
        let init = res.data.content || "";
        try { const p = JSON.parse(init); if (p?.ops) init = p; } catch {}
        setContent(init);
        setLocalContent(res.data.content || "");
        setSnapshots(res.data.snapshots || []);
        const own = res.data.owner?._id === user?.id;
        setIsOwner(own);
        setOwnerName(res.data.owner?.name || "");
        const ownerObj = res.data.owner ? { ...res.data.owner, isOwnerRole: true } : null;
        setCollaboratorsList(ownerObj ? [ownerObj, ...(res.data.collaborators || [])] : (res.data.collaborators || []));
        const aLevels = res.data.accessLevels || {};
        setAccessLevels(aLevels);
        setMyAccessLevel(own ? "read-write" : (aLevels[user?.id] || "read-write"));
        setPendingRequestsCount(res.data.pendingRequests?.length || 0);
        setIsLoaded(true);
      })
      .catch(() => navigate("/dashboard"));

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on("connect_error", () => navigate("/"));
    socket.emit("join-document", { documentId, userName: user?.name });

    socket.on("receive-changes", (payload) => {
      const full = typeof payload === "string" ? payload : payload.content;
      const delta = typeof payload === "string" ? null : payload.delta;
      if (!reactQuillRef.current) return;
      const editor = reactQuillRef.current.getEditor();
      if (delta) { editor.updateContents(delta); }
      else {
        try { editor.setContents(JSON.parse(full), "silent"); }
        catch {
          if (editor.root.innerHTML !== full) {
            const sel = editor.getSelection();
            editor.clipboard.dangerouslyPasteHTML(full);
            if (sel) setTimeout(() => { try { editor.setSelection(sel); } catch {} }, 0);
          }
        }
      }
      setLocalContent(editor.root.innerHTML);
    });

    socket.on("presence-update", (users) => {
      setPresentUsers((prev) => {
        const now = Date.now();
        prev.filter(p => !users.find(u => u.userId === p.userId)).forEach(u => { recentlyLeft.current[u.userId] = now; });
        if (hasReceivedInitialPresence.current) {
          users.filter(u => u.userId !== user?.id && !prev.find(p => p.userId === u.userId)).forEach(u => {
            if (now - (recentlyLeft.current[u.userId] || 0) > 10000) {
              const id = Date.now() + Math.random();
              setJoinToasts(t => [...t, { id, name: u.userName || "Anonymous" }]);
              setTimeout(() => setJoinToasts(t => t.filter(x => x.id !== id)), 4000);
            }
          });
        } else { hasReceivedInitialPresence.current = true; }
        return users;
      });
    });

    socket.on("access-updated", ({ userId, accessLevel }) => {
      setAccessLevels(p => ({ ...p, [userId]: accessLevel }));
      if (user?.id === userId) setMyAccessLevel(accessLevel);
    });
    socket.on("user-typing", ({ userId, userName }) => setTypingUsers(p => p.find(u => u.userId === userId) ? p : [...p, { userId, userName }]));
    socket.on("stopped-typing", ({ userId }) => setTypingUsers(p => p.filter(u => u.userId !== userId)));
    socket.on("title-updated", setTitle);
    socket.on("dashboard-update", () => {
      axios.get(`${API_URL}/documents/${documentId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { setPendingRequestsCount(res.data.pendingRequests?.length || 0); if (requestsPanelOpen) fetchRequestsList(); })
        .catch(() => {});
    });
    socket.on("last-edit-update", setLastEditInfo);
    socket.on("document-restored", (restored) => {
      if (reactQuillRef.current) {
        const editor = reactQuillRef.current.getEditor();
        try { editor.setContents(JSON.parse(restored), "silent"); } catch { editor.root.innerHTML = restored; }
      }
      setLocalContent(restored); setLastEditInfo(null);
      const id = Date.now();
      setJoinToasts(t => [...t, { id, name: "Document restored by owner!", isAlert: true }]);
      setTimeout(() => setJoinToasts(t => t.filter(x => x.id !== id)), 4000);
    });
    socket.on("join-denied", () => navigate("/dashboard"));
    return () => socket.disconnect();
  }, [documentId]);

  const handleChange = (value, delta, source, editor) => {
    setLocalContent(value);
    if (source !== "user") return;
    setSaveStatus("saving");
    const fullDelta = JSON.stringify(editor.getContents());
    socketRef.current.emit("typing", { documentId });
    socketRef.current.emit("send-changes", { documentId, content: fullDelta, delta });
    let action = "edited the document";
    if (delta?.ops) {
      for (const op of delta.ops) {
        if (op.insert) { action = typeof op.insert === "string" && op.insert.trim() ? `added "${op.insert.trim().substring(0,15)}..."` : "added content"; break; }
        if (op.delete) { action = "deleted content"; break; }
        if (op.attributes) { action = "formatted text"; break; }
      }
    }
    socketRef.current.emit("new-edit", { documentId, userName: user?.name, action });
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { socketRef.current.emit("save-document", { documentId, content: fullDelta }); setSaveStatus("saved"); }, 1000);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      socketRef.current?.emit(e.shiftKey ? "redo-edit" : "undo-edit", { documentId });
    }
  };

  const takeSnapshot = async (e) => {
    e.preventDefault();
    if (!snapshotTitle.trim()) return;
    try { const res = await axios.post(`${API_URL}/documents/${documentId}/snapshots`, { title: snapshotTitle }, { headers: { Authorization: `Bearer ${token}` } }); setSnapshots(res.data); setSnapshotTitle(""); }
    catch { console.error("Failed to take snapshot"); }
  };

  const confirmRestoreVersion = async () => {
    const vId = confirmRestore.versionId;
    setConfirmRestore({ isOpen: false, versionId: null });
    if (!vId) return;
    try { await axios.post(`${API_URL}/documents/${documentId}/snapshots/${vId}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } }); setSnapshotsPanelOpen(false); }
    catch { console.error("Failed to restore"); }
  };

  const handleTitleChange = (e) => { setTitle(e.target.value); socketRef.current.emit("title-updated", { documentId, title: e.target.value }); };
  const handleTitleBlur = () => axios.patch(`${API_URL}/documents/${documentId}`, { title }, { headers: { Authorization: `Bearer ${token}` } });

  const plainText = localContent.replace(/<[^>]*>/g, "");
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <div style={E.page}>
      <div className="editor-bg" />

      {/* ── TOP BAR ── */}
      <header style={E.header} className="editor-header">
        <div style={E.headerLeft}>
          <button onClick={() => navigate("/dashboard")} style={E.backBtn} className="interactive-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}>
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Dashboard
          </button>
          {roomCode && (
            <span style={E.codeBadge} title="Room code">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {roomCode}
            </span>
          )}
          {ownerName && !isOwner && <span style={E.ownerBadge}>by {ownerName}</span>}
        </div>

        <div style={E.headerCenter} className="editor-header-center">
          <input
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            style={E.titleInput}
            disabled={!isOwner}
            placeholder="Untitled document"
          />
          <span style={{ ...E.saveChip, ...(saveStatus === "saving" ? E.savingChip : E.savedChip) }}>
            {saveStatus === "saving" ? "saving…" : "✓ saved"}
          </span>
        </div>

        <div style={E.headerRight} className="editor-header-right">
          {typingUsers.length > 0 && (
            <span style={E.typingPill}>
              {typingUsers.map(u => u.userName || "Someone").join(", ")} typing…
            </span>
          )}
          <div style={{ position: "relative" }} ref={collabDropdownRef}>
            <button style={E.collabBtn} onClick={() => setCollabDropdownOpen(!collabDropdownOpen)}>
              <div style={E.avatarStack}>
                {presentUsers.slice(0,4).map((u, i) => (
                  <div key={u.userId} style={{ ...E.miniAvatar, background: colorForUser(u.userId), marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i }}>
                    {(u.userName||"?")[0].toUpperCase()}
                  </div>
                ))}
              </div>
              <span style={E.collabCount}>{presentUsers.length} online</span>
              <span style={{fontSize:10, opacity:0.6}}>▾</span>
            </button>
            {collabDropdownOpen && (
              <div style={E.dropdown} className="resp-dropdown">
                <p style={E.dropdownLabel}>Collaborators</p>
                {collaboratorsList.length === 0 ? <div style={E.dropdownItem}>No collaborators yet</div> : collaboratorsList.map((c) => {
                  const online = presentUsers.some(pu => pu.userId === c._id);
                  return (
                    <div key={c._id} style={E.dropdownItem}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#22c55e" : "var(--paper-shadow)", boxShadow: online ? "0 0 6px #22c55e" : "none", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}{c.isOwnerRole && <span style={{ color: "var(--ink-soft)", fontWeight: 400, fontSize: 11 }}> (owner)</span>}
                        </span>
                      </div>
                      {!c.isOwnerRole && isOwner && (
                        <select value={accessLevels[c._id] || "read-write"} onChange={(e) => changeAccessLevel(c._id, e.target.value)} style={E.accessSelect} onClick={(e) => e.stopPropagation()}>
                          <option value="read-write">Edit</option>
                          <option value="read-only">View</option>
                        </select>
                      )}
                      {!c.isOwnerRole && !isOwner && (
                        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{accessLevels[c._id] === "read-only" ? "View" : "Edit"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {isOwner && (
            <button style={E.headerBtn} onClick={() => setSnapshotsPanelOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              History
            </button>
          )}
          {isOwner && pendingRequestsCount > 0 && (
            <button style={{ ...E.headerBtn, background: "rgba(220,38,38,0.08)", color: "var(--danger)", borderColor: "rgba(220,38,38,0.2)" }}
              onClick={() => { setRequestsPanelOpen(true); fetchRequestsList(); }}>
              Requests <span style={E.reqBadge}>{pendingRequestsCount}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── EDITOR AREA ── */}
      <main style={E.main} className="editor-main">
        <div style={E.editorCard}>
          <div style={E.editorWrapper} onKeyDown={handleKeyDown} className={`wt-editor${myAccessLevel === "read-only" ? " read-only-editor" : ""}`}>
            {isLoaded ? (
              <ReactQuill
                ref={reactQuillRef}
                theme="snow"
                defaultValue={content}
                onChange={handleChange}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                readOnly={myAccessLevel === "read-only"}
                style={E.quill}
                placeholder="Start writing…"
              />
            ) : (
              <div style={E.loading}>
                <div style={E.loadingDot} /><div style={{ ...E.loadingDot, animationDelay: "0.15s" }} /><div style={{ ...E.loadingDot, animationDelay: "0.3s" }} />
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div style={E.statusBar}>
          <span style={E.statusText}>{wordCount} words · {charCount} chars</span>
          {myAccessLevel === "read-only" && <span style={E.readOnlyBadge}>Read-only</span>}
          {lastEditInfo && (
            <span style={E.lastEdit}>
              Last edit by <strong>{lastEditInfo.userName}</strong>: {lastEditInfo.action}
            </span>
          )}
        </div>
      </main>

      {/* ── MODALS ── */}
      {requestsPanelOpen && (
        <div style={E.overlay} className="wt-overlay" onClick={() => setRequestsPanelOpen(false)}>
          <div style={E.modal} className="wt-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={E.modalTitle}>Join requests — {title}</h3>
            {!pendingRequestsList.length ? <p style={E.modalEmpty}>No pending requests.</p> : (
              <ul style={E.reqList}>
                {pendingRequestsList.map((r) => (
                  <li key={r.user._id} style={E.reqRow}>
                    <div style={E.reqAvatar}>{(r.user.name||"?")[0].toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}><p style={E.reqName}>{r.user.name}</p><p style={E.reqEmail}>{r.user.email}</p></div>
                    <div style={{display:"flex",gap:6}}>
                      <button style={{...E.approveBtn,background:"#16a34a"}} onClick={() => respondToRequest(r.user._id,"approve","read-write")}>Edit</button>
                      <button style={E.approveBtn} onClick={() => respondToRequest(r.user._id,"approve","read-only")}>View</button>
                      <button style={E.denyBtn} onClick={() => respondToRequest(r.user._id,"deny")}>Deny</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button style={E.closeBtn} onClick={() => setRequestsPanelOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {snapshotsPanelOpen && (
        <div style={E.overlay} className="wt-overlay" onClick={() => setSnapshotsPanelOpen(false)}>
          <div style={{ ...E.modal, maxWidth: 560 }} className="wt-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={E.modalTitle}>Version History</h3>
            <form onSubmit={takeSnapshot} style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
              <input style={E.snapInput} placeholder="Snapshot name (e.g. v1.0 final)" value={snapshotTitle} onChange={(e) => setSnapshotTitle(e.target.value)} />
              <button type="submit" style={E.approveBtn}>Save</button>
            </form>
            {!snapshots.length ? <p style={E.modalEmpty}>No snapshots yet.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                {[...snapshots].reverse().map((snap) => (
                  <div key={snap._id} style={E.snapRow}>
                    <div style={E.snapIcon}>🕓</div>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontWeight:600,fontSize:14,color:"var(--ink)"}}>{snap.title}</p>
                      <p style={{margin:0,fontSize:12,color:"var(--ink-soft)"}}>{new Date(snap.createdAt).toLocaleString()}</p>
                    </div>
                    <button style={{...E.approveBtn,background:"var(--ink)"}} onClick={() => setConfirmRestore({isOpen:true,versionId:snap._id})}>Restore</button>
                  </div>
                ))}
              </div>
            )}
            <button style={{...E.closeBtn,marginTop:"1.25rem"}} onClick={() => setSnapshotsPanelOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={E.toastArea}>
        {joinToasts.map((t) => (
          <div key={t.id} style={{ ...E.toast, background: t.isAlert ? "var(--accent)" : "#1a2333" }}>
            {t.isAlert ? <strong>{t.name}</strong> : <><strong>{t.name}</strong> joined 🎉</>}
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmRestore.isOpen}
        title="Restore Version"
        message="This will overwrite the live document for everyone in the room."
        confirmText="Restore"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmRestoreVersion}
        onCancel={() => setConfirmRestore({ isOpen: false, versionId: null })}
      />
    </div>
  );
}

const E = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", background: "#f8faff" },
  header: {
    position: "sticky", top: 0, zIndex: 40,
    display: "flex", alignItems: "center", gap: 12, padding: "0 1.5rem", height: 56,
    background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    borderBottom: "1px solid var(--paper-shadow)", flexWrap: "wrap",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  headerCenter: { flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  headerRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },

  backBtn: { display: "flex", alignItems: "center", background: "none", border: "none", fontSize: 13, color: "var(--ink-soft)", padding: "5px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" },
  codeBadge: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(37,99,235,0.15)", padding: "3px 9px", borderRadius: 99, fontFamily: "var(--font-mono)", fontWeight: 600 },
  ownerBadge: { fontSize: 12, color: "var(--ink-soft)", background: "var(--paper)", padding: "3px 10px", borderRadius: 99, border: "1px solid var(--paper-shadow)" },

  titleInput: {
    flex: 1, fontSize: 17, fontFamily: "var(--font-display)", fontWeight: 700,
    border: "none", background: "transparent", color: "var(--ink)", outline: "none",
    padding: "4px 0", minWidth: 0, letterSpacing: "-0.02em",
  },
  saveChip: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 },
  savedChip: { background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)" },
  savingChip: { background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.2)" },

  typingPill: { fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic", background: "var(--paper)", padding: "3px 10px", borderRadius: 99, border: "1px solid var(--paper-shadow)", whiteSpace: "nowrap" },
  collabBtn: {
    display: "flex", alignItems: "center", gap: 7, background: "var(--paper)",
    border: "1px solid var(--paper-shadow)", borderRadius: 99, padding: "5px 12px 5px 6px",
    cursor: "pointer", fontSize: 12, color: "var(--ink-soft)", fontWeight: 500,
  },
  avatarStack: { display: "flex" },
  miniAvatar: { width: 22, height: 22, borderRadius: "50%", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" },
  collabCount: { fontSize: 12, fontWeight: 600, color: "var(--ink)" },
  dropdown: {
    position: "absolute", top: "calc(100% + 8px)", right: 0, width: 260,
    background: "#fff", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-lg)",
    boxShadow: "0 12px 32px rgba(26,35,51,0.12)", padding: "8px", zIndex: 100,
    animation: "slideUp 0.15s ease-out",
  },
  dropdownLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)", padding: "4px 8px 6px", margin: 0 },
  dropdownItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px", borderRadius: "var(--radius-sm)", fontSize: 13 },
  accessSelect: { fontSize: 12, border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-sm)", padding: "2px 6px", background: "#fff", color: "var(--ink)", cursor: "pointer" },
  headerBtn: {
    display: "flex", alignItems: "center", background: "var(--paper)", border: "1px solid var(--paper-shadow)",
    borderRadius: "var(--radius-md)", padding: "6px 12px", fontSize: 12, fontWeight: 600,
    color: "var(--ink-soft)", cursor: "pointer", gap: 2,
  },
  reqBadge: { background: "var(--danger)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 11, fontWeight: 700, marginLeft: 4 },

  main: { flex: 1, display: "flex", flexDirection: "column", maxWidth: 860, width: "100%", margin: "0 auto", padding: "2rem 1.5rem", position: "relative", zIndex: 5 },
  editorCard: { background: "#fff", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-xl)", boxShadow: "0 4px 24px rgba(37,99,235,0.07), 0 1px 4px rgba(37,99,235,0.04)", overflow: "hidden" },
  editorWrapper: { display: "flex", flexDirection: "column" },
  quill: { flex: 1, display: "flex", flexDirection: "column" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3rem", },
  loadingDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", opacity: 0.4, animation: "blink 1.2s ease-in-out infinite" },

  statusBar: { display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" },
  statusText: { fontSize: 12, color: "var(--ink-soft)" },
  readOnlyBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.2)" },
  lastEdit: { fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" },

  overlay: { position: "fixed", inset: 0, background: "rgba(26,35,51,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: "var(--radius-xl)", padding: "2rem", width: "100%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(26,35,51,0.15)", animation: "slideUp 0.2s ease-out" },
  modalTitle: { margin: "0 0 1.25rem", fontSize: 18, fontFamily: "var(--font-display)", color: "var(--ink)" },
  modalEmpty: { color: "var(--ink-soft)", fontStyle: "italic", fontSize: 14, margin: "0 0 1rem" },
  reqList: { listStyle: "none", padding: 0, margin: "0 0 1.25rem", display: "flex", flexDirection: "column", gap: 10 },
  reqRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", borderRadius: "var(--radius-md)" },
  reqAvatar: { width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#0ea5e9)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  reqName: { margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" },
  reqEmail: { margin: 0, fontSize: 12, color: "var(--ink-soft)" },
  approveBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "6px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  denyBtn: { background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)", padding: "6px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  closeBtn: { width: "100%", padding: "10px", background: "transparent", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--ink-soft)", cursor: "pointer" },
  snapInput: { flex: 1, padding: "9px 13px", border: "1.5px solid var(--paper-shadow)", borderRadius: "var(--radius-md)", fontSize: 14, background: "#fff", color: "var(--ink)", outline: "none" },
  snapRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "var(--paper)", borderRadius: "var(--radius-md)" },
  snapIcon: { fontSize: 20 },
  toastArea: { position: "fixed", top: 68, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 2000 },
  toast: { color: "#fff", padding: "10px 16px", borderRadius: "var(--radius-md)", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "slideUp 0.2s ease-out" },
};
