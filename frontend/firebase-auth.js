import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { syncUserWithBackend, apiRequest } from "./api.js";

// SkillPathAI Firebase project configuration
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
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let isSignupMode = false;

// DOM Elements
const signupLink = document.getElementById("signupLink");
const welcomeHeading = document.querySelector(".welcome-heading");
const welcomeSubtext = document.querySelector(".welcome-subtext");
const loginButton = document.querySelector(".login-btn");
const loginForm = document.querySelector(".login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const googleButton = document.querySelector(".google-btn");
const forgotPasswordLink = document.querySelector(".forgot-password");

function clearErrors() {
  if (emailError) emailError.textContent = "";
  if (passwordError) passwordError.textContent = "";
}

function setSignupMode(signup) {
  isSignupMode = signup;
  clearErrors();

  if (welcomeHeading) {
    welcomeHeading.textContent = isSignupMode
      ? "Create Account ✨"
      : "Welcome Back 👋";
  }
  if (welcomeSubtext) {
    welcomeSubtext.textContent = isSignupMode
      ? "Create your SkillPath AI account"
      : "Login to continue your learning journey";
  }
  if (loginButton) {
    loginButton.textContent = isSignupMode ? "Sign Up" : "Login";
  }
  if (signupLink) {
    signupLink.textContent = isSignupMode ? "Login" : "Sign up";
  }

  const signupTextContainer = document.querySelector(".signup-text");
  if (signupTextContainer && signupTextContainer.firstChild) {
    signupTextContainer.firstChild.textContent = isSignupMode
      ? "Already have an account? "
      : "Don't have an account? ";
  }

  if (passwordInput) {
    passwordInput.autocomplete = isSignupMode
      ? "new-password"
      : "current-password";
  }
}

// Auto-switch to signup if URL contains ?signup=true
if (typeof window !== "undefined" && window.location.search.includes("signup=true")) {
  setSignupMode(true);
}

if (signupLink) {
  signupLink.addEventListener("click", (event) => {
    event.preventDefault();
    setSignupMode(!isSignupMode);
  });
}

let isAuthSubmitting = false;
let isGoogleSubmitting = false;

/**
 * Synchronizes user with backend and routes according to user profile & onboarding status.
 * Checks for returnUrl query parameter first.
 * Provides informative status updates if backend cold start takes longer than 3.5 seconds.
 */
async function handleAuthSuccess(userCredential, isCreated) {
  clearErrors();

  // Authoritative first-time registration detection using Firebase isNewUser
  let isNewUser = false;
  try {
    const additionalInfo = getAdditionalUserInfo(userCredential);
    if (additionalInfo && typeof additionalInfo.isNewUser === "boolean") {
      isNewUser = additionalInfo.isNewUser;
    } else {
      isNewUser = Boolean(isCreated);
    }
  } catch (infoErr) {
    isNewUser = Boolean(isCreated);
  }

  const authUser = userCredential ? userCredential.user : null;
  const uid = authUser ? authUser.uid : null;

  if (uid) {
    if (isNewUser) {
      // Persist the first-login flag before redirecting after registration
      try {
        localStorage.setItem(`skillpath_first_login_${uid}`, "true");
        sessionStorage.setItem(`skillpath_first_login_${uid}`, "true");
        localStorage.removeItem(`skillpath_is_returning_${uid}`);
      } catch (e) {
        console.warn("Could not save first-login state:", e);
      }
    } else {
      // Existing returning account signing in
      try {
        localStorage.setItem(`skillpath_is_returning_${uid}`, "true");
        localStorage.removeItem(`skillpath_first_login_${uid}`);
        sessionStorage.removeItem(`skillpath_first_login_${uid}`);
      } catch (e) {
        console.warn("Could not save returning-login state:", e);
      }
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get("returnUrl");

  if (returnUrl && !returnUrl.includes("login.html") && !returnUrl.includes("index.html")) {
    window.location.replace(returnUrl);
    return;
  }

  // Display informative status if Render cold-start takes longer than 3.5s
  const coldStartTimer = setTimeout(() => {
    if (loginButton && loginButton.disabled) {
      loginButton.textContent = "Server is waking up, please hold on...";
    }
    if (googleButton && googleButton.disabled) {
      googleButton.innerHTML = "<span>Server is waking up, please hold on...</span>";
    }
  }, 3500);

  let dbUser = null;
  try {
    dbUser = await syncUserWithBackend();
  } catch (syncErr) {
    console.warn("Backend user sync during auth:", syncErr);
  } finally {
    clearTimeout(coldStartTimer);
  }

  // Check if user has an existing roadmap or onboarding in database or localStorage
  let hasRoadmap = false;
  if (dbUser && dbUser.user_id) {
    try {
      const roadmaps = await apiRequest(`/roadmaps/${dbUser.user_id}`);
      if (Array.isArray(roadmaps) && roadmaps.length > 0) {
        hasRoadmap = true;
      }
    } catch (e) {
      console.warn("Could not check roadmaps during auth routing:", e);
    }
  }

  const hasLocalCareer = localStorage.getItem("careerPath") || localStorage.getItem("skillpath_career");

  if (hasRoadmap || hasLocalCareer) {
    window.location.replace("dashboard.html");
  } else {
    // Fresh user without a selected career path or roadmap
    window.location.replace("home.html");
  }
}

function mapAuthError(error) {
  console.error("Firebase Auth Error:", error.code, error.message);
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return { field: "password", msg: "Incorrect email or password" };
    case "auth/email-already-in-use":
      return { field: "email", msg: "This email is already registered. Please log in instead." };
    case "auth/invalid-email":
      return { field: "email", msg: "Please enter a valid email address." };
    case "auth/weak-password":
      return { field: "password", msg: "Password must be at least 6 characters with letters or numbers." };
    case "auth/too-many-requests":
      return { field: "password", msg: "Too many failed attempts. Please try again in a few minutes." };
    case "auth/popup-closed-by-user":
      return { field: "password", msg: "Google sign-in was cancelled." };
    case "auth/popup-blocked":
      return { field: "password", msg: "Pop-up blocked by browser. Please allow pop-ups for this site." };
    case "auth/network-request-failed":
      return { field: "password", msg: "Network error. Please check your internet connection." };
    case "auth/unauthorized-domain":
      return { field: "password", msg: "This domain is not authorized in Firebase Authentication Console." };
    case "auth/operation-not-allowed":
      return { field: "password", msg: "This sign-in method is not enabled in Firebase Console." };
    default:
      return { field: "password", msg: error.message || "Authentication failed. Please try again." };
  }
}

// 1. Email/Password Form Submission Handler
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isAuthSubmitting) return; // Prevent double submission

    clearErrors();

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email) {
      if (emailError) emailError.textContent = "Email is required";
      if (emailInput) emailInput.focus();
      return;
    }

    if (!password) {
      if (passwordError) passwordError.textContent = "Password is required";
      if (passwordInput) passwordInput.focus();
      return;
    }

    if (password.length < 6) {
      if (passwordError) passwordError.textContent = "Password must be at least 6 characters";
      if (passwordInput) passwordInput.focus();
      return;
    }

    // Disable button & show loading state
    isAuthSubmitting = true;
    const defaultBtnText = isSignupMode ? "Sign Up" : "Login";
    const originalBtnText = (loginButton && loginButton.textContent) ? loginButton.textContent : defaultBtnText;
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = isSignupMode ? "Creating account..." : "Logging in...";
    }

    let redirecting = false;

    try {
      let userCredential;
      if (isSignupMode) {
        // Protect against duplicate user creation:
        // If current session already authenticated the user with this email (e.g. previous attempt timed out during sync)
        if (auth.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() === email.toLowerCase()) {
          userCredential = { user: auth.currentUser };
        } else {
          try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
          } catch (createErr) {
            // If already registered, attempt login with the provided credentials
            if (createErr.code === "auth/email-already-in-use") {
              try {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
              } catch (signInErr) {
                throw createErr;
              }
            } else {
              throw createErr;
            }
          }
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      redirecting = true;
      await handleAuthSuccess(userCredential, isSignupMode);
    } catch (error) {
      redirecting = false;
      const errInfo = mapAuthError(error);
      if (errInfo.field === "email" && emailError) {
        emailError.textContent = errInfo.msg;
      } else if (passwordError) {
        passwordError.textContent = errInfo.msg;
      }
    } finally {
      isAuthSubmitting = false;
      if (!redirecting && loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = isSignupMode ? "Sign Up" : "Login";
      }
    }
  });
}

