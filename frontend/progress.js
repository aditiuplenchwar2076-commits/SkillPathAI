import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { apiRequest } from "./api.js";

// SkillPathAI Firebase Configuration
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
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Populate user profile info in topbar
  let displayName = user.displayName;
  if (!displayName && user.email) {
    displayName = user.email.split("@")[0];
  }
  displayName = displayName || "Learner";

  const userNameEl = document.getElementById("userName");
  const dropdownUserNameEl = document.getElementById("dropdownUserName");
  const dropdownUserEmailEl = document.getElementById("dropdownUserEmail");

  if (userNameEl) userNameEl.textContent = displayName;
  if (dropdownUserNameEl) dropdownUserNameEl.textContent = displayName;
  if (dropdownUserEmailEl && user.email) dropdownUserEmailEl.textContent = user.email;

  // Initial placeholders from localStorage while network request is in flight
  const cachedCareer = localStorage.getItem("careerPath") || localStorage.getItem("skillpath_career") || "Web Development";
  const cachedLevel = localStorage.getItem("skillLevel") || localStorage.getItem("skillpath_level") || "Intermediate";
  applyHeaderInfo(cachedCareer, cachedLevel);

  await loadProgressData();
});

function applyHeaderInfo(career, level) {
  const subtitleEl = document.getElementById("subtitle");
  const levelValueEl = document.getElementById("levelValue");

  if (subtitleEl && career && level) {
    subtitleEl.textContent = `${career} • ${level}`;
  }
  if (levelValueEl && level) {
    levelValueEl.textContent = level;
  }
}

async function loadProgressData() {
  const errorBanner = document.getElementById("progressErrorBanner");
  const errorMessage = document.getElementById("progressErrorMessage");

  if (errorBanner) errorBanner.style.display = "none";

  try {
    const overview = await apiRequest("/dashboard/overview");
    if (!overview) {
      throw new Error("Empty response received from backend overview endpoint.");
    }

    renderProgressView(overview);
  } catch (err) {
    console.error("Failed to load progress data:", err);
    if (errorBanner && errorMessage) {
      errorMessage.textContent = `Could not load progress: ${err.message || "Please check your network and try again."}`;
      errorBanner.style.display = "flex";
    }
  }
}

