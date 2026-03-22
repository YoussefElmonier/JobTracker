import confetti from 'canvas-confetti';
import { useEffect } from 'react';

export default function PremiumConfetti({ trigger }) {
  useEffect(() => {
    if (!trigger) return;

    // First burst — center explosion
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#00BFFF', '#7B2FBE', '#ffffff'],
      scalar: 1.2
    });

    // Left cannon
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#FFD700', '#FFA500', '#ffffff']
      });
    }, 300);

    // Right cannon
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#FFD700', '#FFA500', '#ffffff']
      });
    }, 500);

    // Final golden shower from top
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0 },
        gravity: 0.8,
        colors: ['#FFD700', '#FFA500'],
        scalar: 0.8
      });
    }, 800);

  }, [trigger]);

  return null;
}
