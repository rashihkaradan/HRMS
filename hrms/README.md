# HRMS — Core System + RAG Assistant

FastAPI + PostgreSQL + SQLAlchemy 2.0 async, plus a ChromaDB + Gemini RAG layer
for answering HR-policy questions from uploaded documents.

## What's here

- **Auth**: JWT login, role-based access control (`RoleEnum`: SUPER_ADMIN, HR_ADMIN,
  RECRUITER, HR_MANAGER, MANAGER, EMPLOYEE)
- **Employee management**: departments, employees, manager hierarchy (self-referencing FK)
- **Recruitment/ATS**: job openings, candidates, applications with pipeline stages
  (APPLIED → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED)
- **HR Policy Assistant (RAG)**: upload HR policy PDFs, ask natural-language
  questions about them (`app/rag/`, `/assistant` router)

Not yet built: attendance, leave, performance, payroll, onboarding, resume parsing,
AI candidate matching, and an "AI router" that decides DB-query vs RAG vs both for
a given question. These slot in as new modules following the same pattern.

## Setup

```bash
cp .env.example .env
# edit .env — set a real SECRET_KEY (e.g. `openssl rand -hex 32`)

docker compose up --build
```

This starts Postgres on `5432` and the API on `8000` (docs at `/docs`).

Set `GEMINI_API_KEY` in `.env` before using the HR policy assistant. It uses
`gemini-embedding-001` for retrieval and `gemini-3.8-flash` for answers. These
embeddings are incompatible with the previous OpenAI vectors, so upload policy
PDFs again after switching to the `hr_documents_gemini` collection.

### Run migrations

```bash
# inside the backend container, or locally with DATABASE_URL pointed at localhost
alembic revision --autogenerate -m "init"
alembic upgrade head
```

### Default administrator

When the API starts, it creates the following SUPER_ADMIN account if it does not
already exist:

- Email: `admin@company.com`
- Password: `admin123`

Change this default password before deploying the application. `/auth/register`
requires an existing SUPER_ADMIN/HR_ADMIN token. If you need to bootstrap a
different first administrator manually, run:

```bash
docker compose exec backend python -m scripts.create_admin admin@company.com yourpassword "Admin Name"
```

Then log in via `POST /auth/login` (OAuth2 form: `username`=email, `password`) to get
a token, and use `/auth/register` for everyone else.

## Project layout

```
app/
  core/       config, security (JWT/bcrypt), role-check dependency
  db/         async engine + session
  models/     SQLAlchemy ORM: user, employee, recruitment
  schemas/    Pydantic request/response models
  routers/    auth, employees (+ departments), recruitment
scripts/      create_admin.py bootstrap
alembic/      migrations (async-configured)
```

## RAG Assistant (`app/rag/`)

Standard RAG pattern, kept fully separate from the employee/recruitment tables —
ChromaDB only ever holds HR *documents*, never becomes the employee database.

```
app/rag/
  chroma_client.py   persistent local ChromaDB collection for Gemini embeddings
  ingestion.py        PDF -> text -> chunks -> embedded into ChromaDB
  query.py             embed question -> retrieve top-k chunks -> Gemini answers from them
```

**Upload a policy doc** (HR roles only):
```bash
curl -X POST http://localhost:8000/assistant/upload \
  -H "Authorization: Bearer <token>" \
  -F "title=Leave Policy" \
  -F "category=leave" \
  -F "file=@leave_policy.pdf"
```

**Ask a question** (any logged-in employee):
```bash
curl -X POST http://localhost:8000/assistant/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question": "How many days of annual leave do I get?"}'
```
Response includes `answer` and `sources` (which documents it was grounded in).

Note: `/assistant/ask` only answers from uploaded documents — it does **not**
look up an individual's actual leave balance (that's a DB query against the
`employees`/future `leave_requests` tables, not a RAG question). Building the
router that decides "DB query vs RAG vs both" per question is the next step
once leave/attendance tables exist.

Chroma data persists to `CHROMA_PERSIST_DIR` (`./chroma_data` by default,
mounted as a Docker volume so it survives container restarts).

## Candidate match indicator

The HR Applications dashboard shows a match percentage for every applicant and sorts candidates within each pipeline stage by that indicator. It compares the job's required-skill keywords against resume text and candidate-provided skills (40%), assessment answers (30%), and recorded assessment marks (30%). If evidence is missing, the remaining available sources are reweighted. If there is no usable evidence, the dashboard says so. This is a review aid based on submitted text, not a hiring decision or verified skill assessment.
