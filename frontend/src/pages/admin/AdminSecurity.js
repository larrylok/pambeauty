import React, { useState } from "react";
import { toast } from "sonner";
import api from "../../api";

function getErrorMessage(e, fallback = "Something went wrong") {
  const detail = e?.response?.data?.detail;
  const message = e?.response?.data?.message;

  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;

  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg || "Error").join(" | ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  return e?.message || fallback;
}

export default function AdminSecurity() {
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [recoveryKey, setRecoveryKey] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const changePassword = async () => {
    setLoading(true);
    try {
      await api.post("/admin/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      toast.success("Password changed. Please login again.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to change password"));
    } finally {
      setLoading(false);
    }
  };

  const recoveryReset = async () => {
    setLoading(true);
    try {
      await api.post("/admin/recovery-reset-password", {
        recoveryKey,
        newPassword: resetNewPassword,
        confirmPassword: resetConfirmPassword,
      });

      toast.success("Password reset successfully.");

      setRecoveryKey("");
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
          PAM Beauty
        </p>
        <h1 className="font-serif text-4xl text-[#111111]">Security</h1>
        <p className="mt-2 text-sm text-[#666666]">
          Manage admin authentication and recovery settings.
        </p>
      </div>

      {/* CHANGE PASSWORD */}
      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <h2 className="font-serif text-2xl text-[#111111] mb-2">
          Change Password
        </h2>
        <p className="text-sm text-[#777777] mb-6">
          Update your admin password. Minimum 10 characters recommended.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              label: "Current Password",
              value: currentPassword,
              set: setCurrentPassword,
            },
            {
              label: "New Password",
              value: newPassword,
              set: setNewPassword,
            },
            {
              label: "Confirm Password",
              value: confirmPassword,
              set: setConfirmPassword,
            },
          ].map((f, i) => (
            <div key={i}>
              <label className="block mb-2 text-[10px] uppercase tracking-[0.28em] text-[#7d7d77] font-semibold">
                {f.label}
              </label>
              <input
                type="password"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#111111]"
              />
            </div>
          ))}
        </div>

        <button
          onClick={changePassword}
          disabled={loading}
          className="mt-6 rounded-[20px] bg-[#111111] px-6 py-3 text-xs uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.1)] hover:bg-[#222222] disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </section>

      {/* RECOVERY */}
      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <h2 className="font-serif text-2xl text-[#111111] mb-2">
          Owner Recovery
        </h2>
        <p className="text-sm text-[#777777] mb-6">
          Use the recovery key to reset password if access is lost.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              label: "Recovery Key",
              value: recoveryKey,
              set: setRecoveryKey,
            },
            {
              label: "New Password",
              value: resetNewPassword,
              set: setResetNewPassword,
            },
            {
              label: "Confirm Password",
              value: resetConfirmPassword,
              set: setResetConfirmPassword,
            },
          ].map((f, i) => (
            <div key={i}>
              <label className="block mb-2 text-[10px] uppercase tracking-[0.28em] text-[#7d7d77] font-semibold">
                {f.label}
              </label>
              <input
                type="password"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#111111]"
              />
            </div>
          ))}
        </div>

        <button
          onClick={recoveryReset}
          disabled={loading}
          className="mt-6 rounded-[20px] border border-[#111111] px-6 py-3 text-xs uppercase tracking-[0.22em] text-[#111111] hover:bg-[#111111] hover:text-white transition disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </section>
    </div>
  );
}