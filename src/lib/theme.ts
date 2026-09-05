import { ThemeMode } from '../types';

export type { ThemeMode };

const THEME_STORAGE_KEY = 'reflections_journal_theme';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (e) {
    console.warn('Error reading theme from localStorage:', e);
  }
  return 'system';
}

export function applyTheme(mode: ThemeMode): boolean {
  if (typeof window === 'undefined') return false;

  let isDark = false;
  if (mode === 'dark') {
    isDark = true;
  } else if (mode === 'light') {
    isDark = false;
  } else {
    // system
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Error saving theme to localStorage:', e);
  }

  return isDark;
}

export function getNextTheme(current: ThemeMode): ThemeMode {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'system';
  return 'light';
}
