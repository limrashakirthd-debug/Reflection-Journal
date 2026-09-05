import { User } from 'firebase/auth';
import { BookOpen, LogOut, Plus, ShieldCheck, Bell, Sparkles, Moon, Sun, Monitor, Shield } from 'lucide-react';
import { formatTimeFriendly } from '../lib/notifications';
import { ThemeMode, UserProfile } from '../types';

interface NavbarProps {
  user: User | null;
  userProfile?: UserProfile | null;
  onNewReflection: () => void;
  onSignOut: () => void;
  onOpenAdminConsole?: () => void;
  isSaving?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string;
  emailReminderEnabled?: boolean;
  onOpenReminderModal?: () => void;
  hasJournaledToday?: boolean;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

export function Navbar({
  user,
  userProfile,
  onNewReflection,
  onSignOut,
  onOpenAdminConsole,
  reminderEnabled = false,
  reminderTime = '20:30',
  emailReminderEnabled = false,
  onOpenReminderModal,
  hasJournaledToday = false,
  themeMode = 'system',
  onToggleTheme,
}: NavbarProps) {
  return (
    <header
      id="app-navbar"
      className="border-b border-[#e5e4de] dark:border-[#36332e] bg-[#f8f7f2]/95 dark:bg-[#161514]/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2d2d2a] dark:bg-[#1e1c1a] text-[#f8f7f2] flex items-center justify-center shadow-xs border border-transparent dark:border-[#36332e]">
            <BookOpen className="w-5 h-5 text-[#deb887]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-semibold text-[#2d2d2a] dark:text-[#f4efe6] text-lg tracking-tight">
                Reflections Journal
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-[#3b4c3a] dark:text-[#a0cfa0] bg-[#e6ede4] dark:bg-[#202b20] border border-[#d2ded0] dark:border-[#314830] px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                Private Firestore
              </span>
              {hasJournaledToday && (
                <span
                  id="today-journaled-badge"
                  className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-[#8c5b3e] dark:text-[#deb887] bg-[#f4ede4] dark:bg-[#2d2218] border border-[#e8dfd5] dark:border-[#4d3620] px-2 py-0.5 rounded-full"
                  title="You have reflected today!"
                >
                  <Sparkles className="w-3 h-3 text-[#c48344] dark:text-[#deb887]" />
                  Reflected Today
                </span>
              )}
            </div>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] hidden md:block">
              Authenticated multi-turn companion with Gemini 3.6 Flash
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Mode Toggle (Always accessible) */}
          {onToggleTheme && (
            <button
              id="navbar-theme-toggle-btn"
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-[#e5e4de] dark:border-[#36332e] bg-white dark:bg-[#1e1c1a] text-[#2d2d2a] dark:text-[#deb887] hover:bg-[#f2f1ea] dark:hover:bg-[#282521] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-xs"
              title={`Current theme: ${themeMode.toUpperCase()}. Click to switch to ${
                themeMode === 'light' ? 'Dark' : themeMode === 'dark' ? 'System' : 'Light'
              } mode`}
            >
              {themeMode === 'light' ? (
                <Sun className="w-4 h-4 text-[#c48344]" />
              ) : themeMode === 'dark' ? (
                <Moon className="w-4 h-4 text-[#deb887]" />
              ) : (
                <Monitor className="w-4 h-4 text-[#888780] dark:text-[#deb887]" />
              )}
              <span className="hidden sm:inline text-[11px] font-medium capitalize text-[#6f6e69] dark:text-[#c5bfb4]">
                {themeMode}
              </span>
            </button>
          )}

          {user && (
            <>
              {/* Notification Reminder Bell */}
              <button
                id="navbar-reminder-btn"
                onClick={onOpenReminderModal}
                className={`relative p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                  reminderEnabled || emailReminderEnabled
                    ? 'bg-white dark:bg-[#1e1c1a] border-[#dedcd5] dark:border-[#36332e] text-[#2d2d2a] dark:text-[#f4efe6] hover:bg-[#f2f1ea] dark:hover:bg-[#282521]'
                    : 'bg-[#f2f1ea] dark:bg-[#1e1c1a] border-[#e5e4de] dark:border-[#36332e] text-[#888780] dark:text-[#958f84] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6]'
                }`}
                title={
                  reminderEnabled && emailReminderEnabled
                    ? `Daily browser & email reminders active at ${formatTimeFriendly(reminderTime)}`
                    : reminderEnabled
                    ? `Daily browser reminder active at ${formatTimeFriendly(reminderTime)}`
                    : emailReminderEnabled
                    ? `Daily email reminder active at ${formatTimeFriendly(reminderTime)}`
                    : 'Configure daily journaling & email reminders'
                }
              >
                <Bell className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                {(reminderEnabled || emailReminderEnabled) && (
                  <span className="hidden sm:inline text-[11px] font-mono text-[#6f6e69] dark:text-[#c5bfb4]">
                    {formatTimeFriendly(reminderTime)}
                  </span>
                )}
                {/* Active Indicator Dot */}
                {(reminderEnabled || emailReminderEnabled) && (
                  <span
                    id="navbar-reminder-active-dot"
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#3b4c3a] dark:bg-[#4ade80] ring-2 ring-[#f8f7f2] dark:ring-[#161514]"
                  />
                )}
              </button>

              {/* Admin Governance Console Button (Protected: Visible only to authenticated admins) */}
              {userProfile?.role === 'admin' && (
                <button
                  id="navbar-admin-console-btn"
                  onClick={onOpenAdminConsole}
                  className="px-2.5 py-1.5 rounded-lg border border-[#c48344]/40 dark:border-[#deb887]/40 bg-[#fef7ea] dark:bg-[#2d2218] text-[#855318] dark:text-[#deb887] hover:bg-[#fde9cc] dark:hover:bg-[#3d2f20] transition-all text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                  title="Open Elevated Admin & RBAC Governance Console"
                >
                  <Shield className="w-3.5 h-3.5 text-[#c48344] dark:text-[#deb887]" />
                  <span>Admin</span>
                </button>
              )}

              {/* New Reflection Button */}
              <button
                id="new-reflection-btn"
                onClick={onNewReflection}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] text-sm font-medium rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Start a new reflection"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Reflection</span>
              </button>

              {/* User Profile Pill */}
              <div
                id="user-profile-pill"
                className="flex items-center gap-2.5 bg-[#f2f1ea] dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-lg px-2.5 py-1.5"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-[#dedcd5] dark:border-[#36332e]"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#dedcd5] dark:bg-[#2d2a26] text-[#2d2d2a] dark:text-[#f4efe6] text-xs font-semibold flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] leading-tight truncate max-w-[120px]">
                      {user.displayName || 'Journaler'}
                    </p>
                    {userProfile?.role === 'admin' && (
                      <span
                        id="user-role-admin-badge"
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#deb887]/20 text-[#855318] dark:text-[#deb887] border border-[#deb887]/40 tracking-wider"
                      >
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] leading-tight truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>

                {/* Sign Out */}
                <button
                  id="sign-out-btn"
                  onClick={onSignOut}
                  className="p-1 text-[#6f6e69] dark:text-[#c5bfb4] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] hover:bg-[#ebe9e1] dark:hover:bg-[#282521] rounded-md transition-colors cursor-pointer ml-1"
                  title="Sign out of account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
