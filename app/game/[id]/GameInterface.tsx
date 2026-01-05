'use client';

import { useState } from 'react';
import { calculateRoundScore } from '@/lib/scoring';
import { submitRoundScore, updateRoundScore, resetGame, saveBids } from '../actions';
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
  currentRoundNumber,
  initialPhase = 'BIDDING',
  initialBids = {}
}: {
  gameId: string,
  players: Player[],
  history: RoundData[],
  currentRoundNumber: number,
  initialPhase?: 'BIDDING' | 'SCORING',
  initialBids?: Record<string, number>
}) {
  const [round, setRound] = useState(currentRoundNumber);
  const [historyState, setHistory] = useState(history);
  const [totals, setTotals] = useState(players.map(p => ({ id: p.gamePlayerId, score: p.total })));

  const [phase, setPhase] = useState<'BIDDING' | 'SCORING'>(initialPhase);
  const [currentBids, setCurrentBids] = useState<Record<string, number>>(initialBids);
  const [currentTricks, setCurrentTricks] = useState<Record<string, number>>({});
  const [currentBonus, setCurrentBonus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showVictory, setShowVictory] = useState(true);
  const [editingCell, setEditingCell] = useState<{ round: number, playerId: string, field: 'bid' | 'tricks' | 'bonus' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const router = useRouter();
  const isGameOver = round > 10;

  const topScore = isGameOver ? Math.max(...totals.map(t => t.score)) : 0;
  const winners = isGameOver ? totals.filter(t => t.score === topScore) : [];
  const winnerNames = winners.map(w => players.find(p => p.gamePlayerId === w.id)?.name || 'Inconnu').join(' & ');

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

  const startInlineEdit = (roundNum: number, playerId: string, field: 'bid' | 'tricks' | 'bonus') => {
    const roundData = historyState.find(h => h.roundNumber === roundNum);
    if (!roundData) return;
    const s = roundData.playerScores[playerId];
    if (!s) return;
    setEditingCell({ round: roundNum, playerId, field });
    setEditValue(String(s[field]));
  };

  // Read value directly from input element to avoid React state timing issues with arrows
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.currentTarget.value;
    saveInlineEditWithValue(inputValue);
  };

  const handleInputChange = (value: string) => {
    setEditValue(value);
  };

  const saveInlineEditWithValue = async (inputValue: string) => {
    if (!editingCell) return;
    const { round: editRound, playerId, field } = editingCell;

    // Parse the value - if empty or invalid, cancel edit
    const numValue = inputValue.trim() === '' ? null : parseInt(inputValue);
    if (numValue === null || isNaN(numValue)) {
      setEditingCell(null);
      return;
    }

    // Update history in-place
    const newHistory = historyState.map(h => {
      if (h.roundNumber !== editRound) return h;
      const oldScore = h.playerScores[playerId];
      if (!oldScore) return h;

      const updatedScoreData = { ...oldScore, [field]: numValue };
      updatedScoreData.score = calculateRoundScore({
        roundNumber: editRound,
        bid: updatedScoreData.bid,
        tricksWon: updatedScoreData.tricks,
        bonusPoints: updatedScoreData.bonus
      });

      return {
        ...h,
        playerScores: { ...h.playerScores, [playerId]: updatedScoreData }
      };
    });

    setHistory(newHistory);

    // Recalculate totals from all history
    const newTotals = players.map(p => {
      let score = 0;
      newHistory.forEach(h => {
        const s = h.playerScores[p.gamePlayerId];
        if (s) score += s.score;
      });
      return { id: p.gamePlayerId, score };
    });
    setTotals(newTotals);

    // Save to DB using updateRoundScore (not submitRoundScore)
    const roundData = newHistory.find(h => h.roundNumber === editRound);
    if (roundData) {
      const scoresToSubmit = players.map(p => {
        const s = roundData.playerScores[p.gamePlayerId];
        return s ? { gamePlayerId: p.gamePlayerId, bid: s.bid, tricks: s.tricks, bonus: s.bonus, score: s.score } : null;
      }).filter(Boolean) as { gamePlayerId: string; bid: number; tricks: number; bonus: number; score: number }[];
      await updateRoundScore(gameId, editRound, scoresToSubmit);
    }

    setEditingCell(null);
    router.refresh();
  };

  const startScoring = async () => {
    // Save bids to database before transitioning to scoring
    setLoading(true);
    try {
      const bidsToSave = players.map(p => ({
        gamePlayerId: p.gamePlayerId,
        bid: currentBids[p.gamePlayerId] || 0
      }));
      await saveBids(gameId, round, bidsToSave);
      setPhase('SCORING');
    } catch (err) {
      console.error('Error saving bids:', err);
    } finally {
      setLoading(false);
    }
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
    // Past Rounds - Now with clickable sub-elements
    if (roundNum < round) {
      const r = historyState.find(h => h.roundNumber === roundNum);
      const s = r?.playerScores[playerId];
      if (!s) return <td key={playerId}>-</td>;

      const isEditingBid = editingCell?.round === roundNum && editingCell?.playerId === playerId && editingCell?.field === 'bid';
      const isEditingTricks = editingCell?.round === roundNum && editingCell?.playerId === playerId && editingCell?.field === 'tricks';
      const isEditingBonus = editingCell?.round === roundNum && editingCell?.playerId === playerId && editingCell?.field === 'bonus';

      return (
        <td key={playerId} className={styles.pastCell}>
          <div className={styles.cellScore}>{s.score}</div>
          <div className={styles.cellSubElements}>
            <div
              className={styles.editableField}
              onClick={() => startInlineEdit(roundNum, playerId, 'bid')}
            >
              {isEditingBid ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={handleBlur}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.key === 'Enter' && handleBlur(e as unknown as React.FocusEvent<HTMLInputElement>)}
                  autoFocus
                  className={styles.inlineInput}
                />
              ) : (
                <span>Pari: {s.bid}</span>
              )}
            </div>
            <div
              className={styles.editableField}
              onClick={() => startInlineEdit(roundNum, playerId, 'tricks')}
            >
              {isEditingTricks ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={handleBlur}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.key === 'Enter' && handleBlur(e as unknown as React.FocusEvent<HTMLInputElement>)}
                  autoFocus
                  className={styles.inlineInput}
                />
              ) : (
                <span>Plis: {s.tricks}</span>
              )}
            </div>
            <div
              className={styles.editableField}
              onClick={() => startInlineEdit(roundNum, playerId, 'bonus')}
            >
              {isEditingBonus ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={handleBlur}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.key === 'Enter' && handleBlur(e as unknown as React.FocusEvent<HTMLInputElement>)}
                  autoFocus
                  className={styles.inlineInput}
                />
              ) : (
                <span>Bonus: {s.bonus}</span>
              )}
            </div>
          </div>
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
                <div className={styles.lockedBid}>Pari demandé: {currentBids[playerId] || 0}</div>
                <div className={styles.tricksLabel}>Plis effectués:</div>
                <NumberSelector value={currentTricks[playerId]} onChange={(val) => handleTricksChange(playerId, val)} max={round + 1} />
                <div className={styles.bonusInputWrapper}>
                  <div className={styles.bonusQuickBtns}>
                    {[-20, -10, 10, 20, 30, 40, 50, 60].map(val => (
                      <button
                        key={val}
                        type="button"
                        className={`${styles.bonusBtn} ${val < 0 ? styles.bonusBtnNegative : styles.bonusBtnPositive} ${currentBonus[playerId] === val ? styles.bonusBtnActive : ''}`}
                        onClick={() => handleBonusChange(playerId, val)}
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={currentBonus[playerId] ?? ''} onChange={e => handleBonusChange(playerId, parseInt(e.target.value) || 0)} className={styles.inputBonus} placeholder="+ Bonus" />
                </div>
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
                      <div className={styles.cardLockedBid}>Pari demandé: {currentBids[p.gamePlayerId] || 0}</div>
                      <div className={styles.tricksLabel}>Plis effectués:</div>
                      <NumberSelector value={currentTricks[p.gamePlayerId]} onChange={(val) => handleTricksChange(p.gamePlayerId, val)} max={round + 1} />
                      <div className={styles.bonusInputWrapper}>
                        <div className={styles.bonusQuickBtns}>
                          {[-20, -10, 10, 20, 30, 40, 50, 60].map(val => (
                            <button
                              key={val}
                              type="button"
                              className={`${styles.bonusBtn} ${val < 0 ? styles.bonusBtnNegative : styles.bonusBtnPositive} ${currentBonus[p.gamePlayerId] === val ? styles.bonusBtnActive : ''}`}
                              onClick={() => handleBonusChange(p.gamePlayerId, val)}
                            >
                              {val > 0 ? `+${val}` : val}
                            </button>
                          ))}
                        </div>
                        <input type="number" value={currentBonus[p.gamePlayerId] ?? ''} onChange={e => handleBonusChange(p.gamePlayerId, parseInt(e.target.value) || 0)} className={styles.inputBonus} placeholder="+ Bonus" />
                      </div>
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
      {isGameOver && <img src="/assets/pirate-treasure.png" alt="Treasure" className={styles.desktopTreasure} />}
      <div className={`${styles.scorepadContainer} ${!isGameOver ? styles.desktopHistory : styles.gameOverMobile}`}>
        <table className={styles.scorepad}>
          <thead>
            <tr>
              <th className={styles.roundCol}>#</th>
              {(() => {
                const topScore = Math.max(...totals.map(t => t.score));
                // Sort players by score when game is over
                const sortedPlayers = isGameOver
                  ? [...players].sort((a, b) => {
                    const aScore = totals.find(t => t.id === a.gamePlayerId)?.score || 0;
                    const bScore = totals.find(t => t.id === b.gamePlayerId)?.score || 0;
                    return bScore - aScore;
                  })
                  : players;
                return sortedPlayers.map(p => {
                  const playerScore = totals.find(t => t.id === p.gamePlayerId)?.score || 0;
                  const isWinner = isGameOver && playerScore === topScore;
                  return (
                    <th key={p.gamePlayerId} className={`${styles.playerCol} ${isWinner ? styles.winnerCol : ''}`}>
                      {isWinner && <span className={styles.crownIcon}>👑</span>}
                      {p.name}
                      <div className={styles.totalScore}>
                        {playerScore}
                      </div>
                    </th>
                  );
                });
              })()}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(rNum => {
              // Sort players by score when game is over
              const sortedPlayers = isGameOver
                ? [...players].sort((a, b) => {
                  const aScore = totals.find(t => t.id === a.gamePlayerId)?.score || 0;
                  const bScore = totals.find(t => t.id === b.gamePlayerId)?.score || 0;
                  return bScore - aScore;
                })
                : players;
              return (
                <tr key={rNum} className={rNum === round ? styles.activeRow : ''}>
                  <td className={styles.roundNum}>{rNum}</td>
                  {sortedPlayers.map(p => renderCell(rNum, p.gamePlayerId, true))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE FINAL SCORES (Card-based for readability) */}
      {isGameOver && (
        <div className={styles.mobileFinalSection}>
          <h2 className={styles.mobileFinalTitle}>🏴‍☠️ Classement Final</h2>
          <img src="/assets/pirate-treasure.png" alt="Treasure" className={styles.treasureIcon} />
          <div className={styles.finalPlayerCards}>
            {(() => {
              const sorted = [...totals].sort((a, b) => b.score - a.score);
              const topScore = sorted[0]?.score || 0;
              return sorted.map((t, idx) => {
                const player = players.find(p => p.gamePlayerId === t.id);
                const isWinner = t.score === topScore;
                return (
                  <div key={t.id} className={`glass ${styles.finalPlayerCard} ${isWinner ? styles.winner : ''}`}>
                    <div className={styles.finalRank}>{isWinner ? '👑' : `#${idx + 1}`}</div>
                    <div className={styles.finalPlayerInfo}>
                      <div className={styles.finalPlayerName}>{player?.name}</div>
                      <div className={styles.finalPlayerScore}>{t.score} pts</div>
                    </div>
                    <div className={styles.finalPlayerHistory}>
                      {historyState.map(h => {
                        const s = h.playerScores[t.id];
                        return s ? (
                          <div key={h.roundNumber} className={styles.historyChip}>
                            <span className={styles.historyRound}>M{h.roundNumber}</span>
                            <span className={s.score >= 0 ? styles.historyPositive : styles.historyNegative}>{s.score > 0 ? '+' : ''}{s.score}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {!isGameOver && (
        <div className={styles.stickyControls}>
          <button onClick={phase === 'BIDDING' ? startScoring : finishRound} disabled={loading} className={styles.actionBtn}>
            {loading ? 'Sauvegarde...' : phase === 'BIDDING' ? `Lancer Manche ${round}` : 'Terminer Manche'}
          </button>
        </div>
      )}

      {isGameOver && (
        <div className={styles.finalControls}>
          {showVictory && <VictoryModal winnerName={winnerNames} onClose={() => setShowVictory(false)} />}
          <h2>Partie Terminée !</h2>
          <Link href="/leaderboard" className={styles.actionBtn}>Voir Classement</Link>
        </div>
      )}
    </div>
  );
}
