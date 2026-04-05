import axios from "axios";

function getBackendUrl() {
  // Use the Vercel environment variable first
  const env = process.env.REACT_APP_API_URL;

  if (env && typeof env === "string" && env.trim() && env !== "undefined") {
    return env.replace(/\/+$/, "");
  }

  // Local development fallback
  return "http://127.0.0.1:8000";
}

const TOKEN_KEY = "admin_token";

// One-time migration so old builds keep working
function migrateAdminToken() {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) return existing;

    const legacy =
      localStorage.getItem("adminToken") || localStorage.getItem("token");

    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem("adminToken");
      localStorage.removeItem("token");
      return legacy;
    }

    return "";
  } catch {
    return "";
  }
}

export function getAdminToken() {
  return migrateAdminToken() || "";
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");
  } catch {
    // ignore storage errors
  }
}

export function clearAdminToken() {
  setAdminToken("");
}

const api = axios.create({
  baseURL: `${getBackendUrl()}/api`,
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    const token = getAdminToken();

    config.headers = config.headers || {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      clearAdminToken();

      if (
        window.location.pathname.startsWith("/admin") &&
        !window.location.pathname.startsWith("/admin/login")
      ) {
        window.location.href = "/admin/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;