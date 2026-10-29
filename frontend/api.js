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
const auth = getAuth(app);

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
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Sends an authenticated HTTP request to the FastAPI backend.
 * Obtains a fresh Firebase ID token directly via user.getIdToken().
 * Never stores or reads tokens from localStorage.
 * Includes configurable AbortController timeout support (default 25s).
 */
export async function apiRequest(endpoint, options = {}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: You must be signed in to call the backend API.");
  }

  // Retrieve fresh ID token directly from Firebase Auth
  const token = await user.getIdToken();

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

  const { timeout: _unusedTimeout, signal: _unusedSignal, ...fetchOptions } = options;

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
