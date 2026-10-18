import React, { useEffect, useState, useRef } from 'react';
import { formatBRL } from '../utils/calculator';

interface Props {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  prefix?: string;
  className?: string;
}

export default function AnimatedNumber({
  value,
  duration = 850,
  formatter = formatBRL,
  prefix = '',
  className,
}: Props) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const startVal = isFirstRender.current ? 0 : displayValue;
    isFirstRender.current = false;
    const endVal = value;

    if (Math.abs(startVal - endVal) < 0.01) {
      setDisplayValue(endVal);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const easeOutCubic = (x: number): number => {
      return 1 - Math.pow(1 - x, 3);
    };

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const nextVal = startVal + (endVal - startVal) * easedProgress;
      setDisplayValue(nextVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  const formattedFinal = prefix + formatter(value);

  return (
    <span className={className} title={formattedFinal}>
      {prefix}
      {formatter(displayValue)}
    </span>
  );
}
