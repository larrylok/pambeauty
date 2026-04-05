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

      // single source of truth (and clears legacy keys if your api.js does that)
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

      // If server explicitly says invalid password, show that.
      if (
        err?.response?.status === 401 ||
        String(detail).toLowerCase().includes("invalid password")
      ) {
        toast.error("Invalid password");
      } else if (!err?.response) {
        // Network/CORS/backend down
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
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="diamond-icon w-16 h-16 mx-auto mb-4">
            <div className="w-6 h-6 bg-gold"></div>
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-charcoal mb-2">
            LUXE LOOKS
          </h1>
          <p className="text-sm tracking-widest uppercase text-graphite">
            Admin Panel
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-card border-2 border-gold/20 p-8"
        >
          <div className="mb-6">
            <label className="block text-sm font-bold mb-3 tracking-widest uppercase text-charcoal">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-3 border-b-2 border-gold/30 focus:border-gold bg-transparent focus:ring-0 font-serif"
              required
              autoComplete="current-password"
              data-testid="admin-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-charcoal text-gold border border-gold hover:bg-transparent hover:text-charcoal transition-all duration-300 text-xs tracking-widest uppercase font-bold disabled:opacity-50"
            data-testid="admin-login-button"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-graphite">
              Forgot password?
            </p>
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="text-xs tracking-widest uppercase font-bold text-gold hover:underline"
              data-testid="admin-forgot-password"
            >
              Reset using Recovery Key
            </button>
          </div>

          <p className="text-[11px] text-graphite mt-4">
            Recovery is private key!
          </p>
        </form>
      </div>

      {/* Recovery Modal */}
      {showRecovery && (
        <>
          <div
            className="fixed inset-0 bg-charcoal/60 z-50"
            onClick={() => (!recoveryLoading ? setShowRecovery(false) : null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-lg bg-card border-2 border-gold/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-2xl text-charcoal">Reset Admin Password</h2>
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="p-2 hover:bg-secondary"
                  disabled={recoveryLoading}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecoveryReset} className="space-y-4">
                <div>
                  <label className="block text-xs tracking-widest uppercase font-bold text-charcoal mb-2">
                    Recovery Key
                  </label>
                  <input
                    type="password"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    className="w-full px-4 py-3 border border-gold/30 bg-transparent focus:border-gold focus:ring-0"
                    placeholder="Enter recovery key"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-graphite mt-2">
                    This key is private.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs tracking-widest uppercase font-bold text-charcoal mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gold/30 bg-transparent focus:border-gold focus:ring-0"
                      placeholder="10+ characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-widest uppercase font-bold text-charcoal mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gold/30 bg-transparent focus:border-gold focus:ring-0"
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecovery(false)}
                    className="flex-1 py-3 border border-gold text-charcoal hover:bg-secondary transition-colors disabled:opacity-50"
                    disabled={recoveryLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gold text-white hover:bg-gold/90 transition-colors disabled:opacity-50"
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-[11px] text-graphite">
                If you don’t have the recovery key, please contact developer Larry😏.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}