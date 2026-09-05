import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  updateDoc,
  deleteField,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  JournalInteraction,
  ReminderSettings,
  MoodSentiment,
  JournalLocation,
  UserProfile,
  UserRole,
  AdminAuditLog,
  SystemPromptConfig,
} from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore with specific databaseId if provided
const databaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db: Firestore = databaseId
  ? getFirestore(app, databaseId)
  : getFirestore(app);

// Zero-Crash Payload Hygiene: Undefined-stripping utility
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request'
    ) {
      console.info('Google sign-in popup was closed by the user.');
      return null;
    }
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Firestore Database Operations (Strictly isolated by userId)
export async function saveInteractionToFirestore(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to save interaction.');
  }
  const cleanData = stripUndefined(interaction);
  const interactionRef = doc(db, 'users', userId, 'interactions', interaction.id);
  await setDoc(interactionRef, cleanData, { merge: true });
}

export async function deleteInteractionFromFirestore(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) {
    throw new Error('User ID and Interaction ID are required to delete interaction.');
  }
  const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(interactionRef);
}

export async function toggleFavoriteInFirestore(
  userId: string,
  interactionId: string,
  currentValue: boolean
): Promise<void> {
  if (!userId || !interactionId) return;
  const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
  await updateDoc(interactionRef, {
    favorite: !currentValue,
    updatedAt: Date.now(),
  });
}

export async function updateInteractionSentimentInFirestore(
  userId: string,
  interactionId: string,
  sentiment: MoodSentiment | null
): Promise<void> {
  if (!userId || !interactionId) return;
  const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
  const cleanData = stripUndefined({
    sentiment: sentiment ?? null,
    updatedAt: Date.now(),
  });
  await updateDoc(interactionRef, cleanData);
}

export async function updateInteractionLocationInFirestore(
  userId: string,
  interactionId: string,
  location: JournalLocation | null
): Promise<void> {
  if (!userId || !interactionId) return;
  const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
  if (location === null) {
    await updateDoc(interactionRef, {
      location: deleteField(),
      updatedAt: Date.now(),
    });
  } else {
    const cleanLocation = stripUndefined({
      name: location.name,
      address: location.address || null,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId || null,
    });
    await updateDoc(interactionRef, {
      location: cleanLocation,
      updatedAt: Date.now(),
    });
  }
}

export function subscribeToUserInteractions(
  userId: string,
  onData: (interactions: JournalInteraction[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsCol = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsCol, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as JournalInteraction);
      });
      onData(list);
    },
    (error) => {
      console.error('Error subscribing to interactions:', error);
      if (onError) onError(error);
    }
  );
}

// Reminder Settings Persistence (Stored securely per user under /users/{userId}/settings/reminders)
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  time: '20:30', // 8:30 PM default for evening reflection
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // everyday
  theme: 'evening_reflection',
  customMessage: '',
  soundEnabled: true,
  emailReminderEnabled: false,
  reminderEmail: '',
};

export async function saveReminderSettingsToFirestore(
  userId: string,
  settings: ReminderSettings
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to save reminder settings.');
  }
  const cleanData = stripUndefined({
    ...settings,
    updatedAt: Date.now(),
  });
  const reminderRef = doc(db, 'users', userId, 'settings', 'reminders');
  await setDoc(reminderRef, cleanData, { merge: true });
}

export async function getReminderSettingsFromFirestore(
  userId: string
): Promise<ReminderSettings | null> {
  if (!userId) return null;
  const reminderRef = doc(db, 'users', userId, 'settings', 'reminders');
  const snap = await getDoc(reminderRef);
  if (snap.exists()) {
    return snap.data() as ReminderSettings;
  }
  return null;
}

export function subscribeToReminderSettings(
  userId: string,
  onData: (settings: ReminderSettings | null) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData(null);
    return () => {};
  }
  const reminderRef = doc(db, 'users', userId, 'settings', 'reminders');
  return onSnapshot(
    reminderRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as ReminderSettings);
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('Error subscribing to reminder settings:', error);
      if (onError) onError(error);
    }
  );
}

// User Theme Persistence (Stored securely per user under /users/{userId}/settings/theme)
export async function saveThemePreferenceToFirestore(
  userId: string,
  theme: string
): Promise<void> {
  if (!userId) return;
  const themeRef = doc(db, 'users', userId, 'settings', 'theme');
  await setDoc(themeRef, { theme, updatedAt: Date.now() }, { merge: true });
}

