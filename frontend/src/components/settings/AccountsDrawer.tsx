import React, { useState } from 'react';
import { X, Clock, Key, ShieldCheck, Moon, Sun } from 'lucide-react';
import { Account, Telemetry } from '../../types';
import { api } from '../../lib/api';

interface AccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  telemetry: Telemetry | null;
  onRefreshAccounts: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AccountsDrawer: React.FC<AccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  telemetry,
  onRefreshAccounts,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [cookieAccount, setCookieAccount] = useState('');
  const [cookieJson, setCookieJson] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieSuccess, setCookieSuccess] = useState<string | null>(null);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSwitchAccount = async (alias: string) => {
    try {
      await api.switchAccount(alias);
      onRefreshAccounts();
    } catch (err: any) {
      alert(`Failed to switch account: ${err.message}`);
    }
  };

  const handleToggleAutoSwitch = async () => {
    const current = telemetry?.settings?.auto_switch ?? true;
    try {
      await api.patchSettings({ auto_switch: !current });
      onRefreshAccounts();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleImportCookies = async () => {
    if (!cookieAccount || !cookieJson.trim()) {
      setCookieError('Please select an account and paste the cookies JSON.');
      return;
    }
    setIsSubmitting(true);
    setCookieError(null);
    try {
      const res = await api.importCookies(cookieAccount, cookieJson.trim());
      setCookieSuccess(`Imported ${res.cookies_imported} cookies successfully!`);
      setTimeout(() => {
        setShowCookieModal(false);
        setCookieSuccess(null);
        setCookieJson('');
        onRefreshAccounts();
      }, 1500);
    } catch (err: any) {
      setCookieError(err.message || 'Failed to import cookies');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-up Bottom Sheet (Mobile) / Center Card (Desktop) */}
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#ffffff] dark:bg-[#18181b] rounded-t-3xl sm:rounded-3xl border border-[#e5e5e5] dark:border-[#2b2b2f] p-5 shadow-2xl z-10 animate-slide-up space-y-5">
        {/* Grab Handle for Mobile */}
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-zinc-700 mx-auto -mt-1 sm:hidden" />

        {/* Drawer Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0d0d0d] dark:text-white">
              Accounts & Engine
            </h2>
            <p className="text-xs text-[#6e6e80] dark:text-[#a1a1aa] mt-0.5">
              Manage your ChatGPT accounts and self-hosted engine settings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-black dark:hover:text-white transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Section: ChatGPT Accounts ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] dark:text-[#a1a1aa]">
              ChatGPT Accounts
            </h3>
            <span className="text-[11px] text-gray-400">Rotates on rate limit</span>
          </div>

          <div className="space-y-2">
            {accounts.map((acc) => {
              const inCooldown =
                acc.rate_limited_until && acc.rate_limited_until > Date.now() / 1000;
              const cooldownMinutes = inCooldown
                ? Math.ceil((acc.rate_limited_until! - Date.now() / 1000) / 60)
                : 0;

              return (
                <div
                  key={acc.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    acc.is_active
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#f7f7f8] dark:bg-[#202024] border-[#e5e5e5] dark:border-[#2c2c30]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xs">
                        {acc.alias.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                            {acc.alias}
                          </p>
                          {acc.is_active && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa] font-mono truncate max-w-[180px]">
                          {acc.email || acc.id}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge & Action */}
                    <div className="flex items-center gap-2">
                      {inCooldown ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono border border-amber-500/20">
                          <Clock size={10} />
                          {cooldownMinutes}m cooldown
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-gray-400">
                          {acc.total_generations} gens
                        </span>
                      )}

                      {!acc.is_active && (
                        <button
                          onClick={() => handleSwitchAccount(acc.alias)}
                          className="px-2.5 py-1 rounded-full bg-white dark:bg-[#2b2b30] hover:bg-gray-100 dark:hover:bg-[#383840] border border-gray-200 dark:border-gray-700 text-xs font-medium text-[#0d0d0d] dark:text-white active:scale-95 transition-all shadow-sm"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section: Engine Settings ── */}
        <div className="space-y-3 pt-2 border-t border-[#e5e5e5] dark:border-[#2a2a2e]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] dark:text-[#a1a1aa]">
            Engine Settings
          </h3>

          {/* Auto-Switch Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30]">
            <div>
              <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">
                Auto-Switch on Rate Limit
              </p>
              <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                Automatically rotates to another standby account
              </p>
            </div>
            <button
              onClick={handleToggleAutoSwitch}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                telemetry?.settings?.auto_switch !== false
                  ? 'bg-emerald-500'
                  : 'bg-gray-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  telemetry?.settings?.auto_switch !== false ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f7f8] dark:bg-[#202024] border border-[#e5e5e5] dark:border-[#2c2c30]">
            <div className="flex items-center gap-2">
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
              <div>
                <p className="text-xs font-medium text-[#0d0d0d] dark:text-white">Appearance</p>
                <p className="text-[11px] text-[#6e6e80] dark:text-[#a1a1aa]">
                  {isDarkMode ? 'Dark theme active' : 'Light theme active'}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleDarkMode}
              className="px-3 py-1 rounded-full bg-white dark:bg-[#2b2b30] border border-gray-200 dark:border-gray-700 text-xs font-medium text-[#0d0d0d] dark:text-white active:scale-95 transition-all shadow-sm"
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Import Cookies Action */}
          <button
            onClick={() => setShowCookieModal(true)}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-[#0d0d0d] dark:text-white flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Key size={14} />
            Import cookies.json
          </button>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-[11px]">
          <ShieldCheck size={14} className="flex-shrink-0" />
          <span>Your account data is stored securely on this local machine only.</span>
        </div>

        {/* Cookie Import Modal (Child) */}
        {showCookieModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-[#1f1f23] rounded-2xl p-5 border border-gray-200 dark:border-zinc-700 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0d0d0d] dark:text-white">
                  Import Session Cookies
                </h3>
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="text-gray-400 hover:text-black dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Target Account:
                </label>
                <select
                  value={cookieAccount}
                  onChange={(e) => setCookieAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-[#0d0d0d] dark:text-white outline-none"
                >
                  <option value="">Select an account…</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.alias}>
                      {acc.alias} ({acc.email || acc.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Cookies JSON:
                </label>
                <textarea
                  rows={6}
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  placeholder='[{"name": "__Secure-next-auth.session-token", "value": "..."}]'
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 font-mono text-xs text-[#0d0d0d] dark:text-white outline-none"
                />
              </div>

              {cookieError && <p className="text-xs text-red-500">{cookieError}</p>}
              {cookieSuccess && <p className="text-xs text-emerald-500 font-medium">{cookieSuccess}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportCookies}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  {isSubmitting ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
