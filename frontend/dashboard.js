import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { syncUserWithBackend, apiRequest } from "./api.js";

// Firebase configuration (SkillPathAI Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyCQ9YRQV9edVS0D-Lb6ORl9HX6E0oL4ECQ",
  authDomain: "skillpathai-2e1c7.firebaseapp.com",
  projectId: "skillpathai-2e1c7",
  storageBucket: "skillpathai-2e1c7.firebasestorage.app",
  messagingSenderId: "41899784962",
  appId: "1:41899784962:web:1fe188cfca7f6fa7d201b"
};

// Safe Firebase initialization: reuse existing instance if already initialized
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Auth guard & dynamic user profile population
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // If no user is signed in, redirect to login page
    window.location.href = "index.html";
    return;
  }

  // Display user name if available; otherwise display the email portion before the @ symbol
  let displayName = user.displayName;
  if (!displayName && user.email) {
    displayName = user.email.split("@")[0];
  }
  displayName = displayName || "Learner";

  const userNameEl = document.getElementById("userName");
  const welcomeHeadingEl = document.getElementById("welcomeHeading");

  if (userNameEl) {
    userNameEl.textContent = displayName;
  }
  if (welcomeHeadingEl) {
    welcomeHeadingEl.textContent = "Welcome back, " + displayName + "! 👋";
  }

  // Update dropdown user info
  const dropdownUserNameEl = document.getElementById("dropdownUserName");
  const dropdownUserEmailEl = document.getElementById("dropdownUserEmail");
  if (dropdownUserNameEl) {
    dropdownUserNameEl.textContent = displayName;
  }
  if (dropdownUserEmailEl && user.email) {
    dropdownUserEmailEl.textContent = user.email;
  }

  // Populate career path & skill level from localStorage as immediate placeholders
  const savedCareer = localStorage.getItem("careerPath") || localStorage.getItem("skillpath_career") || "Web Development";
  const savedLevel = localStorage.getItem("skillLevel") || localStorage.getItem("skillpath_level") || "Intermediate";

  applyCareerAndLevel(savedCareer, savedLevel);

  // Load real data from MySQL backend via syncUserWithBackend and apiRequest
  try {
    await loadUserDashboardData(user);
  } catch (err) {
    console.error("Failed to load dashboard data from backend:", err);
  }
});

function applyCareerAndLevel(career, level) {
  const careerPill = document.querySelector(".status-pill strong");
  const myCareerTitle = document.getElementById("myCareerTitle");
  if (careerPill && career) careerPill.textContent = career;
  if (myCareerTitle && career) myCareerTitle.textContent = career;

  const pills = document.querySelectorAll(".status-pill strong");
  if (pills.length > 1 && level) pills[1].textContent = level;
  const myCareerLevel = document.getElementById("myCareerLevel");
  if (myCareerLevel && level) myCareerLevel.textContent = `📶 Level: ${level}`;

  const roadmapSectionTitle = document.getElementById("roadmapSectionTitle");
  if (roadmapSectionTitle && career) {
    roadmapSectionTitle.textContent = `Your Personalized Roadmap (${career})`;
  }

  const todayGoalTags = document.getElementById("todayGoalTags");
  if (todayGoalTags) {
    todayGoalTags.textContent = `${career || "Web Development"} • ${level || "Intermediate"}`;
  }
}

/**
 * Loads authentic user records from MySQL:
 * 1. Synchronizes user with backend (POST /users/sync)
 * 2. Fetches assessments (GET /assessments/{user_id})
 * 3. Fetches roadmaps (GET /roadmaps/{user_id})
 * 4. Fetches topics & progress if roadmap exists, or creates default/AI roadmap if needed
 */
