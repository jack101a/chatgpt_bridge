/**
 * iOS & Android Apple-grade tactile haptic feedback utility.
 * Gracefully degrades when Web Vibration API is not supported or permission is restricted.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection';

export const triggerHaptic = (duration = 10): void => {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore vibration errors on restricted devices/browsers
    }
  }
};

export const hapticImpact = (style: HapticStyle = 'light'): void => {
  switch (style) {
    case 'light':
      triggerHaptic(8);
      break;
    case 'medium':
      triggerHaptic(15);
      break;
    case 'heavy':
      triggerHaptic(28);
      break;
    case 'selection':
      triggerHaptic(6);
      break;
    default:
      triggerHaptic(10);
  }
};
