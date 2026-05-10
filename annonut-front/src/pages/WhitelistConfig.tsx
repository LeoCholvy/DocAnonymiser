import { useState, useEffect } from 'react';

export default function WhitelistConfig() {
    const [whitelist, setWhitelist] = useState<string[]>([]);
    const [newWord, setNewWord] = useState('');

    // ==========================================
    // CHARGEMENT ET FUSION DE LA WHITELIST
    // ==========================================
    useEffect(() => {
        const fetchDefaultsAndMerge = async () => {
            try {
                // 1. Récupération de la liste par défaut depuis le serveur
                const res = await fetch('/api/v1/whitelist');
                const defaultList: string[] = await res.json();

                // 2. Récupération de la liste personnalisée locale
                const saved = localStorage.getItem('annonut_whitelist');
                const localList: string[] = saved ? JSON.parse(saved) : [];

                // 3. Fusion sans doublons (insensible à la casse)
                const merged = [...localList];
                defaultList.forEach(word => {
                    const isDuplicate = merged.some(w => w.toLowerCase() === word.toLowerCase());
                    if (!isDuplicate) {
                        merged.push(word);
                    }
                });

                // 4. Mise à jour de l'état et sauvegarde locale
                setWhitelist(merged);
                localStorage.setItem('annonut_whitelist', JSON.stringify(merged));

            } catch (error) {
                console.error("Erreur lors du chargement de la whitelist par défaut", error);
                // Fallback : on charge au moins la liste locale si le serveur est injoignable
                const saved = localStorage.getItem('annonut_whitelist');
                if (saved) setWhitelist(JSON.parse(saved));
            }
        };

        fetchDefaultsAndMerge();
    }, []);

    // ==========================================
    // ACTIONS UTILISATEUR
    // ==========================================
    const addWord = () => {
        const trimmedWord = newWord.trim();

        // 🔥 Vérification insensible à la casse (Tours == tours)
        const isDuplicate = whitelist.some(
            w => w.toLowerCase() === trimmedWord.toLowerCase()
        );

        if (trimmedWord && !isDuplicate) {
            const updated = [...whitelist, trimmedWord];
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
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Tours, Jean..."
                        value={newWord}
                        onChange={e => setNewWord(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addWord()}
                    />
                    <button
                        className="btn-primary"
                        onClick={addWord}
                        disabled={!newWord.trim()}
                        style={{ opacity: !newWord.trim() ? 0.6 : 1 }}
                    >
                        + Ajouter
                    </button>
                </div>

                <div style={{ marginTop: 20 }}>
                    {whitelist.map(w => (
                        <div key={w} className="chip">
                            {w}
                            <button
                                onClick={() => removeWord(w)}
                                aria-label={`Supprimer ${w}`} // 🔥 Accessibilité (A11y)
                                style={{ background:'transparent', border:'none', cursor:'pointer' }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}