async function loadUserDashboardData(firebaseUser) {
  // Attempt to fetch everything in a single, high-performance aggregate request
  try {
    const overview = await apiRequest("/dashboard/overview");
    if (overview && overview.user) {
      const dbUser = overview.user;
      const userId = dbUser.user_id;

      const latestAssessment = overview.latest_assessment;
      if (latestAssessment && latestAssessment.skill_level) {
        localStorage.setItem("skillLevel", latestAssessment.skill_level);
        localStorage.setItem("skillpath_level", latestAssessment.skill_level);
      }

      let activeRoadmap = overview.active_roadmap;
      const career = (activeRoadmap && activeRoadmap.career_path) ||
                     localStorage.getItem("careerPath") ||
                     localStorage.getItem("skillpath_career") ||
                     (dbUser.career_goal && dbUser.career_goal !== "Not Set" ? dbUser.career_goal : null);

      const level = (latestAssessment && latestAssessment.skill_level) ||
                    localStorage.getItem("skillLevel") ||
                    localStorage.getItem("skillpath_level") ||
                    "Beginner";

      if (career) {
        applyCareerAndLevel(career, level);
      }

      let topics = overview.topics || [];
      const progressRecords = overview.progress || [];
      const quizResults = overview.quiz_results || [];
      const performanceData = overview.performance || [];
      const streakData = overview.streak || { streak_days: 0, completed_projects: 0, week_completed_topics: 0 };

      renderStreakAndProjectMetrics(streakData);

      if (!activeRoadmap && career && career !== "Not Set") {
        try {
          const created = await apiRequest("/roadmaps", {
            method: "POST",
            body: JSON.stringify({ user_id: userId, career_path: career })
          });
          if (created && created.roadmap_id) {
            activeRoadmap = { roadmap_id: created.roadmap_id, user_id: userId, career_path: career };
          }
        } catch (e) {
          console.warn("Could not create roadmap:", e);
        }
      }

      if (!activeRoadmap) {
        renderEmptyRoadmapState();
        return;
      }

      renderDashboardRoadmap(topics, progressRecords, activeRoadmap, level);
      await renderQuizPerformanceMetrics(topics, quizResults, performanceData);
      return;
    }
  } catch (overviewErr) {
    console.warn("Single-trip overview endpoint unavailable or falling back:", overviewErr);
  }

  // Graceful fallback with parallel fetching
  const dbUser = await syncUserWithBackend();
  if (!dbUser || !dbUser.user_id) {
    console.warn("Could not sync user with backend.");
    return;
  }

  const userId = dbUser.user_id;

  // Execute roadmap and assessment queries in parallel
  const [assessmentRes, roadmapRes] = await Promise.allSettled([
    apiRequest(`/assessments/${userId}`),
    apiRequest(`/roadmaps/${userId}`)
  ]);

  const latestAssessment = (assessmentRes.status === "fulfilled" && assessmentRes.value && assessmentRes.value.length > 0)
    ? assessmentRes.value[0] : null;

  if (latestAssessment && latestAssessment.skill_level) {
    localStorage.setItem("skillLevel", latestAssessment.skill_level);
    localStorage.setItem("skillpath_level", latestAssessment.skill_level);
  }

  let activeRoadmap = (roadmapRes.status === "fulfilled" && roadmapRes.value && roadmapRes.value.length > 0)
    ? roadmapRes.value[0] : null;

  const career = (activeRoadmap && activeRoadmap.career_path) ||
                 localStorage.getItem("careerPath") ||
                 localStorage.getItem("skillpath_career") ||
                 (dbUser.career_goal && dbUser.career_goal !== "Not Set" ? dbUser.career_goal : null);

  const level = (latestAssessment && latestAssessment.skill_level) ||
                localStorage.getItem("skillLevel") ||
                localStorage.getItem("skillpath_level") ||
                "Beginner";

  if (career) {
    applyCareerAndLevel(career, level);
  }

  if (!activeRoadmap) {
    renderEmptyRoadmapState();
    return;
  }

  // Parallel fetch remaining dependencies
  const [topicsRes, progressRes, quizRes, perfRes, streakRes] = await Promise.allSettled([
    apiRequest(`/topics/${activeRoadmap.roadmap_id}`),
    apiRequest(`/progress/${userId}`),
    apiRequest(`/quiz-results/${userId}`),
    apiRequest(`/performance/${userId}`),
    apiRequest(`/analytics/streak/${userId}`)
  ]);

  const topics = topicsRes.status === "fulfilled" ? (topicsRes.value || []) : [];
  const progressRecords = progressRes.status === "fulfilled" ? (progressRes.value || []) : [];
  const quizResults = quizRes.status === "fulfilled" ? (quizRes.value || []) : [];
  const performanceData = (perfRes.status === "fulfilled" && perfRes.value && Array.isArray(perfRes.value.performance))
    ? perfRes.value.performance : [];
  const streakData = streakRes.status === "fulfilled" ? streakRes.value : { streak_days: 0, completed_projects: 0, week_completed_topics: 0 };

  renderStreakAndProjectMetrics(streakData);
  renderDashboardRoadmap(topics, progressRecords, activeRoadmap, level);
  await renderQuizPerformanceMetrics(topics, quizResults, performanceData);
}

