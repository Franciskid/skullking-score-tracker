'use client';

import { useState } from 'react';
import { calculateRoundScore } from '@/lib/scoring';
import { submitRoundScore, resetGame } from '../actions';
import styles from './game.module.css';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NumberSelector from '@/components/NumberSelector';
import VictoryModal from '@/components/VictoryModal';

interface Player {
  gamePlayerId: string;
  name: string;
  total: number;
}

interface RoundData {
  roundId: string;
  roundNumber: number;
  playerScores: Record<string, { bid: number, tricks: number, bonus: number, score: number }>;
}

export default function GameInterface({
  gameId,
  players,
  history,
  currentRoundNumber
}: {
  gameId: string,
  players: Player[],
  history: RoundData[],
  currentRoundNumber: number
}) {
  const [round, setRound] = useState(currentRoundNumber);
  const [historyState, setHistory] = useState(history);
  const [totals, setTotals] = useState(players.map(p => ({ id: p.gamePlayerId, score: p.total })));

  const [phase, setPhase] = useState<'BIDDING' | 'SCORING'>('BIDDING');
  const [currentBids, setCurrentBids] = useState<Record<string, number>>({});
  const [currentTricks, setCurrentTricks] = useState<Record<string, number>>({});
  const [currentBonus, setCurrentBonus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showVictory, setShowVictory] = useState(true);

  const router = useRouter();
  const isGameOver = round > 10;

  const winner = isGameOver
    ? totals.reduce((prev, current) => (prev.score > current.score ? prev : current), totals[0])
    : null;
  const winnerName = players.find(p => p.gamePlayerId === winner?.id)?.name || 'Inconnu';

  const handleReset = async () => {
    if (!confirm("Êtes-vous sûr ? Cela effacera tous les scores de cette partie.")) return;
    setLoading(true);
    await resetGame(gameId);
    setRound(1);
    setHistory([]);
    setTotals(players.map(p => ({ id: p.gamePlayerId, score: 0 })));
    setPhase('BIDDING');
    setLoading(false);
    setMenuOpen(false);
    router.refresh();
  };

  const handleBidChange = (pid: string, val: number) => {
    setCurrentBids(prev => ({ ...prev, [pid]: val }));
  };

  const handleTricksChange = (pid: string, val: number) => {
    setCurrentTricks(prev => ({ ...prev, [pid]: val }));
  };

  const handleBonusChange = (pid: string, val: number) => {
    setCurrentBonus(prev => ({ ...prev, [pid]: val }));
  };

  const startScoring = () => {
    setPhase('SCORING');
  };

  const finishRound = async () => {
    setLoading(true);
    try {
      const scoresToSubmit = players.map(p => {
        const bid = currentBids[p.gamePlayerId] || 0;
        const tricks = currentTricks[p.gamePlayerId] || 0;
        const bonus = currentBonus[p.gamePlayerId] || 0;
        const score = calculateRoundScore({ roundNumber: round, bid, tricksWon: tricks, bonusPoints: bonus });
        return { gamePlayerId: p.gamePlayerId, bid, tricks, bonus, score };
      });

      await submitRoundScore(gameId, round, scoresToSubmit);

      const newRoundData: RoundData = {
        roundId: `temp-${Date.now()}`,
        roundNumber: round,
        playerScores: {}
      };
      scoresToSubmit.forEach(s => { newRoundData.playerScores[s.gamePlayerId] = s; });

      setHistory([...historyState, newRoundData]);
      setTotals(prev => prev.map(t => {
        const roundScore = scoresToSubmit.find(s => s.gamePlayerId === t.id)?.score || 0;
        return { ...t, score: t.score + roundScore };
      }));

      setRound(r => r + 1);
      setPhase('BIDDING');
      setCurrentBids({});
      setCurrentTricks({});
      setCurrentBonus({});
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (roundNum: number, playerId: string, isDesktop: boolean = false) => {
    // Past Rounds
    if (roundNum < round) {
      const r = historyState.find(h => h.roundNumber === roundNum);
      const s = r?.playerScores[playerId];
      if (!s) return <td key={playerId}>-</td>;
      return (
        <td key={playerId} className={styles.pastCell}>
          <div className={styles.cellScore}>{s.score}</div>
          {isDesktop ? (
            <div className={styles.cellDetail}>{s.bid}|{s.tricks}{s.bonus !== 0 && `+${s.bonus}`}</div>
          ) : (
            <div className={styles.mobileCellDetail}>
              <div>Pari: {s.bid}</div>
              <div>Plis: {s.tricks}</div>
              {s.bonus !== 0 && <div>Bonus: {s.bonus}</div>}
            </div>
          )}
        </td>
      );
    }

    // Active Round (Inputs)
    if (roundNum === round && !isGameOver) {
      return (
        <td key={playerId} className={`${styles.activeCell} ${!isDesktop ? styles.hideOnMobile : ''}`}>
          <div className={styles.scoringInputs}>
            {phase === 'BIDDING' ? (
              <>
                <div className={styles.tricksLabel}>Pari:</div>
                <NumberSelector value={currentBids[playerId]} onChange={(val) => handleBidChange(playerId, val)} max={round + 1} />
              </>
            ) : (
              <>
                <div className={styles.lockedBid}>Pari: {currentBids[playerId] || 0}</div>
                <div className={styles.tricksLabel}>Plis:</div>
                <NumberSelector value={currentTricks[playerId]} onChange={(val) => handleTricksChange(playerId, val)} max={round + 1} />
                <input type="number" value={currentBonus[playerId] ?? ''} onChange={e => handleBonusChange(playerId, parseInt(e.target.value) || 0)} className={styles.inputBonus} placeholder="+ Bonus" />
              </>
            )}
          </div>
        </td>
      );
    }

    return <td key={playerId} className={styles.futureCell}>-</td>;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.gameInfo}>
          <h1>Skull King</h1>
          <p>Partie #{gameId.slice(0, 4)}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={() => setMenuOpen(!menuOpen)} className={styles.menuBtn}>⚙️ Options</button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <button onClick={handleReset} className={styles.dropdownItem}>Recommencer</button>
              <Link href="/" className={styles.dropdownItem}>Quitter vers Menu</Link>
            </div>
          )}
        </div>
      </header>

      {!isGameOver && (
        <div className={styles.mobileInputSection}>
          <h2 className={styles.mobileRoundTitle}>Manche {round} - {phase === 'BIDDING' ? 'Paris' : 'Plis'}</h2>
          <div className={styles.cardStack}>
            {players.map(p => (
              <div key={p.gamePlayerId} className={`glass ${styles.playerInputCard}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardPlayerName}>{p.name}</span>
                  <span className={styles.cardTotal}>Score: {totals.find(t => t.id === p.gamePlayerId)?.score || 0} pts</span>
                </div>
                <div className={styles.cardBody}>
                  {phase === 'BIDDING' ? (
                    <div className={styles.inputRow}>
                      <span className={styles.inlineLabel}>Pari:</span>
                      <NumberSelector value={currentBids[p.gamePlayerId]} onChange={(val) => handleBidChange(p.gamePlayerId, val)} max={round + 1} />
                    </div>
                  ) : (
                    <div className={styles.inputRow}>
                      <div className={styles.cardLockedBid}>Pari: {currentBids[p.gamePlayerId] || 0}</div>
                      <div className={styles.tricksLabel}>Plis:</div>
                      <NumberSelector value={currentTricks[p.gamePlayerId]} onChange={(val) => handleTricksChange(p.gamePlayerId, val)} max={round + 1} />
                      <input type="number" value={currentBonus[p.gamePlayerId] ?? ''} onChange={e => handleBonusChange(p.gamePlayerId, parseInt(e.target.value) || 0)} className={styles.inputBonus} placeholder="+ Bonus" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOBILE TRANSPOSED TABLE (Only during active game) */}
      {!isGameOver && (
        <div className={`${styles.scorepadContainer} ${styles.mobileHistory}`}>
          <table className={styles.scorepad}>
            <thead>
              <tr>
                <th className={styles.roundCol}>Pirate</th>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (<th key={n}>{n}</th>))}
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.gamePlayerId}>
                  <td className={styles.roundNum}>{p.name}</td>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => renderCell(n, p.gamePlayerId, false))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DESKTOP/GAME OVER TABLE (Standard Orientation) */}
      <div className={`${styles.scorepadContainer} ${!isGameOver ? styles.desktopHistory : styles.gameOverMobile}`}>
        <table className={styles.scorepad}>
          <thead>
            <tr>
              <th className={styles.roundCol}>#</th>
              {players.map(p => (
                <th key={p.gamePlayerId} className={styles.playerCol}>
                  {p.name}
                  <div className={styles.totalScore}>
                    {totals.find(t => t.id === p.gamePlayerId)?.score || 0}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(rNum => (
              <tr key={rNum} className={rNum === round ? styles.activeRow : ''}>
                <td className={styles.roundNum}>{rNum}</td>
                {players.map(p => renderCell(rNum, p.gamePlayerId, true))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isGameOver && (
        <div className={styles.stickyControls}>
          <button onClick={phase === 'BIDDING' ? startScoring : finishRound} disabled={loading} className={styles.actionBtn}>
            {loading ? 'Sauvegarde...' : phase === 'BIDDING' ? `Lancer Manche ${round}` : 'Terminer Manche'}
          </button>
        </div>
      )}

      {isGameOver && (
        <div className={styles.finalControls}>
          {showVictory && <VictoryModal winnerName={winnerName} onClose={() => setShowVictory(false)} />}
          <h2>Partie Terminée !</h2>
          <Link href="/leaderboard" className={styles.actionBtn}>Voir Classement</Link>
        </div>
      )}
    </div>
  );
}
