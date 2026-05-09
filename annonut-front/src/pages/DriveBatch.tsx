import { useState, useEffect } from 'react';
import { GoogleIcon } from '../components/Icons';

export default function DriveBatch() {
    const [folderId, setFolderId] = useState('');
    const [actionOrig, setActionOrig] = useState('keep');
    const [reportFormat, setReportFormat] = useState('md');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<any>(null);

    const getWhitelist = () => JSON.parse(localStorage.getItem('annonut_whitelist') || '[]');

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (taskId && taskData?.status !== 'finished' && taskData?.status !== 'error') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/v1/status/${taskId}`);
                    setTaskData(await res.json());
                } catch (e) { console.error(e); }
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [taskId, taskData?.status]);

    const launchBatch = async () => {
        if (!folderId) return;
        const formData = new FormData();
        formData.append("folder_id", folderId);
        formData.append("whitelist", getWhitelist().join(','));
        formData.append("action_orig", actionOrig);
        formData.append("report_format", reportFormat);

        try {
            const res = await fetch('/api/v1/drive/process', { method: 'POST', body: formData });
            if(res.status === 401) { window.location.href = '/login'; return; }
            const data = await res.json();
            setTaskId(data.task_id);
            setTaskData({ status: 'queued' });
        } catch (e) { alert("Erreur réseau"); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="step-label">NIVEAU BATCH</div>
                <h1 className="page-title">Scan Google Drive</h1>
                <p className="page-description">Anonymisation massive et récursive.</p>
            </div>

            <div className="two-cols">
                <div className="card" style={{ padding: '32px' }}>
                    <div className="card-title">ÉTAPE 1 — CONNEXION OAUTH</div>
                    <button onClick={() => window.location.href = '/login'} className="btn-primary" style={{ background: '#4285F4', width: '100%' }}>
                        <GoogleIcon /> Se connecter avec Google
                    </button>
                </div>

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

                    <button className="btn-primary" onClick={launchBatch} style={{ width: '100%', background: 'var(--accent-yellow)', color: 'black' }}>
                        Lancer l'exploration
                    </button>
                </div>
            </div>

            <h2 style={{ fontSize: '1.5rem', marginBottom: 24, marginTop: 16 }}>Avancement en temps réel</h2>
            <div className="card" style={{ padding: 0 }}>
                <table className="queue-table">
                    <thead><tr><th style={{ paddingLeft: 24 }}>STATUT</th><th>FICHIER EN COURS</th><th>TRAITÉS</th></tr></thead>
                    <tbody>
                    {!taskId ? (
                        <tr><td colSpan={3} className="queue-empty">AUCUN JOB BATCH ACTIF.</td></tr>
                    ) : (
                        <tr>
                            <td style={{ paddingLeft: 24, fontWeight: 'bold' }}>{taskData?.status?.toUpperCase()}</td>
                            <td style={{ color: 'blue' }}>{taskData?.current_file || '-'}</td>
                            <td>
                                <ul style={{ margin: 0, paddingLeft: 15, fontSize: '0.85rem' }}>
                                    {taskData?.processed_list?.map((p: any, i: number) => (
                                        <li key={i}>{p.status} {p.name}</li>
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