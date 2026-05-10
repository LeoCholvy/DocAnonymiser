import { useState, useEffect } from 'react';
import type { TaskData } from '../models/TaskData';

/**
 * Custom Hook gérant la connexion Server-Sent Events (SSE) et la persistance locale.
 * @param storageKey La clé utilisée pour sauvegarder l'ID de la tâche dans le localStorage.
 */
export function useTaskStream(storageKey: string) {
    // Initialisation depuis le localStorage pour survivre aux rechargements de page
    const [taskId, setTaskId] = useState<string | null>(localStorage.getItem(storageKey));

    // Typage strict avec l'interface TaskData (remplace le 'any')
    const [taskData, setTaskData] = useState<TaskData | null>(null);

    useEffect(() => {
        if (!taskId) return;

        // Sauvegarde l'ID de la tâche active
        localStorage.setItem(storageKey, taskId);

        // Ouvre le canal de communication temps réel avec le serveur
        const eventSource = new EventSource(`/api/v1/stream_status/${taskId}`);

        eventSource.onmessage = (e) => {
            const data: TaskData = JSON.parse(e.data);
            setTaskData(data);

            // Fermeture de la connexion si la tâche a un statut terminal
            if (['finished', 'failed', 'deleted'].includes(data.status)) {
                eventSource.close();
                // Nettoyage automatique si le serveur indique que le fichier est purgé
                if (data.status === 'deleted') {
                    localStorage.removeItem(storageKey);
                }
            }
        };

        // Fermeture propre en cas d'erreur réseau
        eventSource.onerror = () => eventSource.close();

        // Cleanup lors du démontage du composant
        return () => eventSource.close();
    }, [taskId, storageKey]);

    /**
     * Permet à l'utilisateur de vider la file d'attente visuelle et de lancer un nouveau traitement.
     */
    const clearTask = () => {
        setTaskId(null);
        setTaskData(null);
        localStorage.removeItem(storageKey);
    };

    return { taskId, setTaskId, taskData, setTaskData, clearTask };
}