function renderStreakAndProjectMetrics(streakData) {
  const streakDays = (streakData && typeof streakData.streak_days === "number") ? streakData.streak_days : 0;
  const completedProjects = (streakData && typeof streakData.completed_projects === "number") ? streakData.completed_projects : 0;
  const weekCompleted = (streakData && typeof streakData.week_completed_topics === "number") ? streakData.week_completed_topics : 0;

  const statDaysEl = document.getElementById("statDaysStreak");
  if (statDaysEl) statDaysEl.textContent = streakDays;

  const rightPanelStreakEl = document.getElementById("rightPanelStreak");
  if (rightPanelStreakEl) rightPanelStreakEl.textContent = `🔥 ${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`;

  const statProjectsEl = document.getElementById("statCompletedProjects");
  if (statProjectsEl) statProjectsEl.textContent = completedProjects;

  const bottomWeekEl = document.getElementById("bottomBannerWeekTopics");
  if (bottomWeekEl) bottomWeekEl.textContent = `${weekCompleted} Topics`;

  const streakDotsContainer = document.getElementById("statStreakDots");
  if (streakDotsContainer) {
    // Generate 7 dots representing up to 7 consecutive days in streak
    let dotsHtml = "";
    for (let i = 1; i <= 7; i++) {
      const isFilled = i <= streakDays;
      dotsHtml += `<span class="streak-dot ${isFilled ? 'filled' : ''}"></span>`;
    }
    streakDotsContainer.innerHTML = dotsHtml;
  }
}

async function renderQuizPerformanceMetrics(topics, quizResults, performanceData) {
  // Update quizzes taken count in right panel
  const quizCountEl = document.getElementById("rightPanelQuizAttempts");
  if (quizCountEl) {
    quizCountEl.textContent = Array.isArray(quizResults) ? quizResults.length : 0;
  }

  const recTextEl = document.getElementById("dashboardAiRecommendation");
  const recLinkEl = document.getElementById("dashboardAiRecLink");
  if (!recTextEl) return;

  // Build topic name lookup map from currently active roadmap topics
  const topicMap = {};
  if (Array.isArray(topics)) {
    topics.forEach((t) => {
      topicMap[t.topic_id] = t;
    });
  }

  // Check if any topic needs practice
  let topicNeedingPractice = null;
  if (Array.isArray(performanceData)) {
    for (const item of performanceData) {
      if (item.needs_practice) {
        if (topicMap[item.topic_id]) {
          topicNeedingPractice = topicMap[item.topic_id];
        } else {
          // Topic ID was not in the active roadmap (e.g. from an earlier roadmap or different set)
          // Fetch exact topic name from backend safely
          let fetchedTopic = null;
          try {
            fetchedTopic = await apiRequest(`/topics/by-id/${item.topic_id}`);
          } catch (e) {
            console.warn("Could not fetch topic name by ID:", item.topic_id, e);
          }
          topicNeedingPractice = fetchedTopic || { topic_id: item.topic_id, topic_name: `Topic #${item.topic_id}` };
        }
        break;
      }
    }
  }

  if (topicNeedingPractice) {
    recTextEl.textContent = `Based on your recent quiz performance, we recommend practicing '${topicNeedingPractice.topic_name}' to strengthen your core concepts.`;
    if (recLinkEl) {
      recLinkEl.href = `practice.html?topic_id=${topicNeedingPractice.topic_id}&topic_name=${encodeURIComponent(topicNeedingPractice.topic_name)}`;
      recLinkEl.textContent = `Practice ${topicNeedingPractice.topic_name} →`;
    }
  } else if (Array.isArray(quizResults) && quizResults.length > 0) {
    // Has taken quizzes and is performing well
    recTextEl.textContent = `Great performance on your recent quizzes! Continue advancing through your roadmap to maintain momentum.`;
    if (recLinkEl) {
      recLinkEl.href = "roadmap.html";
      recLinkEl.textContent = "View Roadmap →";
    }
  } else {
    // Useful empty state: no quizzes taken yet
    recTextEl.textContent = `Ready to test your knowledge? Take your first topic quiz to receive personalized practice recommendations.`;
    if (recLinkEl) {
      const firstTopic = (Array.isArray(topics) && topics.length > 0) ? topics[0] : null;
      if (firstTopic) {
        recLinkEl.href = `practice.html?topic_id=${firstTopic.topic_id}&topic_name=${encodeURIComponent(firstTopic.topic_name)}`;
        recLinkEl.textContent = `Take ${firstTopic.topic_name} Quiz →`;
      } else {
        recLinkEl.href = "practice.html";
        recLinkEl.textContent = "Start Quiz →";
      }
    }
  }
}

