import React, { useState } from 'react';
import {
  Bell,
  X,
  Check,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  Calendar,
  AlertCircle,
  Play,
  ShieldCheck,
  Send,
  Info,
  Mail,
  Download,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  CalendarCheck,
  Loader2,
} from 'lucide-react';
import { ReminderSettings, ReminderTheme } from '../types';
import {
  REMINDER_THEME_PROMPTS,
  getNotificationPermission,
  requestNotificationPermission,
  playGentleChime,
  triggerNativeNotification,
  formatTimeFriendly,
} from '../lib/notifications';
import {
  getGoogleCalendarRecurringUrl,
  downloadIcsCalendarReminder,
} from '../lib/calendar';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReminderSettings;
  userEmail?: string;
  onSaveSettings: (newSettings: ReminderSettings) => Promise<void>;
  onTriggerTestBanner: (theme: ReminderTheme, customMsg?: string) => void;
}

const PRESET_TIMES = [
  { label: 'Morning Clarity', time: '08:00' },
  { label: 'Midday Reset', time: '13:00' },
  { label: 'Evening Reflection', time: '20:30' },
  { label: 'Night Wind-Down', time: '22:00' },
];

const DAYS = [
  { day: 0, label: 'Sun', full: 'Sunday' },
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
];

export function ReminderModal({
  isOpen,
  onClose,
  settings,
  userEmail,
  onSaveSettings,
  onTriggerTestBanner,
}: ReminderModalProps) {
  const [formData, setFormData] = useState<ReminderSettings>(() => ({
    ...settings,
    reminderEmail: settings.reminderEmail || userEmail || '',
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermission());
  const [testSent, setTestSent] = useState(false);

  // Email Test States
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message: string;
    mode?: string;
  } | null>(null);

  // PWA install status
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        ...settings,
        reminderEmail: settings.reminderEmail || userEmail || '',
      });
      setPermissionStatus(getNotificationPermission());
      setSaveSuccess(false);
      setTestSent(false);
      setEmailTestResult(null);
    }
  }, [isOpen, settings, userEmail]);

  if (!isOpen) return null;

  const handleToggleDay = (day: number) => {
    const exists = formData.daysOfWeek.includes(day);
    let newDays: number[];
    if (exists) {
      if (formData.daysOfWeek.length > 1) {
        newDays = formData.daysOfWeek.filter((d) => d !== day);
      } else {
        newDays = formData.daysOfWeek;
      }
    } else {
      newDays = [...formData.daysOfWeek, day].sort((a, b) => a - b);
    }
    setFormData({ ...formData, daysOfWeek: newDays });
  };

  const handleSelectEveryday = () => {
    setFormData({ ...formData, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
  };

  const handleTestNotification = () => {
    if (formData.soundEnabled) {
      playGentleChime();
    }

    const themeData = REMINDER_THEME_PROMPTS[formData.theme];
    const message =
      formData.theme === 'custom' && formData.customMessage
        ? formData.customMessage
        : themeData.defaultMessage;

    // 1. Native desktop notification if permitted
    triggerNativeNotification(
      `🌿 Reflections Journal • ${themeData.title}`,
      message
    );

    // 2. In-app test banner preview
    onTriggerTestBanner(formData.theme, formData.customMessage);

    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleSendTestEmail = async () => {
    const targetEmail = formData.reminderEmail?.trim() || userEmail?.trim();
    if (!targetEmail) {
      setEmailTestResult({
        success: false,
        message: 'Please enter a valid email address to receive reminders.',
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailTestResult(null);

    try {
      const res = await fetch('/api/reminders/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          theme: formData.theme,
          customMessage: formData.customMessage,
          time: formData.time,
          isTest: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email');
      }

      setEmailTestResult({
        success: true,
        message: `Email reminder sent to ${targetEmail}`,
        mode: data.mode,
      });
    } catch (err: any) {
      setEmailTestResult({
        success: false,
        message: err.message || 'Unable to send reminder email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleGoogleCalendarSync = () => {
    const url = getGoogleCalendarRecurringUrl(formData.time, formData.customMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIcs = () => {
    downloadIcsCalendarReminder(formData.time, formData.customMessage);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save reminder settings:', err);
    } finally {
      setIsSaving(false);
    }
  };


  const currentTheme = REMINDER_THEME_PROMPTS[formData.theme];

  return (
    <div
      id="reminder-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d2d2a]/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="reminder-modal-content"
        className="bg-[#f8f7f2] dark:bg-[#181615] border border-[#dedcd5] dark:border-[#36332e] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#e5e4de] dark:border-[#36332e] bg-[#f8f7f2] dark:bg-[#181615] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2d2d2a] dark:bg-[#deb887] text-[#deb887] dark:text-[#161514] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-lg text-[#2d2d2a] dark:text-[#f4efe6]">
                Daily Journaling Reminder
              </h2>
              <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4]">
                Cultivate a consistent, peaceful reflection habit
              </p>
            </div>
          </div>
          <button
            id="close-reminder-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#6f6e69] dark:text-[#c5bfb4] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] hover:bg-[#ebe9e1] dark:hover:bg-[#282521] rounded-lg transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Enable Toggle Card */}
          <div className="p-4 bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <label
                htmlFor="enable-reminder-toggle"
                className="font-medium text-sm text-[#2d2d2a] dark:text-[#f4efe6] flex items-center gap-2 cursor-pointer"
              >
                <span>Enable Everyday Reminder</span>
                {formData.enabled && (
                  <span className="text-[11px] font-medium text-[#3b4c3a] dark:text-[#a5d6a7] bg-[#e6ede4] dark:bg-[#1a2b1c] border border-[#d2ded0] dark:border-[#2b482e] px-2 py-0.2 rounded-full">
                    Active
                  </span>
                )}
              </label>
              <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4]">
                Receive a daily nudge and browser notification at your designated time
              </p>
            </div>
            <button
              id="enable-reminder-toggle"
              role="switch"
              aria-checked={formData.enabled}
              onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                formData.enabled ? 'bg-[#3b4c3a] dark:bg-[#deb887]' : 'bg-[#dedcd5] dark:bg-[#36332e]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#161514] transition-transform ${
                  formData.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Configuration sections (shown whether enabled or not, with muted opacity if disabled) */}
          <div
            className={`space-y-6 transition-opacity ${
              formData.enabled ? 'opacity-100' : 'opacity-70'
            }`}
          >
            {/* Preferred Time Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-[#888780] dark:text-[#958f84]" />
                  <span>Reminder Time</span>
                </label>
                <span className="text-xs text-[#6f6e69] dark:text-[#deb887] font-mono font-medium">
                  {formatTimeFriendly(formData.time)}
                </span>
              </div>

              {/* Time Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_TIMES.map((preset) => {
                  const isSelected = formData.time === preset.time;
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setFormData({ ...formData, time: preset.time })}
                      className={`p-2 rounded-lg text-xs font-medium border transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] border-[#2d2d2a] dark:border-[#deb887] shadow-xs'
                          : 'bg-white dark:bg-[#1e1c1a] text-[#6f6e69] dark:text-[#c5bfb4] border-[#e5e4de] dark:border-[#36332e] hover:border-[#dedcd5] dark:hover:border-[#45413b]'
                      }`}
                    >
                      <div>{preset.label}</div>
                      <div className="text-[11px] font-mono opacity-80 mt-0.5">
                        {formatTimeFriendly(preset.time)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Precise Time Input */}
              <div className="flex items-center gap-3 bg-white dark:bg-[#1e1c1a] p-2.5 border border-[#e5e4de] dark:border-[#36332e] rounded-xl">
                <span className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] font-medium pl-1">
                  Custom exact time:
                </span>
                <input
                  id="reminder-time-input"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="bg-[#f2f1ea] dark:bg-[#282521] border border-[#dedcd5] dark:border-[#36332e] text-[#2d2d2a] dark:text-[#f4efe6] text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-[#2d2d2a] dark:focus:ring-[#deb887]"
                />
              </div>
            </div>

            {/* Frequency & Days of Week Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-[#888780] dark:text-[#958f84]" />
                  <span>Days of the Week</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectEveryday}
                  className="text-xs text-[#8c5b3e] dark:text-[#deb887] hover:underline cursor-pointer font-medium"
                >
                  Reset to Everyday
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => {
                  const isDaySelected = formData.daysOfWeek.includes(d.day);
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => handleToggleDay(d.day)}
                      title={d.full}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                        isDaySelected
                          ? 'bg-[#3b4c3a] dark:bg-[#deb887] text-white dark:text-[#161514] border-[#3b4c3a] dark:border-[#deb887]'
                          : 'bg-white dark:bg-[#1e1c1a] text-[#888780] dark:text-[#958f84] border-[#e5e4de] dark:border-[#36332e] hover:bg-[#f2f1ea] dark:hover:bg-[#282521]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#6f6e69] dark:text-[#958f84]">
                {formData.daysOfWeek.length === 7
                  ? 'Scheduled every single day for unbroken continuity.'
                  : `Active on ${formData.daysOfWeek.length} day${
                      formData.daysOfWeek.length > 1 ? 's' : ''
                    } per week.`}
              </p>
            </div>

            {/* Reflection Theme & Spark Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#c48344] dark:text-[#deb887]" />
                <span>Reminder Prompt Theme</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  Object.keys(REMINDER_THEME_PROMPTS) as ReminderTheme[]
                ).map((themeKey) => {
                  const item = REMINDER_THEME_PROMPTS[themeKey];
                  const isThemeSelected = formData.theme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setFormData({ ...formData, theme: themeKey })}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isThemeSelected
                          ? 'bg-white dark:bg-[#24221f] border-[#2d2d2a] dark:border-[#deb887] ring-1 ring-[#2d2d2a]/10 dark:ring-[#deb887]/20 shadow-xs'
                          : 'bg-[#f2f1ea]/60 dark:bg-[#1e1c1a]/80 border-[#e5e4de] dark:border-[#36332e] hover:bg-white dark:hover:bg-[#24221f]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                          {item.label}
                        </span>
                        {isThemeSelected && (
                          <Check className="w-3.5 h-3.5 text-[#3b4c3a] dark:text-[#4ade80]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] line-clamp-2 leading-relaxed">
                        {item.defaultMessage}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Custom message field if custom theme chosen */}
              {formData.theme === 'custom' && (
                <div className="pt-1">
                  <label className="block text-[11px] font-medium text-[#2d2d2a] dark:text-[#f4efe6] mb-1">
                    Your Personal Reminder Message:
                  </label>
                  <input
                    id="custom-reminder-message"
                    type="text"
                    value={formData.customMessage || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, customMessage: e.target.value })
                    }
                    placeholder="e.g., Take 5 minutes to breathe and write about your day..."
                    className="w-full px-3 py-2 bg-white dark:bg-[#1e1c1a] border border-[#dedcd5] dark:border-[#36332e] rounded-lg text-xs text-[#2d2d2a] dark:text-[#f4efe6] focus:outline-none focus:ring-1 focus:ring-[#2d2d2a] dark:focus:ring-[#deb887]"
                  />
                </div>
              )}

              {/* Preview of Reminder text */}
              <div className="p-3 bg-[#f2f1ea] dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-semibold text-[#888780] dark:text-[#958f84] uppercase tracking-wider block">
                  Notification Preview
                </span>
                <p className="font-serif text-[#2d2d2a] dark:text-[#f4efe6] leading-relaxed">
                  "{formData.theme === 'custom' && formData.customMessage
                    ? formData.customMessage
                    : currentTheme.defaultMessage}"
                </p>
              </div>
            </div>

            {/* Sound Chime & Browser Notification Support */}
            <div className="space-y-3 pt-1">
              {/* Chime toggle */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-xl">
                <div className="flex items-center gap-2.5">
                  {formData.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#888780] dark:text-[#958f84]" />
                  )}
                  <div>
                    <div className="text-xs font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                      Gentle Meditative Chime
                    </div>
                    <div className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4]">
                      Plays a warm, soothing ambient tone on alert
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={playGentleChime}
                    className="p-1.5 text-xs text-[#8c5b3e] dark:text-[#deb887] hover:bg-[#f2f1ea] dark:hover:bg-[#282521] rounded-lg flex items-center gap-1 cursor-pointer"
                    title="Listen to sample chime"
                  >
                    <Play className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        soundEnabled: !formData.soundEnabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      formData.soundEnabled ? 'bg-[#3b4c3a] dark:bg-[#deb887]' : 'bg-[#dedcd5] dark:bg-[#36332e]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-[#161514] transition-transform ${
                        formData.soundEnabled ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Browser Notification Permission Card */}
              <div className="p-3.5 bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#3b4c3a] dark:text-[#86efac]" />
                    <span className="text-xs font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                      Browser Desktop Notifications
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      permissionStatus === 'granted'
                        ? 'bg-[#e6ede4] dark:bg-[#1a2b1c] text-[#3b4c3a] dark:text-[#a5d6a7]'
                        : permissionStatus === 'denied'
                        ? 'bg-[#fcf3f2] dark:bg-[#381816] text-[#9c2b23] dark:text-[#f87171]'
                        : 'bg-[#f4ede4] dark:bg-[#282119] text-[#8c5b3e] dark:text-[#deb887]'
                    }`}
                  >
                    {permissionStatus === 'granted'
                      ? 'Permission Granted'
                      : permissionStatus === 'denied'
                      ? 'Permission Blocked'
                      : 'Permission Needed'}
                  </span>
                </div>

                <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] leading-relaxed">
                  Allows desktop notifications even when you are browsing other tabs.
                  In-app reflection alerts and reminder banners will always appear regardless.
                </p>

                {permissionStatus !== 'granted' && (
                  <button
                    id="request-notification-permission-btn"
                    type="button"
                    onClick={handleRequestPermission}
                    className="w-full py-1.5 px-3 bg-[#f2f1ea] dark:bg-[#282521] hover:bg-[#ebe9e1] dark:hover:bg-[#36332e] border border-[#dedcd5] dark:border-[#36332e] text-[#2d2d2a] dark:text-[#f4efe6] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Request Desktop Notification Permission
                  </button>
                )}
              </div>

              {/* DAILY EMAIL REMINDERS SECTION */}
              <div className="p-3.5 bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#f4ede4] dark:bg-[#282119] flex items-center justify-center text-[#8c5b3e] dark:text-[#deb887]">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                        Daily Email Reminders
                      </div>
                      <div className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4]">
                        Receive your reflection prompt in your inbox daily
                      </div>
                    </div>
                  </div>
                  <button
                    id="toggle-email-reminders-btn"
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        emailReminderEnabled: !formData.emailReminderEnabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      formData.emailReminderEnabled
                        ? 'bg-[#3b4c3a] dark:bg-[#deb887]'
                        : 'bg-[#dedcd5] dark:bg-[#36332e]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-[#161514] transition-transform ${
                        formData.emailReminderEnabled ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.emailReminderEnabled && (
                  <div className="pt-2 border-t border-[#f0eee6] dark:border-[#2d2a26] space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6f6e69] dark:text-[#c5bfb4] mb-1">
                        Send reminders to this email address:
                      </label>
                      <input
                        id="reminder-email-input"
                        type="email"
                        value={formData.reminderEmail || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, reminderEmail: e.target.value })
                        }
                        placeholder="your.email@example.com"
                        className="w-full px-3 py-1.5 bg-[#faf9f5] dark:bg-[#161514] border border-[#dedcd5] dark:border-[#36332e] rounded-lg text-xs text-[#2d2d2a] dark:text-[#f4efe6] focus:outline-none focus:border-[#8c5b3e] dark:focus:border-[#deb887]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        id="send-test-email-btn"
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={isSendingEmail}
                        className="py-1.5 px-3 bg-[#f4ede4] hover:bg-[#eae2d6] dark:bg-[#282119] dark:hover:bg-[#362b20] border border-[#dedcd5] dark:border-[#382b1f] text-[#8c5b3e] dark:text-[#deb887] text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSendingEmail ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending Email...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Test Email Now</span>
                          </>
                        )}
                      </button>

                      {emailTestResult && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            emailTestResult.success
                              ? 'text-[#3b4c3a] dark:text-[#86efac]'
                              : 'text-[#9c2b23] dark:text-[#f87171]'
                          }`}
                        >
                          {emailTestResult.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">
                            {emailTestResult.message}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* REMINDERS WHEN APP IS CLOSED (OFFLINE / BACKGROUND) */}
              <div className="p-3.5 bg-[#f4ede4]/60 dark:bg-[#201a14] border border-[#e8dfd5] dark:border-[#382b1f] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#8c5b3e] dark:text-[#deb887]">
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Reminders When App Is Closed
                    </span>
                  </div>
                  <span className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4]">
                    Cross-device support
                  </span>
                </div>

                <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] leading-relaxed">
                  To receive daily prompt reminders even when your browser tab or computer is closed, choose any of these guaranteed methods:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  {/* Calendar Sync */}
                  <div className="bg-white/90 dark:bg-[#181512] p-3 rounded-lg border border-[#e8dfd5]/80 dark:border-[#33281e] space-y-2">
                    <div className="flex items-center gap-1.5 font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                      <CalendarCheck className="w-3.5 h-3.5 text-[#8c5b3e] dark:text-[#deb887]" />
                      <span>Google &amp; Apple Calendar Sync</span>
                    </div>
                    <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] leading-relaxed">
                      Adds a recurring daily 15-minute reflection session with native phone &amp; desktop alarms.
                    </p>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <button
                        id="sync-google-calendar-btn"
                        type="button"
                        onClick={handleGoogleCalendarSync}
                        className="w-full py-1.5 px-2.5 bg-[#fbf9f5] dark:bg-[#241e17] hover:bg-[#f2eee7] dark:hover:bg-[#2e261d] border border-[#dedcd5] dark:border-[#3d3226] text-[#2d2d2a] dark:text-[#f4efe6] text-[11px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3 text-[#8c5b3e] dark:text-[#deb887]" />
                        <span>Add to Google Calendar</span>
                      </button>
                      <button
                        id="download-ics-calendar-btn"
                        type="button"
                        onClick={handleDownloadIcs}
                        className="w-full py-1.5 px-2.5 bg-[#fbf9f5] dark:bg-[#241e17] hover:bg-[#f2eee7] dark:hover:bg-[#2e261d] border border-[#dedcd5] dark:border-[#3d3226] text-[#2d2d2a] dark:text-[#f4efe6] text-[11px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[#8c5b3e] dark:text-[#deb887]" />
                        <span>Download .ics (Apple / Outlook)</span>
                      </button>
                    </div>
                  </div>

                  {/* PWA / Service Worker */}
                  <div className="bg-white/90 dark:bg-[#181512] p-3 rounded-lg border border-[#e8dfd5]/80 dark:border-[#33281e] space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                        <Smartphone className="w-3.5 h-3.5 text-[#3b4c3a] dark:text-[#86efac]" />
                        <span>Install Standalone App (PWA)</span>
                      </div>
                      <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] leading-relaxed">
                        Installs Reflections to your home screen or dock. Runs background service worker notifications and offline writing.
                      </p>
                    </div>

                    <div className="pt-1">
                      {isInstalled ? (
                        <div className="w-full py-1.5 px-2 bg-[#e6ede4] dark:bg-[#1a2b1c] text-[#3b4c3a] dark:text-[#86efac] text-[11px] font-medium rounded-lg flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>App Installed as Standalone</span>
                        </div>
                      ) : isInstallable ? (
                        <button
                          id="install-pwa-modal-btn"
                          type="button"
                          onClick={install}
                          className="w-full py-1.5 px-2.5 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] text-[11px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Install Reflections App</span>
                        </button>
                      ) : isIOS ? (
                        <div className="text-[10px] text-[#8c5b3e] dark:text-[#deb887] bg-[#f8f4ee] dark:bg-[#261f18] p-1.5 rounded-lg border border-[#e8dfd5] dark:border-[#3d3226]">
                          On iPhone: Tap Share <span className="font-semibold">[↑]</span> → &ldquo;Add to Home Screen&rdquo;
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] bg-[#faf9f5] dark:bg-[#1f1d1a] p-1.5 rounded-lg border border-[#dedcd5] dark:border-[#36332e] text-center">
                          Service Worker active for background alerts
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* How Reminders Reach You Summary Box */}
              <div className="p-3 bg-[#faf9f5] dark:bg-[#1c1a18] border border-[#e8e6de] dark:border-[#2f2c28] rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#6f6e69] dark:text-[#c5bfb4] text-xs font-semibold uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5 text-[#8c5b3e] dark:text-[#deb887]" />
                  <span>Summary of Notification Channels</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="bg-white dark:bg-[#141210] p-2 rounded-lg border border-[#dedcd5]/80 dark:border-[#2b2723]">
                    <div className="font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">1. In-App Banner</div>
                    <div className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] mt-0.5">Top alert with 1-click spark</div>
                  </div>
                  <div className="bg-white dark:bg-[#141210] p-2 rounded-lg border border-[#dedcd5]/80 dark:border-[#2b2723]">
                    <div className="font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">2. Desktop Popups</div>
                    <div className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] mt-0.5">Native OS alert banners</div>
                  </div>
                  <div className="bg-white dark:bg-[#141210] p-2 rounded-lg border border-[#dedcd5]/80 dark:border-[#2b2723]">
                    <div className="font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">3. Daily Email</div>
                    <div className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] mt-0.5">In your inbox when app closed</div>
                  </div>
                  <div className="bg-white dark:bg-[#141210] p-2 rounded-lg border border-[#dedcd5]/80 dark:border-[#2b2723]">
                    <div className="font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">4. Calendar Alarm</div>
                    <div className="text-[10px] text-[#6f6e69] dark:text-[#c5bfb4] mt-0.5">Phone alarm via Google/Apple</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Notification Verification Button */}
            <div className="pt-1">
              <button
                id="test-notification-btn"
                type="button"
                onClick={handleTestNotification}
                className="w-full py-2 px-3 border border-[#deb887] dark:border-[#deb887]/60 bg-[#fdfaf5] dark:bg-[#241e17] hover:bg-[#f4ede4] dark:hover:bg-[#2e261d] text-[#8c5b3e] dark:text-[#deb887] text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {testSent ? 'Browser Notification Triggered!' : 'Send Test In-App & Browser Alert'}
                </span>
              </button>
              <p className="text-[10px] text-[#888780] dark:text-[#958f84] text-center mt-1">
                Simulates sound chime, in-app banner, and system desktop notification
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-3.5 border-t border-[#e5e4de] dark:border-[#36332e] bg-[#f8f7f2] dark:bg-[#181615] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#6f6e69] dark:text-[#c5bfb4]">
            {saveSuccess ? (
              <span className="text-[#3b4c3a] dark:text-[#4ade80] font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Saved to Firestore
              </span>
            ) : (
              <span>Syncs to your private account</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-[#6f6e69] dark:text-[#c5bfb4] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-reminder-settings-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] text-xs font-medium rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
