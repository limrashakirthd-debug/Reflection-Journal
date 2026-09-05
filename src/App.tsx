import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  saveInteractionToFirestore,
  deleteInteractionFromFirestore,
  toggleFavoriteInFirestore,
  subscribeToUserInteractions,
  saveReminderSettingsToFirestore,
  subscribeToReminderSettings,
  saveThemePreferenceToFirestore,
  subscribeToThemePreference,
  updateInteractionSentimentInFirestore,
  updateInteractionLocationInFirestore,
  DEFAULT_REMINDER_SETTINGS,
  syncUserProfile,
  subscribeToUserProfile,
} from './lib/firebase';
import { JournalInteraction, ReflectionMode, Turn, ReminderSettings, ReminderTheme, ThemeMode, MoodSentiment, JournalLocation, UserProfile } from './types';
import { getInitialTheme, applyTheme, getNextTheme } from './lib/theme';
import { Navbar } from './components/Navbar';
import { AuthLanding } from './components/AuthLanding';
import { HistorySidebar } from './components/HistorySidebar';
import { JournalEditor } from './components/JournalEditor';
import { ReminderModal } from './components/ReminderModal';
import { ReminderBanner } from './components/ReminderBanner';
import { AdminConsoleModal } from './components/AdminConsoleModal';
import {
  playGentleChime,
  triggerNativeNotification,
  REMINDER_THEME_PROMPTS,
} from './lib/notifications';
import { Menu } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Theme state (system, light, dark)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  // Daily Notification Reminder state
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS
  );
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [activeReminderBanner, setActiveReminderBanner] = useState<{
    theme: ReminderTheme;
    customMsg?: string;
    isTest?: boolean;
  } | null>(null);
  const [initialSpark, setInitialSpark] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [pendingSentiment, setPendingSentiment] = useState<MoodSentiment | null>(null);
  const [pendingLocation, setPendingLocation] = useState<JournalLocation | null>(null);

  // Buffer for retry turn in case of network or API failure
  const lastFailedTurnRef = useRef<{
    prompt: string;
    mode: ReflectionMode;
  } | null>(null);

  // Apply theme to DOM and listen for OS changes if in system mode
  useEffect(() => {
    applyTheme(themeMode);

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Subscribe to user's saved theme from Firestore when signed in
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToThemePreference(currentUser.uid, (savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setThemeMode(savedTheme);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleToggleTheme = () => {
    const next = getNextTheme(themeMode);
    setThemeMode(next);
    if (currentUser) {
      saveThemePreferenceToFirestore(currentUser.uid, next).catch((err) =>
        console.warn('Could not save theme preference to Firestore:', err)
      );
    }
  };

  // 1. Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      setAuthError(null);
      if (user) {
        syncUserProfile(user)
          .then((profile) => setUserProfile(profile))
          .catch((err) => console.warn('Could not sync user profile:', err));
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1b. Subscribe to real-time User Profile & Role changes (RBAC)
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const unsubscribe = subscribeToUserProfile(currentUser.uid, (profile) => {
      if (profile) {
        setUserProfile(profile);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Subscribe to user's private Firestore interactions
  useEffect(() => {
    if (!currentUser) {
      setInteractions([]);
      setActiveId(null);
      return;
    }

    const unsubscribe = subscribeToUserInteractions(
      currentUser.uid,
      (data) => {
        setInteractions(data);
        // If no active interaction yet and data has items, select the most recent
        setActiveId((currentActive) => {
          if (!currentActive && data.length > 0) {
            return data[0].id;
          }
          return currentActive;
        });
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setSaveStatus('error');
        setSaveErrorMessage(
          'Database access permission or connection error. Please verify Firestore rules.'
        );
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Subscribe to user's private Firestore reminder settings
  useEffect(() => {
    if (!currentUser) {
      setReminderSettings(DEFAULT_REMINDER_SETTINGS);
      return;
    }

    const unsubscribe = subscribeToReminderSettings(
      currentUser.uid,
      (settings) => {
        if (settings) {
          setReminderSettings(settings);
        } else {
          setReminderSettings(DEFAULT_REMINDER_SETTINGS);
        }
      },
      (err) => {
        console.warn('Could not fetch reminder settings from Firestore:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Determine if user has already reflected today
  const todayDateStr = new Date().toDateString();
  const hasJournaledToday = interactions.some(
    (item) => new Date(item.updatedAt).toDateString() === todayDateStr
  );

  // 4. Background Reminder Ticker (Checks time every 20 seconds)
  useEffect(() => {
    if (!currentUser || !reminderSettings.enabled) {
      return;
    }

    const checkReminderTime = () => {
      // If snoozed and snooze period is still active, wait
      if (snoozedUntil && Date.now() < snoozedUntil) {
        return;
      }

      const now = new Date();
      const currentDay = now.getDay();

      // Check if scheduled for this day of week
      if (!reminderSettings.daysOfWeek.includes(currentDay)) {
        return;
      }

      // Check if dismissed for today
      const todayISO = now.toISOString().split('T')[0];
      const dismissedKey = `reflections_reminder_dismissed_${currentUser.uid}_${todayISO}`;
      if (localStorage.getItem(dismissedKey) === 'true') {
        return;
      }

      // Check if already journaled today
      if (hasJournaledToday) {
        return;
      }

      // Format current time HH:MM
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeFormatted = `${hours}:${minutes}`;

      // Trigger if current time has arrived or passed scheduled time
      if (currentTimeFormatted >= reminderSettings.time) {
        setActiveReminderBanner((existing) => {
          if (!existing) {
            // Play gentle chime if sound enabled
            if (reminderSettings.soundEnabled) {
              playGentleChime();
            }

            // Trigger native browser notification if permission granted
            const themeConfig =
              REMINDER_THEME_PROMPTS[reminderSettings.theme] ||
              REMINDER_THEME_PROMPTS.evening_reflection;
            const message =
              reminderSettings.theme === 'custom' && reminderSettings.customMessage
                ? reminderSettings.customMessage
                : themeConfig.defaultMessage;

            triggerNativeNotification(
              `🌿 Reflections Journal • ${themeConfig.title}`,
              message
            );

            return {
              theme: reminderSettings.theme,
              customMsg: reminderSettings.customMessage,
              isTest: false,
            };
          }
          return existing;
        });
      }
    };

    checkReminderTime();
    const timer = setInterval(checkReminderTime, 20000);
    return () => clearInterval(timer);
  }, [
    currentUser,
    reminderSettings,
    snoozedUntil,
    hasJournaledToday,
  ]);

  // Sign In Handler
  const handleSignIn = async () => {
    try {
      setAuthError(null);
      const user = await signInWithGoogle();
      if (!user) {
        // User closed or cancelled the popup window
        setAuthError(null);
        return;
      }
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';

      // Gracefully handle popup closed or cancelled by user
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('popup-closed-by-user')
      ) {
        console.info('Sign-in cancelled or popup closed.');
        setAuthError(null);
        return;
      }

      if (code === 'auth/popup-blocked') {
        console.warn('Sign-in popup blocked by browser/iframe environment.');
        setAuthError(
          'The sign-in popup was blocked by your browser. Please allow pop-ups or open the app in a new tab.'
        );
        return;
      }

      if (code === 'auth/unauthorized-domain') {
        console.warn('Firebase unauthorized domain:', window.location.hostname);
        setAuthError(
          `This domain (${window.location.hostname}) is not authorized in Firebase Authentication. Please add it under Authorized Domains in the Firebase console.`
        );
        return;
      }

      console.error('Sign-in error:', err);
      const friendlyMsg =
        msg.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?\s*)?/, '').trim() ||
        'Failed to complete Google sign-in. Please try again.';
      setAuthError(friendlyMsg);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setActiveId(null);
      setInteractions([]);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Start a fresh reflection
  const handleNewReflection = () => {
    setActiveId(null);
    setPendingSentiment(null);
    setPendingLocation(null);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
    setIsSidebarOpen(false);
  };

  // Active interaction finder
  const activeInteraction =
    interactions.find((item) => item.id === activeId) || null;

  // Send turn (Prompt + Gemini + Save)
  const handleSendTurn = useCallback(
    async (prompt: string, mode: ReflectionMode) => {
      if (!currentUser) return;

      setIsGenerating(true);
      setSaveStatus('saving');
      setSaveErrorMessage(null);
      lastFailedTurnRef.current = { prompt, mode };

      const userTurn: Turn = {
        id: crypto.randomUUID(),
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };

      // Current turns
      const existingTurns = activeInteraction ? [...activeInteraction.turns] : [];
      const updatedTurnsWithUser = [...existingTurns, userTurn];

      // Prepare payload for Gemini API proxy
      const historyPayload = existingTurns.map((t) => ({
        role: t.role,
        text: t.text,
      }));

      try {
        const response = await fetch('/api/gemini/reflect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            history: historyPayload,
            mode,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        const modelResponseText = data.response;
        const generatedTitle = data.title;
        const modelUsed = data.modelUsed || 'gemini-3.1-flash-lite';

        const modelTurn: Turn = {
          id: crypto.randomUUID(),
          role: 'model',
          text: modelResponseText,
          timestamp: Date.now(),
          modelUsed,
        };

        const finalTurns = [...updatedTurnsWithUser, modelTurn];

        const interactionId = activeInteraction
          ? activeInteraction.id
          : crypto.randomUUID();

        const interactionTitle = activeInteraction
          ? activeInteraction.title
          : generatedTitle || prompt.slice(0, 35) + '...';

        const chosenSentiment = activeInteraction
          ? (activeInteraction.sentiment ?? pendingSentiment ?? undefined)
          : (pendingSentiment ?? undefined);
        const chosenLocation = activeInteraction
          ? (activeInteraction.location ?? pendingLocation ?? undefined)
          : (pendingLocation ?? undefined);

        const updatedInteraction: JournalInteraction = {
          id: interactionId,
          userId: currentUser.uid,
          title: interactionTitle,
          mode,
          turns: finalTurns,
          sentiment: chosenSentiment,
          location: chosenLocation,
          createdAt: activeInteraction ? activeInteraction.createdAt : Date.now(),
          updatedAt: Date.now(),
          favorite: activeInteraction ? activeInteraction.favorite : false,
        };

        // Guaranteed Transaction Verification: Save to Firestore
        await saveInteractionToFirestore(currentUser.uid, updatedInteraction);

        // Update local state and active id
        setActiveId(interactionId);
        setPendingSentiment(null);
        setPendingLocation(null);
        setSaveStatus('saved');
        lastFailedTurnRef.current = null;
      } catch (err: any) {
        console.error('Reflection interaction failed:', err);
        setSaveStatus('error');
        setSaveErrorMessage(
          err?.message ||
            'Could not complete or save reflection. Your prompt is preserved. Click Retry to re-attempt.'
        );
        throw err; // bubble up so editor preserves input if necessary
      } finally {
        setIsGenerating(false);
      }
    },
    [currentUser, activeInteraction, pendingSentiment, pendingLocation]
  );

  // Retry previous failed turn
  const handleRetryTurn = async () => {
    if (lastFailedTurnRef.current) {
      const { prompt, mode } = lastFailedTurnRef.current;
      await handleSendTurn(prompt, mode);
    }
  };

  // Update Title
  const handleUpdateTitle = async (newTitle: string) => {
    if (!currentUser || !activeInteraction) return;
    try {
      const updated: JournalInteraction = {
        ...activeInteraction,
        title: newTitle,
        updatedAt: Date.now(),
      };
      await saveInteractionToFirestore(currentUser.uid, updated);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Update Mood Sentiment Tag
  const handleUpdateSentiment = async (sentiment: MoodSentiment | null) => {
    if (!currentUser) return;
    if (activeInteraction) {
      try {
        setSaveStatus('saving');
        await updateInteractionSentimentInFirestore(currentUser.uid, activeInteraction.id, sentiment);
        setInteractions((prev) =>
          prev.map((item) =>
            item.id === activeInteraction.id
              ? { ...item, sentiment: sentiment ?? undefined, updatedAt: Date.now() }
              : item
          )
        );
        setSaveStatus('saved');
      } catch (err: any) {
        console.error('Failed to update mood sentiment:', err);
        setSaveStatus('error');
        setSaveErrorMessage('Failed to save mood sentiment. Please retry.');
      }
    } else {
      setPendingSentiment(sentiment);
    }
  };

  // Update Location Pin
  const handleUpdateLocation = async (location: JournalLocation | null) => {
    if (!currentUser) return;
    if (activeInteraction) {
      try {
        setSaveStatus('saving');
        await updateInteractionLocationInFirestore(currentUser.uid, activeInteraction.id, location);
        setInteractions((prev) =>
          prev.map((item) =>
            item.id === activeInteraction.id
              ? { ...item, location: location ?? undefined, updatedAt: Date.now() }
              : item
          )
        );
        setSaveStatus('saved');
      } catch (err: any) {
        console.error('Failed to update pinned location:', err);
        setSaveStatus('error');
        setSaveErrorMessage('Failed to save pinned location. Please retry.');
      }
    } else {
      setPendingLocation(location);
    }
  };

  // Delete Interaction
  const handleDeleteInteraction = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteInteractionFromFirestore(currentUser.uid, id);
      if (activeId === id) {
        setActiveId(null);
      }
    } catch (err) {
      console.error('Failed to delete interaction:', err);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (id: string, current: boolean) => {
    if (!currentUser) return;
    try {
      await toggleFavoriteInFirestore(currentUser.uid, id, current);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Save Reminder Settings to Firestore
  const handleSaveReminderSettings = async (newSettings: ReminderSettings) => {
    if (!currentUser) return;
    try {
      await saveReminderSettingsToFirestore(currentUser.uid, newSettings);
      setReminderSettings(newSettings);
    } catch (err) {
      console.error('Failed to save reminder settings:', err);
      throw err;
    }
  };

  // Trigger test banner from modal preview
  const handleTriggerTestBanner = (theme: ReminderTheme, customMsg?: string) => {
    setActiveReminderBanner({
      theme,
      customMsg,
      isTest: true,
    });
  };

  // Start reflection from reminder banner click
  const handleStartReflectionFromReminder = (spark: string) => {
    handleNewReflection();
    setInitialSpark(spark);
    setActiveReminderBanner(null);
  };

  // Snooze reminder for 1 hour
  const handleSnoozeReminder = () => {
    setSnoozedUntil(Date.now() + 60 * 60 * 1000); // 1 hour
    setActiveReminderBanner(null);
  };

  // Dismiss reminder for today
  const handleDismissToday = () => {
    if (currentUser) {
      const todayISO = new Date().toISOString().split('T')[0];
      const dismissedKey = `reflections_reminder_dismissed_${currentUser.uid}_${todayISO}`;
      localStorage.setItem(dismissedKey, 'true');
    }
    setActiveReminderBanner(null);
  };

  return (
    <div id="reflections-app-root" className="min-h-screen flex flex-col bg-[#f8f7f2] dark:bg-[#161514] text-[#2d2d2a] dark:text-[#f4efe6] antialiased font-sans transition-colors">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        userProfile={userProfile}
        onNewReflection={handleNewReflection}
        onSignOut={handleSignOut}
        onOpenAdminConsole={() => setIsAdminConsoleOpen(true)}
        isSaving={saveStatus === 'saving'}
        reminderEnabled={reminderSettings.enabled}
        reminderTime={reminderSettings.time}
        emailReminderEnabled={reminderSettings.emailReminderEnabled}
        onOpenReminderModal={() => setIsReminderModalOpen(true)}
        hasJournaledToday={hasJournaledToday}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Body */}
      {authLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-[#f8f7f2] dark:bg-[#161514]">
          <div className="w-6 h-6 border-2 border-[#2d2d2a] dark:border-[#deb887] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] font-medium">
            Verifying secure session...
          </p>
        </div>
      ) : !currentUser ? (
        <AuthLanding
          onSignIn={handleSignIn}
          isLoading={authLoading}
          error={authError}
          onDismissError={() => setAuthError(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f8f7f2] dark:bg-[#161514]">
          {/* Daily Reminder In-App Banner */}
          {activeReminderBanner && (
            <ReminderBanner
              theme={activeReminderBanner.theme}
              customMessage={activeReminderBanner.customMsg}
              onStartReflection={handleStartReflectionFromReminder}
              onSnooze={handleSnoozeReminder}
              onDismissToday={handleDismissToday}
              isTestPreview={activeReminderBanner.isTest}
            />
          )}

          <div className="flex-1 flex overflow-hidden relative">
            {/* Mobile history toggle button */}
            <button
              id="mobile-history-toggle"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="lg:hidden fixed bottom-20 left-4 z-40 p-3 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] rounded-full shadow-lg border border-[#dedcd5] dark:border-[#36332e] cursor-pointer transition-colors"
              title="Toggle past reflections"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Past History Sidebar */}
            <HistorySidebar
              interactions={interactions}
              activeId={activeId}
              onSelectInteraction={(id) => {
                setActiveId(id);
                setPendingSentiment(null);
                setPendingLocation(null);
              }}
              onDeleteInteraction={handleDeleteInteraction}
              onToggleFavorite={handleToggleFavorite}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />

            {/* Active Journal Conversation View */}
            <JournalEditor
              interaction={activeInteraction}
              onSendTurn={handleSendTurn}
              onUpdateTitle={handleUpdateTitle}
              onRetryTurn={handleRetryTurn}
              isLoading={isGenerating}
              saveStatus={saveStatus}
              saveErrorMessage={saveErrorMessage}
              onRetrySave={handleRetryTurn}
              initialSpark={initialSpark}
              onClearInitialSpark={() => setInitialSpark(null)}
              currentSentiment={activeInteraction?.sentiment ?? pendingSentiment}
              onUpdateSentiment={handleUpdateSentiment}
              currentLocation={activeInteraction?.location ?? pendingLocation}
              onUpdateLocation={handleUpdateLocation}
            />
          </div>
        </div>
      )}

      {/* Reminder Configuration Modal */}
      {currentUser && (
        <ReminderModal
          isOpen={isReminderModalOpen}
          onClose={() => setIsReminderModalOpen(false)}
          settings={reminderSettings}
          userEmail={currentUser.email || undefined}
          onSaveSettings={handleSaveReminderSettings}
          onTriggerTestBanner={handleTriggerTestBanner}
        />
      )}

      {/* RBAC Admin Governance Console (Visible only to authorized admins) */}
      {currentUser && userProfile?.role === 'admin' && (
        <AdminConsoleModal
          isOpen={isAdminConsoleOpen}
          onClose={() => setIsAdminConsoleOpen(false)}
          currentUserProfile={userProfile}
        />
      )}
    </div>
  );
}
