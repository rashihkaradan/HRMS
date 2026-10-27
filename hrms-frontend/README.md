# HRMS Frontend

React (Vite) frontend for the HRMS backend — employee records, recruitment
pipeline, and the HR policy assistant.

## Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. API calls to `/api/*` are proxied to the
backend at `http://localhost:8000` (see `vite.config.js`) — make sure the
backend is running first, and that it has CORS configured for
`http://localhost:5173` (already set in `app/main.py`).

To create your first login, bootstrap an admin on the backend:
```bash
python -m scripts.create_admin admin@company.com yourpassword "Admin Name"
```

## Pages

| Route            | Purpose                                                        | Access                        |
|-------------------|------------------------------------------------------------------|--------------------------------|
| `/login`          | Sign in                                                          | Public                        |
| `/`                | Overview — headcount, open reqs, pipeline stats                | Any signed-in user            |
| `/employees`       | Employee records — add, view, change status                    | View: all · Edit: HR roles    |
| `/departments`     | Department list                                                 | View: all · Edit: HR roles    |
| `/jobs`             | Job openings                                                     | View: all · Edit: recruiting  |
| `/candidates`       | Candidate records                                                | Recruiting roles only         |
| `/applications`     | Kanban board of applications by pipeline stage                  | Recruiting roles only         |
| `/assistant`        | Ask HR-policy questions (RAG); HR roles can upload policy PDFs  | View: all · Upload: HR roles  |

Role gating in the UI mirrors the backend's `require_roles` checks — it's a
UX convenience, not a security boundary; the API enforces access either way.

## Structure

```
src/
  api/client.js          fetch wrapper, JWT attached from localStorage
  context/AuthContext.jsx  login/logout, current user, role helpers
  components/             Sidebar, Modal, StageBadge, ProtectedRoute
  pages/                   one file per route
  styles/global.css        design tokens + all styling (no CSS framework)
```

No component library or CSS framework — plain CSS with custom properties in
`global.css` for the color/type/spacing tokens.

## Production build

```bash
npm run build
```

Outputs static files to `dist/` — serve with any static host (nginx, Vercel,
Netlify, etc.) and point `vite.config.js`'s proxy target (or your host's env)
at the deployed backend URL. Remember to add the deployed frontend origin to
the backend's `CORSMiddleware` allow list in `app/main.py`.
