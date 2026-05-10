import { useState } from 'react';
import { GoogleIcon } from '../components/Icons';
import { useTaskStream } from '../hooks/useTaskStream';

export default function DriveBatch() {
    // États du formulaire
    const [folderId, setFolderId] = useState('');
    const [actionOrig, setActionOrig] = useState('keep');
    const [reportFormat, setReportFormat] = useState('md');

    // 🔥 Hook personnalisé : Typage automatique, plus besoin d'importer TaskData ici !
    const { taskId, setTaskId, taskData, setTaskData, clearTask } = useTaskStream('current_batch_task_id');

    const getWhitelist = () => JSON.parse(localStorage.getItem('annonut_whitelist') || '[]');

    /**
     * Déclenche l'appel API pour démarrer le traitement par lot.
     */
    const launchBatch = async () => {
        if (!folderId) return;

        setTaskData(null); // Réinitialise l'affichage

        // 🔥 EXTRACTION DE L'ID GOOGLE DRIVE
        // Cherche une suite de 25+ caractères alphanumériques (ID classique de GDrive)
        let finalFolderId = folderId.trim();
        const idMatch = finalFolderId.match(/[-\w]{25,}/);

        if (idMatch) {
            finalFolderId = idMatch[0]; // Récupère uniquement l'ID
        } else {
            alert("L'ID ou l'URL du dossier Google Drive semble invalide.");
            return;
        }

        const formData = new FormData();
        formData.append("folder_id", finalFolderId);
        formData.append("whitelist", getWhitelist().join(','));
        formData.append("action_orig", actionOrig);
        formData.append("report_format", reportFormat);

        try {
            const res = await fetch('/api/v1/drive/process', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }

            const data = await res.json();
            setTaskId(data.task_id); // Modifie l'état, ce qui déclenche l'useEffect du Hook SSE
        } catch (e) {
            console.error(e);
            alert("Erreur réseau lors de la communication avec l'API.");
        }
    };

    return (
        <div>
            <div className="page-header">
                <div className="step-label">NIVEAU BATCH</div>
                <h1 className="page-title">Scan Google Drive</h1>
                <p className="page-description">Anonymisation massive et récursive.</p>
            </div>

            <div className="two-cols">
                {/* ÉTAPE 1 : OAUTH */}
                <div className="card" style={{ padding: '32px' }}>
                    <div className="card-title">ÉTAPE 1 — CONNEXION OAUTH</div>
                    <button onClick={() => window.location.href = '/login'} className="btn-primary" style={{ background: '#4285F4', width: '100%' }}>
                        <GoogleIcon /> Se connecter avec Google
                    </button>
                </div>

                {/* ÉTAPE 2 : CONFIGURATION */}
                <div className="card" style={{ padding: '32px' }}>
                    <div className="card-title">ÉTAPE 2 — LANCER LE TRAITEMENT</div>
                    <input type="text" className="input-field" placeholder="Folder ID..." value={folderId} onChange={e => setFolderId(e.target.value)} style={{marginBottom: 16}}/>

                    <select className="input-field" value={actionOrig} onChange={e => setActionOrig(e.target.value)} style={{marginBottom: 16}}>
                        <option value="keep">Laisser originaux à côté</option>
                        <option value="move">Déplacer originaux dans [UNANONYZED]_Archives</option>
                    </select>

                    <select className="input-field" value={reportFormat} onChange={e => setReportFormat(e.target.value)} style={{marginBottom: 24}}>
                        <option value="md">Rapport Markdown</option>
                        <option value="csv">Rapport CSV</option>
                        <option value="none">Aucun rapport</option>
                    </select>

                    <button
                        className="btn-primary"
                        onClick={launchBatch}
                        // 🔥 Correction TypeScript : on s'assure de renvoyer un vrai booléen (false au lieu de null)
                        disabled={!folderId || (taskData !== null && !['finished', 'failed', 'deleted'].includes(taskData.status))}
                        style={{
                            width: '100%',
                            background: 'var(--accent-yellow)',
                            color: 'black',
                            opacity: (!folderId) ? 0.5 : 1,
                            cursor: (!folderId) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Lancer l'exploration
                    </button>
                </div>
            </div>

            {/* SUIVI TEMPS RÉEL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Avancement en temps réel</h2>
                {/* Bouton pour vider la file d'attente si une tâche existe */}
                {taskId && (
                    <button onClick={clearTask} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        🗑️ Vider
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="queue-table">
                    <thead><tr><th style={{ paddingLeft: 24 }}>STATUT</th><th>FICHIER EN COURS</th><th>TRAITÉS</th></tr></thead>
                    <tbody>
                    {!taskId ? (
                        <tr><td colSpan={3} className="queue-empty">AUCUN JOB BATCH ACTIF.</td></tr>
                    ) : (
                        <tr>
                            <td style={{ paddingLeft: 24, fontWeight: 'bold' }}>
                                {taskData?.status === 'deleted'
                                    ? <span style={{color: '#e74c3c'}}>TERMINÉ / PURGÉ</span>
                                    : taskData?.status?.toUpperCase() || "CONNEXION..."}
                            </td>
                            <td style={{ color: 'blue' }}>{taskData?.current_file || '-'}</td>
                            <td>
                                <ul style={{ margin: 0, paddingLeft: 15, fontSize: '0.85rem' }}>
                                    {/* Map sécurisé avec typage inféré */}
                                    {taskData?.processed_list?.map((p, i) => (
                                        <li key={i}>{p.status} {p.name} {p.error ? `(${p.error})` : ''}</li>
                                    ))}
                                </ul>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}