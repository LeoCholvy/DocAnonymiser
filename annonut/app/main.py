import os, uuid, yaml, time, json, asyncio
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, StreamingResponse
from redis import Redis
from rq import Queue
from rq.job import Job
from starlette.middleware.sessions import SessionMiddleware
from google_auth_oauthlib.flow import Flow
from app.worker_tasks import task_anonymize, task_process_drive
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# CONFIGURATION INITIALE
# ==========================================
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Chargement de la configuration
with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)

app = FastAPI(title="AnnonUT Ultimate", description="API d'anonymisation de documents via Google Drive et Upload local.")

# Gestion des sessions (nécessaire pour OAuth)
app.add_middleware(SessionMiddleware, secret_key="super-secret-key-annonut")

# Autorisation CORS pour permettre au Front-end React (port 5173) de communiquer avec l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connexion à Redis et configuration des files d'attente (Queues RQ)
redis_conn = Redis(host='redis', port=6379)
q_short = Queue("short_tasks", connection=redis_conn)
q_long = Queue("long_tasks", connection=redis_conn)

# Identifiants Google OAuth
CLIENT_SECRETS = "client_secret.json"
SCOPES = ['https://www.googleapis.com/auth/drive']


# ==========================================
# GESTION DU CYCLE DE VIE DU SERVEUR
# ==========================================
@app.on_event("startup")
async def startup_event():
    """Événement déclenché au lancement de FastAPI."""

    # 1. Création des dossiers nécessaires pour éviter l'erreur FileNotFoundError
    os.makedirs(config["app"]["upload_dir"], exist_ok=True)
    os.makedirs(config["app"]["processed_dir"], exist_ok=True)

    # 2. Lancement de la tâche de nettoyage en arrière-plan
    asyncio.create_task(cleanup_loop())

# ==========================================
# ROUTE : LISTE BLANCHE PAR DÉFAUT
# ==========================================
@app.get("/api/v1/whitelist")
async def get_default_whitelist():
    """Renvoie la liste blanche par défaut (Jargon UTC, Assos, Outils Dev)."""
    try:
        # Assure-toi que le chemin correspond à l'endroit où tu as créé le fichier
        whitelist_path = os.path.join(os.path.dirname(__file__), "default_whitelist.json")
        with open(whitelist_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        # Fallback de sécurité si le fichier n'est pas trouvé
        return ["UTC", "Compiègne", "React", "FastAPI"]

async def cleanup_loop():
    """Vérifie toutes les minutes si des fichiers ont expiré pour les supprimer proprement."""
    while True:
        now = time.time()
        # Récupère tous les task_ids dont le timestamp d'expiration est dépassé (<= maintenant)
        expired_tasks = redis_conn.zrangebyscore("file_expirations", 0, now)

        for task_id in expired_tasks:
            if isinstance(task_id, bytes): task_id = task_id.decode('utf-8')
            try:
                job = Job.fetch(task_id, connection=redis_conn)
                out_file = job.result.get("output_file") if job.result else None

                # Suppression du fichier physique s'il existe
                if out_file and os.path.exists(out_file):
                    os.remove(out_file)

                # Suppression du job de la base Redis
                job.delete()
            except Exception:
                pass # Si le job est déjà supprimé, on ignore

            # Retrait de la tâche de la liste de surveillance d'expiration
            redis_conn.zrem("file_expirations", task_id)

        await asyncio.sleep(60) # Pause d'une minute avant le prochain cycle


# ==========================================
# ROUTES D'AUTHENTIFICATION GOOGLE OAUTH2
# ==========================================
@app.get("/login")
def login(request: Request):
    """Initie le flux de connexion Google OAuth2."""
    flow = Flow.from_client_secrets_file(CLIENT_SECRETS, scopes=SCOPES, redirect_uri="http://localhost:8000/oauth2callback")
    url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    request.session['state'] = state
    return RedirectResponse(url)

@app.get("/oauth2callback")
def callback(request: Request):
    """Gère le retour de Google après l'authentification de l'utilisateur."""
    # Interception d'éventuelles erreurs renvoyées par Google (ex: "access_denied")
    error = request.query_params.get("error")
    if error:
        raise HTTPException(400, f"Erreur Google OAuth: {error}")

    # Récupération du code et du state depuis l'URL
    code = request.query_params.get("code")
    state_from_url = request.query_params.get("state")

    if not code:
        raise HTTPException(400, "Code d'autorisation manquant dans l'URL.")

    # Injection du state reçu pour bypasser l'erreur de mismatching_state (utile en dév local)
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS,
        scopes=SCOPES,
        state=state_from_url,
        redirect_uri="http://localhost:8000/oauth2callback"
    )

    # Récupération du token final
    flow.fetch_token(code=code)

    # Sauvegarde des identifiants dans la session
    c = flow.credentials
    request.session['credentials'] = {
        'token': c.token, 'refresh_token': c.refresh_token, 'token_uri': c.token_uri,
        'client_id': c.client_id, 'client_secret': c.client_secret, 'scopes': c.scopes
    }

    # Redirection vers l'interface React
    return RedirectResponse("http://localhost:5173/drive")


