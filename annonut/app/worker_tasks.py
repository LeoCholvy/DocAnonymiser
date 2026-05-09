import os, yaml, time
from rq import get_current_job
from app.engine import process_pdf, process_docx, process_text
from app.gdrive import get_user_drive_service, list_files_recursive, download_file, upload_file

with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)

def get_entities_from_options(options: dict) -> list:
    mapping = {
        "mask_person": "PERSON", "mask_email": "EMAIL_ADDRESS",
        "mask_phone": "PHONE_NUMBER", "mask_location": "LOCATION",
        "mask_bank": ["CREDIT_CARD", "IBAN_CODE", "CRYPTO"]
    }
    entities = []
    for key, is_active in options.items():
        if is_active:
            val = mapping.get(key)
            if isinstance(val, list): entities.extend(val)
            elif val: entities.append(val)
    return entities if entities else ["PERSON"]

def task_anonymize(task_id: str, filename: str, whitelist: list, options: dict):
    """Tâche MANUELLE : Un seul fichier uploadé par le client."""
    input_path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{filename}")
    output_path = os.path.join(config["app"]["processed_dir"], f"{task_id}_[ANONYMIZED]_{filename}")
    entities = get_entities_from_options(options)

    nom = filename.lower()
    if nom.endswith(".pdf"): m = process_pdf(input_path, output_path, whitelist, entities)
    elif nom.endswith(".docx"): m = process_docx(input_path, output_path, whitelist, entities)
    elif nom.endswith((".txt", ".md")): m = process_text(input_path, output_path, whitelist, entities)

    if os.path.exists(input_path): os.remove(input_path)
    return {"status": "success", "mots_masques": m, "output_file": output_path}

def task_process_drive(task_id: str, folder_id: str, whitelist: list, options: dict, creds_dict: dict):
    """Tâche BATCH : Scan récursif du Drive + GDocs."""
    job = get_current_job()
    if job:
        job.meta.update({'processed_files': [], 'current_file': 'Exploration du Drive...'})
        job.save_meta()

    service = get_user_drive_service(creds_dict)
    files = list_files_recursive(service, folder_id)
    entities = get_entities_from_options(options)

    for file in files:
        if "[ANONYMIZED]" in file['name']: continue

        is_gdoc = (file['mimeType'] == 'application/vnd.google-apps.document')
        if not (file['name'].lower().endswith(('.pdf', '.docx', '.txt', '.md')) or is_gdoc):
            continue

        if job:
            job.meta['current_file'] = file['name']
            job.save_meta()

        # Pour les GDocs, on traite en local comme du DOCX
        local_ext = ".docx" if is_gdoc else os.path.splitext(file['name'])[1]
        input_path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{file['name']}{local_ext if is_gdoc else ''}")
        output_path = os.path.join(config["app"]["processed_dir"], f"{task_id}_[ANONYMIZED]_{file['name']}{local_ext if is_gdoc else ''}")

        try:
            download_file(service, file['id'], input_path, file['mimeType'])

            # Routage IA
            if is_gdoc or input_path.lower().endswith(".docx"):
                m = process_docx(input_path, output_path, whitelist, entities)
            elif input_path.lower().endswith(".pdf"):
                m = process_pdf(input_path, output_path, whitelist, entities)
            else:
                m = process_text(input_path, output_path, whitelist, entities)

            # Upload au même endroit (parent_id)
            final_name = file['name'] + "_[ANONYMIZED]" + local_ext
            upload_file(service, file['parent_id'], output_path, final_name)

            if job:
                job.meta['processed_files'].append({"name": file['name'], "status": "✅"})
                job.save_meta()
        except Exception as e:
            if job:
                job.meta['processed_files'].append({"name": file['name'], "status": f"❌ {str(e)}"})
                job.save_meta()
        finally:
            for p in [input_path, output_path]:
                if os.path.exists(p): os.remove(p)
        time.sleep(1)

    if job:
        job.meta['current_file'] = None
        job.save_meta()
    return {"status": "finished"}