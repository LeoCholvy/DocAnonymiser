/**
 * Modèle de données représentant l'état d'une tâche d'anonymisation renvoyée par le Server-Sent Events (SSE).
 */
export interface TaskData {
    status: 'queued' | 'started' | 'finished' | 'failed' | 'deleted';
    current_file?: string;
    processed_list?: Array<{
        name: string;
        status: string;
        mots?: number;
        error?: string
    }>;
    download_url?: string;
}