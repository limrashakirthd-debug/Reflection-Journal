import { ReminderSettings, ReminderTheme } from '../types';

export const REMINDER_THEME_PROMPTS: Record<
  ReminderTheme,
  { label: string; title: string; defaultMessage: string; spark: string }
> = {
  evening_reflection: {
    label: 'Evening Reflection',
    title: 'Evening Journaling Reminder',
    defaultMessage: 'Take 3 quiet minutes to reflect on what brought you peace or challenged you today.',
    spark: 'Looking back on today, what stood out to me was...',
  },
  mindful: {
    label: 'Mindful Pause',
    title: 'Mindful Pause Reminder',
    defaultMessage: 'Take a gentle breath. Check in with yourself and jot down how your mind and body feel right now.',
    spark: 'Right now, in this present moment, I feel...',
  },
  morning_clarity: {
    label: 'Morning Intentions',
    title: 'Morning Clarity Reminder',
    defaultMessage: 'Start your day with clarity. What matters most to you today, and how do you wish to show up?',
    spark: 'My core focus and intention for today is...',
  },
  gratitude: {
    label: 'Gratitude Spark',
    title: 'Daily Gratitude Reminder',
    defaultMessage: 'Pause to note three simple moments, people, or feelings from today that you appreciate.',
    spark: 'Three moments or things I am genuinely grateful for today: 1. ',
  },
  custom: {
    label: 'Custom Message',
    title: 'Personal Journaling Reminder',
    defaultMessage: 'Time for your daily reflection and personal journaling.',
    spark: 'Notes and reflections for today...',
  },
};

/**
 * Check if the browser Notification API is available.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Could not request notification permission (sandbox/iframe restrictions):', err);
    return Notification.permission || 'denied';
  }
}

/**
 * Play a gentle, soothing meditative chime using the Web Audio API.
 * Uses two soft harmonic sine tones (C5 = 523.25Hz, G5 = 783.99Hz) with smooth decay.
 */
export function playGentleChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First harmonic tone: C5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.08); // gentle attack
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.6); // smooth decay
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Second harmonic tone: G5 (played slightly delayed for a relaxing resonant chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12); // G5
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.09, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 1.8);
    osc2.start(now + 0.12);
    osc2.stop(now + 2.2);

    // Clean up audio context
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2500);
  } catch (err) {
    console.debug('Web Audio chime could not play:', err);
  }
}

/**
 * Trigger a native desktop/browser notification if granted.
 */
export function triggerNativeNotification(
  title: string,
  body: string,
  onClick?: () => void
): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'daily-journal-reminder',
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    return true;
  } catch (err) {
    console.warn('Native notification trigger blocked:', err);
    return false;
  }
}

/**
 * Check if the given reminder is scheduled for today and matches current day of week.
 */
export function isReminderActiveForToday(settings: ReminderSettings): boolean {
  if (!settings.enabled) return false;
  const currentDay = new Date().getDay(); // 0 = Sun, 6 = Sat
  return settings.daysOfWeek.includes(currentDay);
}

/**
 * Format 24-hour time "HH:MM" into friendly readable time "h:mm A".
 */
export function formatTimeFriendly(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;

  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minuteFormatted = m < 10 ? `0${m}` : `${m}`;
  return `${hour12}:${minuteFormatted} ${ampm}`;
}
