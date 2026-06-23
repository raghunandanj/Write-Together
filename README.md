<div align="center">
  <h1>✨ Write-Together - Collaborative Document Editor</h1>
  <p><strong>Write-Together is a full-stack, real-time collaborative document editor built on the MERN stack and Socket.io. </strong></p>
  <p><strong><a href="https://link-ink-buy0.onrender.com" target="_blank">🟢 Live Demo: link-ink-buy0.onrender.com</a></strong></p>

  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
  ![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
  ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
  ![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
</div>

<br />


## ✨ Key Features

- **Real-Time Collaboration:** Powered by Socket.io and Quill.js Deltas, changes are synced instantly across all connected clients without sending the entire document over the wire.
- **Robust Access Control:** Share rooms securely using a unique 6-character room code. Owners can grant Read-Write or Read-Only access.
- **Approval Workflow:** New users request access, and owners must explicitly approve or deny them from their dashboard.
- **Historical Snapshots:** Owners can capture named versions of the document at any time and instantly restore them if a mistake is made.
- **Live Presence:** See exactly who is currently online and viewing the document.
- **Secure Authentication:** JWT-based authentication with bcrypt-hashed passwords. Security is enforced at both the REST API level and the persistent WebSocket connection level.
- **Beautiful UI/UX:** Custom-built design system featuring micro-animations, glassmorphism, dynamic dusk/star backgrounds, and highly polished custom modals for a premium feel.

## 🛠 Tech Stack

**Frontend:** React 18, Vite, React Router, React Quill (Delta sync), Socket.io-client, CSS (Vanilla Custom Properties & Media Queries)

**Backend:** Node.js, Express, MongoDB (Mongoose), Socket.io, JWT, bcryptjs

## ⚙️ Setup

### 1. Clone & Install

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment Variables

Create `.env` files in both the client and server directories based on your local setup.

**`server/.env`**
```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

### 3. Run

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open http://localhost:5173

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Email/password login
- `PUT /api/auth/profile` — Update user name and email
- `PUT /api/auth/password` — Update user password

### Documents & Collaboration
- `GET /api/documents` — List all owned, joined, or pending documents
- `POST /api/documents` — Create a new document
- `GET /api/documents/:id` — Get document content and metadata
- `PUT /api/documents/:id` — Update document title
- `POST /api/documents/join` — Request access to a room using a code
- `DELETE /api/documents/:id` — Delete a document (Owner only)
- `POST /api/documents/:id/leave` — Leave a shared room

### Access Control & Snapshots
- `GET /api/documents/:id/requests` — View pending access requests
- `POST /api/documents/:id/requests/:userId/:action` — Approve or deny a request
- `PUT /api/documents/:id/collaborators/:userId/access` — Change a collaborator's access level (read-only / read-write)
- `DELETE /api/documents/:id/collaborators/:userId` — Remove a collaborator
- `POST /api/documents/:id/snapshots` — Save a version snapshot
- `GET /api/documents/:id/snapshots` — List all snapshots
- `POST /api/documents/:id/snapshots/:snapshotId/restore` — Restore a snapshot

## 🔐 Test Accounts

There are no pre-seeded accounts. Create them via the signup flow:

- **Owner** — Register and create a document.
- **Collaborator** — Register a second account, paste the room code to request access, and have the Owner approve it via the Requests dashboard.