function renderEmptyRoadmapState() {
  const container = document.getElementById("dashboardRoadmapItems");
  const todayGoalTitle = document.getElementById("todayGoalTitle");
  if (todayGoalTitle) {
    todayGoalTitle.textContent = "Start by Choosing a Career Path";
  }

  if (container) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; background: #fff; border-radius: 12px; border: 1px dashed #d1d5db;">
        <h3 style="margin-bottom: 8px; color: #1e1b4b;">No Learning Roadmap Found</h3>
        <p style="color: #6b7280; margin-bottom: 20px; font-size: 14px;">Take our quick assessment to personalize your career roadmap and curriculum.</p>
        <a href="asses.html" class="btn-primary" style="display: inline-block; padding: 10px 22px; background: linear-gradient(to right, #4F63D2, #7c93f5); color: white; border-radius: 8px; font-weight: bold; text-decoration: none;">Take Skill Assessment →</a>
      </div>
    `;
  }

  updateStatMetrics(0, 0, 0);
  renderStreakAndProjectMetrics({ streak_days: 0, completed_projects: 0, week_completed_topics: 0 });
}

function updateStatMetrics(completed, total, overallPercent) {
  const statCompleted = document.getElementById("statCompletedTopics");
  const statFraction = document.getElementById("statTopicsFraction");
  const statFill = document.getElementById("statTopicsProgressFill");
  const statOverall = document.getElementById("statOverallProgress");

  const rightPanelPercent = document.getElementById("rightPanelPercent");
  const rightPanelTotal = document.getElementById("rightPanelTotalTopics");
  const rightPanelCompleted = document.getElementById("rightPanelCompletedTopics");

  if (statCompleted) statCompleted.textContent = completed;
  if (statFraction) statFraction.textContent = `${completed}/${total}`;
  if (statFill) statFill.style.width = `${total > 0 ? Math.round((completed / total) * 100) : 0}%`;
  if (statOverall) statOverall.textContent = `${overallPercent}%`;

  if (rightPanelPercent) rightPanelPercent.textContent = `${overallPercent}%`;
  if (rightPanelTotal) rightPanelTotal.textContent = total;
  if (rightPanelCompleted) rightPanelCompleted.textContent = completed;
}

function renderDashboardRoadmap(topics, progressRecords, roadmap, level) {
  const container = document.getElementById("dashboardRoadmapItems");
  const phaseTimeline = document.getElementById("dashboardPhaseTimeline");

  if (!topics || topics.length === 0) {
    renderEmptyRoadmapState();
    return;
  }

  // Build progress lookup map by topic_id (taking highest completion / completed status if multiple)
  const progressMap = {};
  if (Array.isArray(progressRecords)) {
    progressRecords.forEach((p) => {
      const existing = progressMap[p.topic_id];
      if (!existing) {
        progressMap[p.topic_id] = p;
      } else {
        const isNewDone = (p.status && p.status.toLowerCase() === "completed") || p.completion_percentage >= 100;
        const isOldDone = (existing.status && existing.status.toLowerCase() === "completed") || existing.completion_percentage >= 100;
        if (isNewDone || (!isOldDone && (p.completion_percentage || 0) > (existing.completion_percentage || 0))) {
          progressMap[p.topic_id] = p;
        }
      }
    });
  }

  let completedCount = 0;
  const icons = ["📘", "🧩", "🌳", "🔁", "🎯", "⚡", "🚀", "💡"];

  // Render phase timeline
  if (phaseTimeline) {
    phaseTimeline.innerHTML = topics.map((t, idx) => {
      const p = progressMap[t.topic_id];
      const isDone = (t.status && t.status.toLowerCase() === "completed") ||
                     (p && (p.completion_percentage === 100 || p.status === "Completed"));
      const isCurrent = !isDone && (idx === 0 || (t.status && t.status.toLowerCase() === "in progress"));

      const phaseClass = isDone ? "completed" : (isCurrent ? "in-progress" : "upcoming");
      const phaseMarker = isDone ? "✓" : "●";

      return `
        <div class="phase-item ${phaseClass}">
          <span class="phase-marker">${phaseMarker}</span>
          <div class="phase-label">
            <p class="phase-name">Topic ${idx + 1}</p>
            <p class="phase-duration">${t.topic_name.length > 15 ? t.topic_name.substring(0, 15) + '...' : t.topic_name}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  // Render roadmap cards
  if (container) {
    let html = "";
    let firstIncompleteTopic = null;

    topics.forEach((topic, idx) => {
      const p = progressMap[topic.topic_id];
      let percent = p ? (p.completion_percentage || 0) : 0;
      let statusText = topic.status || "Not Started";
      const isTopicCompleted = (statusText.toLowerCase() === "completed") ||
                               (percent >= 100) ||
                               (p && p.status && p.status.toLowerCase() === "completed");

      if (isTopicCompleted) {
        percent = 100;
        statusText = "Completed";
        completedCount++;
      } else if (statusText.toLowerCase() === "in progress" || percent > 0) {
        statusText = "In Progress";
        // Use authentic progress percentage from database; do not invent arbitrary numbers
        if (!firstIncompleteTopic) firstIncompleteTopic = topic;
      } else {
        statusText = "Upcoming";
        percent = 0;
        if (!firstIncompleteTopic) firstIncompleteTopic = topic;
      }

      const badgeClass = statusText === "Completed" ? "completed" :
                         (statusText === "In Progress" ? "in-progress" : "upcoming");

      const icon = icons[idx % icons.length];

      html += `
        <div class="roadmap-item" onclick="window.location.href='roadmap.html'" style="cursor: pointer;">
          <span class="item-icon icon-${(idx % 5) + 1}">${icon}</span>
          <div class="item-info">
            <h3>${topic.sequence_no}. ${topic.topic_name}</h3>
            <p>Phase ${idx + 1} curriculum for ${roadmap.career_path || "SkillPath"}</p>
          </div>
          <div class="item-status">
            <span class="status-badge ${badgeClass}">${statusText}</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>
            <span class="progress-percent">${percent}%</span>
          </div>
          <span class="expand-arrow">⌄</span>
        </div>
      `;
    });

    container.innerHTML = html;

    // Update today's learning goal with the current active topic
    const todayGoalTitle = document.getElementById("todayGoalTitle");
    if (todayGoalTitle) {
      if (firstIncompleteTopic) {
        todayGoalTitle.textContent = firstIncompleteTopic.topic_name;
      } else if (topics.length > 0) {
        todayGoalTitle.textContent = "Roadmap Completed! 🎉";
      }
    }
  }

  const overallPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  updateStatMetrics(completedCount, topics.length, overallPercent);
}

