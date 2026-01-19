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
  const [statsCollapsed, setStatsCollapsed] = useState(false);

  const router = useRouter();
  const MAX_ROUNDS = 10;
  const isGameOver = round > MAX_ROUNDS;

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

  /* Handlers */
  const handleBidChange = async (playerId: string, value: number) => {
    // 1. Optimistic Update
    setCurrentBids(prev => ({ ...prev, [playerId]: value }));

    // 2. Persist immediately
    try {
      if (phase === 'BIDDING') {
        // In bidding phase, safe to use saveBids (tricks null is expected)
        await saveBids(gameId, round, [{ gamePlayerId: playerId, bid: value }]);
      } else {
        // In SCORING phase, preserve other fields
        const currentT = currentTricks[playerId] || 0;
        const currentB = currentBonus[playerId] || 0;
        const score = calculateRoundScore({ roundNumber: round, bid: value, tricksWon: currentT, bonusPoints: currentB });

        await updateRoundScore(gameId, round, [{
          gamePlayerId: playerId,
          bid: value,
          tricks: currentT,
          bonus: currentB,
          score
        }]);
      }
    } catch (err) {
      console.error("Failed to auto-save bid:", err);
    }
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
                <>
                  <span className={styles.miniLabel}>PARI</span>
                  <span className={styles.miniValue}>{s.bid}</span>
                </>
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
                <>
                  <span className={styles.miniLabel}>PLIS</span>
                  <span className={styles.miniValue}>{s.tricks}</span>
                </>
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
                <>
                  <span className={styles.miniLabel}>BONUS</span>
                  <span className={styles.miniValue}>{s.bonus}</span>
                </>
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
                <div className={styles.lockedBid}>
                  <span className={styles.bidLabelWrapper}>
                    Pari demandé:
                    <div className={styles.absoluteWheel}>
                      <NumberSelector value={currentBids[playerId]} onChange={(val) => handleBidChange(playerId, val)} max={round + 1} mini />
                    </div>
                  </span>
                </div>
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

  /* Stats Calculations for Banner */
  // Total tricks available = round number (NOT round * players)
  const totalTricks = round;
  const currentTotalBids = Object.values(currentBids).reduce((a, b) => a + (b || 0), 0);
  const bidDiff = currentTotalBids - totalTricks;

  const avgScore = players.length > 0 ? Math.round(totals.reduce((sum, t) => sum + t.score, 0) / players.length) : 0;
  const sortedScores = [...totals].sort((a, b) => b.score - a.score);
  const maxScore = sortedScores.length > 0 ? sortedScores[0].score : 0;
  // Find the first player with a score lower than the leader(s)
  // This handles ties: if 2 players tie at 100, and 3rd player has 80, advantage is 20
  const nextLowerScore = sortedScores.find(t => t.score < maxScore)?.score ?? maxScore;
  const leaderAdvantage = maxScore - nextLowerScore;
  // Capitalize leader names
  const leaders = totals.filter(t => t.score === maxScore)
    .map(t => {
      const name = players.find(p => p.gamePlayerId === t.id)?.name || '';
      return name.charAt(0).toUpperCase() + name.slice(1);
    })
    .filter(Boolean);

  // Historical Tension: Average (bids - tricks) per round from completed rounds
  const historicalTension = (() => {
    if (historyState.length === 0) return null;
    let totalDiff = 0;
    historyState.forEach(h => {
      const roundBids = Object.values(h.playerScores).reduce((sum, ps) => sum + ps.bid, 0);
      const roundTricks = h.roundNumber; // Tricks available = round number
      totalDiff += (roundBids - roundTricks);
    });
    const avg = totalDiff / historyState.length;
    return avg;
  })();

  // Cumulative Bid Stats: total bids / total cards dealt across all completed rounds
  const cumulativeBidStats = (() => {
    if (historyState.length === 0) return null;
    let totalBids = 0;
    let totalCardsDealt = 0;
    historyState.forEach(h => {
      totalBids += Object.values(h.playerScores).reduce((sum, ps) => sum + ps.bid, 0);
      totalCardsDealt += h.roundNumber; // Cards dealt = round number
    });
    const percentage = totalCardsDealt > 0 ? Math.round((totalBids / totalCardsDealt) * 100) : 0;
    const diff = totalBids - totalCardsDealt;

    // Classification based on percentage
    let style: 'conservative' | 'balanced' | 'aggressive';
    let icon: string;
    let label: string;
    if (percentage < 90) {
      style = 'conservative';
      icon = '🛡️';
      label = 'Prudent';
    } else if (percentage <= 110) {
      style = 'balanced';
      icon = '⚖️';
      label = 'Équilibré';
    } else {
      style = 'aggressive';
      icon = '⚔️';
      label = 'Audacieux';
    }

    return { totalBids, totalCardsDealt, percentage, diff, style, icon, label };
  })();

  // Individual player bid stats for the tendency bar
  const playerBidStats = (() => {
    if (historyState.length === 0) return null;

    const stats = players.map(p => {
      let playerTotalBids = 0;
      let playerTotalCards = 0;
      let zeroBidCount = 0;

      historyState.forEach(h => {
        const score = h.playerScores[p.gamePlayerId];
        if (score) {
          playerTotalBids += score.bid;
          playerTotalCards += h.roundNumber;
          if (score.bid === 0) zeroBidCount++;
        }
      });

      const percentage = playerTotalCards > 0 ? Math.round((playerTotalBids / playerTotalCards) * 100) : 0;
      const initial = p.name.charAt(0).toUpperCase();

      return {
        id: p.gamePlayerId,
        name: p.name,
        initial,
        totalBids: playerTotalBids,
        percentage,
        zeroBidCount
      };
    });

    // Find extremes
    const sortedByPercentage = [...stats].sort((a, b) => b.percentage - a.percentage);
    const mostAggressive = sortedByPercentage[0];
    const mostConservative = sortedByPercentage[sortedByPercentage.length - 1];
    const mostZeroBids = [...stats].sort((a, b) => b.zeroBidCount - a.zeroBidCount)[0];

    return {
      players: stats,
      mostAggressive: mostAggressive.percentage !== mostConservative.percentage ? mostAggressive : null,
      mostConservative: mostAggressive.percentage !== mostConservative.percentage ? mostConservative : null,
      mostZeroBids: mostZeroBids.zeroBidCount > 0 ? mostZeroBids : null
    };
  })();

  const getBidStatus = () => {
    // New format: "Paris: X/Y"
    // icon and color remain
    if (bidDiff === 0) return { text: `Paris: ${currentTotalBids}/${totalTricks}`, subtext: "(Équilibré)", icon: "⚖️", color: "#4caf50" };
    if (bidDiff > 0) return { text: `Paris: ${currentTotalBids}/${totalTricks}`, subtext: `(+${bidDiff})`, icon: "🔥", color: "#ffa726" };
    return { text: `Paris: ${currentTotalBids}/${totalTricks}`, subtext: `(${bidDiff})`, icon: "❄️", color: "#42a5f5" };
  };
  const bidStatus = getBidStatus();

  const getHistoricalTensionText = () => {
    if (historicalTension === null) return null;
    const rounded = Math.round(historicalTension * 10) / 10;
    if (rounded === 0) return { text: "Jusque-là: Équilibré", icon: "⚓", color: "#9e9e9e" };
    if (rounded > 0) return { text: `Jusque-là: Sur-demandé en moyenne de ${rounded} levée(s)`, icon: "📈", color: "#ff7043" };
    return { text: `Jusque-là: Sous-demandé en moyenne de ${Math.abs(rounded)} levée(s)`, icon: "📉", color: "#64b5f6" };
  };
  const histTension = getHistoricalTensionText();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup} onClick={() => setStatsCollapsed(!statsCollapsed)} style={{ cursor: 'pointer' }}>
            <h1>Skull King 🏴‍☠️</h1>
            <span className={`${styles.collapseArrow} ${statsCollapsed ? styles.collapsed : ''}`}>▼</span>
            <p className={styles.gameId}>Partie #{gameId.slice(0, 4)}</p>
          </div>
          <div className={styles.actions}>
            <button onClick={() => setMenuOpen(!menuOpen)} className={styles.menuBtn}>⚙️ Options</button>
            {menuOpen && (
              <div className={styles.dropdown}>
                {!isGameOver && (
                  <button onClick={handleReset} className={styles.dropdownItem}>Recommencer</button>
                )}
                <Link href="/games" className={styles.dropdownItem}>Historique</Link>
                <Link href="/" className={styles.dropdownItem}>Quitter vers Menu</Link>
              </div>
            )}
          </div>
        </div>

        {/* Clean Stats Bar - Collapsible */}
        <div className={`${styles.statsBar} ${statsCollapsed ? styles.statsBarCollapsed : ''}`}>
          {/* Round Info - Most Prominent */}
          {/* Round Info - Most Prominent */}
          <div className={styles.roundBadge}>
            {isGameOver ? (
              <span className={styles.roundLabel} style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '2px' }}>PARTIE TERMINÉE</span>
            ) : (
              <>
                <span className={styles.roundLabel}>Manche</span>
                <span className={styles.roundValue}>{round}</span>
                <span className={styles.roundTotal}>/ {MAX_ROUNDS}</span>
              </>
            )}
          </div>

          {/* Game Stats - Inline */}
          <div className={styles.gameStats}>
            <span className={styles.statItem}>
              <span className={styles.statLabel}>{players.length} pirates</span>
            </span>
            <span className={styles.statDivider}>•</span>
            {maxScore > 0 && (
              <>
                <span className={styles.statItem}>
                  <span className={styles.statLabel}>En tête:</span>
                  <span className={styles.statValue}>
                    {leaders.length > 0 ? leaders.join(', ') : '-'}
                    {leaderAdvantage > 0 && (
                      <span className={styles.leaderAdvantage}> (+{leaderAdvantage})</span>
                    )}
                  </span>
                </span>
                <span className={styles.statDivider}>•</span>
              </>
            )}
            <span className={styles.statItem}>
              <span className={styles.statLabel}>Moyenne:</span>
              <span className={styles.statValue}>{avgScore} pts</span>
            </span>
          </div>

          {/* Bid Status - Clear Explanation (Hide if game over) */}
          {!isGameOver && (
            <div className={`${styles.bidCard} ${bidDiff === 0 ? styles.bidBalanced : bidDiff > 0 ? styles.bidOver : styles.bidUnder}`}>
              <div className={styles.bidMain}>
                <span className={styles.bidCount}>{currentTotalBids} paris</span>
                <span className={styles.bidSeparator}>/</span>
                <span className={styles.bidAvailable}>{totalTricks} plis dispo</span>
              </div>
              <div className={styles.bidResult}>
                {bidDiff === 0 ? (
                  <span>Équilibré</span>
                ) : bidDiff > 0 ? (
                  <span>+{bidDiff} en trop</span>
                ) : (
                  <span>{Math.abs(bidDiff)} non réclamés</span>
                )}
              </div>
            </div>
          )}

          {/* Historical Bid Tendency - Only show after round 1 */}
          {cumulativeBidStats && (
            <div className={`${styles.tendencyCard} ${styles[`tendency${cumulativeBidStats.style.charAt(0).toUpperCase() + cumulativeBidStats.style.slice(1)}`]}`}>
              <div className={styles.tendencyHeader}>
                <span className={styles.tendencyIcon}>{cumulativeBidStats.icon}</span>
                <span className={styles.tendencyLabel}>Tendance des paris:</span>
                <span className={styles.tendencyStyle}>{cumulativeBidStats.label}</span>

                {/* Skull Head - static with color filter based on tendency */}
                <img
                  src="/assets/skull-head.png"
                  alt="Skull"
                  className={`${styles.tendencySkull} ${styles[`skull${cumulativeBidStats.style.charAt(0).toUpperCase() + cumulativeBidStats.style.slice(1)}`]}`}
                  title={`Équipe: ${cumulativeBidStats.label} (${cumulativeBidStats.percentage}%)`}
                />
              </div>



              {/* REFACTOR: Calculate scale logic first - ZOOM on Players */}
              {(() => {
                if (!playerBidStats) return null;
                const percentages = playerBidStats.players.map(p => p.percentage);
                // Scale based ONLY on players to maximize spread
                // Add 15% buffer on right
                const maxPlayerVal = Math.max(...percentages);
                const scaleMax = maxPlayerVal > 0 ? maxPlayerVal * 1.15 : 100;

                // Helper for positioning
                const getPos = (val: number) => (Math.max(val, 0) / scaleMax) * 100;

                return (
                  <div className={styles.tendencyBar}>
                    <div
                      className={styles.tendencyFill}
                      style={{ width: `${Math.min(getPos(cumulativeBidStats.percentage), 100)}%` }}
                    />

                    {/* Only show 100% marker if within view (or close to it) */}
                    {getPos(100) <= 100 && (
                      <div
                        className={styles.tendencyMarker}
                        style={{ left: `${getPos(100)}%` }}
                        title="100% = équilibré"
                      />
                    )}

                    {(() => {
                      // Collision Logic
                      const playersWithPos = playerBidStats.players.map(p => ({
                        ...p,
                        pos: getPos(p.percentage)
                      }));

                      const groups: Record<number, typeof playersWithPos> = {};
                      playersWithPos.forEach(p => {
                        const key = p.percentage;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(p);
                      });

                      return Object.values(groups).flatMap(group => {
                        if (group.length === 1) {
                          const p = group[0];
                          return (
                            <span
                              key={p.id}
                              className={styles.playerInitial}
                              style={{ left: `${p.pos}%` }}
                              title={`${p.name}: ${p.totalBids} paris (${p.percentage}% du total)`}
                            >
                              {p.initial}
                            </span>
                          );
                        } else {
                          const offsetStep = 1.5;
                          const startOffset = -((group.length - 1) * offsetStep) / 2;
                          return group.map((p, idx) => {
                            // Clamp to keep within visible area visually, but allow stacking
                            const finalPos = Math.min(Math.max(p.pos + startOffset + (idx * offsetStep), 1), 99);
                            return (
                              <span
                                key={p.id}
                                className={styles.playerInitial}
                                style={{ left: `${finalPos}%` }}
                                title={`${p.name}: ${p.totalBids} paris (${p.percentage}% du total)`}
                              >
                                {p.initial}
                              </span>
                            );
                          });
                        }
                      });
                    })()}
                  </div>
                );
              })()}

              <div className={styles.tendencyStats}>
                <span title="Total des paris demandés">{cumulativeBidStats.totalBids} paris</span>
                <span className={styles.tendencyPercent} title="Ratio paris/cartes disponibles">{cumulativeBidStats.percentage}%</span>
                <span title="Total des cartes distribuées">{cumulativeBidStats.totalCardsDealt} cartes</span>
              </div>
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
                      <div className={styles.cardLockedBid}>
                        <span className={styles.bidLabelWrapper}>
                          Pari demandé:
                          <div className={styles.absoluteWheel}>
                            <NumberSelector value={currentBids[p.gamePlayerId]} onChange={(val) => handleBidChange(p.gamePlayerId, val)} max={round + 1} mini />
                          </div>
                        </span>
                      </div>
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
      )
      }

      {/* MOBILE TRANSPOSED TABLE (Only during active game) */}
      {
        !isGameOver && (
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
        )
      }

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
      {
        isGameOver && (
          <div className={styles.mobileFinalSection}>
            <h2 className={styles.mobileFinalTitle}>🏴‍☠️ Classement Final</h2>
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
        )
      }

      {
        !isGameOver && (
          <div className={styles.stickyControls}>
            {(() => {
              const allTricksEntered = players.every(p => currentTricks[p.gamePlayerId] !== undefined);
              const isBidding = phase === 'BIDDING';

              // Text logic
              let btnText = '';
              if (loading) btnText = 'Sauvegarde...';
              else if (isBidding) btnText = `Lancer Manche ${round}`;
              else if (!allTricksEntered) btnText = 'Sélectionnez les plis effectués';
              else btnText = 'Terminer Manche';

              // Disable logic
              const isDisabled = loading || (!isBidding && !allTricksEntered);

              return (
                <button
                  onClick={isBidding ? startScoring : finishRound}
                  disabled={isDisabled}
                  className={styles.actionBtn}
                  style={isDisabled ? { opacity: 0.7, cursor: 'not-allowed', background: '#5d4037' } : {}}
                >
                  {btnText}
                </button>
              );
            })()}
          </div>
        )
      }

      {
        isGameOver && (
          <div className={styles.finalControls}>
            {showVictory && <VictoryModal winnerName={winnerNames} onClose={() => setShowVictory(false)} />}
            <h2>Partie Terminée !</h2>
            <Link href="/leaderboard" className={styles.actionBtn}>Voir Classement</Link>
          </div>
        )
      }
    </div >
  );
}
