import io
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload

def get_user_drive_service(credentials_dict):
    creds = Credentials(**credentials_dict)
    return build('drive', 'v3', credentials=creds)

def list_files_recursive(service, folder_id):
    """Explore tous les sous-dossiers en ignorant les dossiers d'archives."""
    all_items = []
    query = f"'{folder_id}' in parents and trashed = false"

    results = service.files().list(q=query, fields="nextPageToken, files(id, name, mimeType)", supportsAllDrives=True, includeItemsFromAllDrives=True).execute()

    for item in results.get('files', []):
        if item['name'].startswith('[UNANONYZED]'):
            continue # On ne scanne pas les dossiers d'archives !

        if item['mimeType'] == 'application/vnd.google-apps.folder':
            all_items.extend(list_files_recursive(service, item['id']))
        else:
            item['parent_id'] = folder_id
            all_items.append(item)
    return all_items

def download_file(service, file_id, save_path, mime_type=None):
    if mime_type == 'application/vnd.google-apps.document':
        request = service.files().export_media(fileId=file_id, mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    else:
        request = service.files().get_media(fileId=file_id)

    fh = io.FileIO(save_path, 'wb')
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while done is False: status, done = downloader.next_chunk()

def upload_file(service, folder_id, file_path, new_name):
    file_metadata = {'name': new_name, 'parents': [folder_id]}
    media = MediaFileUpload(file_path, resumable=True)
    return service.files().create(body=file_metadata, media_body=media, fields='id', supportsAllDrives=True).execute()

def create_folder(service, folder_name, parent_id):
    """Crée un dossier dans Google Drive."""
    file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent_id]}
    file = service.files().create(body=file_metadata, fields='id', supportsAllDrives=True).execute()
    return file.get('id')

def move_file(service, file_id, new_parent_id, old_parent_id):
    """Déplace un fichier d'un dossier à un autre."""
    return service.files().update(fileId=file_id, addParents=new_parent_id, removeParents=old_parent_id, fields='id, parents', supportsAllDrives=True).execute()