// ===== PRESERVED DASHBOARD FUNCTIONALITY =====

// ===== ROADMAP TABS (Overview / Phase View / Skill View) =====
const tabs = document.querySelectorAll(".tab");

tabs.forEach(function(tab) {
  tab.addEventListener("click", function(event) {
    event.preventDefault();

    tabs.forEach(function(t) {
      t.classList.remove("active");
    });
    tab.classList.add("active");
  });
});


// ===== SIDEBAR MENU TOGGLE =====
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.querySelector(".nav-menu");

if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", function() {
    navMenu.classList.toggle("show");
  });
}

// ===== PROFILE DROPDOWN & LOGOUT HANDLERS =====
const userProfileEl = document.getElementById("userProfile");
const profileDropdownMenuEl = document.getElementById("profileDropdownMenu");
const logoutBtnEl = document.getElementById("logoutBtn");

if (userProfileEl && profileDropdownMenuEl) {
  function closeDropdown() {
    profileDropdownMenuEl.classList.remove("show");
    profileDropdownMenuEl.style.display = "none";
    userProfileEl.classList.remove("active");
    userProfileEl.setAttribute("aria-expanded", "false");
  }

  function openDropdown() {
    profileDropdownMenuEl.classList.add("show");
    profileDropdownMenuEl.style.display = "block";
    userProfileEl.classList.add("active");
    userProfileEl.setAttribute("aria-expanded", "true");
  }

  userProfileEl.addEventListener("click", function(event) {
    event.stopPropagation();
    const isOpen = profileDropdownMenuEl.style.display === "block" || profileDropdownMenuEl.classList.contains("show");
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Close menu when clicking outside
  document.addEventListener("click", function(event) {
    if (!userProfileEl.classList.contains("show") && profileDropdownMenuEl.style.display === "none") return;
    if (!userProfileEl.contains(event.target)) {
      closeDropdown();
    }
  });

  // Close menu on Escape key
  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      closeDropdown();
    }
  });
}

