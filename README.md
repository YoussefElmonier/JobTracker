# JobTrackr 🎯

> **Your job search, organized.** — A smart, full-stack job application tracker.

![Stack](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![Node](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js) ![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb) ![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens)

---

## Features

- 📋 **Kanban Board** — Drag & drop applications across 5 stages
- 📊 **Dashboard** — Stats, charts, weekly goal tracker
- 🔔 **Reminders** — Overdue/today follow-ups sorted by urgency
- 🔐 **JWT Auth** — Secure register/login, all routes user-scoped
- 🌙 **Dark Navy UI** — Notion-inspired, fully responsive

---

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | React 19 (Vite), React Router v6        |
| Charts    | Recharts (AreaChart)                    |
| DnD       | @hello-pangea/dnd                       |
| Backend   | Node.js + Express                       |
| Database  | MongoDB + Mongoose                      |
| Auth      | JWT + bcryptjs                          |
| Styling   | Vanilla CSS (design tokens)             |

---

## Project Structure

```
JobTracker/
├── client/          # React + Vite frontend (port 3000)
│   └── src/
│       ├── api/         # Axios instance
│       ├── components/  # Sidebar, AddJobModal, ProtectedRoute
│       ├── context/     # AuthContext
│       ├── hooks/       # useJobs (CRUD)
│       └── pages/       # Landing, Login, Register, Dashboard, Kanban, Reminders
│
└── server/          # Express API (port 5000)
    ├── models/      # User, Job (Mongoose)
    ├── routes/      # /api/auth, /api/jobs
    └── middleware/  # JWT auth guard
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (or MongoDB Atlas URI)

### 1. Clone & Install

```bash
git clone <repo-url>
cd JobTracker

# Install root deps (concurrently)
npm install

# Install client deps
cd client && npm install && cd ..

# Install server deps
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy and edit the server .env
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/jobtrackr
JWT_SECRET=your_very_long_random_secret_here
CLIENT_URL=http://localhost:3000
```

### 3. Run (Development)

```bash
# From root — starts both client + server
npm run dev
```

Or separately:
```bash
# Terminal 1 — Express API
cd server && npm run dev

# Terminal 2 — React app
cd client && npm run dev
```

### URLs
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api
- **Health**: http://localhost:5000/api/health

---

## API Reference

### Auth
| Method | Endpoint              | Auth | Description       |
|--------|-----------------------|------|-------------------|
| POST   | `/api/auth/register`  | ❌   | Create account    |
| POST   | `/api/auth/login`     | ❌   | Login, get token  |
| GET    | `/api/auth/me`        | ✅   | Get current user  |

### Jobs
| Method | Endpoint          | Auth | Description          |
|--------|-------------------|------|----------------------|
| GET    | `/api/jobs`       | ✅   | Get all user's jobs  |
| POST   | `/api/jobs`       | ✅   | Create a job         |
| PUT    | `/api/jobs/:id`   | ✅   | Update a job         |
| DELETE | `/api/jobs/:id`   | ✅   | Delete a job         |

All `/api/jobs` routes are scoped to the authenticated user.

---

## Status Values

| Status      | Kanban Column        | Badge Color  |
|-------------|----------------------|-------------|
| `applied`   | Applied              | Indigo       |
| `interview` | Interview Scheduled  | Cyan         |
| `waiting`   | Waiting              | Amber        |
| `offer`     | Offer Received       | Emerald      |
| `rejected`  | Rejected             | Rose         |
