import { useState, useEffect } from 'react';

export default function WhitelistConfig() {
    const [whitelist, setWhitelist] = useState<string[]>([]);
    const [newWord, setNewWord] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('annonut_whitelist');
        if (saved) setWhitelist(JSON.parse(saved));
    }, []);

    const addWord = () => {
        if (newWord.trim() && !whitelist.includes(newWord.trim())) {
            const updated = [...whitelist, newWord.trim()];
            setWhitelist(updated);
            localStorage.setItem('annonut_whitelist', JSON.stringify(updated));
            setNewWord('');
        }
    };

    const removeWord = (w: string) => {
        const updated = whitelist.filter(x => x !== w);
        setWhitelist(updated);
        localStorage.setItem('annonut_whitelist', JSON.stringify(updated));
    };

    return (
        <div>
            <div className="page-header">
                <div className="step-label">CONFIGURATION</div>
                <h1 className="page-title">Ma Liste Blanche</h1>
                <p className="page-description">Ces mots ne seront <b>jamais</b> censurés (Upload & Drive).</p>
            </div>

            <div className="card" style={{ padding: '32px' }}>
                <div className="input-with-button">
                    <input type="text" className="input-field" placeholder="Ex: Tours, Jean..." value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()} />
                    <button className="btn-primary" onClick={addWord}>+ Ajouter</button>
                </div>

                <div style={{ marginTop: 20 }}>
                    {whitelist.map(w => (
                        <div key={w} className="chip">{w} <button onClick={() => removeWord(w)} style={{ background:'transparent', border:'none', cursor:'pointer' }}>×</button></div>
                    ))}
                </div>
            </div>
        </div>
    );
}