if (logoutBtnEl) {
  logoutBtnEl.addEventListener("click", async function(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to log out. Please try again.");
    }
  });
}

// ===== AI CHAT MODAL INTERACTION =====
const openChatBtn = document.getElementById("openChatBtn");
const chatModalBackdrop = document.getElementById("aiChatModalBackdrop");
const closeChatBtn = document.getElementById("closeChatBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInputForm = document.getElementById("chatInputForm");
const chatInputField = document.getElementById("chatInputField");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatQuickSuggestions = document.getElementById("chatQuickSuggestions");
const quickQuestionButtons = document.querySelectorAll(".quick-question-btn");

function openChatModal(initialQuery = "") {
  if (chatModalBackdrop) {
    chatModalBackdrop.style.display = "flex";
  }
  if (initialQuery && chatInputField) {
    chatInputField.value = initialQuery;
    handleSendMessage(initialQuery);
  } else if (chatInputField) {
    setTimeout(() => chatInputField.focus(), 100);
  }
}

function closeChatModal() {
  if (chatModalBackdrop) {
    chatModalBackdrop.style.display = "none";
  }
}

if (openChatBtn) {
  openChatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openChatModal();
  });
}

if (closeChatBtn) {
  closeChatBtn.addEventListener("click", () => {
    closeChatModal();
  });
}

if (chatModalBackdrop) {
  chatModalBackdrop.addEventListener("click", (e) => {
    if (e.target === chatModalBackdrop) {
      closeChatModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatModalBackdrop.style.display !== "none") {
      closeChatModal();
    }
  });
}

// Wire quick question buttons on the dashboard card
quickQuestionButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const query = btn.textContent.trim();
    openChatModal(query);
  });
});

// Wire in-modal suggestion chips
if (chatQuickSuggestions) {
  chatQuickSuggestions.querySelectorAll(".chat-suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const query = chip.textContent.trim();
      handleSendMessage(query);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, (tag) => {
    switch (tag) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case "'": return '&#39;';
      case '"': return '&quot;';
      default: return tag;
    }
  });
}

