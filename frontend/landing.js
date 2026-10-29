import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// SkillPathAI Firebase Client Config
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

// Dynamic Authentication State Handler for Topbar
const navAuthBtn = document.getElementById("navAuthBtn");
const navDashboardLink = document.getElementById("navDashboardLink");

let authInitialized = false;
let currentAuthUser = null;

onAuthStateChanged(auth, (user) => {
  authInitialized = true;
  currentAuthUser = user;
  if (user) {
    if (navDashboardLink) navDashboardLink.style.display = "inline-block";
    if (navAuthBtn) {
      navAuthBtn.textContent = "Log out";
      navAuthBtn.href = "#";
      navAuthBtn.classList.remove("btn-primary");
      navAuthBtn.classList.add("btn-ghost");
      navAuthBtn.onclick = async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "index.html";
      };
    }
  } else {
    if (navDashboardLink) navDashboardLink.style.display = "none";
    if (navAuthBtn) {
      navAuthBtn.textContent = "Log in";
      navAuthBtn.href = "login.html";
      navAuthBtn.onclick = null;
      navAuthBtn.classList.remove("btn-primary");
      navAuthBtn.classList.add("btn-ghost");
    }
  }
});

/* ================= 1. CAREER SELECTION ================= */
const SUPPORTED_CAREERS = [
  "Web Developer",
  "Data Analyst",
  "Data Scientist",
  "AI / ML Engineer",
  "Cybersecurity Analyst",
  "UI/UX Designer",
  "Cloud Engineer",
  "Mobile App Developer",
  "Software Engineer"
];

function validateCareer(careerName) {
  if (!careerName || typeof careerName !== "string") return "Web Developer";
  const trimmed = careerName.trim();
  const match = SUPPORTED_CAREERS.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return match || "Web Developer";
}

const cards = document.querySelectorAll('.career-card');
const selectionText = document.getElementById('selectionText');
const continueBtn = document.getElementById('continueBtn');

function selectCareer(card) {
  cards.forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const career = validateCareer(card.dataset.career);
  selectionText.textContent = 'Selected: ' + career;
  continueBtn.disabled = false;
  try {
    localStorage.setItem('skillpath_career', career);
    localStorage.setItem('careerPath', career);
    sessionStorage.setItem('skillpath_pending_career', career);
  } catch (e) {}
}

cards.forEach(card => card.addEventListener('click', () => selectCard(card)));
function selectCard(card) { selectCareer(card); }

continueBtn.addEventListener('click', async () => {
  const savedCareer = validateCareer(
    localStorage.getItem('skillpath_career') || localStorage.getItem('careerPath') || 'Web Developer'
  );
  try {
    sessionStorage.setItem('skillpath_pending_career', savedCareer);
    sessionStorage.setItem('skillpath_pending_action', 'assessment');
  } catch (e) {}

  let user = currentAuthUser;
  if (!authInitialized) {
    if (typeof auth.authStateReady === "function") {
      try {
        await auth.authStateReady();
        user = auth.currentUser;
      } catch (e) {}
    }
    if (!user) {
      user = await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          unsubscribe();
          resolve(u);
        });
        setTimeout(() => resolve(auth.currentUser), 500);
      });
    }
  }

  if (user) {
    window.location.href = 'asses.html';
  } else {
    window.location.href = `login.html?returnUrl=${encodeURIComponent('asses.html')}&action=assessment`;
  }
});

// Restore an earlier choice if the user comes back
try {
  const saved = localStorage.getItem('skillpath_career');
  if (saved) {
    const match = [...cards].find(c => c.dataset.career === saved);
    if (match) selectCareer(match);
  }
} catch (e) {}

/* ================= 2. CHATBOT ================= */
const chatToggle = document.getElementById('chatToggle');
const chatWindow = document.getElementById('chatWindow');
const chatClose = document.getElementById('chatClose');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatQuick = document.getElementById('chatQuick');

// Keyword -> reply. The first rule whose keyword appears in the message wins.
const replies = [
  { keys: ['hello', 'hi', 'hey'], text: 'Hi! I can help you choose a career or explain how SkillPath works.' },
  { keys: ['which career', 'pick', 'choose', 'confused'], text: 'Think about what you enjoy. Like building things? Try Web or Software Engineer. Like numbers? Try Data Analyst. Like design? Try UI/UX. You can switch later.' },
  { keys: ['assessment', 'test', 'quiz'], text: 'After you pick a career, a short quiz checks your current skills. Your score decides your level: Beginner, Intermediate or Advanced.' },
  { keys: ['free', 'price', 'cost', 'pay'], text: 'You can start for free. Pick a career and take the assessment to begin.' },
  { keys: ['web', 'html', 'javascript'], text: 'Web Developer is a great start for beginners. You begin with HTML, CSS and JavaScript, then move to React.' },
  { keys: ['data'], text: 'Data Analyst focuses on Excel, SQL and dashboards. Data Scientist adds Python and machine learning.' },
  { keys: ['roadmap', 'level'], text: 'Your roadmap is built from your assessment result, so each lesson matches your level.' },
  { keys: ['job', 'interview', 'placement'], text: 'Later in the path you can practise AI mock interviews and see your job readiness score.' }
];
const fallback = "I'm not sure about that yet. Try asking about careers, the assessment, or the roadmap.";

function addMessage(text, who) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;                 // textContent keeps user input safe
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function getReply(message) {
  const lower = message.toLowerCase();
  const rule = replies.find(r => r.keys.some(k => lower.includes(k)));
  return rule ? rule.text : fallback;
}

function sendMessage(text) {
  text = text.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';
  setTimeout(() => addMessage(getReply(text), 'bot'), 500);   // small "typing" delay
}

function openChat() {
  chatWindow.hidden = false;
  if (!chatBody.children.length) {
    addMessage('Hi! I\'m the SkillPath assistant. Ask me anything about choosing a career.', 'bot');
  }
  chatInput.focus();
}

chatToggle.addEventListener('click', () => chatWindow.hidden ? openChat() : (chatWindow.hidden = true));
chatClose.addEventListener('click', () => chatWindow.hidden = true);
chatSend.addEventListener('click', () => sendMessage(chatInput.value));
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(chatInput.value); });
chatQuick.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') sendMessage(e.target.textContent);
});
