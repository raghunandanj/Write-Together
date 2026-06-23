import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth, API_URL } from "./AuthContext";
import ConfirmModal from "./ConfirmModal";

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("dashboardTab") || "owned");
  const { token, user, logout, updateUser } = useAuth();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [confirmState, setConfirmState] = useState({ isOpen: false, actionType: null, docId: null });
  const [requestsPanelDoc, setRequestsPanelDoc] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [collaboratorsPanelDoc, setCollaboratorsPanelDoc] = useState(null);
  const navigate = useNavigate();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (profileModalOpen) {
      setProfileError(""); setProfileSuccess(""); setPasswordError(""); setPasswordSuccess("");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      setProfileName(user?.name || ""); setProfileEmail(user?.email || "");
    }
  }, [profileModalOpen]);
  useEffect(() => { if (profileModalOpen && user) { setProfileName(user.name || ""); setProfileEmail(user.email || ""); } }, [user]);
  useEffect(() => { sessionStorage.setItem("dashboardTab", activeTab); }, [activeTab]);

  useEffect(() => {
    fetchDocuments();
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on("dashboard-update", fetchDocuments);
    return () => socket.disconnect();
  }, [token]);

  const fetchDocuments = async () => {
    try { const res = await axios.get(`${API_URL}/documents`, authHeaders); setDocuments(res.data); }
    catch { setError("Failed to load documents"); }
  };

  const createDocument = async () => {
    try { const res = await axios.post(`${API_URL}/documents`, { title: "Untitled Document" }, authHeaders); navigate(`/documents/${res.data._id}`); }
    catch { setError("Failed to create document"); }
  };

  const joinRoom = async (e) => {
    e.preventDefault(); setError(""); setInfo("");
    try {
      const res = await axios.post(`${API_URL}/documents/join`, { roomCode: roomCodeInput }, authHeaders);
      if (res.data.status === "approved") { navigate(`/documents/${res.data.document._id}`); }
      else { setInfo(`Request sent for "${res.data.document.title}". You'll see it once approved.`); setRoomCodeInput(""); fetchDocuments(); }
    } catch (err) { setError(err.response?.data?.error || "Failed to join room"); }
  };

  const openRequestsPanel = async (doc, e) => {
    e.stopPropagation(); setRequestsPanelDoc(doc);
    try { const res = await axios.get(`${API_URL}/documents/${doc._id}/requests`, authHeaders); setPendingRequests(res.data); }
    catch { setError("Failed to load requests"); }
  };

  const dismissDeniedRequest = async (docId) => {
    try { await axios.delete(`${API_URL}/documents/${docId}/requests/dismiss`, authHeaders); fetchDocuments(); }
    catch { setError("Failed to dismiss"); }
  };

  const respondToRequest = async (userId, action, accessLevel = "read-write") => {
    try {
      await axios.post(`${API_URL}/documents/${requestsPanelDoc._id}/requests/${userId}/${action}`, { accessLevel }, authHeaders);
      setPendingRequests((prev) => prev.filter((r) => r.user._id !== userId));
      fetchDocuments();
    } catch { setError(`Failed to ${action} request`); }
  };

  const copyCode = (doc) => { navigator.clipboard.writeText(doc.roomCode); setCopiedId(doc._id); setTimeout(() => setCopiedId(null), 1500); };
  const startRename = (doc, e) => { e.stopPropagation(); setRenamingId(doc._id); setRenameValue(doc.title); };
  const submitRename = async (docId) => {
    try { await axios.patch(`${API_URL}/documents/${docId}`, { title: renameValue }, authHeaders); setRenamingId(null); fetchDocuments(); }
    catch { setError("Failed to rename"); }
  };

  const confirmDelete = async () => {
    try { await axios.delete(`${API_URL}/documents/${confirmState.docId}`, authHeaders); setConfirmState({ isOpen: false, actionType: null, docId: null }); fetchDocuments(); }
    catch { setError("Failed to delete"); setConfirmState({ isOpen: false, actionType: null, docId: null }); }
  };
  const confirmLeave = async () => {
    try { await axios.delete(`${API_URL}/documents/${confirmState.docId}/collaborators/${user.id}`, authHeaders); setConfirmState({ isOpen: false, actionType: null, docId: null }); fetchDocuments(); }
    catch { setError("Failed to leave"); setConfirmState({ isOpen: false, actionType: null, docId: null }); }
  };

  const openCollaboratorsPanel = (doc, e) => { e.stopPropagation(); setCollaboratorsPanelDoc(doc); };
  const removeCollaborator = async (userId) => {
    try {
      await axios.delete(`${API_URL}/documents/${collaboratorsPanelDoc._id}/collaborators/${userId}`, authHeaders);
      setCollaboratorsPanelDoc((prev) => ({ ...prev, collaborators: prev.collaborators.filter(c => c._id !== userId) }));
      fetchDocuments();
    } catch { setError("Failed to remove collaborator"); }
  };

  const updateProfile = async (e) => {
    e.preventDefault(); setProfileError(""); setProfileSuccess("");
    try { const res = await axios.put(`${API_URL}/auth/profile`, { name: profileName, email: profileEmail }, authHeaders); updateUser(res.data); setProfileSuccess("Profile updated!"); setTimeout(() => setProfileSuccess(""), 3000); }
    catch (err) { setProfileError(err.response?.data?.error || "Failed to update profile"); }
  };
  const updatePassword = async (e) => {
    e.preventDefault(); setPasswordError(""); setPasswordSuccess("");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match");
    try { await axios.put(`${API_URL}/auth/password`, { oldPassword, newPassword }, authHeaders); setPasswordSuccess("Password updated!"); setTimeout(() => setPasswordSuccess(""), 3000); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); }
    catch (err) { setPasswordError(err.response?.data?.error || "Failed to update password"); }
  };

  const displayedDocs = activeTab === "owned"
    ? documents.filter((doc) => doc.owner?._id === user?.id)
    : activeTab === "joined"
    ? documents.filter((doc) => doc.owner?._id !== user?.id && doc.collaborators.some((c) => c._id === user?.id || c === user?.id))
    : documents.filter((doc) => doc.owner?._id !== user?.id && (
        doc.pendingRequests?.some((r) => r.user === user?.id || r.user?._id === user?.id) ||
        doc.deniedRequests?.some((r) => r.user === user?.id || r.user?._id === user?.id)
      ));

  const getRequestStatus = (doc) => {
    if (doc.collaborators.some((c) => c._id === user?.id || c === user?.id)) return "Accepted";
    if (doc.deniedRequests?.some((r) => r.user === user?.id || r.user?._id === user?.id)) return "Denied";
    if (doc.pendingRequests?.some((r) => r.user === user?.id || r.user?._id === user?.id)) return "Pending";
    return null;
  };

  const pendingRequestsCount = documents.filter((doc) =>
    doc.owner?._id !== user?.id && doc.pendingRequests?.some((r) => r.user === user?.id)
  ).length;

  const userInitials = (user?.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.brandIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <span style={S.brandName}>Write-Together</span>
        </div>
        <div style={S.headerRight}>
          <button onClick={() => setProfileModalOpen(true)} style={S.avatarBtn} title="Profile settings">
            {userInitials}
          </button>
          <button onClick={logout} style={S.logoutBtn} className="interactive-btn">Sign out</button>
        </div>
      </header>

      <div style={S.layout} className="dash-layout">
        {/* ── SIDEBAR ── */}
        <aside style={S.sidebar} className="dash-sidebar">
          <button onClick={createDocument} style={S.newDocBtn} className="interactive-btn dash-new-doc-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:8}}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New document
          </button>

          <form onSubmit={joinRoom} style={S.joinForm}>
            <div style={S.joinInputWrapper}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <input style={S.joinInput} placeholder="Enter room code…" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value)} className="dash-join-input" />
            </div>
            <button type="submit" style={S.joinBtn} className="interactive-btn">Join</button>
          </form>

          <nav style={S.nav} className="dash-sidebar-nav">
            {[
              { key: "owned", label: "My Documents", icon: "📄" },
              { key: "joined", label: "Joined Rooms", icon: "👥" },
              { key: "requests", label: "My Requests", icon: "📬", badge: pendingRequestsCount },
            ].map(({ key, label, icon, badge }) => (
              <button key={key} style={{ ...S.navItem, ...(activeTab === key ? S.navItemActive : {}) }} onClick={() => setActiveTab(key)}>
                <span style={S.navIcon}>{icon}</span>
                <span style={S.navLabel}>{label}</span>
                {badge > 0 && <span style={S.navBadge}>{badge}</span>}
              </button>
            ))}
          </nav>

          <div style={S.sidebarUser} className="dash-sidebar-user">
            <div style={S.sidebarAvatarSmall}>{userInitials}</div>
            <div style={{minWidth:0}}>
              <p style={S.sidebarUserName}>{user?.name}</p>
              <p style={S.sidebarUserEmail}>{user?.email}</p>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={S.main} className="dash-main">
          <div style={S.pageHead}>
            <h1 style={S.pageTitle}>
              {activeTab === "owned" ? "My Documents" : activeTab === "joined" ? "Joined Rooms" : "My Requests"}
            </h1>
            <span style={S.docCount}>{displayedDocs.length} {displayedDocs.length === 1 ? "doc" : "docs"}</span>
          </div>

          {error && <div style={S.errorBanner}><span>⚠ {error}</span><button onClick={() => setError("")} style={S.bannerClose}>✕</button></div>}
          {info && <div style={S.infoBanner}><span>ℹ {info}</span><button onClick={() => setInfo("")} style={S.bannerClose}>✕</button></div>}

          {displayedDocs.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}>
                {activeTab === "owned" ? "📝" : activeTab === "joined" ? "🤝" : "📬"}
              </div>
              <p style={S.emptyTitle}>{activeTab === "owned" ? "No documents yet" : activeTab === "joined" ? "No joined rooms yet" : "No requests yet"}</p>
              <p style={S.emptyHint}>
                {activeTab === "owned" ? "Hit \"New document\" to start writing." : activeTab === "joined" ? "Enter a room code to join a collaboration." : "Join a room using a code to send a request."}
              </p>
            </div>
          ) : (
            <div style={S.grid} className="dash-grid">
              {displayedDocs.map((doc) => {
                const status = activeTab === "requests" ? getRequestStatus(doc) : null;
                const isUnclickable = status === "Pending" || status === "Denied";
                const showPendingDot = doc.owner?._id === user?.id && doc.pendingRequests?.length > 0;
                const hasUnread = doc.lastViewed?.[user?.id]
                  ? (new Date(doc.updatedAt).getTime() - new Date(doc.lastViewed[user?.id]).getTime() > 1000) : false;

                return (
                  <div key={doc._id} style={{ ...S.card, cursor: isUnclickable ? "default" : "pointer", opacity: status === "Denied" ? 0.55 : 1 }}
                    className="doc-card-wrap"
                    onClick={() => { if (!isUnclickable) navigate(`/documents/${doc._id}`); }}
                  >
                    {/* Card top — doc icon + indicators */}
                    <div style={S.cardIconRow}>
                      <div style={S.docIcon}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
                        </svg>
                      </div>
                      <div style={S.cardIndicators}>
                        {showPendingDot && <span style={S.dotRed} title="Pending requests" />}
                        {hasUnread && !showPendingDot && <span style={S.dotBlue} title="Unread edits" />}
                        {status && (
                          <span style={{ ...S.statusChip, ...(status === "Accepted" ? S.chipGreen : status === "Denied" ? S.chipRed : S.chipGray) }}>
                            {status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div style={S.cardBody}>
                      {renamingId === doc._id ? (
                        <input autoFocus style={S.renameInput} value={renameValue}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => submitRename(doc._id)}
                          onKeyDown={(e) => e.key === "Enter" && submitRename(doc._id)} />
                      ) : (
                        <div style={S.titleRow}>
                          <h3 style={S.cardTitle}>{doc.title}</h3>
                          {doc.owner?._id === user?.id && (
                            <button style={S.editIconBtn} className="doc-rename-btn" onClick={(e) => startRename(doc, e)} title="Rename document">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      <p style={S.cardMeta}>
                        {doc.owner?._id !== user?.id && <span style={{fontWeight:500,color:"var(--ink)",marginRight:6}}>by {doc.owner?.name} ·</span>}
                        Updated {new Date(doc.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>

                    {/* Room code stamp (owner only) */}
                    {doc.owner?._id === user?.id && (
                      <button style={S.stamp} onClick={(e) => { e.stopPropagation(); copyCode(doc); }} title="Copy room code">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span style={S.stampCode}>{doc.roomCode}</span>
                        <span style={S.stampCopy}>{copiedId === doc._id ? "✓ copied" : "copy"}</span>
                      </button>
                    )}

                    {/* Card actions */}
                    <div style={S.cardActions} onClick={(e) => e.stopPropagation()}>
                      {doc.owner?._id === user?.id && doc.pendingRequests?.length > 0 && (
                        <button style={S.actionBtnBlue} onClick={(e) => openRequestsPanel(doc, e)}>
                          Requests ({doc.pendingRequests.length})
                        </button>
                      )}
                      {doc.owner?._id === user?.id && (
                        <button style={S.actionBtnGhost} onClick={(e) => openCollaboratorsPanel(doc, e)}>People</button>
                      )}
                      {activeTab === "requests" && status === "Accepted" && (
                        <button style={S.actionBtnBlue} onClick={() => navigate(`/documents/${doc._id}`)}>Open</button>
                      )}
                      {activeTab === "requests" && status === "Denied" && (
                        <button style={S.actionBtnRed} onClick={() => dismissDeniedRequest(doc._id)}>Dismiss</button>
                      )}
                      {doc.owner?._id === user?.id && (
                        <button style={S.actionBtnRed} onClick={() => setConfirmState({ isOpen: true, actionType: "delete", docId: doc._id })}>Delete</button>
                      )}
                      {doc.owner?._id !== user?.id && activeTab === "joined" && (
                        <button style={S.actionBtnRed} onClick={() => setConfirmState({ isOpen: true, actionType: "leave", docId: doc._id })}>Leave</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      {collaboratorsPanelDoc && (
        <div style={S.overlay} className="dash-overlay" onClick={() => setCollaboratorsPanelDoc(null)}>
          <div style={S.modal} className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>People — {collaboratorsPanelDoc.title}</h3></div>
            {!collaboratorsPanelDoc.collaborators?.length ? <p style={S.modalEmpty}>No collaborators yet.</p> : (
              <ul style={S.requestList}>
                {collaboratorsPanelDoc.collaborators.map((c) => (
                  <li key={c._id} style={S.requestRow}>
                    <div style={S.reqAvatar}>{(c.name||"?")[0].toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={S.requestName}>{c.name}</p>
                      <p style={S.requestEmail}>{c.email}</p>
                    </div>
                    <button style={S.denyBtn} onClick={() => removeCollaborator(c._id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <button style={S.closeBtn} onClick={() => setCollaboratorsPanelDoc(null)}>Close</button>
          </div>
        </div>
      )}

      {requestsPanelDoc && (
        <div style={S.overlay} className="dash-overlay" onClick={() => setRequestsPanelDoc(null)}>
          <div style={S.modal} className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}><h3 style={S.modalTitle}>Join requests — {requestsPanelDoc.title}</h3></div>
            {!pendingRequests.length ? <p style={S.modalEmpty}>No pending requests.</p> : (
              <ul style={S.requestList}>
                {pendingRequests.map((r) => (
                  <li key={r.user._id} style={S.requestRow}>
                    <div style={S.reqAvatar}>{(r.user.name||"?")[0].toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={S.requestName}>{r.user.name}</p>
                      <p style={S.requestEmail}>{r.user.email}</p>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button style={S.approveBtn} onClick={() => respondToRequest(r.user._id, "approve", "read-write")}>Edit</button>
                      <button style={{...S.approveBtn,background:"var(--teal)"}} onClick={() => respondToRequest(r.user._id, "approve", "read-only")}>View</button>
                      <button style={S.denyBtn} onClick={() => respondToRequest(r.user._id, "deny")}>Deny</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button style={S.closeBtn} onClick={() => setRequestsPanelDoc(null)}>Close</button>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <div style={S.overlay} className="dash-overlay" onClick={() => setProfileModalOpen(false)}>
          <div style={{...S.modal, maxWidth:460}} className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{...S.reqAvatar,width:44,height:44,fontSize:18,marginRight:12}}>{userInitials}</div>
              <h3 style={S.modalTitle}>Profile Settings</h3>
            </div>
            <form onSubmit={updateProfile} style={{marginBottom:"1.75rem"}}>
              <p style={S.formSectionLabel}>Account Info</p>
              {profileError && <p style={S.formError}>{profileError}</p>}
              {profileSuccess && <p style={S.formSuccess}>{profileSuccess}</p>}
              <div style={S.fieldGroup}>
                <input style={S.fieldInput} placeholder="Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
                <input style={S.fieldInput} type="email" placeholder="Email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} required />
              </div>
              <button type="submit" style={S.primaryBtn}>Save changes</button>
            </form>
            <form onSubmit={updatePassword}>
              <p style={S.formSectionLabel}>Change Password</p>
              {passwordError && <p style={S.formError}>{passwordError}</p>}
              {passwordSuccess && <p style={S.formSuccess}>{passwordSuccess}</p>}
              <div style={S.fieldGroup}>
                <input style={S.fieldInput} type="password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                <input style={S.fieldInput} type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                <input style={S.fieldInput} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" style={S.primaryBtn}>Update password</button>
            </form>
            <button style={{...S.closeBtn,marginTop:"1.5rem"}} onClick={() => setProfileModalOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.actionType === "delete" ? "Delete Document" : "Leave Room"}
        message={confirmState.actionType === "delete" ? "This will permanently delete the document. This can't be undone." : "You'll need owner approval to rejoin this room."}
        confirmText={confirmState.actionType === "delete" ? "Delete" : "Leave"}
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmState.actionType === "delete" ? confirmDelete : confirmLeave}
        onCancel={() => setConfirmState({ isOpen: false, actionType: null, docId: null })}
      />
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0 2rem", height: 56,
    background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid var(--paper-shadow)", position: "sticky", top: 0, zIndex: 50,
  },
  brand: { display: "flex", alignItems: "center", gap: 9 },
  brandIcon: {
    width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(37,99,235,0.28)",
  },
  brandName: { fontSize: 15, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  avatarBtn: {
    width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
    color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.04em",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoutBtn: { background: "transparent", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-md)", padding: "6px 14px", fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" },

  layout: { display: "flex", flex: 1, overflow: "hidden" },

  sidebar: {
    width: 240, flexShrink: 0, borderRight: "1px solid var(--paper-shadow)",
    background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)",
    display: "flex", flexDirection: "column", gap: 6, padding: "1.25rem 1rem",
    position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto",
  },
  newDocBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg,#2563eb,#0ea5e9)", color: "#fff",
    border: "none", borderRadius: "var(--radius-md)", padding: "11px 16px",
    fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
    marginBottom: 8,
  },
  joinForm: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  joinInputWrapper: { position: "relative" },
  joinInput: {
    width: "100%", padding: "9px 10px 9px 30px", border: "1.5px solid var(--paper-shadow)",
    borderRadius: "var(--radius-md)", fontSize: 13, fontFamily: "var(--font-mono)",
    background: "#fff", color: "var(--ink)", outline: "none", boxSizing: "border-box",
  },
  joinBtn: {
    padding: "9px", background: "var(--accent-soft)", border: "1.5px solid rgba(37,99,235,0.2)",
    borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, color: "var(--accent)", cursor: "pointer",
  },
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  navItem: {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
    background: "none", border: "none", borderRadius: "var(--radius-md)",
    fontSize: 14, color: "var(--ink-soft)", cursor: "pointer", textAlign: "left",
    transition: "all 0.15s ease",
  },
  navItemActive: { background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 },
  navIcon: { fontSize: 15, width: 20, textAlign: "center" },
  navLabel: { flex: 1 },
  navBadge: {
    background: "var(--accent)", color: "#fff", borderRadius: 10,
    padding: "1px 7px", fontSize: 11, fontWeight: 700,
  },
  sidebarUser: {
    display: "flex", alignItems: "center", gap: 9, padding: "10px 8px",
    borderTop: "1px solid var(--paper-shadow)", marginTop: "auto",
  },
  sidebarAvatarSmall: {
    width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
    color: "#fff", fontSize: 11, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sidebarUserName: { margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sidebarUserEmail: { margin: 0, fontSize: 11, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  main: { flex: 1, padding: "2rem 2.5rem", overflowY: "auto", minWidth: 0 },
  pageHead: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: "1.5rem" },
  pageTitle: { fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--ink)", margin: 0 },
  docCount: { fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 },

  errorBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #fca5a5", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 13, marginBottom: "1rem" },
  infoBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(37,99,235,0.2)", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 13, marginBottom: "1rem" },
  bannerClose: { background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: 0.6, padding: 0 },

  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 0", textAlign: "center" },
  emptyIcon: { fontSize: 48, marginBottom: "1rem", opacity: 0.5 },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", margin: "0 0 8px" },
  emptyHint: { fontSize: 14, color: "var(--ink-soft)", margin: 0, maxWidth: 320 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },

  card: {
    background: "#fff", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-lg)",
    padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10,
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    boxShadow: "0 1px 4px rgba(37,99,235,0.05)",
  },
  cardIconRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  docIcon: { width: 44, height: 44, background: "var(--accent-soft)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center" },
  cardIndicators: { display: "flex", alignItems: "center", gap: 6 },
  dotRed: { width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", boxShadow: "0 0 6px var(--danger)" },
  dotBlue: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" },
  statusChip: { padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 },
  chipGreen: { background: "rgba(22,163,74,0.1)", color: "#16a34a" },
  chipRed: { background: "var(--danger-soft)", color: "var(--danger)" },
  chipGray: { background: "#f1f5f9", color: "var(--ink-soft)" },

  cardBody: { display: "flex", flexDirection: "column", gap: 4 },
  titleRow: { display: "flex", alignItems: "center", gap: 6 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  editIconBtn: {
    background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer",
    padding: "3px 5px", borderRadius: 4, display: "flex", alignItems: "center", flexShrink: 0,
    opacity: 1,
  },
  renameInput: { fontSize: 15, fontWeight: 600, border: "1.5px solid var(--accent)", borderRadius: 6, padding: "3px 8px", background: "var(--paper)", width: "100%", outline: "none" },
  cardMeta: { margin: 0, fontSize: 12, color: "var(--ink-soft)" },

  stamp: {
    display: "flex", alignItems: "center", gap: 7, background: "var(--accent-soft)",
    border: "1.5px dashed rgba(37,99,235,0.3)", borderRadius: "var(--radius-sm)",
    padding: "7px 10px", cursor: "pointer",
  },
  stampCode: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--ink)", flex: 1, letterSpacing: "0.08em" },
  stampCopy: { fontSize: 11, color: "var(--accent)", fontWeight: 600 },

  cardActions: { display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid var(--paper-shadow)", marginTop: 2 },
  actionBtnBlue: { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  actionBtnGhost: { background: "transparent", color: "var(--ink-soft)", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 12, cursor: "pointer" },
  actionBtnRed: { background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },

  overlay: { position: "fixed", inset: 0, background: "rgba(26,35,51,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: "var(--radius-xl)", padding: "2rem", width: "100%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(26,35,51,0.15)", animation: "slideUp 0.2s ease-out" },
  modalHeader: { display: "flex", alignItems: "center", marginBottom: "1.5rem" },
  modalTitle: { margin: 0, fontSize: 18, fontFamily: "var(--font-display)", color: "var(--ink)" },
  modalEmpty: { color: "var(--ink-soft)", fontStyle: "italic", fontSize: 14, margin: "0 0 1rem" },
  requestList: { listStyle: "none", padding: 0, margin: "0 0 1.25rem", display: "flex", flexDirection: "column", gap: 10 },
  requestRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--paper)", borderRadius: "var(--radius-md)" },
  reqAvatar: { width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#0ea5e9)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  requestName: { margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" },
  requestEmail: { margin: 0, fontSize: 12, color: "var(--ink-soft)" },
  approveBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  denyBtn: { background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  closeBtn: { width: "100%", padding: "10px", background: "transparent", border: "1px solid var(--paper-shadow)", borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--ink-soft)", cursor: "pointer" },

  formSectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-soft)", margin: "0 0 10px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
  fieldInput: { padding: "10px 14px", border: "1.5px solid var(--paper-shadow)", borderRadius: "var(--radius-md)", fontSize: 14, background: "#fff", color: "var(--ink)", outline: "none" },
  primaryBtn: { background: "linear-gradient(135deg,#2563eb,#0ea5e9)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 3px 10px rgba(37,99,235,0.2)" },
  formError: { background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #fca5a5", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, margin: "0 0 10px" },
  formSuccess: { background: "rgba(22,163,74,0.1)", color: "#15803d", border: "1px solid rgba(22,163,74,0.25)", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, margin: "0 0 10px" },
};
