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

/**
 * Routes user according to their onboarding status.
 * Checks for returnUrl query parameter first.
 */
function handleAuthSuccess(userCredential, isCreated) {
  const additionalInfo = getAdditionalUserInfo(userCredential);
  const isNewUser = isCreated || (additionalInfo ? additionalInfo.isNewUser : false);

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get("returnUrl");

  if (isNewUser) {
    // Clear prior cached data for fresh account setup
    localStorage.removeItem("careerPath");
    localStorage.removeItem("skillLevel");
    localStorage.removeItem("skillpath_career");
    localStorage.removeItem("skillpath_level");
    localStorage.removeItem("skillpath_route");
    localStorage.removeItem("skillpath_score");
    window.location.href = "home.html";
  } else {
    // Returning user
    const hasOnboarding = localStorage.getItem("careerPath") || localStorage.getItem("skillLevel");
    if (returnUrl && !returnUrl.includes("login.html") && !returnUrl.includes("index.html")) {
      window.location.href = returnUrl;
    } else if (hasOnboarding) {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "home.html";
    }
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
    const originalBtnText = loginButton ? loginButton.textContent : "Submit";
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = isSignupMode ? "Creating account..." : "Logging in...";
    }

    try {
      let userCredential;
      if (isSignupMode) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      handleAuthSuccess(userCredential, isSignupMode);
    } catch (error) {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = originalBtnText;
      }
      const errInfo = mapAuthError(error);
      if (errInfo.field === "email" && emailError) {
        emailError.textContent = errInfo.msg;
      } else if (passwordError) {
        passwordError.textContent = errInfo.msg;
      }
    }
  });
}

// 2. Google Authentication Button Handler
if (googleButton) {
  googleButton.addEventListener("click", async (event) => {
    event.preventDefault();
    clearErrors();

    const originalBtnContent = googleButton.innerHTML;
    googleButton.disabled = true;
    googleButton.style.opacity = "0.7";

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      handleAuthSuccess(userCredential, false);
    } catch (error) {
      googleButton.disabled = false;
      googleButton.style.opacity = "1";
      googleButton.innerHTML = originalBtnContent;

      const errInfo = mapAuthError(error);
      if (passwordError) {
        passwordError.textContent = errInfo.msg;
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
