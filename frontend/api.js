import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// SkillPathAI Firebase Client Config
const firebaseConfig = {
  apiKey: "AIzaSyCQ9YRQV9edVS0D-Lb6ORl9HX6E0oL4ECQ",
  authDomain: "skillpathai-2e1c7.firebaseapp.com",
  projectId: "skillpathai-2e1c7",
  storageBucket: "skillpathai-2e1c7.firebasestorage.app",
  messagingSenderId: "41899784962",
  appId: "1:41899784962:web:1fe188cfca7f6fa7d201b"
};

// Safe Firebase initialization
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Backend API Base URL configuration
// In development, default to local FastAPI server (http://127.0.0.1:8000).
// In production, can be overridden via window.__SKILLPATH_API_BASE_URL__ or window.SKILLPATH_API_BASE_URL.
const isLocalhost = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === ""
);

export const API_BASE_URL =
  typeof window !== "undefined" &&
  (window.__SKILLPATH_API_BASE_URL__ || window.SKILLPATH_API_BASE_URL)
    ? (
        window.__SKILLPATH_API_BASE_URL__ ||
        window.SKILLPATH_API_BASE_URL
      ).replace(/\/$/, "")
    : isLocalhost
      ? "http://127.0.0.1:8000"
      : "https://skillpathai-jpdw.onrender.com";


/**
 * Waits for Firebase auth state to resolve and returns the current user,
 * or null if unauthenticated.
 * Awaits auth.authStateReady() when available to prevent race conditions
 * where IndexedDB persistence is still loading on initial page render.
 *
 * @param {number} [timeoutMs=4000] - Safety timeout in milliseconds.
 * @returns {Promise<import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js").User|null>}
 */
export async function getCurrentUser(timeoutMs = 4000) {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (typeof auth.authStateReady === "function") {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn("auth.authStateReady() error:", e);
    }
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    let timer = null;
    let unsubscribed = false;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!unsubscribed) {
        unsubscribed = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });

    timer = setTimeout(() => {
      if (!unsubscribed) {
        unsubscribed = true;
        unsubscribe();
        resolve(auth.currentUser || null);
      }
    }, timeoutMs);
  });
}

/**
 * Sends an authenticated HTTP request to the FastAPI backend.
 * Obtains a fresh Firebase ID token directly via user.getIdToken().
 * Never stores or reads tokens from localStorage.
 * Includes configurable AbortController timeout support (default 25s).
 * Automatically retries once with force-refreshed token on 401.
 */
