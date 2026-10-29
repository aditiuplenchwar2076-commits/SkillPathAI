import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// Firebase configuration
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

// Authentication Guard
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html?returnUrl=interview.html";
    return;
  }

  // Populate user name and avatar
  let displayName = user.displayName;
  if (!displayName && user.email) {
    displayName = user.email.split("@")[0];
  }
  const nameEl = document.querySelector(".user-name");
  if (nameEl) {
    nameEl.textContent = displayName || "Learner";
  }

  const avatarEl = document.querySelector(".user-avatar");
  if (avatarEl && user.photoURL) {
    avatarEl.src = user.photoURL;
  }
});

// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });
}

// Career and skill level personalization
const level = localStorage.getItem("skillLevel") || localStorage.getItem("skillpath_level") || "Intermediate";
const career = localStorage.getItem("careerPath") || localStorage.getItem("skillpath_career") || "Web Development";
const subtitleEl = document.getElementById("subtitle");
if (subtitleEl) {
  subtitleEl.textContent = `${career} • ${level}`;
}

// Interview Questions and Flow
const questions = [
  "Hello! I'm your AI interviewer. Tell me about a project you have worked on.",
  "What was the hardest problem you faced while building it, and how did you solve it?",
  `Why do you want to work in ${career}?`
];

const sampleAnswers = [
  "I built a personal portfolio website using HTML, CSS and JavaScript with a responsive layout.",
  "Making the navbar work on mobile was hard. I used a media query and a JavaScript toggle to fix it.",
  "I enjoy building things people can use and I want to keep improving my skills."
];

let current = 0;
let listeningTimer = null;

const micBtn = document.getElementById("micBtn");
const listening = document.getElementById("listening");
const transcript = document.getElementById("transcript");
const nextBtn = document.getElementById("nextBtn");

// Speech simulation
if (micBtn) {
  micBtn.addEventListener("click", function() {
    micBtn.disabled = true;
    if (listening) listening.classList.add("on");
    if (transcript) transcript.textContent = "";
    listeningTimer = setTimeout(function() {
      if (listening) listening.classList.remove("on");
      if (transcript) transcript.textContent = sampleAnswers[current] || "Good technical response provided.";
      if (nextBtn) nextBtn.style.display = "block";
    }, 2000);
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", function() {
    current++;
    if (current >= questions.length) {
      const interviewBox = document.getElementById("interviewBox");
      const feedbackBox = document.getElementById("feedbackBox");
      const readinessBox = document.getElementById("readinessBox");
      if (interviewBox) interviewBox.style.display = "none";
      if (feedbackBox) feedbackBox.style.display = "block";
      if (readinessBox) readinessBox.style.display = "block";
      return;
    }
    const qCount = document.getElementById("qCount");
    const questionText = document.getElementById("questionText");
    if (qCount) qCount.textContent = `Question ${current + 1} of ${questions.length}`;
    if (questionText) questionText.textContent = questions[current];
    if (transcript) transcript.textContent = "Your answer will appear here...";
    nextBtn.style.display = "none";
    if (micBtn) micBtn.disabled = false;
  });
}
