import React from 'react';
import { Bell, Sparkles, X, Clock, ArrowRight } from 'lucide-react';
import { ReminderTheme } from '../types';
import { REMINDER_THEME_PROMPTS } from '../lib/notifications';

interface ReminderBannerProps {
  theme: ReminderTheme;
  customMessage?: string;
  onStartReflection: (initialSpark: string) => void;
  onSnooze: () => void;
  onDismissToday: () => void;
  isTestPreview?: boolean;
}

export function ReminderBanner({
  theme,
  customMessage,
  onStartReflection,
  onSnooze,
  onDismissToday,
  isTestPreview = false,
}: ReminderBannerProps) {
  const themeData = REMINDER_THEME_PROMPTS[theme] || REMINDER_THEME_PROMPTS.evening_reflection;
  const message =
    theme === 'custom' && customMessage ? customMessage : themeData.defaultMessage;
  const spark = themeData.spark;

  return (
    <div
      id="daily-reminder-banner"
      className="bg-[#f4ede4] dark:bg-[#231b14] border-b border-[#e8dfd5] dark:border-[#423122] text-[#2d2d2a] dark:text-[#f4efe6] px-4 sm:px-6 py-3 transition-all animate-in slide-in-from-top-2 duration-200"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Icon & Notification message */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#2d2d2a] dark:bg-[#deb887] text-[#deb887] dark:text-[#161514] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <Bell className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#8c5b3e] dark:text-[#deb887] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#c48344] dark:text-[#deb887]" />
                {isTestPreview ? 'Notification Preview' : 'Daily Journal Reminder'}
              </span>
              <span className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] bg-[#ebe9e1] dark:bg-[#2e261e] px-2 py-0.2 rounded-full font-medium">
                {themeData.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#2d2d2a] dark:text-[#f4efe6] font-serif leading-relaxed mt-0.5">
              "{message}"
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
          <button
            id="reminder-snooze-btn"
            type="button"
            onClick={onSnooze}
            className="px-2.5 py-1.5 text-xs text-[#6f6e69] dark:text-[#c5bfb4] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] hover:bg-[#e8dfd5]/60 dark:hover:bg-[#36291e] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="Remind me again in 1 hour"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Snooze 1h</span>
          </button>

          <button
            id="reminder-start-reflection-btn"
            type="button"
            onClick={() => onStartReflection(spark)}
            className="px-3.5 py-1.5 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Begin Reflection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            id="reminder-dismiss-btn"
            type="button"
            onClick={onDismissToday}
            className="p-1.5 text-[#888780] dark:text-[#958f84] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] hover:bg-[#e8dfd5]/60 dark:hover:bg-[#36291e] rounded-lg transition-colors cursor-pointer ml-1"
            title="Dismiss for today"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
