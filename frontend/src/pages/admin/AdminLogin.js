// Adds a "Forgot password?" recovery flow (no email/provider) using:
// POST /api/admin/recovery-reset-password
// Requires you to have ADMIN_RECOVERY_KEY set on the server (backend/.env)
 
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { setAdminToken } from "../../api";
 
export default function AdminLogin() {
  const navigate = useNavigate();
 
  // Login
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
 
  // Recovery modal
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
 
  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
 
    const pwd = password.trim();
    if (!pwd) {
      toast.error("Enter your admin password.");
      return;
    }
 
    setLoading(true);
    try {
      const res = await api.post("/admin/login", { password: pwd });
 
      const token = res?.data?.token;
      if (!token) {
        toast.error("Login failed: server did not return a token.");
        return;
      }
 
      setAdminToken(token);
 
      toast.success("Login successful");
      setPassword("");
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
 
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "";
 
      if (
        err?.response?.status === 401 ||
        String(detail).toLowerCase().includes("invalid password")
      ) {
        toast.error("Invalid password");
      } else if (!err?.response) {
        toast.error("Cannot reach server. Check backend is running + CORS + URL.");
      } else {
        toast.error(detail || "Login failed");
      }
 
      setPassword("");
    } finally {
      setLoading(false);
    }
  };
 
  const handleRecoveryReset = async (e) => {
    e.preventDefault();
    if (recoveryLoading) return;
 
    const key = recoveryKey.trim();
    const np = newPassword.trim();
    const cp = confirmPassword.trim();
 
    if (!key) {
      toast.error("Recovery key is required.");
      return;
    }
    if (!np || !cp) {
      toast.error("Enter the new password and confirm it.");
      return;
    }
    if (np.length < 10) {
      toast.error("New password must be at least 10 characters.");
      return;
    }
    if (np !== cp) {
      toast.error("Passwords do not match.");
      return;
    }
 
    setRecoveryLoading(true);
    try {
      await api.post("/admin/recovery-reset-password", {
        recoveryKey: key,
        newPassword: np,
        confirmPassword: cp,
      });
 
      toast.success("Password reset successful. Please login with the new password.");
 
      setShowRecovery(false);
      setRecoveryKey("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
    } catch (err) {
      console.error(err);
 
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "";
 
      if (err?.response?.status === 401) {
        toast.error("Invalid recovery key.");
      } else {
        toast.error(detail || "Failed to reset password");
      }
    } finally {
      setRecoveryLoading(false);
    }
  };
 
  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
 
        {/* Brand header */}
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.38em] text-[#7a7a74] mb-3">
            Admin Panel
          </p>
          <h1 className="font-serif text-4xl text-[#111111] tracking-tight">
            Pam Beauty
          </h1>
          <div className="mt-4 h-px w-16 mx-auto bg-gradient-to-r from-transparent via-black/15 to-transparent" />
        </div>
 
        {/* Login card */}
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-[10px] uppercase tracking-[0.35em] text-[#7a7a74] mb-3">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-white border border-[#e7e7e2] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#b0b0aa] focus:outline-none focus:border-[#111111] transition-colors"
                required
                autoComplete="current-password"
                data-testid="admin-password-input"
              />
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#111111] text-white rounded-[14px] text-[11px] uppercase tracking-[0.25em] font-semibold hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="admin-login-button"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
 
            {/* Recovery row */}
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-[#9a9a94]">Forgot password?</p>
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#111111] border-b border-[#111111] hover:opacity-60 transition-opacity"
                data-testid="admin-forgot-password"
              >
                Reset via Recovery Key
              </button>
            </div>
 
            <p className="text-[11px] text-[#b0b0aa] mt-4 text-center">
              Recovery key is private — keep it safe.
            </p>
          </form>
        </div>
 
      </div>
 
      {/* Recovery Modal */}
      {showRecovery && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-[3px] z-50"
            onClick={() => (!recoveryLoading ? setShowRecovery(false) : null)}
          />
 
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
 
              {/* Modal header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-[#7a7a74] mb-1">
                    Account Recovery
                  </p>
                  <h2 className="font-serif text-2xl text-[#111111]">
                    Reset Admin Password
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  disabled={recoveryLoading}
                  aria-label="Close"
                  className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-[#e7e7e2] bg-white text-[#777777] text-sm hover:border-[#111111] hover:text-[#111111] transition-colors disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
 
              <form onSubmit={handleRecoveryReset} className="space-y-5">
 
                {/* Recovery key field */}
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.35em] text-[#7a7a74] mb-2">
                    Recovery Key
                  </label>
                  <input
                    type="password"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    className="w-full bg-white border border-[#e7e7e2] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#b0b0aa] focus:outline-none focus:border-[#111111] transition-colors"
                    placeholder="Enter your recovery key"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-[#b0b0aa] mt-1.5">
                    This key is private — only you should have it.
                  </p>
                </div>
 
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-black/8 to-transparent" />
 
                {/* New passwords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.35em] text-[#7a7a74] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-[#e7e7e2] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#b0b0aa] focus:outline-none focus:border-[#111111] transition-colors"
                      placeholder="10+ characters"
                      autoComplete="new-password"
                    />
                  </div>
 
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.35em] text-[#7a7a74] mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white border border-[#e7e7e2] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#b0b0aa] focus:outline-none focus:border-[#111111] transition-colors"
                      placeholder="Repeat password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
 
                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRecovery(false)}
                    disabled={recoveryLoading}
                    className="flex-1 py-3 rounded-[14px] border border-[#e7e7e2] bg-white text-[#5f5f5a] text-[11px] uppercase tracking-[0.2em] font-semibold hover:border-[#d8d8d2] hover:bg-[#f8f8f6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="flex-1 py-3 rounded-[14px] bg-[#111111] text-white text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recoveryLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
 
              <p className="text-[11px] text-[#b0b0aa] mt-5">
                Don't have the recovery key? Contact your developer Larry 😏
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}