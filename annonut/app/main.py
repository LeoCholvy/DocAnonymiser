import os, uuid, yaml
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from redis import Redis
from rq import Queue
from rq.job import Job
from starlette.middleware.sessions import SessionMiddleware
from google_auth_oauthlib.flow import Flow
from app.worker_tasks import task_anonymize, task_process_drive

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
with open("config.yaml", "r") as f: config = yaml.safe_load(f)

app = FastAPI(title="AnnonUT Hybrid")
app.add_middleware(SessionMiddleware, secret_key="super-secret-key")

redis_conn = Redis(host='redis', port=6379)
q_short = Queue("short_tasks", connection=redis_conn)
q_long = Queue("long_tasks", connection=redis_conn)

CLIENT_SECRETS = "client_secret.json"
SCOPES = ['https://www.googleapis.com/auth/drive']

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    creds = request.session.get('credentials')
    status = "🟢 Google Connecté" if creds else "🔴 Google Non connecté"
    return f"""
    <body style="font-family:sans-serif; max-width:900px; margin:auto; padding:30px;">
        <h1>AnnonUT Dashboard</h1>
        <p>Statut : <b>{status}</b> | <a href="/login">Se connecter</a></p>
        <hr>
        <div style="display:flex; gap:40px;">
            <div style="flex:1; border:1px solid #ccc; padding:15px;">
                <h3>📁 Option A : Manuel</h3>
                <form action="/api/v1/upload" method="post" enctype="multipart/form-data">
                    Fichier : <input type="file" name="file" required><br><br>
                    Whitelist: <input type="text" name="whitelist" placeholder="noms séparés par virgule"><br><br>
                    <button type="submit">Lancer l'IA</button>
                </form>
            </div>
            <div style="flex:1; border:1px solid #ccc; padding:15px;">
                <h3>☁️ Option B : Google Drive (Batch)</h3>
                <form action="/api/v1/drive/process" method="post">
                    ID Dossier : <input type="text" name="folder_id" required><br><br>
                    Censurer : <br>
                    <input type="checkbox" name="mask_person" checked> Personnes<br>
                    <input type="checkbox" name="mask_email" checked> Emails<br>
                    <input type="checkbox" name="mask_bank" checked> Banques/IBAN<br><br>
                    <button type="submit" style="background:green; color:white;">Anonymiser tout le dossier</button>
                </form>
            </div>
        </div>
        <p><i>NB : Pour suivre l'avancement, allez sur /api/v1/status/VOTRE_TASK_ID</i></p>
    </body>
    """

# --- OAUTH FLOW ---
@app.get("/login")
def login(request: Request):
    flow = Flow.from_client_secrets_file(CLIENT_SECRETS, scopes=SCOPES, redirect_uri="http://localhost:8000/oauth2callback")
    url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    request.session['state'] = state
    return RedirectResponse(url)

@app.get("/oauth2callback")
def callback(request: Request):
    flow = Flow.from_client_secrets_file(CLIENT_SECRETS, scopes=SCOPES, state=request.session['state'], redirect_uri="http://localhost:8000/oauth2callback")
    flow.fetch_token(authorization_response=str(request.url))
    c = flow.credentials
    request.session['credentials'] = {'token': c.token, 'refresh_token': c.refresh_token, 'token_uri': c.token_uri, 'client_id': c.client_id, 'client_secret': c.client_secret, 'scopes': c.scopes}
    return RedirectResponse("/")

# --- API ROUTES ---
@app.post("/api/v1/upload")
async def manual_upload(file: UploadFile, whitelist: str = Form(""), mask_person: bool = Form(True), mask_email: bool = Form(True), mask_bank: bool = Form(True)):
    task_id = str(uuid.uuid4())
    path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{file.filename}")
    with open(path, "wb") as b: b.write(await file.read())
    options = {"mask_person": mask_person, "mask_email": mask_email, "mask_bank": mask_bank}
    job = q_short.enqueue(task_anonymize, task_id, file.filename, [w.strip() for w in whitelist.split(",") if w], options, job_id=task_id)
    return {"task_id": job.id, "status": "queued"}

@app.post("/api/v1/drive/process")
async def drive_process(request: Request, folder_id: str = Form(...), whitelist: str = Form(""), mask_person: bool = Form(True), mask_email: bool = Form(True), mask_bank: bool = Form(True)):
    creds = request.session.get('credentials')
    if not creds: raise HTTPException(401, "Veuillez vous connecter à Google")
    task_id = str(uuid.uuid4())
    options = {"mask_person": mask_person, "mask_email": mask_email, "mask_bank": mask_bank}
    job = q_long.enqueue(
        task_process_drive,
        task_id,
        folder_id,
        [w.strip() for w in whitelist.split(",") if w],
        options,
        creds,
        job_id=task_id,
        job_timeout=36000 # <-- C'EST ICI ! job_timeout au lieu de timeout
    )
    return {"task_id": job.id, "status": "queued"}

@app.get("/api/v1/status/{task_id}")
async def get_status(task_id: str):
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.refresh()
    except: raise HTTPException(404, "Task non trouvée")
    return {
        "status": job.get_status(),
        "current_file": job.meta.get("current_file"),
        "processed": job.meta.get("processed_files", []),
        "download_url": f"/api/v1/download/{task_id}" if job.is_finished and not job.meta.get("processed_files") else None
    }