# ==========================================
# ROUTES DE TRAITEMENT (UPLOAD & DRIVE)
# ==========================================
@app.post("/api/v1/upload")
async def manual_upload(
        file: UploadFile, whitelist: str = Form(""),
        mask_person: bool = Form(True), mask_email: bool = Form(True),
        mask_phone: bool = Form(True), mask_location: bool = Form(True), mask_bank: bool = Form(True)
):
    """Reçoit un fichier unique uploadé manuellement et l'ajoute à la file d'attente courte."""
    task_id = str(uuid.uuid4())
    path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{file.filename}")

    # Enregistrement du fichier original sur le disque
    with open(path, "wb") as b:
        b.write(await file.read())

    options = {
        "mask_person": mask_person, "mask_email": mask_email,
        "mask_phone": mask_phone, "mask_location": mask_location, "mask_bank": mask_bank
    }

    # Ajout à la queue Redis
    job = q_short.enqueue(task_anonymize, task_id, file.filename, [w.strip() for w in whitelist.split(",") if w], options, job_id=task_id)
    return {"task_id": job.id, "status": "queued"}

@app.post("/api/v1/drive/process")
async def drive_process(
        request: Request, folder_id: str = Form(...), whitelist: str = Form(""),
        mask_person: bool = Form(True), mask_email: bool = Form(True),
        mask_phone: bool = Form(True), mask_location: bool = Form(True), mask_bank: bool = Form(True),
        action_orig: str = Form("keep"), report_format: str = Form("md")
):
    """Lance un traitement par lot sur un dossier Google Drive et l'ajoute à la file d'attente longue."""
    creds = request.session.get('credentials')
    if not creds: raise HTTPException(401, "Connectez-vous à Google")

    task_id = str(uuid.uuid4())
    options = {
        "mask_person": mask_person, "mask_email": mask_email, "mask_phone": mask_phone,
        "mask_location": mask_location, "mask_bank": mask_bank,
        "action_orig": action_orig, "report_format": report_format
    }

    # Ajout à la queue Redis longue (timeout rallongé pour les gros dossiers)
    job = q_long.enqueue(
        task_process_drive, task_id, folder_id,
        [w.strip() for w in whitelist.split(",") if w],
        options, creds, job_id=task_id, job_timeout=36000
    )
    return {"task_id": job.id, "status": "queued"}


# ==========================================
# ROUTES DE SUIVI (SSE) ET DE TÉLÉCHARGEMENT
# ==========================================
@app.get("/api/v1/stream_status/{task_id}")
async def stream_status(task_id: str):
    """Point d'entrée SSE (Server-Sent Events) pour informer le client en temps réel."""
    async def event_generator():
        while True:
            try:
                job = Job.fetch(task_id, connection=redis_conn)
                job.refresh()
            except:
                # Si le job n'existe plus (supprimé par la boucle de nettoyage)
                yield f"data: {json.dumps({'status': 'deleted'})}\n\n"
                break

            status = job.get_status()
            download_url = None

            if status == "finished":
                output_file = job.result.get("output_file") if job.result else None
                # Vérifie si le fichier physique a été supprimé
                if output_file and not os.path.exists(output_file):
                    yield f"data: {json.dumps({'status': 'deleted'})}\n\n"
                    break
                else:
                    # Construction de l'URL de téléchargement
                    download_url = f"/api/v1/download/{task_id}"

            # Construction du payload de réponse
            res = {
                "status": status,
                "current_file": job.meta.get("current_file"),
                "processed_list": job.meta.get("processed_files", []),
                "download_url": download_url
            }

            # Envoi des données au client
            yield f"data: {json.dumps(res)}\n\n"

            # Si le job est terminé (succès ou échec), on arrête le flux
            if status in ["finished", "failed"]:
                break

            await asyncio.sleep(1.5) # Fréquence de rafraîchissement

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/v1/download/{task_id}")
async def download_file(task_id: str):
    """Permet de télécharger le fichier anonymisé et réduit son temps de vie restant à 30 min."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
    except:
        raise HTTPException(404, "Tâche introuvable.")

    if not job.is_finished:
        raise HTTPException(400, "Le fichier n'est pas encore prêt.")

    output_file = job.result.get("output_file")
    if not os.path.exists(output_file):
        raise HTTPException(404, "Le fichier a expiré et été supprimé du serveur.")

    # ---------------------------------------------------------
    # GESTION DU TTL : Réduction à 30 minutes après téléchargement
    # ---------------------------------------------------------
    current_expiry = redis_conn.zscore("file_expirations", task_id)
    new_expiry = time.time() + 1800 # 30 minutes (1800 secondes) depuis maintenant

    # On met à jour l'expiration uniquement si 30 minutes est plus court que le temps restant initial
    if current_expiry and new_expiry < current_expiry:
        redis_conn.zadd("file_expirations", {task_id: new_expiry})

    # Renvoi du fichier avec le préfixe task_id nettoyé du nom
    return FileResponse(
        path=output_file,
        filename=os.path.basename(output_file).replace(f"{task_id}_", "")
    )


# ==========================================
# PAGE DE TEST LOCALE (BACKBACK)
# ==========================================
@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Un dashboard minimaliste généré par FastAPI pour des tests directs côté back."""
    creds = request.session.get('credentials')
    status = "🟢 Connecté à Google" if creds else "🔴 Non connecté"
    return f"""
    <body style="font-family:sans-serif; max-width:900px; margin:auto; padding:30px; background:#f4f7f6;">
        <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1>AnnonUT Ultimate Dashboard</h1>
            <p>Statut Google Drive : <b>{status}</b> | <a href="/login">Se connecter</a></p>
            <hr>
            <h3>📁 Option de test : Upload Manuel Rapide</h3>
            <form action="/api/v1/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="file" required> 
                <button type="submit">Anonymiser ce fichier</button>
            </form>
        </div>
    </body>
    """