import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { DEFAULT_API_URL } from "@/lib/constants";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/lib/auth";

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// --- 401 interceptor with refresh-token rotation ---
// On 401, we try ONE refresh against /auth/refresh using the stored refresh_token.
// If refresh succeeds, the stored tokens are rotated and the original request is
// retried transparently. If refresh fails (no token / 401), we clear state and
// redirect to /login.
//
// Concurrent 401s share the same refresh promise so we never hit /auth/refresh more
// than once per token expiration burst.

let refreshPromise: Promise<string | null> | null = null;

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

function clearSessionAndRedirect() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;
  try {
    // Use a bare axios call to skip our own interceptors and avoid a recursion loop.
    const res = await axios.post(
      `${DEFAULT_API_URL}/auth/refresh`,
      { refresh_token: refresh },
      { headers: { "Content-Type": "application/json" } }
    );
    const access = res.data?.access_token as string | undefined;
    const newRefresh = res.data?.refresh_token as string | undefined;
    if (!access) return null;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;

    // Only attempt refresh once per request, and never for the /auth/refresh call itself.
    const isRefreshCall = (original?.url || "").includes("/auth/refresh");
    if (status !== 401 || !original || original._retried || isRefreshCall) {
      if (status === 401) clearSessionAndRedirect();
      return Promise.reject(error);
    }

    original._retried = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccess = await refreshPromise;
    if (!newAccess) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
    return api(original);
  }
);