function renderProgressView(overview) {
  const user = overview.user || {};
  const activeRoadmap = overview.active_roadmap;
  const latestAssessment = overview.latest_assessment;
  const streak = overview.streak || { streak_days: 0, active_dates: [], active_dates_count: 0 };
  const performance = overview.performance || [];

  // 1. Career and Level
  const career = (activeRoadmap && activeRoadmap.career_path) ||
                 user.career_goal ||
                 localStorage.getItem("careerPath") ||
                 localStorage.getItem("skillpath_career") ||
                 "Web Development";

  const level = (latestAssessment && latestAssessment.skill_level) ||
                localStorage.getItem("skillLevel") ||
                localStorage.getItem("skillpath_level") ||
                "Beginner";

  applyHeaderInfo(career, level);

  // 2. Consistent Progress Metrics (single source of truth from backend progress_summary)
  let summary = overview.progress_summary;

  // Fallback calculation if progress_summary is missing in older responses
  if (!summary) {
    const topics = overview.topics || [];
    const progressRecords = overview.progress || [];

    const progressMap = {};
    progressRecords.forEach((p) => {
      const existing = progressMap[p.topic_id];
      if (!existing) {
        progressMap[p.topic_id] = p;
      } else {
        const isNewDone = (p.status && p.status.toLowerCase() === "completed") || (p.completion_percentage >= 100);
        const isOldDone = (existing.status && existing.status.toLowerCase() === "completed") || (existing.completion_percentage >= 100);
        if (isNewDone || (!isOldDone && (p.completion_percentage || 0) > (existing.completion_percentage || 0))) {
          progressMap[p.topic_id] = p;
        }
      }
    });

    let completed = 0;
    let currentTopicObj = null;

    topics.forEach((t) => {
      const p = progressMap[t.topic_id];
      const pct = p ? (p.completion_percentage || 0) : 0;
      const statusText = t.status || "Not Started";
      const isDone = (statusText.toLowerCase() === "completed") || (pct >= 100) || (p && p.status && p.status.toLowerCase() === "completed");

      if (isDone) {
        completed++;
      } else if (!currentTopicObj) {
        currentTopicObj = {
          topic_id: t.topic_id,
          topic_name: t.topic_name,
          sequence_no: t.sequence_no,
          status: (statusText.toLowerCase() === "in progress" || pct > 0) ? "In Progress" : "Not Started"
        };
      }
    });

    const total = topics.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    summary = {
      completed_topics: completed,
      total_topics: total,
      overall_percentage: pct,
      fraction: `${completed}/${total}`,
      current_topic: currentTopicObj
    };
  }

  // 3. Update Topics Completed Stat Card
  const topicsCompletedValueEl = document.getElementById("statTopicsCompletedValue");
  const topicsCompletedBarEl = document.getElementById("statTopicsCompletedBar");
  const topicsCompletedSubEl = document.getElementById("statTopicsCompletedSub");

  if (topicsCompletedValueEl) {
    topicsCompletedValueEl.textContent = summary.fraction;
  }
  if (topicsCompletedBarEl) {
    topicsCompletedBarEl.style.width = `${summary.overall_percentage}%`;
  }
  if (topicsCompletedSubEl) {
    topicsCompletedSubEl.textContent = `${summary.overall_percentage}% of roadmap completed`;
  }

  // 4. Update Current Topic Stat Card
  const currentTopicNameEl = document.getElementById("statCurrentTopicName");
  const currentTopicStatusEl = document.getElementById("statCurrentTopicStatus");

  if (currentTopicNameEl && currentTopicStatusEl) {
    if (summary.current_topic) {
      currentTopicNameEl.textContent = summary.current_topic.topic_name;
      currentTopicStatusEl.textContent = summary.current_topic.status || "In progress";
      currentTopicStatusEl.style.color = summary.current_topic.status === "In Progress" ? "#3b82f6" : "#888";
    } else if (summary.total_topics > 0 && summary.completed_topics === summary.total_topics) {
      currentTopicNameEl.textContent = "All Topics Completed! 🎉";
      currentTopicStatusEl.textContent = "Roadmap Complete";
      currentTopicStatusEl.style.color = "#22c55e";
    } else {
      currentTopicNameEl.textContent = "No Active Roadmap";
      currentTopicStatusEl.textContent = "Take Assessment to Start";
      currentTopicStatusEl.style.color = "#888";
    }
  }

  // 5. Update Learning Streak Stat Card
  const streakValueEl = document.getElementById("statStreakValue");
  const streakSubEl = document.getElementById("statStreakSub");
  const streakDays = streak.streak_days || 0;

  if (streakValueEl) {
    streakValueEl.textContent = `🔥 ${streakDays} Day${streakDays === 1 ? "" : "s"}`;
  }
  if (streakSubEl) {
    const activeCount = streak.active_dates_count || (streak.active_dates ? streak.active_dates.length : 0);
    streakSubEl.textContent = `${activeCount} active study day${activeCount === 1 ? "" : "s"}`;
  }

  // 6. Update Strengths and Areas to Improve
  renderStrengthsAndAreas(performance);

  // 7. Update This Week's Activity
  renderWeeklyActivity(streak.active_dates || []);

  // 8. Update AI Recommendation
  renderAIRecommendation(summary, performance, career);

  // 9. Update Placement Readiness (Placement Tab)
  const placementFill = document.getElementById("placementFill");
  const placementText = document.getElementById("placementText");
  const placementSub = document.getElementById("placementSub");

  if (placementFill) {
    placementFill.style.width = `${summary.overall_percentage}%`;
  }
  if (placementText) {
    placementText.textContent = `${summary.overall_percentage}% ready`;
  }
  if (placementSub) {
    if (summary.overall_percentage >= 100) {
      placementSub.textContent = "Congratulations! You have completed all curriculum milestones and are placement-ready.";
    } else if (summary.overall_percentage >= 50) {
      placementSub.textContent = "Great progress! Continue completing topic quizzes and projects to reach full placement readiness.";
    } else {
      placementSub.textContent = "Complete more roadmap milestones and practice tests to unlock advanced placement preparation.";
    }
  }
}

