// Centralized access check so the rule "who can view/edit this document"
// lives in exactly one place, instead of being copy-pasted into every
// REST route and every socket handler (and risking them drifting apart).

function isOwner(doc, userId) {
  const ownerId = doc.owner?._id || doc.owner;
  return ownerId.toString() === userId.toString();
}

function isCollaborator(doc, userId) {
  return doc.collaborators.some((c) => {
    const cid = c?._id || c;
    return cid.toString() === userId.toString();
  });
}

// Approved access = owner OR an already-approved collaborator.
// Does NOT include pending requesters - they can't view/edit yet.
function hasAccess(doc, userId) {
  return isOwner(doc, userId) || isCollaborator(doc, userId);
}

function hasPendingRequest(doc, userId) {
  return doc.pendingRequests.some((r) => r.user.toString() === userId.toString());
}

module.exports = { isOwner, isCollaborator, hasAccess, hasPendingRequest };