export function subscribeToThemePreference(
  userId: string,
  onData: (theme: string | null) => void
) {
  if (!userId) {
    onData(null);
    return () => {};
  }
  const themeRef = doc(db, 'users', userId, 'settings', 'theme');
  return onSnapshot(
    themeRef,
    (snap) => {
      if (snap.exists() && snap.data()?.theme) {
        onData(snap.data().theme as string);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.warn('Error subscribing to theme preference:', err);
    }
  );
}

// ==========================================
// RBAC & User Profile Management
// ==========================================

export const BOOTSTRAP_ADMIN_EMAILS = [
  'limrashakirthd@gmail.com',
];

/**
 * Synchronize authenticated user profile and resolve initial RBAC role.
 * Enforces Zero-Crash Payload Hygiene and Role Anti-Escalation.
 */
export async function syncUserProfile(user: User): Promise<UserProfile> {
  if (!user || !user.uid) {
    throw new Error('Valid authenticated user is required to sync profile.');
  }

  const userDocRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userDocRef);
  const isBootstrapAdmin = user.email ? BOOTSTRAP_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  if (snap.exists()) {
    const existing = snap.data() as UserProfile;
    // If the account belongs to the designated bootstrap admin and role isn't 'admin', elevate securely
    if (isBootstrapAdmin && existing.role !== 'admin') {
      const updatedProfile: UserProfile = {
        ...existing,
        role: 'admin',
        updatedAt: Date.now(),
      };
      await setDoc(userDocRef, stripUndefined(updatedProfile), { merge: true });
      return updatedProfile;
    }
    return existing;
  }

  // Create new profile with anti-escalation guard
  const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'user';
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Reflective Soul',
    photoURL: user.photoURL || undefined,
    role: initialRole,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const cleanData = stripUndefined(newProfile);
  await setDoc(userDocRef, cleanData);
  return newProfile;
}

/**
 * Real-time subscription to current user's profile and RBAC role.
 */
export function subscribeToUserProfile(
  userId: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData(null);
    return () => {};
  }

  const userDocRef = doc(db, 'users', userId);
  return onSnapshot(
    userDocRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProfile);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.error('Error subscribing to user profile:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Log privileged administrative operations to /admin/audit_logs.
 * Accessible only to verified admins (protected by firestore.rules).
 */
export async function logAdminAction(
  adminUid: string,
  adminEmail: string,
  action: string,
  details: string
): Promise<void> {
  try {
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const auditRef = doc(db, 'admin', 'audit_logs', 'items', logId);
    const auditRecord: AdminAuditLog = {
      id: logId,
      adminUid,
      adminEmail,
      action,
      details,
      timestamp: Date.now(),
    };
    await setDoc(auditRef, stripUndefined(auditRecord));
  } catch (err) {
    console.error('Failed to append admin audit log:', err);
  }
}

/**
 * Subscribe to admin audit logs (Admin only).
 */
export function subscribeToAdminAuditLogs(
  onData: (logs: AdminAuditLog[]) => void,
  onError?: (err: Error) => void
) {
  const auditCol = collection(db, 'admin', 'audit_logs', 'items');
  const q = query(auditCol, orderBy('timestamp', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AdminAuditLog[] = [];
      snapshot.forEach((snap) => {
        logs.push(snap.data() as AdminAuditLog);
      });
      onData(logs);
    },
    (err) => {
      console.warn('Admin audit logs subscription error (expected if non-admin):', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch all registered users for administrative audit and management (Admin only).
 */
export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  const usersCol = collection(db, 'users');
  const snap = await getDocs(usersCol);
  const list: UserProfile[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.email && data.role) {
      list.push(data as UserProfile);
    }
  });
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Modify user role (Admin only).
 */
export async function updateUserRoleByAdmin(
  adminUser: { uid: string; email: string },
  targetUserId: string,
  newRole: UserRole
): Promise<void> {
  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    role: newRole,
    updatedAt: Date.now(),
  });

  await logAdminAction(
    adminUser.uid,
    adminUser.email,
    'UPDATE_USER_ROLE',
    `Updated role for user ${targetUserId} to ${newRole}`
  );
}

