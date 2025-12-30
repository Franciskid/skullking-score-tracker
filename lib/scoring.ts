export interface RoundScoreInput {
  roundNumber: number;
  bid: number;
  tricksWon: number;
  bonusPoints?: number;
}

export function calculateRoundScore(input: RoundScoreInput): number {
  const { roundNumber, bid, tricksWon, bonusPoints = 0 } = input;
  let score = 0;

  if (bid === 0) {
    if (tricksWon === 0) {
      score = roundNumber * 10;
    } else {
      score = -(roundNumber * 10);
    }
  } else {
    if (bid === tricksWon) {
      score = bid * 20;
    } else {
      const difference = Math.abs(bid - tricksWon);
      score = -(difference * 10);
    }
  }

  // Bonus points are only awarded if the bid was successful (for tricks won)
  // OR they are specifically for capturing pirates/SK which happens during tricks.
  // In Skull King, bonuses are usually added regardless of bid success if they were earned capture-wise,
  // but many play that you must get your bid. 
  // Standard rules: "Bonuses are awarded regardless of whether the bid was correct."
  return score + bonusPoints;
}
