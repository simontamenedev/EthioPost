# EthioPost commission dashboard

A TypeScript/TSX Next.js frontend and a FastAPI backend starter for an EthioPost commission dashboard. The frontend includes a commission overview, Excel import/export, agent/branch/district summaries, and a sign-in screen.

The commission dashboard reads `.xlsx` workbooks locally in the browser. It uses an imported commission column when available, or calculates commission as amount × rate when the workbook has no commission column. Agent, branch, and district columns are mapped during import. Imported data stays in browser memory until a page refresh or tab close and is not sent to FastAPI. Authentication, database storage, and frontend/backend integration are intentionally not implemented.

## Run the frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run the FastAPI backend

In a second terminal, from the project root:

```powershell
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn app.main:app --app-dir backend --reload
```

The health check is at [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health), and interactive API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Frontend pages

- `/` — commission dashboard and totals by agent, branch, and district
- `/login` — sign-in template
- `/reports` — commission summaries and imported entries

Import `.xlsx` files, review the detected column mapping, and export a workbook with a detail sheet plus separate agent, branch, and district summaries.

## Validate

```bash
npm run lint
npm run build
```
