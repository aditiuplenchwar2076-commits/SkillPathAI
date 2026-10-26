
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let isSignupMode = false;

const signupLink = document.getElementById("signupLink");
const welcomeHeading = document.querySelector(".welcome-heading");
const welcomeSubtext = document.querySelector(".welcome-subtext");
const loginButton = document.querySelector(".login-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function setSignupMode(signup) {
  isSignupMode = signup;
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

const loginForm = document.querySelector(".login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");


loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  emailError.textContent = "";
  passwordError.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    emailError.textContent = "Email is required";
    return;
  }

  if (!password) {
    passwordError.textContent = "Password is required";
    return;
  }

  if (password.length < 6) {
    passwordError.textContent = "Password must be at least 6 characters";
    return;
  }

  try {
    let userCredential;

    if (isSignupMode) {
      userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      alert("Account created successfully!");
    } else {
      userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      alert("Login successful!");
    }

    console.log("Authenticated user:", userCredential.user.uid);
    // Determine if this is a newly created account using Firebase's getAdditionalUserInfo
    const additionalInfo = getAdditionalUserInfo(userCredential);
    const isNewUser = additionalInfo ? additionalInfo.isNewUser : isSignupMode;

    if (isNewUser) {
      // Clear any prior cached onboarding data for fresh account setup
      localStorage.removeItem("careerPath");
      localStorage.removeItem("skillLevel");
      localStorage.removeItem("skillpath_career");
      localStorage.removeItem("skillpath_level");
      localStorage.removeItem("skillpath_route");
      localStorage.removeItem("skillpath_score");
      window.location.href = "home.html";
    } else {
      // Temporary fallback check for existing users:
      // Limitation: Until backend profile checking is integrated, an existing user logging in
      // on a new device or cleared browser will lack localStorage profile data and will be routed
      // to landing.html to select their career.
      const hasOnboarding = localStorage.getItem("careerPath") || localStorage.getItem("skillLevel");
      if (hasOnboarding) {
        window.location.href = "dashboard.html";
      } else {
        window.location.href = "home.html";
      }
    }

  } catch (error) {
    console.error("Authentication failed:", error.code);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      passwordError.textContent = "Incorrect email or password";
    } else if (error.code === "auth/email-already-in-use") {
      emailError.textContent = "This email is already registered";
    } else if (error.code === "auth/invalid-email") {
      emailError.textContent = "Please enter a valid email address";
    } else if (error.code === "auth/weak-password") {
      passwordError.textContent = "Choose a stronger password";
    } else if (error.code === "auth/too-many-requests") {
      passwordError.textContent = "Too many attempts. Try again later";
    } else {
      passwordError.textContent = "Authentication failed. Please try again";
    }
  }
});



console.log("SkillPathAI Firebase initialized successfully.");
