import os, yaml, time, csv
from rq import get_current_job
from app.engine import process_pdf, process_docx, process_text
from app.gdrive import get_user_drive_service, list_files_recursive, download_file, upload_file, create_folder, move_file

with open("config.yaml", "r") as f: config = yaml.safe_load(f)

def get_entities_from_options(options: dict) -> list:
    mapping = {
        "mask_person": "PERSON", "mask_email": "EMAIL_ADDRESS",
        "mask_phone": "PHONE_NUMBER", "mask_location": "LOCATION",
        "mask_bank": ["CREDIT_CARD", "IBAN_CODE", "CRYPTO"]
    }
    entities = []
    for key, is_active in options.items():
        if key in mapping and is_active:
            val = mapping[key]
            if isinstance(val, list): entities.extend(val)
            elif val: entities.append(val)
    return entities if entities else ["PERSON"]

def task_anonymize(task_id: str, filename: str, whitelist: list, options: dict):
    input_path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{filename}")
    output_path = os.path.join(config["app"]["processed_dir"], f"{task_id}_[ANONYMIZED]_{filename}")
    entities = get_entities_from_options(options)

    nom = filename.lower()
    if nom.endswith(".pdf"): m = process_pdf(input_path, output_path, whitelist, entities)
    elif nom.endswith(".docx"): m = process_docx(input_path, output_path, whitelist, entities)
    elif nom.endswith((".txt", ".md", ".csv")): m = process_text(input_path, output_path, whitelist, entities)

    if os.path.exists(input_path): os.remove(input_path)
    return {"status": "success", "mots_masques": m, "output_file": output_path}

def task_process_drive(task_id: str, folder_id: str, whitelist: list, options: dict, creds_dict: dict):
    job = get_current_job()
    if job:
        job.meta.update({'processed_files': [], 'current_file': 'Exploration du Drive...'})
        job.save_meta()

    service = get_user_drive_service(creds_dict)
    files = list_files_recursive(service, folder_id)
    entities = get_entities_from_options(options)

    action_orig = options.get("action_orig", "keep") # "keep" ou "move"
    report_format = options.get("report_format", "md") # "md", "csv", "none"

    archive_folder_id = None
    if action_orig == "move":
        # Création du dossier d'archives à la racine du dossier ciblé
        archive_folder_id = create_folder(service, f"[UNANONYZED]_Archives_{task_id[:4]}", folder_id)

    report_data = [] # Pour stocker les infos du rapport

    for file in files:
        if "[ANONYMIZED]" in file['name']: continue

        is_gdoc = (file['mimeType'] == 'application/vnd.google-apps.document')
        if not (file['name'].lower().endswith(('.pdf', '.docx', '.txt', '.md', '.csv')) or is_gdoc):
            continue

        if job:
            job.meta['current_file'] = file['name']
            job.save_meta()

        local_ext = ".docx" if is_gdoc else os.path.splitext(file['name'])[1]
        input_path = os.path.join(config["app"]["upload_dir"], f"{task_id}_{file['name']}{local_ext if is_gdoc else ''}")
        output_path = os.path.join(config["app"]["processed_dir"], f"{task_id}_[ANONYMIZED]_{file['name']}{local_ext if is_gdoc else ''}")

        m = 0
        status_msg = "✅ Succès"
        try:
            download_file(service, file['id'], input_path, file['mimeType'])

            if is_gdoc or input_path.lower().endswith(".docx"): m = process_docx(input_path, output_path, whitelist, entities)
            elif input_path.lower().endswith(".pdf"): m = process_pdf(input_path, output_path, whitelist, entities)
            else: m = process_text(input_path, output_path, whitelist, entities)

            # Upload de la version anonymisée
            final_name = file['name'] + "_[ANONYMIZED]" + local_ext
            # upload_file(service, file['parent_id'], output_path, final_name)
            upload_file(
                service,
                file['parent_id'],
                output_path,
                final_name,
                convert_to_gdoc=is_gdoc  # <-- Utilise le flag détecté au début
            )

            # Déplacement de l'original si demandé
            if action_orig == "move" and archive_folder_id:
                move_file(service, file['id'], archive_folder_id, file['parent_id'])

            if job:
                job.meta['processed_files'].append({"name": file['name'], "mots": m, "status": "✅"})
                job.save_meta()

        except Exception as e:
            status_msg = f"❌ Erreur ({str(e)})"
            if job:
                job.meta['processed_files'].append({"name": file['name'], "error": str(e), "status": "❌"})
                job.save_meta()
        finally:
            report_data.append({"fichier": file['name'], "statut": status_msg, "mots": m})
            for p in [input_path, output_path]:
                if os.path.exists(p): os.remove(p)
        time.sleep(1)

    # GÉNÉRATION DU RAPPORT
    if report_format != "none" and report_data:
        report_path = os.path.join(config["app"]["processed_dir"], f"rapport_{task_id}.{report_format}")

        if report_format == "md":
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(f"# Rapport AnnonUT - {task_id}\n\n| Fichier | Statut | Masqués |\n|---|---|---|\n")
                for r in report_data: f.write(f"| {r['fichier']} | {r['statut']} | {r['mots']} |\n")

        elif report_format == "csv":
            with open(report_path, "w", encoding="utf-8", newline='') as f:
                writer = csv.writer(f, delimiter=';')
                writer.writerow(["Fichier Original", "Statut", "Entités Masquées"])
                for r in report_data: writer.writerow([r['fichier'], r['statut'], r['mots']])

        upload_file(service, folder_id, report_path, f"Rapport_Anonymisation.{report_format}")
        os.remove(report_path)

    if job:
        job.meta['current_file'] = None
        job.save_meta()
    return {"status": "finished"}