function formatInlineStyles(str) {
  let s = escapeHtml(str);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

function renderSafeMarkdown(text) {
  if (!text) return '';
  const codeBlocks = [];
  let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push('<pre class="chat-code-block"><code class="language-' + escapeHtml(lang || 'plaintext') + '">' + escapeHtml(code.trim()) + '</code></pre>');
    return '___CODE_BLOCK_' + idx + '___';
  });

  const lines = formatted.split('\n');
  const processedLines = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^###\s+(.*)/.test(line)) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      const content = line.replace(/^###\s+/, '');
      processedLines.push('<h4 class="chat-heading-3">' + formatInlineStyles(content) + '</h4>');
      continue;
    }
    if (/^##\s+(.*)/.test(line)) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      const content = line.replace(/^##\s+/, '');
      processedLines.push('<h3 class="chat-heading-2">' + formatInlineStyles(content) + '</h3>');
      continue;
    }
    if (/^#\s+(.*)/.test(line)) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      const content = line.replace(/^#\s+/, '');
      processedLines.push('<h2 class="chat-heading-1">' + formatInlineStyles(content) + '</h2>');
      continue;
    }

    if (/^(\*|-)\s+(.*)/.test(line)) {
      if (!inList) { processedLines.push('<ul class="chat-list">'); inList = true; }
      const item = line.replace(/^(\*|-)\s+/, '');
      processedLines.push('<li>' + formatInlineStyles(item) + '</li>');
      continue;
    } else {
      if (inList) { processedLines.push('</ul>'); inList = false; }
    }

    if (line.trim().startsWith('___CODE_BLOCK_')) {
      processedLines.push(line);
      continue;
    }

    if (line.trim()) {
      let processed = formatInlineStyles(line);
      processed = processed.replace(/`([^`\n]+)`/g, (m, c) => '<code class="chat-inline-code">' + c + '</code>');
      processedLines.push('<p class="chat-paragraph">' + processed + '</p>');
    }
  }
  if (inList) processedLines.push('</ul>');

  let result = processedLines.join('');
  result = result.replace(/___CODE_BLOCK_(\d+)___/g, (m, id) => codeBlocks[Number(id)]);
  return result;
}

function appendChatMessage(text, sender = "ai", isHtml = false) {
  if (!chatMessages) return null;
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  if (isHtml) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

async function handleSendMessage(queryText) {
  const query = (queryText || (chatInputField ? chatInputField.value : "")).trim();
  if (!query) return;

  if (chatInputField) chatInputField.value = "";
  if (chatSendBtn) chatSendBtn.disabled = true;

  // Append user bubble
  appendChatMessage(query, "user");

  // Append animated loading bubble
  const loadingBubble = appendChatMessage(
    '<div class="chat-loading-dots"><span></span><span></span><span></span></div>',
    "ai",
    true
  );

  const currentLevel = localStorage.getItem("skillLevel") || localStorage.getItem("skillpath_level") || "Intermediate";

  try {
    const data = await apiRequest("/explain-topic", {
      method: "POST",
      body: JSON.stringify({
        topic_name: query,
        skill_level: currentLevel
      })
    });

    if (loadingBubble && loadingBubble.parentNode) {
      loadingBubble.remove();
    }

    if (data && data.explanation) {
      const formattedHtml = renderSafeMarkdown(data.explanation);
      appendChatMessage(formattedHtml, "ai", true);
    } else {
      appendChatMessage("I received your question but couldn't generate an explanation right now. Please try again.", "ai");
    }
  } catch (err) {
    if (loadingBubble && loadingBubble.parentNode) {
      loadingBubble.remove();
    }
    console.error("AI chat error:", err);

    let errorMsg = "Sorry, our AI assistant is experiencing high traffic right now. Please try again in a moment.";
    if (err.message && (err.message.includes("timed out") || err.message.includes("504"))) {
      errorMsg = "The AI request timed out. The upstream model took too long to respond.";
    } else if (err.message && err.message.includes("503")) {
      errorMsg = "The AI service is temporarily busy (503). Please wait a few seconds and tap retry.";
    }

    const errBubble = appendChatMessage(
      `<span>${escapeHtml(errorMsg)}</span> <button type="button" style="margin-left:8px; background:none; border:none; color:#7c5cff; font-weight:bold; cursor:pointer; text-decoration:underline;">Retry</button>`,
      "error",
      true
    );

    const retryBtn = errBubble.querySelector("button");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        errBubble.remove();
        handleSendMessage(query);
      });
    }
  } finally {
    if (chatSendBtn) chatSendBtn.disabled = false;
    if (chatInputField) chatInputField.focus();
  }
}

if (chatInputForm) {
  chatInputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage();
  });
}

