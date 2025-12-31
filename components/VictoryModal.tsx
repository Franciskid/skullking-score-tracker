'use client';

import styles from './VictoryModal.module.css';
import Image from 'next/image';

interface Props {
  winnerName: string;
  onClose: () => void;
}

export default function VictoryModal({ winnerName, onClose }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.confetti}></div>
        <h2 className={styles.title}>Gloire au Vainqueur !</h2>

        <div className={styles.treasureContainer}>
          <Image
            src="/assets/pirate-treasure.png"
            alt="Treasure Chest"
            width={300}
            height={300}
            className={styles.chest}
          />
          <div className={styles.glow}></div>
        </div>

        <p className={styles.winnerName}>{winnerName}</p>
        <p className={styles.subtitle}>{winnerName.includes('&') ? 'Les Rois des Pirates !' : 'Le Roi des Pirates !'}</p>

        <button onClick={onClose} className={styles.closeBtn}>Réclamer le Butin</button>
      </div>
    </div>
  );
}