export async function apiRequest(endpoint, options = {}) {
  const user = await getCurrentUser();
  if (!user) {
    const unauthErr = new Error("Unauthenticated: You must be signed in to call the backend API.");
    unauthErr.status = 401;
    throw unauthErr;
  }

  // Retrieve fresh ID token directly from Firebase Auth
  const token = await user.getIdToken(options.forceRefresh === true);

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {})
  };

  // Configure AbortController timeout (default 25s, or custom timeout in options)
  const controller = new AbortController();
  const timeoutMs = typeof options.timeout === "number" ? options.timeout : 25000;
  let didTimeout = false;
  let timerId = null;

  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  // Link any external AbortSignal if caller provided one
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort());
    }
  }

  const { timeout: _unusedTimeout, signal: _unusedSignal, forceRefresh: _unusedForceRefresh, _isRetry: _unusedIsRetry, ...fetchOptions } = options;

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
  } catch (fetchErr) {
    if (didTimeout || (fetchErr && fetchErr.name === "AbortError" && didTimeout)) {
      const timeoutErr = new Error("Request timed out while waiting for server response. The server may be waking up, please try again.");
      timeoutErr.name = "TimeoutError";
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw fetchErr;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }

  // If response is 401 and we haven't retried yet, force-refresh token and retry once
  if (response.status === 401 && !options._isRetry) {
    try {
      const refreshedToken = await user.getIdToken(true);
      return await apiRequest(endpoint, {
        ...options,
        _isRetry: true,
        headers: {
          ...(options.headers || {}),
          "Authorization": `Bearer ${refreshedToken}`
        }
      });
    } catch (retryErr) {
      console.warn("Token refresh retry failed:", retryErr);
    }
  }

  if (!response.ok) {
    let errorDetail = "API request failed with status " + response.status;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (e) {
      // Non-JSON error body
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

/**
 * Synchronizes the authenticated Firebase identity with the MySQL backend.
 * Calls POST /users/sync and returns the internal user record (user_id, email, etc).
 * Sets a 35s timeout to accommodate backend cold starts gracefully.
 */
export async function syncUserWithBackend(options = {}) {
  return await apiRequest("/users/sync", {
    method: "POST",
    timeout: 35000,
    ...options
  });
}

/**
 * Explicitly approved internal destinations for authentication return routing.
 * Never includes login.html or index.html to prevent redirect loops.
 */
export const ALLOWED_INTERNAL_PAGES = new Set([
  "asses.html",
  "certificates.html",
  "community.html",
  "dashboard.html",
  "home.html",
  "interview.html",
  "practice.html",
  "pricing.html",
  "progress.html",
  "project-detail.html",
  "quizbeg.html",
  "resources.html",
  "result.html",
  "roadmap.html",
  "settings.html"
]);

/**
 * Strictly sanitizes and validates post-authentication return URLs.
 * Rejects external origins, protocol-relative URLs (//example.com, \\example.com),
 * unsafe schemes (javascript:, data:, vbscript:, file:), path traversals (../, %2e%2e),
 * control characters, and unapproved destinations.
 *
 * Preserves legitimate internal destinations and query parameters (e.g. asses.html?action=beginner).
 *
 * @param {string|null|undefined} rawUrl - The candidate returnUrl to inspect.
 * @param {string|null} [defaultUrl=null] - Fallback URL if rawUrl is invalid.
 * @returns {string|null} Safe relative URL with query string, or defaultUrl.
 */
export function sanitizeReturnUrl(rawUrl, defaultUrl = null) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return defaultUrl;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return defaultUrl;
  }

  // Reject control characters, newlines, carriage returns, or backslashes
  if (/[\r\n\t\0\\]/.test(trimmed)) {
    return defaultUrl;
  }

  // Reject protocol-relative URLs (//example.com, ///example.com)
  if (trimmed.startsWith("//")) {
    return defaultUrl;
  }

  // Reject path traversal attempts (../, %2e%2e)
  if (trimmed.includes("..") || /%2e%2e/i.test(trimmed)) {
    return defaultUrl;
  }

  // Determine current origin
  const baseOrigin = typeof window !== "undefined" && window.location && window.location.origin
    ? window.location.origin
    : "http://localhost:5500";

  // Check if rawUrl has an explicit scheme (e.g. "https:", "javascript:", "data:")
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const parsedExplicit = new URL(trimmed);
      if (
        parsedExplicit.origin !== baseOrigin ||
        (parsedExplicit.protocol !== "http:" && parsedExplicit.protocol !== "https:")
      ) {
        return defaultUrl;
      }
    } catch (e) {
      return defaultUrl;
    }
  }

  // Parse relative to baseOrigin
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed, baseOrigin);
  } catch (e) {
    return defaultUrl;
  }

  // Verify origin matches baseOrigin exactly
  if (parsedUrl.origin !== baseOrigin) {
    return defaultUrl;
  }

  // Extract filename from pathname (e.g. "/asses.html" -> "asses.html")
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const filename = segments.length > 0 ? segments[segments.length - 1] : "";

  if (!filename || !ALLOWED_INTERNAL_PAGES.has(filename.toLowerCase())) {
    return defaultUrl;
  }

  // Return safe relative filename and search query string
  return `${filename}${parsedUrl.search}`;
}

/**
 * Classifies an assessment score into a discrete SkillPathAI skill level.
 * Defines complete, non-overlapping ranges covering 0% to 100%:
 * - [0%, 40%):   'Beginner'     (0 <= score < 40)
 * - [40%, 75%):  'Intermediate' (40 <= score < 75)
 * - [75%, 100%]: 'Advanced'     (75 <= score <= 100)
 *
 * Aligns precisely with the 5-question curriculum:
 * - 0/5 (0%) or 1/5 (20%)   -> 'Beginner'
 * - 2/5 (40%) or 3/5 (60%)  -> 'Intermediate'
 * - 4/5 (80%) or 5/5 (100%) -> 'Advanced'
 * - Beginner mode (score: 0) -> 'Beginner'
 *
 * @param {number|string} score - Assessment percentage (0 - 100)
 * @returns {'Beginner'|'Intermediate'|'Advanced'}
 */
export function classifyAssessmentScore(score) {
  const num = Number(score);
  if (isNaN(num) || num < 40) {
    return "Beginner";
  } else if (num < 75) {
    return "Intermediate";
  } else {
    return "Advanced";
  }
}
