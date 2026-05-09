import React, { useState } from 'react';
import './App.css';

// --- TYPES & DUMMY DATA ---
type Tab = 'dashboard' | 'whitelist' | 'drive' | 'settings';

interface User {
  email: string;
  assos: string[]; // IDs of assos they are members of
}

interface Asso {
  id: string;
  name: string;
  words: string[];
}

const currentUser: User = {
  email: 'admin@asso.fr',
  assos: ['bde-test', 'test-e2e-fe']
};

const initialAssos: Asso[] = [
  { id: 'bde-test', name: 'BDE Test', words: ['BDE'] },
  { id: 'test-asso-c64e32', name: 'TEST_Asso_c64e32', words: [] },
  { id: 'test-upload-d1eff9', name: 'TEST_Upload_d1eff9', words: [] },
  { id: 'test-e2e-fe', name: 'TEST_E2E_FE', words: ['FE', 'E2E'] },
];

const initialPersonalWords = ['MonGala', 'Polytech', 'PolyTest', 'jkrsbvgsz'];

// --- ICONS ---
const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="M9 12l2 2 4-4"></path>
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16l-4-4-4 4"></path>
    <path d="M12 12v9"></path>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
    <path d="M16 16l-4-4-4 4"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);


// --- COMPONENTS ---

const Dashboard = ({ assos }: { assos: Asso[] }) => {
  const [activeAsso, setActiveAsso] = useState(assos[0].id);
  const [showError, setShowError] = useState(true);

  return (
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <div className="step-label">ÉTAPE 1</div>
        <h1 className="hero-title">Dépose. Anonymise. Conserve.</h1>
        <p className="hero-subtitle">
          Glisse tes archives (.txt, .md, .docx, .pdf, .pptx). Le moteur NLP local détecte noms, emails,
          téléphones, IBAN et plus encore — sans qu'aucune donnée ne quitte ton serveur.
        </p>

        <div className="dropzone">
          <div className="dropzone-icon">
            <UploadCloudIcon />
          </div>
          <h2 className="dropzone-title">Glisse ici tes fichiers</h2>
          <div className="dropzone-or">OU</div>
          <button className="btn-primary">Sélectionner des fichiers</button>
          <div className="dropzone-formats">.txt · .md · .docx · .pdf · .pptx</div>
        </div>

        {showError && (
          <div className="alert-error" onClick={() => setShowError(false)}>
            Une erreur est survenue.
          </div>
        )}

        <div className="card">
          <div className="queue-header">
            <h2 className="queue-title">File d'attente</h2>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              RAFRAÎCHIR
            </button>
          </div>
          <table className="queue-table">
            <thead>
              <tr>
                <th>FICHIER</th>
                <th>STATUT</th>
                <th>ENTITÉS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4}>
                  <div className="queue-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 12, opacity: 0.5 }}>
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg><br/>
                    FILE VIDE. DÉPOSE UN FICHIER.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-sidebar">
        <div className="card">
          <div className="card-title">ASSOCIATION</div>
          <h3 className="card-heading">Liste blanche active</h3>
          <select 
            className="input-field" 
            value={activeAsso} 
            onChange={(e) => setActiveAsso(e.target.value)}
          >
            {assos.map(asso => (
              <option key={asso.id} value={asso.id}>{asso.name} ({asso.words.length} mots)</option>
            ))}
          </select>
          <div className="info-text">
            Les mots de la liste blanche de cette asso ne seront pas censurés lors de l'upload.
          </div>
        </div>

        <div className="card">
          <div className="card-title">FILTRES</div>
          <h3 className="card-heading">Que masquer ?</h3>
          <div className="checkbox-group">
            {['Noms', 'Emails', 'Téléphones', 'IBAN', 'Cartes bancaires', 'Lieux', 'Organisations'].map(filter => (
              <label key={filter} className="checkbox-item">
                <input type="checkbox" defaultChecked />
                <span className="checkbox-label">{filter}</span>
              </label>
            ))}
          </div>
          <div className="info-text">
            Tout est activé par défaut. Décocher uniquement si tu sais ce que tu fais.
          </div>
        </div>

        <div className="promise-card">
          <div className="promise-title">RGPD · PROMESSE</div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            Le modèle NLP tourne localement. Aucune donnée ne sort vers une API externe. Les fichiers sont purgés automatiquement (60 min après téléchargement, 24 h max).
          </div>
        </div>
      </div>
    </div>
  );
};

