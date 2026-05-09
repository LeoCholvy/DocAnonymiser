import { useState, useEffect } from 'react';
import { UploadCloudIcon } from '../components/Icons';

export default function ManualUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<any>(null);
    const [filters, setFilters] = useState({
        mask_person: true, mask_email: true, mask_phone: true, mask_location: true, mask_bank: true
    });

    const getWhitelist = () => JSON.parse(localStorage.getItem('annonut_whitelist') || '[]');

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (taskId && taskData?.status !== 'completed' && taskData?.status !== 'error') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/v1/status/${taskId}`);
                    setTaskData(await res.json());
                } catch (e) { console.error(e); }
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [taskId, taskData?.status]);

    const handleUpload = async () => {
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("whitelist", getWhitelist().join(','));
        Object.entries(filters).forEach(([k, v]) => formData.append(k, String(v)));

        const res = await fetch('/api/v1/upload', { method: 'POST', body: formData });
        const data = await res.json();
        setTaskId(data.task_id);
        setTaskData({ status: 'queued' });
    };

    const handleCheckbox = (key: keyof typeof filters) => setFilters({ ...filters, [key]: !filters[key] });

    return (
        <div className="dashboard-layout">
            <div className="dashboard-main">
                <div className="step-label">MODE CHIRURGICAL</div>
                <h1 className="hero-title">Upload Manuel.</h1>
                <p className="hero-subtitle">Traitement d'un fichier unique (.txt, .md, .docx, .pdf, .csv). Idéal pour un test rapide.</p>

                <div className="dropzone">
                    <div className="dropzone-icon"><UploadCloudIcon /></div>
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ margin: '20px 0' }} />
                    {file && <button className="btn-primary" onClick={handleUpload}>Anonymiser {file.name}</button>}
                </div>

                <div className="card">
                    <div className="queue-header"><h2 className="queue-title">Suivi du traitement</h2></div>
                    <table className="queue-table">
                        <thead><tr><th>TASK ID</th><th>STATUT</th><th>RÉSULTAT</th></tr></thead>
                        <tbody>
                        {!taskId ? (
                            <tr><td colSpan={3} className="queue-empty">FILE VIDE. DÉPOSE UN FICHIER.</td></tr>
                        ) : (
                            <tr>
                                <td>{taskId.substring(0, 8)}...</td>
                                <td><b>{taskData?.status?.toUpperCase()}</b></td>
                                <td>
                                    {taskData?.download_url ? (
                                        <a href={taskData.download_url} download className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Télécharger</a>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>En attente...</span>
                                    )}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="dashboard-sidebar">
                <div className="card">
                    <div className="card-title">FILTRES IA</div>
                    <h3 className="card-heading">Que masquer ?</h3>
                    <div className="checkbox-group">
                        {Object.keys(filters).map(key => (
                            <label key={key} className="checkbox-item">
                                <input type="checkbox" checked={filters[key as keyof typeof filters]} onChange={() => handleCheckbox(key as keyof typeof filters)} />
                                <span className="checkbox-label">{key.replace('mask_', '').toUpperCase()}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}