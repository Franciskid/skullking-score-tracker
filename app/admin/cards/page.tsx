'use client';

import { useState } from 'react';
import { generateCardIdea } from './actions';
import styles from './cards.module.css';

export default function AdminCards() {
  const [type, setType] = useState('Pirate');
  const [prompt, setPrompt] = useState('');
  const [idea, setIdea] = useState<{ name: string, description: string, imageUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setIdea(null);
    try {
      const res = await generateCardIdea(type, prompt);
      setIdea(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Forge de Cartes</h1>
        <p>Gérer les trésors et l'IA</p>
      </header>

      <div className={`glass ${styles.forge}`}>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Décrivez votre carte..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={styles.input}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className={styles.select}>
            <option value="Pirate">Pirate</option>
            <option value="Mermaid">Sirène</option>
            <option value="Skull King">Skull King</option>
            <option value="Sea Monster">Monstre Marin</option>
            <option value="Treasure">Trésor</option>
            <option value="Kraken">Kraken</option>
          </select>
          <button onClick={handleGenerate} disabled={loading} className={styles.generateBtn}>
            {loading ? "Consultation de l'Oracle..." : 'Générer Carte IA'}
          </button>
        </div>

        {idea && (
          <div className={styles.result}>
            <h3>{idea.name}</h3>
            <p>{idea.description}</p>
            <div className={styles.placeholderArt}>
              {idea.imageUrl ? (
                <img src={idea.imageUrl} alt={idea.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
              ) : (
                <span>[ Échec de l'image / Placeholder ]</span>
              )}
            </div>
            <button className={styles.saveBtn}>Enregistrer dans le Coffre</button>
          </div>
        )}
      </div>
    </div>
  );
}
