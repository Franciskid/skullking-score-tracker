'use client';

import { useEffect, useRef } from 'react';
import styles from './NumberSelector.module.css';

interface Props {
  value: number | undefined;
  onChange: (val: number) => void;
  max: number;
  mini?: boolean;
}

export default function NumberSelector({ value, onChange, max, mini = false }: Props) {
  const options = Array.from({ length: max + 1 }, (_, i) => i);

  const containerClass = mini ? styles.containerMini : styles.container;
  const optionClass = mini ? styles.optionMini : styles.option;

  /* Auto-scroll to selected element */
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 10ms timeout to ensure layout is computed
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const selectedEl = container.querySelector(`.${styles.selected}`) as HTMLElement;
      if (selectedEl) {
        // Calculate center position
        const containerWidth = container.offsetWidth;
        const itemLeft = selectedEl.offsetLeft;
        const itemWidth = selectedEl.offsetWidth;
        const scrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);

        container.scrollTo({
          left: scrollLeft,
          behavior: 'instant' // Use instant for initial render and quick updates
        });
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [value, mini]);

  return (
    <div className={containerClass} ref={scrollContainerRef}>
      {options.map((num) => (
        <button
          key={num}
          className={`${optionClass} ${value === num ? styles.selected : ''}`}
          onClick={() => onChange(num)}
          type="button" // Prevent form submission if inside form
        >
          {num}
        </button>
      ))}
    </div>
  );
}
