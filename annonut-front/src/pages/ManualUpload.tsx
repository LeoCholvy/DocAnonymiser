import { useState, useRef } from 'react';
import { UploadCloudIcon } from '../components/Icons';
import { useTaskStream } from '../hooks/useTaskStream';

export default function ManualUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [filters, setFilters] = useState({
        mask_person: true, mask_email: true, mask_phone: true, mask_location: true, mask_bank: true
    });

    // 🔥 Hook personnalisé avec ajout de 'clearTask' pour vider la queue
    const { taskId, setTaskId, taskData, setTaskData, clearTask } = useTaskStream('current_task_id');

    const getWhitelist = () => JSON.parse(localStorage.getItem('annonut_whitelist') || '[]');

    // --- GESTION DU DRAG & DROP ---
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    };
    const handleBrowseClick = () => fileInputRef.current?.click();

    // --- UPLOAD ---
    const handleUpload = async () => {
        if (!file) return;
        setTaskData(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("whitelist", getWhitelist().join(','));
        Object.entries(filters).forEach(([k, v]) => formData.append(k, String(v)));

        try {
            const res = await fetch('/api/v1/upload', { method: 'POST', body: formData });
            const data = await res.json();
            setTaskId(data.task_id);
        } catch (e) {
            console.error("Erreur d'upload", e);
        }
    };

    const handleCheckbox = (key: keyof typeof filters) => setFilters({ ...filters, [key]: !filters[key] });

    return (
        <div className="dashboard-layout">
            <div className="dashboard-main">
                <div className="step-label">MODE CHIRURGICAL</div>
                <h1 className="hero-title">Upload Manuel.</h1>
                <p className="hero-subtitle">Traitement d'un fichier unique (.txt, .md, .docx, .pdf, .csv). Idéal pour un test rapide.</p>

                {/* ZONE DE DROP */}
                <div
                    className={`dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                        border: isDragging ? '2px dashed var(--primary-color, #27ae60)' : '2px dashed #ccc',
                        backgroundColor: isDragging ? 'rgba(39, 174, 96, 0.05)' : 'transparent',
                        padding: '40px',
                        textAlign: 'center',
                        borderRadius: '10px',
                        transition: 'all 0.2s ease',
                        marginBottom: '30px'
                    }}
                >
                    <div className="dropzone-icon"><UploadCloudIcon /></div>

                    {file ? (
                        <div style={{ margin: '20px 0' }}>
                            <p>Fichier prêt : <strong>{file.name}</strong></p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                                <button className="btn-secondary" onClick={() => setFile(null)}>Annuler</button>
                                <button className="btn-primary" onClick={handleUpload}>Anonymiser</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ margin: '20px 0' }}>
                            <p style={{ marginBottom: '10px', fontWeight: '500' }}>Glissez et déposez votre fichier ici</p>
                            <p style={{ color: 'var(--text-muted, gray)', marginBottom: '15px', fontSize: '0.9rem' }}>ou</p>

                            <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                            <button className="btn-secondary" onClick={handleBrowseClick} style={{ padding: '8px 20px', cursor: 'pointer' }}>
                                Choisir un fichier
                            </button>
                        </div>
                    )}
                </div>

                {/* SUIVI DU TRAITEMENT */}
                <div className="card">
                    <div className="queue-header"
                         style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2 className="queue-title" style={{margin: 0}}>Suivi du traitement</h2>
                        {taskId && (
                            <button onClick={clearTask} className="btn-secondary"
                                    style={{padding: '4px 8px', fontSize: '0.75rem'}}>
                                🗑️ Vider
                            </button>
                        )}
                    </div>

                    <table className="queue-table" style={{marginTop: '15px'}}>
                        <thead>
                        <tr>
                            <th>TASK ID</th>
                            <th>STATUT</th>
                            <th>RÉSULTAT</th>
                        </tr>
                        </thead>
                        <tbody>
                        {!taskId ? (
                            <tr>
                                <td colSpan={3} className="queue-empty">FILE VIDE. DÉPOSE UN FICHIER.</td>
                            </tr>
                        ) : (
                            <tr>
                                <td>
                                    {/* Conteneur Flex pour aligner le texte et le bouton */}
                                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                        <span title={taskId}>{taskId.substring(0, 8)}...</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(taskId)}
                                            title="Copier l'ID complet"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                opacity: 0.7,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <b>
                                        {taskData?.status === 'deleted'
                                            ? <span style={{color: '#e74c3c'}}>EXPIRÉ / SUPPRIMÉ</span>
                                            : taskData?.status?.toUpperCase() || "CONNEXION..."}
                                    </b>
                                </td>
                                <td>
                                    {taskData?.download_url ? (
                                        <a href={taskData.download_url} download className="btn-primary"
                                           style={{padding: '4px 10px', fontSize: '0.8rem'}}>Télécharger</a>
                                    ) : taskData?.status === 'deleted' ? (
                                        <span style={{color: 'var(--text-muted)'}}>Fichier purgé du serveur</span>
                                    ) : (
                                        <span style={{color: 'var(--text-muted)'}}>En attente...</span>
                                    )}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                    <p style={{fontSize: "0.8rem", color: "gray", marginTop: "10px"}}>
                        * Les fichiers anonymisés sont conservés 24h sur le serveur. Après un téléchargement, ils sont
                        supprimés sous 30 minutes.
                    </p>
                </div>
            </div>

            {/* BARRE LATÉRALE (FILTRES) */}
            <div className="dashboard-sidebar">
                <div className="card">
                    <div className="card-title">FILTRES IA</div>
                    <h3 className="card-heading">Que masquer ?</h3>
                    <div className="checkbox-group">
                        {Object.keys(filters).map(key => (
                            <label key={key} className="checkbox-item">
                                <input type="checkbox" checked={filters[key as keyof typeof filters]}
                                       onChange={() => handleCheckbox(key as keyof typeof filters)}/>
                                <span className="checkbox-label">{key.replace('mask_', '').toUpperCase()}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}