'use client';

import styles from './NumberSelector.module.css';

interface Props {
  value: number | undefined;
  onChange: (val: number) => void;
  max: number;
}

export default function NumberSelector({ value, onChange, max }: Props) {
  const options = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div className={styles.container}>
      {options.map((num) => (
        <button
          key={num}
          className={`${styles.option} ${value === num ? styles.selected : ''}`}
          onClick={() => onChange(num)}
          type="button" // Prevent form submission if inside form
        >
          {num}
        </button>
      ))}
    </div>
  );
}
