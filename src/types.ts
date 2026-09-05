export type ReflectionMode =
  | 'reflection'
  | 'summary'
  | 'brainstorm'
  | 'action_plan'
  | 'empathy';

export type MoodSentiment =
  | 'peaceful'
  | 'grateful'
  | 'energized'
  | 'thoughtful'
  | 'anxious'
  | 'tired'
  | 'frustrated';

export interface MoodConfig {
  id: MoodSentiment;
  label: string;
  emoji: string;
  badgeColor: string;
  subtext: string;
  promptSpark: string;
}

export const MOOD_CONFIGS: Record<MoodSentiment, MoodConfig> = {
  peaceful: {
    id: 'peaceful',
    label: 'Peaceful',
    emoji: '🌿',
    badgeColor: 'bg-[#eaf4ea] text-[#2e5c38] border-[#c8e2cb] dark:bg-[#1a2d1e] dark:text-[#a3e4b0] dark:border-[#2b4c32]',
    subtext: 'Calm, balanced, centered',
    promptSpark: 'I feel at peace right now. What brought this calm to my mind today?',
  },
  grateful: {
    id: 'grateful',
    label: 'Grateful',
    emoji: '✨',
    badgeColor: 'bg-[#fef7ea] text-[#855318] border-[#fde3be] dark:bg-[#322312] dark:text-[#f8c976] dark:border-[#5a3f1e]',
    subtext: 'Thankful, appreciative, grounded',
    promptSpark: 'I want to honor the small blessings and people that supported me recently.',
  },
  energized: {
    id: 'energized',
    label: 'Energized',
    emoji: '⚡',
    badgeColor: 'bg-[#eef8fc] text-[#1c6585] border-[#d2edfa] dark:bg-[#142834] dark:text-[#84d0f5] dark:border-[#204a60]',
    subtext: 'Inspired, motivated, excited',
    promptSpark: 'I have a burst of clarity and momentum. Here is what is inspiring me...',
  },
  thoughtful: {
    id: 'thoughtful',
    label: 'Thoughtful',
    emoji: '💭',
    badgeColor: 'bg-[#f4edf9] text-[#693988] border-[#e8d7f3] dark:bg-[#2a1a35] dark:text-[#d3a3f5] dark:border-[#4c2d60]',
    subtext: 'Reflective, inquisitive, observing',
    promptSpark: 'A thought has been turning over in my mind today: ',
  },
  anxious: {
    id: 'anxious',
    label: 'Anxious',
    emoji: '🌊',
    badgeColor: 'bg-[#fcf1eb] text-[#9c4d28] border-[#f8dbc8] dark:bg-[#341d13] dark:text-[#f5a176] dark:border-[#582d1c]',
    subtext: 'Restless, racing thoughts, uneasy',
    promptSpark: 'My mind feels uneasy right now. Here is what is feeling overwhelming or uncertain: ',
  },
  tired: {
    id: 'tired',
    label: 'Tired',
    emoji: '🌧️',
    badgeColor: 'bg-[#f1f3f5] text-[#495057] border-[#dde1e5] dark:bg-[#202326] dark:text-[#adb5bd] dark:border-[#383d42]',
    subtext: 'Drained, weary, needing rest',
    promptSpark: 'I am running on low energy today. What drained me, and how can I practice gentle self-compassion?',
  },
  frustrated: {
    id: 'frustrated',
    label: 'Challenged',
    emoji: '🌪️',
    badgeColor: 'bg-[#fdf0f0] text-[#9c2b2b] border-[#f9cece] dark:bg-[#351616] dark:text-[#fca5a5] dark:border-[#5c2323]',
    subtext: 'Stuck, irritated, in friction',
    promptSpark: 'I hit friction or frustration today. Here is what happened and why it bothers me: ',
  },
};

export interface Turn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  modelUsed?: string;
}

export interface JournalLocation {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  sentiment?: MoodSentiment;
  turns: Turn[];
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
  location?: JournalLocation;
}

export interface ReflectionRequest {
  prompt: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  mode: ReflectionMode;
  sentiment?: MoodSentiment;
}

export interface ReflectionResponse {
  response: string;
  title: string;
  modelUsed: string;
}

export type ReminderTheme =
  | 'mindful'
  | 'evening_reflection'
  | 'morning_clarity'
  | 'gratitude'
  | 'custom';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // "HH:MM" 24-hour format e.g., "20:30"
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  theme: ReminderTheme;
  customMessage?: string;
  soundEnabled: boolean;
  lastDismissedDate?: string; // "YYYY-MM-DD"
  updatedAt?: number;
  emailReminderEnabled?: boolean;
  reminderEmail?: string;
  lastEmailSentDate?: string; // "YYYY-MM-DD"
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface SystemStats {
  totalReflections: number;
  totalUsers: number;
  activeReminders: number;
  pinnedLocationsCount: number;
  healthy: boolean;
  activeAiModel: string;
}

export interface SystemPromptConfig {
  id: string;
  mode: ReflectionMode;
  systemInstruction: string;
  updatedAt: number;
  updatedBy: string;
}

