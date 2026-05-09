import os, uuid, yaml
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from redis import Redis
from rq import Queue
from rq.job import Job
from starlette.middleware.sessions import SessionMiddleware
from google_auth_oauthlib.flow import Flow
from app.worker_tasks import task_anonymize, task_process_drive
from fastapi.middleware.cors import CORSMiddleware


os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
with open("config.yaml", "r") as f: config = yaml.safe_load(f)

app = FastAPI(title="AnnonUT Ultimate")
app.add_middleware(SessionMiddleware, secret_key="super-secret-key-annonut")
# Autoriser le Front-end (port 5173) à parler à l'API (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # L'adresse de ton React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_conn = Redis(host='redis', port=6379)
q_short = Queue("short_tasks", connection=redis_conn)
q_long = Queue("long_tasks", connection=redis_conn)

CLIENT_SECRETS = "client_secret.json"
SCOPES = ['https://www.googleapis.com/auth/drive']

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    creds = request.session.get('credentials')
    status = "🟢 Connecté à Google" if creds else "🔴 Non connecté"
    return f"""
    <body style="font-family:sans-serif; max-width:900px; margin:auto; padding:30px; background:#f4f7f6;">
        <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1>AnnonUT Ultimate Dashboard</h1>
            <p>Statut Google Drive : <b>{status}</b> | <a href="/login">Se connecter</a></p>
            <hr>
            
            <form action="/api/v1/drive/process" method="post">
                <h2 style="color:#2c3e50;">🚀 Batch Anonymisation (Dossiers & GDocs)</h2>
                
                <div style="display:flex; gap:20px;">
                    <div style="flex:1; background:#e8f4fd; padding:15px; border-radius:5px;">
                        <b>1. Cible & Filtres :</b><br><br>
                        ID Dossier : <input type="text" name="folder_id" style="width:100%;" required placeholder="1l5Q2SA..."><br><br>
                        
                        <input type="checkbox" name="mask_person" checked> Noms<br>
                        <input type="checkbox" name="mask_email" checked> Emails<br>
                        <input type="checkbox" name="mask_phone" checked> Téléphones<br>
                        <input type="checkbox" name="mask_location" checked> Lieux<br>
                        <input type="checkbox" name="mask_bank" checked> Banques (IBAN, CB)<br><br>
                        
                        Whitelist : <input type="text" name="whitelist" placeholder="ex: Tours, Jean" style="width:100%;">
                    </div>
                    
                    <div style="flex:1; background:#fff3e0; padding:15px; border-radius:5px;">
                        <b>2. Options de sortie :</b><br><br>
                        
                        <i>Que faire des originaux ?</i><br>
                        <label><input type="radio" name="action_orig" value="keep" checked> Laisser à côté (avec tag [ANONYMIZED])</label><br>
                        <label><input type="radio" name="action_orig" value="move"> Déplacer dans un dossier [UNANONYZED]_Archives</label><br><br>
                        
                        <i>Rapport de traitement :</i><br>
                        <label><input type="radio" name="report_format" value="md" checked> Fichier Markdown (.md)</label><br>
                        <label><input type="radio" name="report_format" value="csv"> Fichier Excel (.csv)</label><br>
                        <label><input type="radio" name="report_format" value="none"> Aucun rapport</label>
                    </div>
                </div>
                <br>
                <button type="submit" style="width:100%; background:#27ae60; color:white; padding:15px; border:none; border-radius:5px; font-size:18px; cursor:pointer;">
                    Démarrer l'Anonymisation Massive
                </button>
            </form>
            
            <hr style="margin:30px 0;">
            <h3>📁 Option alternative : Upload Manuel</h3>
            <form action="/api/v1/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="file" required> 
                <button type="submit">Anonymiser ce fichier</button>
            </form>
        </div>
    </body>
    """

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
    request.session['credentials'] = {
        'token': c.token, 'refresh_token': c.refresh_token, 'token_uri': c.token_uri,
        'client_id': c.client_id, 'client_secret': c.client_secret, 'scopes': c.scopes
    }
    return RedirectResponse("http://localhost:5173/drive")

@app.post("/api/v1/upload")
async def manual_upload(
        file: UploadFile, whitelist: str = Form(""),
        mask_person: bool = Form(True), mask_email: bool = Form(True),
        mask_phone: bool = Form(True), mask_location: bool = Form(True), mask_bank: bool = Form(True)
):
    task_id = str(uuid.uuid4())
    path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{file.filename}")
    with open(path, "wb") as b: b.write(await file.read())

    options = {"mask_person": mask_person, "mask_email": mask_email, "mask_phone": mask_phone, "mask_location": mask_location, "mask_bank": mask_bank}
    job = q_short.enqueue(task_anonymize, task_id, file.filename, [w.strip() for w in whitelist.split(",") if w], options, job_id=task_id)
    return {"task_id": job.id, "status": "queued"}

@app.post("/api/v1/drive/process")
async def drive_process(
        request: Request, folder_id: str = Form(...), whitelist: str = Form(""),
        mask_person: bool = Form(True), mask_email: bool = Form(True),
        mask_phone: bool = Form(True), mask_location: bool = Form(True), mask_bank: bool = Form(True),
        action_orig: str = Form("keep"), report_format: str = Form("md")
):
    creds = request.session.get('credentials')
    if not creds: raise HTTPException(401, "Connectez-vous à Google")

    task_id = str(uuid.uuid4())
    options = {
        "mask_person": mask_person, "mask_email": mask_email, "mask_phone": mask_phone,
        "mask_location": mask_location, "mask_bank": mask_bank,
        "action_orig": action_orig, "report_format": report_format
    }

    job = q_long.enqueue(
        task_process_drive, task_id, folder_id,
        [w.strip() for w in whitelist.split(",") if w],
        options, creds, job_id=task_id, job_timeout=36000
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
        "processed_list": job.meta.get("processed_files", []),
        "download_url": f"/api/v1/download/{task_id}" if job.is_finished and not job.meta.get("processed_files") else None
    }

@app.get("/api/v1/download/{task_id}")
async def download_file(task_id: str):
    try: job = Job.fetch(task_id, connection=redis_conn)
    except: raise HTTPException(404)
    if not job.is_finished: raise HTTPException(400, "Non prêt")

    output_file = job.result.get("output_file")
    if not os.path.exists(output_file): raise HTTPException(404, "Supprimé")
    return FileResponse(path=output_file, filename=os.path.basename(output_file).replace(f"{task_id}_", ""))