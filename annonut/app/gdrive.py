import io
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload

def get_user_drive_service(credentials_dict):
    """Initialise la connexion avec les accès de l'utilisateur (OAuth2)."""
    creds = Credentials(**credentials_dict)
    return build('drive', 'v3', credentials=creds)

def list_files_recursive(service, folder_id):
    """Explore tous les sous-dossiers pour trouver les fichiers."""
    all_items = []
    query = f"'{folder_id}' in parents and trashed = false"

    results = service.files().list(
        q=query,
        fields="nextPageToken, files(id, name, mimeType)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    for item in results.get('files', []):
        if item['mimeType'] == 'application/vnd.google-apps.folder':
            # C'est un dossier : on descend récursivement
            all_items.extend(list_files_recursive(service, item['id']))
        else:
            # C'est un fichier : on mémorise le parent pour uploader au même endroit
            item['parent_id'] = folder_id
            all_items.append(item)
    return all_items

def download_file(service, file_id, save_path, mime_type=None):
    """Télécharge un fichier ou exporte un GDoc en DOCX."""
    if mime_type == 'application/vnd.google-apps.document':
        # Conversion GDoc -> DOCX
        request = service.files().export_media(
            fileId=file_id,
            mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    else:
        request = service.files().get_media(fileId=file_id)

    fh = io.FileIO(save_path, 'wb')
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while done is False:
        status, done = downloader.next_chunk()

def upload_file(service, folder_id, file_path, new_name):
    """Upload vers le Drive (Compatible Dossiers Partagés)."""
    file_metadata = {'name': new_name, 'parents': [folder_id]}
    media = MediaFileUpload(file_path, resumable=True)
    return service.files().create(body=file_metadata, media_body=media, fields='id', supportsAllDrives=True).execute()