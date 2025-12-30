'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createNewGame, getAvailablePlayers } from '../actions';
import styles from './new-game.module.css';

interface ExistingPlayer {
  id: string;
  name: string;
  gamesPlayed: number;
  totalScore: number;
}

export default function NewGame() {
  const [players, setPlayers] = useState(['', '']);
  const [existingPlayers, setExistingPlayers] = useState<ExistingPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dice Logic
  const [rolling, setRolling] = useState(false);
  const [captain, setCaptain] = useState<string | null>(null);
  
  // Drag Logic
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    getAvailablePlayers().then(setExistingPlayers);
  }, []);

  const addPlayer = () => setPlayers([...players, '']);
  
  const updatePlayer = (index: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[index] = name;
    setPlayers(newPlayers);
  };
  
  const removePlayer = (index: number) => {
    if (players.length <= 2) {
      // Clear instead of remove if min players
      updatePlayer(index, '');
      return;
    }
    const newPlayers = players.filter((_, i) => i !== index);
    setPlayers(newPlayers);
  };
  
  const recruitPlayer = (name: string) => {
    if (players.includes(name)) return; // Prevent duplicate
    const emptyIndex = players.findIndex(p => p.trim() === '');
    if (emptyIndex !== -1) {
      updatePlayer(emptyIndex, name);
    } else {
      setPlayers([...players, name]);
    }
  };

  // Drag Handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary for Drop to fire
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Optional: Visual reordering preview could go here, but simple swap on drop is safer for MVP
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const newPlayers = [...players];
    const item = newPlayers[draggedIndex];
    newPlayers.splice(draggedIndex, 1);
    newPlayers.splice(index, 0, item);
    setPlayers(newPlayers);
    setDraggedIndex(null);
  };

  const rollForCaptain = () => {
    const validPlayers = players.filter(p => p.trim() !== '');
    if (validPlayers.length < 2) {
      setError("Il faut au moins 2 pirates pour élire un capitaine !");
      return;
    }
    
    setRolling(true);
    setError('');
    setCaptain(null);

    // Simulation of rolling
    setTimeout(() => {
      const winnerIndex = Math.floor(Math.random() * validPlayers.length);
      const winnerName = validPlayers[winnerIndex];
      
      const originalIndex = players.indexOf(winnerName);
      
      // Rotate array
      const rotated = [
        ...players.slice(originalIndex), 
        ...players.slice(0, originalIndex)
      ];
      
      setPlayers(rotated);
      setCaptain(winnerName);
      setRolling(false);
    }, 2000);
  };

  const startGame = async () => {
    setLoading(true);
    setError('');
    try {
      const gameId = await createNewGame(players);
      router.push(`/game/${gameId}`);
    } catch (e) {
      console.error(e);
      setError('Impossible de démarrer. Vérifiez les joueurs (min 2).');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Left Panel: Current Crew */}
        <div className={`glass ${styles.card}`}>
          <h2>Nouveau Voyage</h2>
          {error && <p style={{color: 'red'}}>{error}</p>}
          <div className={styles.playerList}>
            {players.map((name, i) => (
              <div 
                key={i} 
                className={`${styles.inputGroup} ${draggedIndex === i ? styles.dragging : ''}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
              >
                <span className={styles.dragHandle}>☰</span>
                <span className={styles.inputLabel}>{i + 1}</span>
                <input
                  className={styles.input}
                  placeholder={`Nom du Pirate`}
                  value={name}
                  onChange={(e) => updatePlayer(i, e.target.value)}
                  disabled={loading}
                />
                <button className={styles.deleteBtn} onClick={() => removePlayer(i)} title="Virer">✖</button>
              </div>
            ))}
          </div>
          
          <div className={styles.controls}>
            <button onClick={addPlayer} className={styles.secondaryBtn} disabled={loading}>+ Ajouter Pirate</button>
            
            <div className={styles.diceSection}>
              <div className={styles.diceContainer}>
                <span className={`${styles.dice} ${rolling ? styles.rolling : ''}`}>🎲</span>
              </div>
              <button onClick={rollForCaptain} className={styles.secondaryBtn} disabled={loading || rolling}>
                {rolling ? 'Les dés roulent...' : 'Élire le 1er Joueur'}
              </button>
              {captain && <div className={styles.diceResult}>Le Capitaine est {captain} ! ⚓</div>}
            </div>

            <button onClick={startGame} className={styles.primaryBtn} disabled={loading || rolling}>
              {loading ? 'Lancement...' : 'Hissez les Voiles !'}
            </button>
          </div>
        </div>

        {/* Right Panel: Tavern Recruitment */}
        <div className={`glass ${styles.tavern}`}>
          <h3>Taverne (Recrutement)</h3>
          <div className={styles.tavernList}>
            {existingPlayers.map(p => {
              const isSelected = players.includes(p.name);
              return (
                <div 
                  key={p.id} 
                  className={`${styles.wantedPoster} ${isSelected ? styles.disabledPoster : ''}`} 
                  onClick={() => recruitPlayer(p.name)}
                >
                  <div className={styles.posterName}>{p.name}</div>
                  <div className={styles.posterStats}>
                    <span>⚔️ {p.gamesPlayed}</span>
                    <span>💰 {p.totalScore}</span>
                  </div>
                </div>
              );
            })}
            {existingPlayers.length === 0 && <p className={styles.emptyTavern}>La taverne est vide...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}