// 2. Google Authentication Button Handler
if (googleButton) {
  googleButton.addEventListener("click", async (event) => {
    event.preventDefault();
    if (isGoogleSubmitting) return;

    clearErrors();

    const originalBtnContent = googleButton.innerHTML;
    isGoogleSubmitting = true;
    googleButton.disabled = true;
    googleButton.style.opacity = "0.7";
    googleButton.innerHTML = "<span>Signing in with Google...</span>";

    let redirecting = false;

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      redirecting = true;
      await handleAuthSuccess(userCredential, false);
    } catch (error) {
      redirecting = false;
      // If user is already authenticated (e.g. redirect in flight or secondary error), do not show error
      if (auth.currentUser) {
        redirecting = true;
        await handleAuthSuccess({ user: auth.currentUser }, false);
        return;
      }

      const errInfo = mapAuthError(error);
      if (passwordError) {
        passwordError.textContent = errInfo.msg;
      }
    } finally {
      isGoogleSubmitting = false;
      if (!redirecting && googleButton) {
        googleButton.disabled = false;
        googleButton.style.opacity = "1";
        googleButton.innerHTML = originalBtnContent;
      }
    }
  });
}

// 3. Forgot Password Handler
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (event) => {
    event.preventDefault();
    clearErrors();

    const email = emailInput ? emailInput.value.trim() : "";
    if (!email) {
      if (emailError) emailError.textContent = "Enter your email to receive a password reset link";
      if (emailInput) emailInput.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (error) {
      const errInfo = mapAuthError(error);
      if (emailError) emailError.textContent = errInfo.msg;
    }
  });
}

console.log("SkillPathAI Firebase Auth module ready.");
