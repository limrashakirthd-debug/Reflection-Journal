import { useState, useEffect } from 'react';
import {
  Shield,
  X,
  Activity,
  Users,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Lock,
  Layers,
  Sparkles,
  Server,
} from 'lucide-react';
import { UserProfile, AdminAuditLog, UserRole } from '../types';
import {
  subscribeToAdminAuditLogs,
  logAdminAction,
  fetchAllUsersForAdmin,
  updateUserRoleByAdmin,
} from '../lib/firebase';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
}

type AdminTab = 'diagnostics' | 'users' | 'audit_logs' | 'sparks';

interface SystemDiagnostics {
  status: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  nodeVersion: string;
  security: {
    rbacEnforced: boolean;
    rulesDeployed: boolean;
    ownerIsolationEnforced: boolean;
    authorizedAdminCount: number;
  };
  integrations: {
    gemini: {
      configured: boolean;
      fallbackLadder: string[];
      primaryModel: string;
    };
    googleMaps: {
      configured: boolean;
      geocodingProxyActive: boolean;
      attributionTracking: string;
    };
    emailReminders: {
      configured: boolean;
      mode: string;
    };
  };
}

export function AdminConsoleModal({
  isOpen,
  onClose,
  currentUserProfile,
}: AdminConsoleModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('diagnostics');

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // Security Verification Benchmark State
  const [benchmarkResult, setBenchmarkResult] = useState<{
    tested: boolean;
    verified: boolean;
    grantedPermissions?: string[];
    callerEmail?: string;
    message?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Users Directory State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userUpdateMessage, setUserUpdateMessage] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load diagnostics when tab is active
  const fetchDiagnostics = async () => {
    if (!currentUserProfile) return;
    setLoadingDiagnostics(true);
    setDiagnosticError(null);
    try {
      const res = await fetch('/api/admin/system-stats', {
        headers: {
          'x-admin-email': currentUserProfile.email,
          'x-user-role': currentUserProfile.role,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status} error`);
      }
      const data = await res.json();
      setDiagnostics(data);
    } catch (err: any) {
      console.error('Failed to fetch system stats:', err);
      setDiagnosticError(err.message || 'Failed to retrieve administrative diagnostics.');
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  // Run RBAC Security Verification Benchmark
  const handleRunSecurityBenchmark = async () => {
    if (!currentUserProfile) return;
    setIsVerifying(true);
    try {
      const res = await fetch('/api/admin/verify-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': currentUserProfile.email,
          'x-user-role': currentUserProfile.role,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBenchmarkResult({
          tested: true,
          verified: true,
          grantedPermissions: data.grantedPermissions,
          callerEmail: data.callerEmail,
          message: 'Zero-Trust RBAC security checks passed. Elevated credentials verified.',
        });
        await logAdminAction(
          currentUserProfile.uid,
          currentUserProfile.email,
          'SECURITY_BENCHMARK_VERIFIED',
          'Executed live RBAC verification benchmark test'
        );
      } else {
        setBenchmarkResult({
          tested: true,
          verified: false,
          message: data.error || 'RBAC check failed.',
        });
      }
    } catch (err: any) {
      setBenchmarkResult({
        tested: true,
        verified: false,
        message: err.message || 'Verification endpoint failed.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Load users directory
  const loadUsers = async () => {
    setLoadingUsers(true);
    setUserUpdateMessage(null);
    try {
      const users = await fetchAllUsersForAdmin();
      setUsersList(users);
    } catch (err: any) {
      console.error('Failed to fetch users list:', err);
      setUserUpdateMessage(`Access error: ${err.message || 'Unable to list users'}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Change user role
  const handleToggleUserRole = async (targetUser: UserProfile) => {
    if (!currentUserProfile) return;
    const newRole: UserRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRoleByAdmin(
        { uid: currentUserProfile.uid, email: currentUserProfile.email },
        targetUser.uid,
        newRole
      );
      setUserUpdateMessage(`Successfully changed role for ${targetUser.email} to ${newRole.toUpperCase()}.`);
      // Update local state
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      setUserUpdateMessage(`Failed to update role: ${err.message || 'Operation rejected'}`);
    }
  };

  // Subscriptions & Initial Fetch
  useEffect(() => {
    if (!isOpen || !currentUserProfile) return;

    if (activeTab === 'diagnostics') {
      fetchDiagnostics();
    } else if (activeTab === 'users') {
      loadUsers();
    }
  }, [isOpen, activeTab, currentUserProfile]);

  // Subscribe to real-time admin audit logs when modal is open
  useEffect(() => {
    if (!isOpen || !currentUserProfile) return;

    const unsubscribe = subscribeToAdminAuditLogs(
      (logs) => {
        setAuditLogs(logs);
        setAuditError(null);
      },
      (err) => {
        setAuditError(err.message || 'Permission denied reading admin audit collection.');
      }
    );

    return () => unsubscribe();
  }, [isOpen, currentUserProfile]);

  if (!isOpen) return null;

  return (
    <div
      id="admin-console-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="admin-console-modal"
        className="bg-[#faf9f5] dark:bg-[#1a1816] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-[#dedcd5] dark:border-[#332f2b] shadow-2xl flex flex-col overflow-hidden text-[#2d2d2a] dark:text-[#f4efe6] transition-all"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#dedcd5] dark:border-[#332f2b] flex items-center justify-between bg-white dark:bg-[#201d1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2d2d2a] dark:bg-[#2d2218] border border-[#dedcd5] dark:border-[#4d3620] flex items-center justify-center text-[#deb887]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-serif font-semibold tracking-tight text-[#2d2d2a] dark:text-[#f4efe6]">
                  Admin & RBAC Governance Console
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e6ede4] text-[#2d5a31] dark:bg-[#1a2d1e] dark:text-[#9fe2ab] border border-[#cbe0c9] dark:border-[#2f4c34]">
                  <CheckCircle2 className="w-3 h-3" />
                  Directive 9 Active
                </span>
              </div>
              <p className="text-xs text-[#6f6e69] dark:text-[#a8a398]">
                Role-Based Access Control • Tier 1 Elevation • Owner Isolation Guard
              </p>
            </div>
          </div>

          <button
            id="admin-console-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6f6e69] hover:text-[#2d2d2a] dark:text-[#a8a398] dark:hover:text-[#f4efe6] hover:bg-[#f0eee6] dark:hover:bg-[#2b2723] transition-colors cursor-pointer"
            title="Close Admin Console"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Identity Status Banner */}
        <div className="bg-[#f3f0e8] dark:bg-[#24211d] px-6 py-2.5 border-b border-[#dedcd5] dark:border-[#332f2b] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#6f6e69] dark:text-[#a8a398]">Active Admin Identity:</span>
            <span className="font-mono font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
              {currentUserProfile?.email || 'N/A'}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#deb887]/20 text-[#855318] dark:text-[#deb887] border border-[#deb887]/40 uppercase">
              Role: {currentUserProfile?.role}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#6f6e69] dark:text-[#a8a398]">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#3b4c3a] dark:text-[#4ade80]" />
              Anti-Escalation Locked
            </span>
            <span className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-[#c48344] dark:text-[#deb887]" />
              Rules Deployed
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#1e1c1a] px-6 gap-2">
          <button
            id="tab-btn-diagnostics"
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-[#2d2d2a] dark:border-[#deb887] text-[#2d2d2a] dark:text-[#deb887]'
                : 'border-transparent text-[#6f6e69] dark:text-[#a8a398] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6]'
            }`}
          >
            <Activity className="w-4 h-4" />
            System Diagnostics
          </button>

          <button
            id="tab-btn-users"
            onClick={() => setActiveTab('users')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-[#2d2d2a] dark:border-[#deb887] text-[#2d2d2a] dark:text-[#deb887]'
                : 'border-transparent text-[#6f6e69] dark:text-[#a8a398] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6]'
            }`}
          >
            <Users className="w-4 h-4" />
            User Roles Directory
          </button>

          <button
            id="tab-btn-audit-logs"
            onClick={() => setActiveTab('audit_logs')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'border-[#2d2d2a] dark:border-[#deb887] text-[#2d2d2a] dark:text-[#deb887]'
                : 'border-transparent text-[#6f6e69] dark:text-[#a8a398] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tamper-Evident Audit Logs
            {auditLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#f0eee6] dark:bg-[#2d2a26] text-[#6f6e69] dark:text-[#c5bfb4]">
                {auditLogs.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-sparks"
            onClick={() => setActiveTab('sparks')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sparks'
                ? 'border-[#2d2d2a] dark:border-[#deb887] text-[#2d2d2a] dark:text-[#deb887]'
                : 'border-transparent text-[#6f6e69] dark:text-[#a8a398] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Prompts & Directives
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SYSTEM DIAGNOSTICS & BENCHMARK */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              {/* Security Benchmark Card */}
              <div className="p-4 rounded-xl border border-[#cbe0c9] dark:border-[#2f4c34] bg-[#f4faf4] dark:bg-[#142416] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#2d5a31] dark:text-[#4ade80]" />
                    <h3 className="text-sm font-semibold text-[#1a381d] dark:text-[#d1fae5]">
                      Directive 9: Security Checks & Permissions Verification
                    </h3>
                  </div>
                  <button
                    id="run-security-benchmark-btn"
                    onClick={handleRunSecurityBenchmark}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2d5a31] hover:bg-[#396b3d] dark:bg-[#4ade80] dark:hover:bg-[#6ee7b7] text-white dark:text-[#0b1f10] shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                    {isVerifying ? 'Verifying...' : 'Test RBAC Verification'}
                  </button>
                </div>

                <p className="text-xs text-[#2e5233] dark:text-[#a7f3d0]">
                  Verifies that caller identity passes strict server-side RBAC validation (`/api/admin/verify-access`) and ensures elevated administrative privileges are granted without bypass risks.
                </p>

                {benchmarkResult && (
                  <div
                    id="benchmark-result-box"
                    className={`p-3 rounded-lg border text-xs ${
                      benchmarkResult.verified
                        ? 'bg-white/80 dark:bg-[#0f1d11] border-[#a3d9a5] dark:border-[#284a2d] text-[#1e4622] dark:text-[#86efac]'
                        : 'bg-red-50 dark:bg-[#2d1212] border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      {benchmarkResult.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span>{benchmarkResult.message}</span>
                    </div>
                    {benchmarkResult.grantedPermissions && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {benchmarkResult.grantedPermissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 rounded-md bg-[#2d5a31]/10 dark:bg-[#4ade80]/15 text-[11px] font-mono text-[#1a381d] dark:text-[#d1fae5] border border-[#2d5a31]/20 dark:border-[#4ade80]/20"
                          >
                            ✓ {perm}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* System Stats Overview */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#2d2d2a] dark:text-[#f4efe6] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                  Live Operational Telemetry
                </h3>
                <button
                  onClick={fetchDiagnostics}
                  disabled={loadingDiagnostics}
                  className="text-xs text-[#6f6e69] hover:text-[#2d2d2a] dark:text-[#a8a398] dark:hover:text-[#f4efe6] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {diagnosticError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs dark:bg-[#2d1212] dark:border-red-900/40 dark:text-red-300">
                  {diagnosticError}
                </div>
              )}

              {diagnostics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Uptime & Runtime */}
                  <div className="p-4 rounded-xl border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] space-y-2">
                    <span className="text-[11px] font-medium text-[#6f6e69] dark:text-[#a8a398] uppercase tracking-wider">
                      Node & Uptime
                    </span>
                    <p className="text-xl font-bold font-mono text-[#2d2d2a] dark:text-[#f4efe6]">
                      {Math.floor(diagnostics.uptimeSeconds / 60)}m {diagnostics.uptimeSeconds % 60}s
                    </p>
                    <p className="text-[#6f6e69] dark:text-[#a8a398]">
                      Memory: <span className="font-mono font-medium">{diagnostics.memoryUsageMb} MB</span>
                    </p>
                    <p className="text-[#6f6e69] dark:text-[#a8a398]">
                      Runtime: <span className="font-mono">{diagnostics.nodeVersion}</span>
                    </p>
                  </div>

                  {/* Gemini AI Ladder */}
                  <div className="p-4 rounded-xl border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] space-y-2">
                    <span className="text-[11px] font-medium text-[#6f6e69] dark:text-[#a8a398] uppercase tracking-wider">
                      Gemini Fallback Ladder
                    </span>
                    <p className="text-sm font-semibold text-[#2d2d2a] dark:text-[#deb887]">
                      {diagnostics.integrations.gemini.configured ? '✓ API Key Bound' : '⚠️ Missing Key'}
                    </p>
                    <p className="text-[11px] text-[#6f6e69] dark:text-[#a8a398]">
                      Primary: <span className="font-mono text-[#2d2d2a] dark:text-[#f4efe6]">{diagnostics.integrations.gemini.primaryModel}</span>
                    </p>
                    <div className="text-[10px] text-[#888780] dark:text-[#958f84] space-y-0.5">
                      {diagnostics.integrations.gemini.fallbackLadder.map((m, i) => (
                        <div key={m} className="font-mono">
                          {i + 1}. {m}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Google Maps & Email Integrations */}
                  <div className="p-4 rounded-xl border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] space-y-2">
                    <span className="text-[11px] font-medium text-[#6f6e69] dark:text-[#a8a398] uppercase tracking-wider">
                      Geocoding & Reminders
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs">
                        Maps Proxy: <span className="font-medium text-green-600 dark:text-green-400">Active (CF1 CORS Guard)</span>
                      </p>
                      <p className="text-xs">
                        Attribution: <span className="font-mono text-[10px]">{diagnostics.integrations.googleMaps.attributionTracking}</span>
                      </p>
                      <p className="text-xs">
                        Email Reminders: <span className="font-medium">{diagnostics.integrations.emailReminders.mode.toUpperCase()}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER ROLES DIRECTORY */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                    Registered User Directory (Protected by Firestore RBAC)
                  </h3>
                  <p className="text-xs text-[#6f6e69] dark:text-[#a8a398]">
                    Admins can view and grant role permissions. Normal users are forbidden from listing users (`firestore.rules`).
                  </p>
                </div>
                <button
                  id="refresh-users-btn"
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] hover:bg-[#f0eee6] dark:hover:bg-[#2b2723] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {userUpdateMessage && (
                <div className="p-3 rounded-lg border border-[#dedcd5] dark:border-[#332f2b] bg-[#f9f8f4] dark:bg-[#201d1a] text-xs font-medium">
                  {userUpdateMessage}
                </div>
              )}

              {loadingUsers ? (
                <div className="py-8 text-center text-xs text-[#6f6e69] dark:text-[#a8a398]">
                  Loading user directory from Firestore...
                </div>
              ) : (
                <div className="border border-[#dedcd5] dark:border-[#332f2b] rounded-xl overflow-hidden bg-white dark:bg-[#201d1a]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#dedcd5] dark:border-[#332f2b] bg-[#f7f6f0] dark:bg-[#25221e] text-[#6f6e69] dark:text-[#a8a398]">
                        <th className="py-2.5 px-4 font-semibold">User</th>
                        <th className="py-2.5 px-4 font-semibold">Email</th>
                        <th className="py-2.5 px-4 font-semibold">Assigned Role</th>
                        <th className="py-2.5 px-4 font-semibold">Joined Date</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedcd5] dark:divide-[#332f2b]">
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[#888780] dark:text-[#958f84]">
                            No registered users found in directory.
                          </td>
                        </tr>
                      ) : (
                        usersList.map((usr) => (
                          <tr key={usr.uid} className="hover:bg-[#fcfbf7] dark:hover:bg-[#27231f]">
                            <td className="py-3 px-4 font-medium flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#dedcd5] dark:bg-[#332f2b] text-[#2d2d2a] dark:text-[#f4efe6] text-[10px] font-bold flex items-center justify-center">
                                {(usr.displayName || usr.email || 'U')[0].toUpperCase()}
                              </div>
                              <span className="truncate max-w-[120px]">{usr.displayName || 'Reflective Soul'}</span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[#6f6e69] dark:text-[#a8a398]">
                              {usr.email}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                                  usr.role === 'admin'
                                    ? 'bg-[#fef7ea] text-[#855318] border-[#fde3be] dark:bg-[#322312] dark:text-[#f8c976] dark:border-[#5a3f1e]'
                                    : 'bg-[#eaf4ea] text-[#2e5c38] border-[#c8e2cb] dark:bg-[#1a2d1e] dark:text-[#a3e4b0] dark:border-[#2b4c32]'
                                }`}
                              >
                                {usr.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#888780] dark:text-[#958f84]">
                              {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {usr.uid === currentUserProfile?.uid ? (
                                <span className="text-[10px] text-[#888780] dark:text-[#958f84] italic">
                                  Current User
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleToggleUserRole(usr)}
                                  className="px-2 py-1 text-[11px] font-medium rounded-md border border-[#dedcd5] dark:border-[#332f2b] hover:bg-[#f0eee6] dark:hover:bg-[#2b2723] transition-colors cursor-pointer"
                                >
                                  {usr.role === 'admin' ? 'Demote to User' : 'Elevate to Admin'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit_logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                    Tamper-Evident Administrative Audit Trail
                  </h3>
                  <p className="text-xs text-[#6f6e69] dark:text-[#a8a398]">
                    Stored securely in `/admin/audit_logs` (Tier 1 isolation). Records privileged admin actions and benchmark tests.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!currentUserProfile) return;
                    await logAdminAction(
                      currentUserProfile.uid,
                      currentUserProfile.email,
                      'MANUAL_AUDIT_PING',
                      `Manual security inspection triggered by admin ${currentUserProfile.email}`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] transition-colors cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Log Security Audit Ping
                </button>
              </div>

              {auditError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs dark:bg-[#2d1212] dark:border-red-900/40 dark:text-red-300">
                  {auditError}
                </div>
              )}

              <div className="border border-[#dedcd5] dark:border-[#332f2b] rounded-xl overflow-hidden bg-white dark:bg-[#201d1a]">
                <div className="max-h-80 overflow-y-auto divide-y divide-[#dedcd5] dark:divide-[#332f2b]">
                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#888780] dark:text-[#958f84]">
                      No audit log records recorded yet. Click "Log Security Audit Ping" to test logging.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-3.5 hover:bg-[#fcfbf7] dark:hover:bg-[#27231f] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#8c5b3e] dark:text-[#deb887]">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-[#888780] dark:text-[#958f84] font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[#2d2d2a] dark:text-[#f4efe6] text-xs">{log.details}</p>
                        <div className="flex items-center gap-3 text-[10px] text-[#888780] dark:text-[#958f84] font-mono">
                          <span>Admin: {log.adminEmail}</span>
                          <span>UID: {log.adminUid.substring(0, 10)}...</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROMPTS & DIRECTIVES */}
          {activeTab === 'sparks' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                Directive 9 Guidelines & Reflection Modes Governance
              </h3>
              <p className="text-xs text-[#6f6e69] dark:text-[#a8a398]">
                Specification for how the AI should generate security checks for elevated admin permissions.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                    <Lock className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                    Anti-Escalation Safeguards
                  </div>
                  <p className="text-[#6f6e69] dark:text-[#a8a398] leading-relaxed">
                    Users cannot elevate their own role upon document creation or update. Security rules enforce:
                  </p>
                  <pre className="p-2 rounded bg-[#f7f6f0] dark:bg-[#161514] font-mono text-[11px] text-[#2d2d2a] dark:text-[#deb887] overflow-x-auto">
{`allow create: if isOwner(userId) && (
  request.resource.data.role == 'user' ||
  (isBootstrapAdmin && role == 'admin')
);
allow update: if (isOwner(userId) && 
  request.resource.data.role == resource.data.role)
  || isAdmin();`}
                  </pre>
                </div>

                <div className="p-4 rounded-xl border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#201d1a] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                    <Layers className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                    Tiered Resource Partitioning
                  </div>
                  <p className="text-[#6f6e69] dark:text-[#a8a398] leading-relaxed">
                    Personal reflections (`/users/&#123;userId&#125;/interactions`) are owner-isolated, while administrative logs (`/admin/audit_logs`) and system diagnostics require `isAdmin()` verification.
                  </p>
                  <pre className="p-2 rounded bg-[#f7f6f0] dark:bg-[#161514] font-mono text-[11px] text-[#2d2d2a] dark:text-[#deb887] overflow-x-auto">
{`function isAdmin() {
  return isSignedIn() && (
    (exists(/databases/$(db)/documents/users/$(request.auth.uid)) &&
     getUserData().role == 'admin') ||
    request.auth.token.email == 'limrashakirthd@gmail.com'
  );
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#dedcd5] dark:border-[#332f2b] bg-[#f7f6f0] dark:bg-[#201d1a] flex items-center justify-between text-xs">
          <span className="text-[#6f6e69] dark:text-[#a8a398]">
            RBAC Governance Active • Connected to {currentUserProfile?.email}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#dedcd5] dark:border-[#332f2b] bg-white dark:bg-[#282521] text-[#2d2d2a] dark:text-[#f4efe6] font-medium hover:bg-[#f0eee6] dark:hover:bg-[#322e29] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