const Whitelist = ({ assos, setAssos }: { assos: Asso[], setAssos: React.Dispatch<React.SetStateAction<Asso[]>> }) => {
  const [personalWords, setPersonalWords] = useState(initialPersonalWords);
  const [newPersonalWord, setNewPersonalWord] = useState('');
  const [activeAssoId, setActiveAssoId] = useState(assos[0].id);
  const [newAssoWord, setNewAssoWord] = useState('');

  const activeAsso = assos.find(a => a.id === activeAssoId);
  const isMember = currentUser.assos.includes(activeAssoId);

  const addPersonalWord = () => {
    if (newPersonalWord.trim() && !personalWords.includes(newPersonalWord.trim())) {
      setPersonalWords([...personalWords, newPersonalWord.trim()]);
      setNewPersonalWord('');
    }
  };

  const removePersonalWord = (word: string) => {
    setPersonalWords(personalWords.filter(w => w !== word));
  };

  const addAssoWord = () => {
    if (newAssoWord.trim() && activeAsso && !activeAsso.words.includes(newAssoWord.trim())) {
      setAssos(assos.map(a => 
        a.id === activeAssoId ? { ...a, words: [...a.words, newAssoWord.trim()] } : a
      ));
      setNewAssoWord('');
    }
  };

  const removeAssoWord = (word: string) => {
    if (activeAsso) {
      setAssos(assos.map(a => 
        a.id === activeAssoId ? { ...a, words: a.words.filter(w => w !== word) } : a
      ));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="step-label">CONFIGURATION</div>
        <h1 className="page-title">Listes blanches</h1>
        <p className="page-description">
          Ta liste perso s'applique à chacun de tes uploads. Les listes d'asso sont consultables par tous,
          mais seuls les membres peuvent les modifier.
        </p>
      </div>

      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--accent-yellow)', padding: 12, border: 'var(--border-width) solid var(--border-color)', display: 'flex' }}>
            <UserIcon />
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>TOUJOURS APPLIQUÉE</div>
            <h3 className="card-heading" style={{ marginBottom: 0 }}>Ma liste blanche</h3>
          </div>
        </div>

        <div className="input-with-button">
          <input 
            type="text" 
            className="input-field" 
            placeholder="Ajouter un mot ou une expression..." 
            value={newPersonalWord}
            onChange={e => setNewPersonalWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPersonalWord()}
          />
          <button className="btn-primary" onClick={addPersonalWord}>+ Ajouter</button>
        </div>

        <div>
          {personalWords.map(word => (
            <div key={word} className="chip">
              {word} <button onClick={() => removePersonalWord(word)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.5rem' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        Listes d'associations
      </h2>

      <div className="two-cols">
        <div>
          <div className="card-title" style={{ marginLeft: 8 }}>TOUTES LES ASSOCIATIONS</div>
          {assos.map(asso => (
            <div 
              key={asso.id} 
              className={`list-item ${activeAssoId === asso.id ? 'active' : ''}`}
              onClick={() => setActiveAssoId(asso.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                {currentUser.assos.includes(asso.id) && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                )}
                {asso.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{asso.words.length}</div>
            </div>
          ))}
        </div>

        {activeAsso && (
          <div className="card" style={{ padding: '32px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  ASSOCIATION
                  {isMember && <span className="list-badge">MEMBRE</span>}
                </div>
                <h3 className="card-heading" style={{ fontSize: '2rem', marginBottom: 0 }}>{activeAsso.name}</h3>
              </div>
              {isMember && (
                <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <TrashIcon /> SUPPRIMER
                </button>
              )}
            </div>

            {isMember && (
              <div className="input-with-button">
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Mot ou expression à ne pas censurer" 
                  value={newAssoWord}
                  onChange={e => setNewAssoWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAssoWord()}
                />
                <button className="btn-primary" onClick={addAssoWord}>+ Ajouter</button>
              </div>
            )}

            <div>
              {activeAsso.words.map(word => (
                <div key={word} className="chip">
                  {word} {isMember && <button onClick={() => removeAssoWord(word)}>×</button>}
                </div>
              ))}
              {activeAsso.words.length === 0 && (
                <div className="info-text">Aucun mot dans la liste blanche de cette association.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Settings = () => {
  return (
    <div>
      <div className="page-header">
        <div className="step-label">CONFIGURATION</div>
        <h1 className="page-title">Paramètres</h1>
      </div>

      <div className="settings-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: 12, border: 'var(--border-width) solid var(--border-color)', display: 'flex' }}>
              <SettingsIcon />
            </div>
            <h3 className="card-heading" style={{ marginBottom: 0 }}>Workers</h3>
          </div>
          
          <div className="settings-row">
            <span>WORKER_COUNT</span>
            <span>1</span>
          </div>
          <div className="settings-row">
            <span>RAM/WORKER</span>
            <span>~450 MB</span>
          </div>
          
          <div className="info-text" style={{ marginTop: 24 }}>
            Configuré dans backend/.env. Chaque worker charge spaCy fr_core_news_md et Presidio en mémoire.
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: 12, border: 'var(--border-width) solid var(--border-color)', display: 'flex' }}>
              <TrashIcon />
            </div>
            <h3 className="card-heading" style={{ marginBottom: 0 }}>Rétention RGPD</h3>
          </div>
          
          <div className="settings-row">
            <span>APRÈS TÉLÉCHARGEMENT</span>
            <span>60 min</span>
          </div>
          <div className="settings-row">
            <span>MAXIMUM ABSOLU</span>
            <span>24 h</span>
          </div>
          
          <div className="info-text" style={{ marginTop: 24 }}>
            Les fichiers uploadés ET produits sont purgés automatiquement.
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: 12, border: 'var(--border-width) solid var(--border-color)', display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <h3 className="card-heading" style={{ marginBottom: 0 }}>Formats supportés</h3>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['.docx', '.md', '.pdf', '.pptx', '.txt'].map(fmt => (
              <div key={fmt} className="chip" style={{ marginRight: 0, marginBottom: 0 }}>{fmt}</div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: 12, border: 'var(--border-width) solid var(--border-color)', display: 'flex' }}>
              <ShieldIcon />
            </div>
            <h3 className="card-heading" style={{ marginBottom: 0 }}>Entités détectées</h3>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['PERSON', 'LOCATION', 'ORGANIZATION', 'EMAIL_ADDRESS', 'PHONE_NUMBER'].map(ent => (
              <div key={ent} className="chip yellow" style={{ marginRight: 0, marginBottom: 0 }}>{ent}</div>
            ))}
            <div className="chip yellow" style={{ marginRight: 0, marginBottom: 0 }}>IBAN_CODE</div>
            <div className="chip yellow" style={{ marginRight: 0, marginBottom: 0 }}>CREDIT_CARD</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BotDrive = ({ assos }: { assos: Asso[] }) => {
  return (
    <div>
      <div className="page-header">
        <div className="step-label">NIVEAU 3</div>
        <h1 className="page-title">Bot Google Drive</h1>
        <p className="page-description">
          Partage un dossier Drive avec le bot. Il créera des copies anonymisées suffixées [ANONYMIZED] à côté de chaque fichier original, sans rien supprimer.
        </p>
      </div>

      <div className="two-cols">
        <div className="card" style={{ padding: '32px' }}>
          <div className="card-title">ÉTAPE 1 — PARTAGE</div>
          <div style={{ marginBottom: 16 }}>Dans Drive, partage ton dossier (rôle <b>Éditeur</b>) avec :</div>
          
          <div style={{ display: 'flex', marginBottom: 24 }}>
            <div style={{ 
              background: '#000', 
              color: '#888', 
              fontFamily: 'var(--font-mono)', 
              padding: '12px 16px', 
              flex: 1,
              border: 'var(--border-width) solid var(--border-color)',
              borderRight: 'none'
            }}>
              (non configuré)
            </div>
            <button style={{ 
              background: 'var(--accent-yellow)', 
              border: 'var(--border-width) solid var(--border-color)', 
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CopyIcon />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: '0.9rem' }}>
            Statut clé SA : <span style={{ background: 'var(--error)', color: 'white', padding: '2px 8px', fontWeight: 600, border: '1px solid var(--border-color)' }}>MANQUANTE</span>
          </div>

          <div className="info-text">
            Place le JSON Service Account dans /app/backend/google_sa.json puis redémarre le drive worker.
          </div>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <div className="card-title">ÉTAPE 2 — LANCER UN TRAITEMENT</div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>FOLDER ID</label>
            <input type="text" className="input-field" placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>LISTE BLANCHE (ASSO)</label>
            <select className="input-field">
              <option>— Aucune (tout est censuré) —</option>
              {assos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <label className="checkbox-item" style={{ marginBottom: 24 }}>
            <input type="checkbox" />
            <span className="checkbox-label">Générer aussi un rapport CSV</span>
          </label>

          <div className="alert-error" style={{ padding: '12px 16px', marginBottom: 24 }}>
            Une erreur est survenue.
          </div>

          <button className="btn-primary" style={{ fontSize: '1rem', padding: '12px 32px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Lancer le bot
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: 24, marginTop: 16 }}>Historique des jobs</h2>
      
      <div className="card" style={{ padding: 0 }}>
        <table className="queue-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>FOLDER</th>
              <th>STATUT</th>
              <th>AVANCEMENT</th>
              <th style={{ paddingRight: 24 }}>DÉTAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4}>
                <div className="queue-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 12, opacity: 0.5 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg><br/>
                  AUCUN JOB. LANCE TON PREMIER TRAITEMENT.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};


function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [assos, setAssos] = useState<Asso[]>(initialAssos);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">
            <ShieldIcon />
          </div>
          <div className="header-logo-text">
            <div className="header-logo-title">ANON.ASSO</div>
            <div className="header-logo-subtitle">RGPD · LOCAL · OPEN</div>
          </div>
        </div>

        <nav className="header-nav">
          <a href="#" className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>Tableau de bord</a>
          <a href="#" className={`nav-item ${activeTab === 'whitelist' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('whitelist'); }}>Liste blanche</a>
          <a href="#" className={`nav-item ${activeTab === 'drive' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('drive'); }}>Bot Google Drive</a>
          <a href="#" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}>Paramètres</a>
        </nav>

        <div className="header-user">
          <div className="user-email">{currentUser.email}</div>
          <button className="btn-logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sortir
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard assos={assos} />}
        {activeTab === 'whitelist' && <Whitelist assos={assos} setAssos={setAssos} />}
        {activeTab === 'drive' && <BotDrive assos={assos} />}
        {activeTab === 'settings' && <Settings />}
      </main>

      <footer className="footer">
        <div className="footer-title">RGPD · AUCUNE DONNÉE N'EST ENVOYÉE À UN SERVICE EXTERNE.</div>
        <div className="footer-muted">v0.1 — built for asso étudiantes</div>
      </footer>
    </div>
  );
}

export default App;
