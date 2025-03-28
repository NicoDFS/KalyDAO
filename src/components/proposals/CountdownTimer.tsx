import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetBlock?: number;      // Make optional
  currentBlock?: number;     // Make optional
  targetTimestamp?: number;  // Add target timestamp (seconds)
  averageBlockTime?: number; // in seconds
  type?: 'badge' | 'detail'; 
  label?: string; // Add label prop for flexibility
}

export const CountdownTimer = ({ 
  targetBlock,
  currentBlock,
  targetTimestamp,
  averageBlockTime = 2, // KalyChain average block time is 2 seconds
  type = 'detail',
  label = "Voting starts in:" // Default label
}: CountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      let totalSeconds = 0;

      if (targetTimestamp) {
        // Timestamp-based calculation
        const nowSeconds = Date.now() / 1000;
        totalSeconds = targetTimestamp - nowSeconds;
      } else if (targetBlock && currentBlock) {
        // Block-based calculation (fallback)
        const blocksRemaining = targetBlock - currentBlock;
        if (blocksRemaining <= 0) return null;
        totalSeconds = blocksRemaining * averageBlockTime;
      } else {
        // Not enough info
        return null;
      }

      if (totalSeconds <= 0) return null;

      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = Math.floor(totalSeconds % 60);

      return { days, hours, minutes, seconds };
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetBlock, currentBlock, averageBlockTime, targetTimestamp]);

  if (!timeRemaining) return null;

  if (type === 'badge') {
    return (
      <div className="text-xs text-gray-600 mt-1.5">
        <Clock className="h-3 w-3 inline-block mr-1" />
        {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
      </div>
    );
  }

  // Detail view
  const timeString = `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`;

  return (
    <div className="flex items-center text-sm text-gray-600 mt-2">
      <Clock className="h-4 w-4 mr-2" />
      <span>
        {label} {timeString}
      </span>
    </div>
  );
}; 