function renderStrengthsAndAreas(performance) {
  const strengthsList = document.getElementById("strengthsList");
  const improveList = document.getElementById("improveList");

  if (!strengthsList || !improveList) return;

  const strengths = [];
  const needsImprovement = [];

  if (Array.isArray(performance)) {
    performance.forEach((item) => {
      const topicLabel = `Topic #${item.topic_id}`;
      if (item.performance_level === "Good" || item.average_percentage >= 75) {
        strengths.push(`${topicLabel} (${item.average_percentage}%)`);
      } else {
        needsImprovement.push(`${topicLabel} (${item.average_percentage}%)`);
      }
    });
  }

  if (strengths.length > 0) {
    strengthsList.innerHTML = strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  } else {
    strengthsList.innerHTML = `
      <li style="color: #888;">Complete topic quizzes with 75%+ score to identify strengths.</li>
    `;
  }

  if (needsImprovement.length > 0) {
    improveList.innerHTML = needsImprovement.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  } else if (strengths.length > 0) {
    improveList.innerHTML = `
      <li style="color: #22c55e;">No weak areas detected! Excellent work on your quizzes.</li>
    `;
  } else {
    improveList.innerHTML = `
      <li style="color: #888;">Topics needing extra practice will appear as you take quizzes.</li>
    `;
  }
}

function renderWeeklyActivity(activeDates) {
  const weekRow = document.getElementById("weekRow");
  if (!weekRow) return;

  const activeSet = new Set(activeDates);
  const now = new Date();
  // Monday of current week
  const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayOfWeek);
  monday.setHours(0, 0, 0, 0);

  const dayElements = weekRow.querySelectorAll(".day");
  dayElements.forEach((dayEl, index) => {
    const dot = dayEl.querySelector(".day-dot");
    if (!dot) return;

    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + index);
    const isoDateString = targetDate.toISOString().split("T")[0];

    if (activeSet.has(isoDateString)) {
      dot.classList.add("on");
      dot.setAttribute("title", `Active learning on ${isoDateString}`);
    } else {
      dot.classList.remove("on");
    }
  });
}

function renderAIRecommendation(summary, performance, career) {
  const recEl = document.getElementById("aiRecText");
  if (!recEl) return;

  // 1. Check if any topic requires practice
  const topicNeedingPractice = Array.isArray(performance) ? performance.find((p) => p.needs_practice) : null;

  if (topicNeedingPractice) {
    recEl.textContent = `Based on your recent quiz scores, spend time reviewing Topic #${topicNeedingPractice.topic_id} before advancing to subsequent chapters.`;
  } else if (summary.current_topic) {
    recEl.textContent = `Continue advancing your roadmap: focus on '${summary.current_topic.topic_name}' to maintain your learning momentum in ${career}.`;
  } else if (summary.total_topics > 0 && summary.completed_topics === summary.total_topics) {
    recEl.textContent = `You've completed all topics in your ${career} roadmap! We recommend starting mock interviews or working on full-stack capstone projects.`;
  } else {
    recEl.textContent = `Start by exploring your curriculum and completing your first assessment to receive tailored recommendations.`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===== UI INTERACTIVITY =====

// Tab switcher
const tabBtns = document.querySelectorAll(".tab-switcher-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const target = document.getElementById(btn.getAttribute("data-tab"));
    if (target) target.classList.add("active");
  });
});

// Retry button
const retryBtn = document.getElementById("progressRetryBtn");
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    loadProgressData();
  });
}

// Mobile sidebar toggle
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.querySelector(".nav-menu");
if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("show");
  });
}

// User Profile dropdown and logout
const userProfileEl = document.getElementById("userProfile");
const profileDropdownMenuEl = document.getElementById("profileDropdownMenu");
const logoutBtnEl = document.getElementById("logoutBtn");

if (userProfileEl && profileDropdownMenuEl) {
  userProfileEl.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdownMenuEl.style.display = profileDropdownMenuEl.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (e) => {
    if (!userProfileEl.contains(e.target)) {
      profileDropdownMenuEl.style.display = "none";
    }
  });
}

if (logoutBtnEl) {
  logoutBtnEl.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = "index.html";
  });
}
