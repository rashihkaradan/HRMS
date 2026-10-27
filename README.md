# HRMS

Human Resource Management System for employee records, recruitment, candidate assessments, interview workflows, and HR policy support.

The project has a FastAPI backend and a React/Vite frontend. PostgreSQL stores application data, while ChromaDB and Gemini power answers grounded in uploaded HR policy documents.

## Features

- JWT authentication and role-based access for administrators, HR staff, recruiters, managers, and employees
- Employee and department management
- Recruitment workflows for job openings, candidates, applications, and pipeline stages
- Candidate assessment and application match indicators to support recruiter review
- HR policy assistant that accepts PDF documents and returns answers with sources

## Repository layout

```text
hrms/            FastAPI backend, database migrations, and Docker Compose
hrms-frontend/   React frontend
```

## Run with Docker Compose

Install Docker Desktop or Docker Engine with the Compose plugin. From the backend directory:

```bash
cd hrms
```

Create the environment file from the example, then edit `hrms/.env` and set a strong `SECRET_KEY`. Add a Gemini API key to enable the HR policy assistant.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Start the services:

```bash
docker compose up --build
```

The app is available at:

- Frontend: <http://localhost:5174>
- Backend API: <http://localhost:8000>
- API docs: <http://localhost:8000/docs>
- PostgreSQL: `localhost:5433`

Stop the services with `Ctrl+C`, or run `docker compose down` from `hrms/`. Persistent database and ChromaDB data are stored in Docker volumes.

## Local development

### Backend

Requirements: Python 3.12 recommended and PostgreSQL. Configure `hrms/.env` with a database URL that points to your local PostgreSQL instance. Install the dependencies and run the API from `hrms/`:

```bash
python -m venv .venv
```

Activate the virtual environment, then:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

In a separate terminal, run from `hrms-frontend/`:

```bash
npm install
npm run dev
```

Vite serves the frontend at <http://localhost:5173> and proxies `/api` requests to the backend. Keep the backend running while using the frontend.

## First login

On startup, the backend creates a default administrator if one does not already exist:

- Email: `admin@company.com`
- Password: `admin123`

Change this password immediately and use a strong secret key before deploying or exposing the app. You can create an administrator manually from `hrms/` with:

```bash
python -m scripts.create_admin admin@company.com yourpassword "Admin Name"
```

## HR policy assistant

Set `GEMINI_API_KEY` in `hrms/.env` to use Gemini for embeddings and answers. HR-authorized users can upload policy PDFs; signed-in users can ask questions and see the documents used as sources. The assistant answers from uploaded policy documents and does not retrieve individual employee or leave records.

## Database migrations

Run Alembic commands from `hrms/` with the environment configured:

```bash
alembic upgrade head
```

## Build the frontend

From `hrms-frontend/`:

```bash
npm run build
```

The production bundle is written to `hrms-frontend/dist/`.
