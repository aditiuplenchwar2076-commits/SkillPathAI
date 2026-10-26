// SkillPathAI - Public Marketing Landing Page Client Script
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// Firebase configuration (SkillPathAI Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyCQ9YRQV9edVS0D-Lb6ORl9HX6E0oL4ECQ",
  authDomain: "skillpathai-2e1c7.firebaseapp.com",
  projectId: "skillpathai-2e1c7",
  storageBucket: "skillpathai-2e1c7.firebasestorage.app",
  messagingSenderId: "41899784962",
  appId: "1:41899784962:web:1fe188cfca7f6fa7d201b"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Responsive Mobile Menu Handler
const mobileToggle = document.getElementById("mobileToggle");
const navMenu = document.getElementById("navMenu");

if (mobileToggle && navMenu) {
  mobileToggle.addEventListener("click", () => {
    navMenu.classList.toggle("show");
  });

  // Close menu when clicking any nav-link
  navMenu.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("show");
    });
  });
}

// Authentication Aware Topbar Buttons
const navAuthBtn = document.getElementById("navAuthBtn");
const navGetStartedBtn = document.getElementById("navGetStartedBtn");

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Authenticated user state
    if (navAuthBtn) {
      navAuthBtn.textContent = "Dashboard";
      navAuthBtn.href = "dashboard.html";
      navAuthBtn.classList.remove("btn-ghost");
      navAuthBtn.classList.add("btn-secondary");
    }
    if (navGetStartedBtn) {
      navGetStartedBtn.textContent = "My Learning Path →";
      navGetStartedBtn.href = "dashboard.html";
    }
  } else {
    // Public visitor state
    if (navAuthBtn) {
      navAuthBtn.textContent = "Log in";
      navAuthBtn.href = "login.html";
      navAuthBtn.classList.remove("btn-secondary");
      navAuthBtn.classList.add("btn-ghost");
    }
    if (navGetStartedBtn) {
      navGetStartedBtn.textContent = "Get Started";
      navGetStartedBtn.href = "login.html?signup=true";
    }
  }
});
