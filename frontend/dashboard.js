import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth, syncUserWithBackend, apiRequest } from "./api.js";

// Display name resolver with graceful fallbacks
export function getResolvedDisplayName(firebaseUser, dbUser) {
  if (firebaseUser && typeof firebaseUser.displayName === "string" && firebaseUser.displayName.trim()) {
    return firebaseUser.displayName.trim();
  }
  if (dbUser && typeof dbUser.name === "string" && dbUser.name.trim() && dbUser.name.trim().toLowerCase() !== "user") {
    return dbUser.name.trim();
  }
  if (firebaseUser && typeof firebaseUser.email === "string" && firebaseUser.email.includes("@")) {
    const prefix = firebaseUser.email.split("@")[0].trim();
    if (prefix) return prefix;
  }
  return "Learner";
}

// Authoritative first-time user check based on registration transaction flag
export function isAuthoritativeFirstTimeUser(user) {
  if (!user || !user.uid) return false;
  const uid = user.uid;

  const sessionFlag = sessionStorage.getItem(`skillpath_first_login_${uid}`);
  const localFlag = localStorage.getItem(`skillpath_first_login_${uid}`);
  if (sessionFlag === "true" || localFlag === "true") {
    return true;
  }

  // If returning flag is explicitly set or missing, do NOT treat missing localStorage as proof of a new user
  return false;
}

// Consumes the first-time flag only after the dashboard greeting has been displayed
export function consumeFirstTimeUserFlag(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(`skillpath_first_login_${uid}`);
    sessionStorage.removeItem(`skillpath_first_login_${uid}`);
    localStorage.setItem(`skillpath_is_returning_${uid}`, "true");
  } catch (e) {
    console.warn("Could not consume first-time user flag:", e);
  }
}

// Dashboard greeting manager ensuring all 3 cases and neutral fallback
export function updateDashboardGreeting(firebaseUser, dbUser, activityState) {
  const welcomeHeadingEl = document.getElementById("welcomeHeading");
  if (!welcomeHeadingEl) return;

  const displayName = getResolvedDisplayName(firebaseUser, dbUser);

  // Update navbar/profile display names
  const userNameEl = document.getElementById("userName");
  const dropdownUserNameEl = document.getElementById("dropdownUserName");
  if (userNameEl) userNameEl.textContent = displayName;
  if (dropdownUserNameEl) dropdownUserNameEl.textContent = displayName;

  // Case 1: First-time user on their first login
  if (activityState && activityState.isFirstTime) {
    welcomeHeadingEl.textContent = `Welcome to SkillPathAI, ${displayName}! 👋`;
    consumeFirstTimeUserFlag(firebaseUser?.uid);
    return;
  }

  // Requirement 4: Do not infer zero activity from failed, timed-out, or incomplete backend requests!
  // Keep the neutral "Welcome back, [Name]! 👋" greeting until valid data is available.
  if (!activityState || !activityState.hasValidData) {
    welcomeHeadingEl.textContent = `Welcome back, ${displayName}! 👋`;
    return;
  }

  // Case 3: Returning user who has completed activities
  if (activityState.hasCompletedActivities) {
    welcomeHeadingEl.textContent = `Welcome back, ${displayName}! You're making progress—keep it up! 🚀`;
    return;
  }

  // Case 2: Returning user with an incomplete roadmap (0 completed activities)
  welcomeHeadingEl.textContent = `Welcome back, ${displayName}! Ready to continue learning?`;
}

// Auth guard & dynamic user profile population
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // If no user is signed in, redirect to login page
    window.location.href = "login.html";
    return;
  }

  const isFirstTime = isAuthoritativeFirstTimeUser(user);
  const displayName = getResolvedDisplayName(user, null);

  const userNameEl = document.getElementById("userName");
  const welcomeHeadingEl = document.getElementById("welcomeHeading");

  if (userNameEl) {
    userNameEl.textContent = displayName;
  }
  if (welcomeHeadingEl) {
    if (isFirstTime) {
      // Preliminary first-time greeting while dashboard data loads;
      // flag is consumed in updateDashboardGreeting after dashboard greeting is rendered.
      welcomeHeadingEl.textContent = `Welcome to SkillPathAI, ${displayName}! 👋`;
    } else {
      // Safe initial neutral greeting while backend data loads
      welcomeHeadingEl.textContent = `Welcome back, ${displayName}! 👋`;
    }
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

  // Apply saved avatar
  const userAvatar = user.photoURL || localStorage.getItem("skillpath_user_avatar");
  if (userAvatar) {
    document.querySelectorAll(".user-avatar").forEach(img => {
      img.src = userAvatar;
    });
    localStorage.setItem("skillpath_user_avatar", userAvatar);
  }

  // Populate career path & skill level from localStorage as immediate placeholders
  const savedCareer = localStorage.getItem("careerPath") || localStorage.getItem("skillpath_career") || "Web Development";
  const savedLevel = localStorage.getItem("skillLevel") || localStorage.getItem("skillpath_level") || "Intermediate";

  applyCareerAndLevel(savedCareer, savedLevel);

  // Load real data from MySQL backend via syncUserWithBackend and apiRequest
  try {
    await loadUserDashboardData(user, isFirstTime);
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
async function loadUserDashboardData(firebaseUser, isFirstTime = false) {
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

      renderStreakAndProjectMetrics(streakData, quizResults);

      // Evaluate authentic user activity for dashboard greeting with strict field validation
      if (!isFirstTime) {
        const hasValidSummary = overview.progress_summary &&
          typeof overview.progress_summary === "object" &&
          typeof overview.progress_summary.completed_topics === "number" &&
          !isNaN(overview.progress_summary.completed_topics);
        const hasValidProgressList = Array.isArray(overview.progress);
        const hasValidQuizList = Array.isArray(overview.quiz_results);

        const hasValidActivityData = (hasValidSummary || hasValidProgressList) && hasValidQuizList;

        if (hasValidActivityData) {
          const completedTopics = hasValidSummary
            ? overview.progress_summary.completed_topics
            : overview.progress.filter(p => (p.status && p.status.toLowerCase() === "completed") || (p.completion_percentage && p.completion_percentage >= 100)).length;
          const completedQuizzes = overview.quiz_results.length;
          const hasDone = (completedTopics > 0) || (completedQuizzes > 0);

          updateDashboardGreeting(firebaseUser, dbUser, {
            isFirstTime: false,
            hasValidData: true,
            hasCompletedActivities: hasDone
          });
        } else {
          // If required activity data is missing or malformed, retain neutral greeting
          updateDashboardGreeting(firebaseUser, dbUser, {
            isFirstTime: false,
            hasValidData: false,
            hasCompletedActivities: false
          });
        }
      } else {
        updateDashboardGreeting(firebaseUser, dbUser, {
          isFirstTime: true,
          hasValidData: true,
          hasCompletedActivities: false
        });
      }

      if ((!activeRoadmap || topics.length === 0) && career && career !== "Not Set") {
        if (latestAssessment) {
          try {
            const score = typeof latestAssessment.score === "number" ? latestAssessment.score : 75.0;
            const generated = await apiRequest("/generate-roadmap", {
              method: "POST",
              body: JSON.stringify({
                user_id: userId,
                career_goal: career,
                current_skills: "",
                interests: career,
                skill_level: level,
                assessment_score: score
              })
            });
            if (generated && generated.roadmap_id) {
              activeRoadmap = { roadmap_id: generated.roadmap_id, user_id: userId, career_path: generated.career_path || career };
              if (Array.isArray(generated.topics) && generated.topics.length > 0 && generated.topics[0].topic_id) {
                topics = generated.topics;
              } else {
                topics = await apiRequest(`/topics/${generated.roadmap_id}`);
              }
            }
          } catch (e) {
            console.warn("Could not generate AI roadmap on dashboard:", e);
          }
        }
      }

      if (!activeRoadmap || topics.length === 0) {
        renderEmptyRoadmapState();
        return;
      }

      checkAndRenderCareerMismatch(activeRoadmap, dbUser, level, latestAssessment);
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

  renderStreakAndProjectMetrics(streakData, quizResults);

  // Evaluate authentic user activity for dashboard greeting in fallback mode
  const topicsOk = topicsRes.status === "fulfilled" && Array.isArray(topicsRes.value);
  const progressOk = progressRes.status === "fulfilled" && Array.isArray(progressRes.value);
  const quizOk = quizRes.status === "fulfilled" && Array.isArray(quizRes.value);

  if (!isFirstTime) {
    if (topicsOk && progressOk && quizOk) {
      const progressRecordsList = progressRes.value;
      const topicsList = topicsRes.value;
      const quizResultsList = quizRes.value;

      const completedTopics = progressRecordsList.filter(p =>
        (p.status && p.status.toLowerCase() === "completed") || (p.completion_percentage && p.completion_percentage >= 100)
      ).length;
      const completedTopicsInList = topicsList.filter(t => t.status && t.status.toLowerCase() === "completed").length;
      const completedQuizzes = quizResultsList.length;

      const hasDone = completedTopics > 0 || completedTopicsInList > 0 || completedQuizzes > 0;

      updateDashboardGreeting(firebaseUser, dbUser, {
        isFirstTime: false,
        hasValidData: true,
        hasCompletedActivities: hasDone
      });
    } else {
      // Incomplete or failed requests: keep neutral greeting, do not infer zero activity
      updateDashboardGreeting(firebaseUser, dbUser, {
        isFirstTime: false,
        hasValidData: false,
        hasCompletedActivities: false
      });
    }
  } else {
    updateDashboardGreeting(firebaseUser, dbUser, {
      isFirstTime: true,
      hasValidData: true,
      hasCompletedActivities: false
    });
  }

  if (!topics || topics.length === 0) {
    renderEmptyRoadmapState();
    return;
  }

  checkAndRenderCareerMismatch(activeRoadmap, dbUser, level, latestAssessment);
  renderDashboardRoadmap(topics, progressRecords, activeRoadmap, level);
  await renderQuizPerformanceMetrics(topics, quizResults, performanceData);
}

function renderStreakAndProjectMetrics(streakData, quizResults = []) {
  const streakDays = (streakData && typeof streakData.streak_days === "number") ? streakData.streak_days : 0;
  const weekCompleted = (streakData && typeof streakData.week_completed_topics === "number") ? streakData.week_completed_topics : 0;

  const statDaysEl = document.getElementById("statDaysStreak");
  if (statDaysEl) statDaysEl.textContent = streakDays;

  const rightPanelStreakEl = document.getElementById("rightPanelStreak");
  if (rightPanelStreakEl) rightPanelStreakEl.textContent = `🔥 ${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`;

  // Authentic Quiz Passing Metrics (replaces misleading hardcoded zero projects)
  const statCompletedQuizzesEl = document.getElementById("statCompletedQuizzes") || document.getElementById("statCompletedProjects");
  const statQuizFractionEl = document.getElementById("statQuizFraction");

  if (Array.isArray(quizResults) && quizResults.length > 0) {
    const totalAttempts = quizResults.length;
    const passedAttempts = quizResults.filter(q => q.total_questions > 0 && (q.score / q.total_questions) >= 0.7).length;
    const avgScore = Math.round(
      quizResults.reduce((acc, q) => acc + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0), 0) / totalAttempts
    );

    if (statCompletedQuizzesEl) statCompletedQuizzesEl.textContent = passedAttempts;
    if (statQuizFractionEl) statQuizFractionEl.textContent = `${passedAttempts}/${totalAttempts} passed (${avgScore}% avg)`;
  } else {
    if (statCompletedQuizzesEl) statCompletedQuizzesEl.textContent = 0;
    if (statQuizFractionEl) statQuizFractionEl.textContent = "0 quizzes taken yet";
  }

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
  currentDashboardTopics = [];
  currentProgressRecords = [];
  renderOverallProgressGraph(currentProgressFilter);
}

export function formatProgressConicGradient(percent) {
  let p = typeof percent === "number" && !isNaN(percent) ? percent : Number(percent);
  if (isNaN(p) || p <= 0) {
    p = 0;
  } else if (p >= 100) {
    p = 100;
  } else {
    p = Math.round(p);
  }
  return `conic-gradient(#7c5cff 0% ${p}%, #eee ${p}% 100%)`;
}

export function updateStatMetrics(completed, total, overallPercent) {
  const statCompleted = document.getElementById("statCompletedTopics");
  const statFraction = document.getElementById("statTopicsFraction");
  const statFill = document.getElementById("statTopicsProgressFill");
  const statOverall = document.getElementById("statOverallProgress");

  const rightPanelPercent = document.getElementById("rightPanelPercent");
  const rightPanelTotal = document.getElementById("rightPanelTotalTopics");
  const rightPanelCompleted = document.getElementById("rightPanelCompletedTopics");

  // Validate and sanitize numeric counts safely
  const safeCompleted = typeof completed === "number" && !isNaN(completed) && completed > 0 ? Math.floor(completed) : 0;
  const safeTotal = typeof total === "number" && !isNaN(total) && total > 0 ? Math.floor(total) : 0;

  // Compute safe normalized percentage (0% to 100%)
  let safePercent = 0;
  if (typeof overallPercent === "number" && !isNaN(overallPercent)) {
    safePercent = Math.min(100, Math.max(0, Math.round(overallPercent)));
  } else if (safeTotal > 0) {
    safePercent = Math.min(100, Math.max(0, Math.round((safeCompleted / safeTotal) * 100)));
  }

  // 1. Dynamic SVG Progress Ring in Right Panel (r=52, circumference=326.73)
  const progressRingFill = document.getElementById("progressRingFill");
  const circumference = 326.73;
  if (progressRingFill) {
    const offset = circumference - (circumference * safePercent / 100);
    progressRingFill.style.strokeDashoffset = offset;
  }

  const progressCircle = document.getElementById("overallProgressCircle") || document.querySelector(".progress-circle");
  if (progressCircle) {
    progressCircle.setAttribute("aria-valuenow", safePercent);
    progressCircle.setAttribute("aria-label", `Overall curriculum progress: ${safePercent}%`);
    // Backwards compatibility for legacy CSS
    progressCircle.style.background = formatProgressConicGradient(safePercent);
  }

  // 2. Dynamic Mini Progress Ring in Stat Card (r=14, circumference=87.96)
  const miniRingFill = document.getElementById("statMiniRingFill");
  const miniCircumference = 87.96;
  if (miniRingFill) {
    const miniOffset = miniCircumference - (miniCircumference * safePercent / 100);
    miniRingFill.style.strokeDashoffset = miniOffset;
  }

  const miniRing = document.getElementById("statMiniRing") || document.querySelector(".mini-ring");
  if (miniRing) {
    miniRing.setAttribute("aria-valuenow", safePercent);
    miniRing.setAttribute("aria-label", `Overall progress: ${safePercent}%`);
    // Backwards compatibility for legacy CSS
    miniRing.style.background = formatProgressConicGradient(safePercent);
  }

  if (statCompleted) statCompleted.textContent = safeCompleted;
  if (statFraction) statFraction.textContent = `${safeCompleted}/${safeTotal}`;
  if (statFill) statFill.style.width = `${safePercent}%`;
  if (statOverall) statOverall.textContent = `${safePercent}%`;

  if (rightPanelPercent) rightPanelPercent.textContent = `${safePercent}%`;
  if (rightPanelTotal) rightPanelTotal.textContent = safeTotal;
  if (rightPanelCompleted) rightPanelCompleted.textContent = safeCompleted;

  const overallProgressBadge = document.getElementById("overallProgressBadge");
  if (overallProgressBadge) {
    overallProgressBadge.textContent = `${safePercent}% Complete`;
    overallProgressBadge.classList.toggle("neutral", safePercent === 0);
  }
}

// Global cached state for interactive dashboard roadmap views
let currentDashboardTopics = [];
let currentProgressMap = {};
let currentProgressRecords = [];
let currentRoadmapData = null;
let currentSkillLevel = "Beginner";
let activeRoadmapTab = "overview";
let currentProgressFilter = "weekly";

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 */
function toLocalDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses an ISO date/timestamp into a local calendar Date (midnight).
 * Returns null if the input is missing or invalid (never fabricates a date).
 */
function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Builds chronological progress timeline points strictly from genuine dated progress records.
 * Never reconstructs past progress from undated current topic statuses.
 */
export function buildProgressTimelineData(topics, progressRecords, filterType = "weekly", referenceToday = new Date()) {
  const today = new Date(referenceToday.getFullYear(), referenceToday.getMonth(), referenceToday.getDate());
  const totalTopics = Array.isArray(topics) ? topics.length : 0;

  if (totalTopics === 0) {
    return { empty: true, reason: "no_topics", totalTopics: 0, completedCount: 0, points: [] };
  }

  // Restrict to topic IDs belonging to the active roadmap
  const activeTopicIds = new Set(topics.map((t) => t.topic_id).filter((id) => id != null));

  // Build map of completed topic_id -> genuine completion date from dated progress records only
  const completedTopicDates = new Map();
  if (Array.isArray(progressRecords)) {
    progressRecords.forEach((p) => {
      const isDone = (p.status && p.status.toLowerCase() === "completed") || (p.completion_percentage >= 100);
      if (isDone && p.topic_id != null && activeTopicIds.has(p.topic_id)) {
        const dt = parseDateOnly(p.last_updated);
        if (!dt) return;
        const existing = completedTopicDates.get(p.topic_id);
        if (!existing || dt < existing) {
          completedTopicDates.set(p.topic_id, dt);
        }
      }
    });
  }

  const completedCount = completedTopicDates.size;
  if (completedCount === 0) {
    return { empty: true, reason: "no_dated_progress", totalTopics, completedCount: 0, points: [] };
  }

  const completedEntries = Array.from(completedTopicDates.values()).sort((a, b) => a - b);
  const checkpoints = [];

  if (filterType === "weekly") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      checkpoints.push({
        date: d,
        label: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
        showLabel: i === 0 || i === 2 || i === 4 || i === 6
      });
    }
  } else if (filterType === "monthly") {
    const offsets = [28, 21, 14, 7, 0];
    offsets.forEach((offset, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      checkpoints.push({
        date: d,
        label: offset === 0 ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        showLabel: idx === 0 || idx === 2 || idx === 4
      });
    });
  } else {
    // All-time: span strictly from the earliest genuine dated record to today
    const earliest = new Date(completedEntries[0]);
    const start = earliest > today ? today : earliest;
    const totalDays = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
    if (totalDays === 0) {
      checkpoints.push({
        date: today,
        label: "Today",
        showLabel: true
      });
    } else {
      const numSegments = Math.min(6, Math.max(1, totalDays));
      for (let i = 0; i <= numSegments; i++) {
        const d = new Date(start);
        const dayOffset = Math.round((i / numSegments) * totalDays);
        d.setDate(start.getDate() + dayOffset);
        const isLast = i === numSegments;
        checkpoints.push({
          date: isLast ? today : d,
          label: isLast ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          showLabel: i === 0 || i === Math.floor(numSegments / 2) || isLast
        });
      }
    }
  }

  // Deduplicate checkpoints sharing the same calendar day while preserving order
  const uniqueCheckpoints = [];
  const seenKeys = new Set();
  checkpoints.forEach((cp, idx) => {
    const key = toLocalDateKey(cp.date);
    if (!seenKeys.has(key) || idx === checkpoints.length - 1) {
      if (seenKeys.has(key) && uniqueCheckpoints.length > 0) {
        uniqueCheckpoints[uniqueCheckpoints.length - 1] = cp;
      } else {
        seenKeys.add(key);
        uniqueCheckpoints.push(cp);
      }
    }
  });

  const points = uniqueCheckpoints.map((cp) => {
    const cpKey = toLocalDateKey(cp.date);
    let countUpToDate = 0;
    completedTopicDates.forEach((dt) => {
      if (toLocalDateKey(dt) <= cpKey) {
        countUpToDate++;
      }
    });
    const percent = Math.min(100, Math.round((countUpToDate / totalTopics) * 100));
    return {
      label: cp.label,
      showLabel: cp.showLabel,
      fullDate: cp.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      count: countUpToDate,
      percent
    };
  });

  return { empty: false, totalTopics, completedCount, points };
}

/**
 * Renders the modern SaaS Overall Progress smooth area chart or graceful empty state.
 */
export function renderOverallProgressGraph(filterType = currentProgressFilter) {
  const container = document.getElementById("overallProgressGraphContainer");
  const tooltipEl = document.getElementById("progressChartTooltip");
  if (!container) return;

  const timeline = buildProgressTimelineData(currentDashboardTopics, currentProgressRecords, filterType);
  const filterButtons = document.querySelectorAll(".progress-filter-btn");

  const rightPanelNote = document.getElementById("rightPanelNote");
  if (timeline.empty) {
    filterButtons.forEach((btn) => { btn.disabled = true; });
    if (tooltipEl) tooltipEl.style.display = "none";
    if (rightPanelNote) rightPanelNote.textContent = "Complete your first topic or quiz to start tracking progress.";

    container.className = "progress-empty-state";
    container.innerHTML = `
      <div class="empty-state-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      </div>
      <h4 class="empty-state-title">No Learning Activity Yet</h4>
      <p class="empty-state-desc">Complete roadmap topics or quizzes to start tracking your learning curve over time! 😊</p>
      <a href="roadmap.html" class="empty-state-btn">View Roadmap →</a>
    `;
    return;
  }

  filterButtons.forEach((btn) => { btn.disabled = false; });
  container.className = "progress-graph-container";
  if (rightPanelNote) rightPanelNote.textContent = "Keep going! You're making great progress.";

  const { points, totalTopics, completedCount } = timeline;
  const periodLabel = filterType === "weekly" ? "Last 7 Days" : (filterType === "monthly" ? "Last 30 Days" : "All-Time History");

  // SVG layout dimensions
  const width = 280;
  const height = 135;
  const padLeft = 30;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 22;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const bottomY = padTop + chartH;

  // Map data points to SVG coordinates
  const n = points.length;
  const coords = points.map((pt, idx) => {
    const x = n > 1 ? padLeft + (idx * chartW) / (n - 1) : padLeft + chartW / 2;
    const y = padTop + chartH - (pt.percent * chartH) / 100;
    return { x, y, pt };
  });

  // Construct smooth cubic Bezier curve path when multiple checkpoints exist
  let lineD = "";
  let areaD = "";
  if (coords.length > 1) {
    lineD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const { x: x0, y: y0 } = coords[i];
      const { x: x1, y: y1 } = coords[i + 1];
      const cp1x = x0 + (x1 - x0) / 2;
      const cp1y = y0;
      const cp2x = x0 + (x1 - x0) / 2;
      const cp2y = y1;
      lineD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    areaD = `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  }

  // Horizontal grid lines (100%, 75%, 50%, 25%, 0%)
  const gridLevels = [100, 75, 50, 25, 0];
  const gridHtml = gridLevels.map((lvl) => {
    const gy = padTop + chartH - (lvl * chartH) / 100;
    const isBase = lvl === 0;
    return `
      <line class="chart-grid-line ${isBase ? "base" : ""}" x1="${padLeft}" y1="${gy.toFixed(1)}" x2="${width - padRight}" y2="${gy.toFixed(1)}" />
      <text class="chart-axis-y" x="${padLeft - 5}" y="${(gy + 3).toFixed(1)}">${lvl}%</text>
    `;
  }).join("");

  // X-axis date labels
  const xLabelsHtml = coords.map((c, idx) => {
    if (!c.pt.showLabel && idx !== 0 && idx !== coords.length - 1) return "";
    const anchor = coords.length === 1 ? "middle" : (idx === 0 ? "start" : (idx === coords.length - 1 ? "end" : "middle"));
    return `<text class="chart-axis-x" x="${c.x.toFixed(1)}" y="${height - 4}" text-anchor="${anchor}">${c.pt.label}</text>`;
  }).join("");

  // Checkpoint dots
  const dotsHtml = coords.map((c, idx) => {
    const isLast = idx === coords.length - 1;
    return `<circle class="chart-point ${isLast ? "active" : ""}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isLast ? 4 : 3}" data-point-idx="${idx}" />`;
  }).join("");

  const gradSuffix = filterType;
  const pathMarkup = coords.length > 1
    ? `<path class="chart-area-fill" fill="url(#progressAreaGrad_${gradSuffix})" d="${areaD}" />
       <path class="chart-line-stroke" stroke="url(#progressLineGrad_${gradSuffix})" d="${lineD}" />`
    : "";

  container.innerHTML = `
    <div class="graph-trend-meta">
      <span class="trend-period-label">${periodLabel}</span>
      <span class="trend-sub">${completedCount} of ${totalTopics} topics</span>
    </div>
    <div class="progress-svg-wrap">
      <svg class="progress-chart-svg" id="progressChartSvg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="progressAreaGrad_${gradSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.26" />
            <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.01" />
          </linearGradient>
          <linearGradient id="progressLineGrad_${gradSuffix}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#4f46e5" />
            <stop offset="100%" stop-color="#818cf8" />
          </linearGradient>
        </defs>
        ${gridHtml}
        ${pathMarkup}
        <line class="chart-crosshair" id="chartCrosshair" x1="0" y1="${padTop}" x2="0" y2="${bottomY}" style="display: none;" />
        ${dotsHtml}
        ${xLabelsHtml}
      </svg>
    </div>
  `;

  // Wire up polished hover and touch interactions
  const svgEl = document.getElementById("progressChartSvg");
  const crosshairEl = document.getElementById("chartCrosshair");
  const cardEl = document.getElementById("overallProgressCard");
  if (!svgEl || !tooltipEl || !cardEl) return;

  const showTooltipAtClientX = (clientX) => {
    const svgRect = svgEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    if (svgRect.width === 0) return;

    const relX = ((clientX - svgRect.left) / svgRect.width) * width;
    let closestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - relX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    const target = coords[closestIdx];
    const dateEl = document.getElementById("tooltipDate");
    const valEl = document.getElementById("tooltipVal");
    const subEl = document.getElementById("tooltipSub");

    if (dateEl) dateEl.textContent = target.pt.fullDate;
    if (valEl) valEl.textContent = `${target.pt.percent}% Complete`;
    if (subEl) subEl.textContent = `${target.pt.count} of ${totalTopics} topics completed`;

    // Highlight active dot & crosshair
    svgEl.querySelectorAll(".chart-point").forEach((dot, idx) => {
      dot.classList.toggle("active", idx === closestIdx);
      dot.setAttribute("r", idx === closestIdx ? "5" : "3");
    });

    if (crosshairEl) {
      crosshairEl.setAttribute("x1", target.x.toFixed(1));
      crosshairEl.setAttribute("x2", target.x.toFixed(1));
      crosshairEl.style.display = "block";
    }

    // Show first to measure true rendered width before clamping inside card
    tooltipEl.style.display = "block";
    tooltipEl.setAttribute("aria-hidden", "false");

    const dotScreenX = svgRect.left + (target.x / width) * svgRect.width;
    const dotScreenY = svgRect.top + (target.y / height) * svgRect.height;
    let leftPos = dotScreenX - cardRect.left;
    const topPos = dotScreenY - cardRect.top;

    // Clamp horizontally inside card bounds using measured half-width
    const halfW = (tooltipEl.offsetWidth || 140) / 2;
    const minLeft = halfW + 10;
    const maxLeft = Math.max(minLeft, cardRect.width - halfW - 10);
    leftPos = Math.min(maxLeft, Math.max(minLeft, leftPos));

    tooltipEl.style.left = `${leftPos}px`;
    tooltipEl.style.top = `${topPos}px`;
  };

  const hideTooltip = () => {
    tooltipEl.style.display = "none";
    tooltipEl.setAttribute("aria-hidden", "true");
    if (crosshairEl) crosshairEl.style.display = "none";
    svgEl.querySelectorAll(".chart-point").forEach((dot, idx) => {
      const isLast = idx === coords.length - 1;
      dot.classList.toggle("active", isLast);
      dot.setAttribute("r", isLast ? "4" : "3");
    });
  };

  svgEl.addEventListener("mousemove", (e) => showTooltipAtClientX(e.clientX));
  svgEl.addEventListener("mouseleave", hideTooltip);
  svgEl.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches[0]) {
      showTooltipAtClientX(e.touches[0].clientX);
    }
  }, { passive: true });
  svgEl.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches[0]) {
      showTooltipAtClientX(e.touches[0].clientX);
    }
  }, { passive: true });
  svgEl.addEventListener("touchend", hideTooltip);
}

export function setupProgressGraphFilters() {
  const filterBtns = document.querySelectorAll(".progress-filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const filter = btn.getAttribute("data-filter") || "weekly";
      currentProgressFilter = filter;
      filterBtns.forEach((b) => {
        const isCurrent = b === btn;
        b.classList.toggle("active", isCurrent);
        b.setAttribute("aria-selected", isCurrent ? "true" : "false");
      });
      renderOverallProgressGraph(currentProgressFilter);
    });
  });
}

const TOPIC_ICONS = ["📘", "🧩", "🌳", "🔁", "🎯", "⚡", "🚀", "💡"];

function getTopicStatusInfo(topic, progressMap) {
  const p = progressMap[topic.topic_id];
  let percent = p ? (p.completion_percentage || 0) : 0;
  let statusText = topic.status || "Not Started";
  const isDone = (statusText.toLowerCase() === "completed") ||
                 (percent >= 100) ||
                 (p && p.status && p.status.toLowerCase() === "completed");

  if (isDone) {
    percent = 100;
    statusText = "Completed";
  } else if (statusText.toLowerCase() === "in progress" || percent > 0) {
    statusText = "In Progress";
  } else {
    statusText = "Upcoming";
    percent = 0;
  }

  const badgeClass = statusText === "Completed" ? "completed" :
                     (statusText === "In Progress" ? "in-progress" : "upcoming");

  return { percent, statusText, isDone, badgeClass };
}

function buildSingleTopicCardHtml(topic, idx, progressMap, careerPath) {
  const { percent, statusText, badgeClass } = getTopicStatusInfo(topic, progressMap);
  const icon = TOPIC_ICONS[idx % TOPIC_ICONS.length];

  return `
    <div class="roadmap-item" onclick="window.location.href='roadmap.html'" style="cursor: pointer;">
      <span class="item-icon icon-${(idx % 5) + 1}">${icon}</span>
      <div class="item-info">
        <h3>${topic.sequence_no || (idx + 1)}. ${escapeHtml(topic.topic_name)}</h3>
        <p>Curriculum module for ${escapeHtml(careerPath || "SkillPath")}</p>
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
}

function renderOverviewView(container) {
  const phaseTimeline = document.getElementById("dashboardPhaseTimeline");
  const topics = currentDashboardTopics;
  const progressMap = currentProgressMap;
  const roadmap = currentRoadmapData || {};

  if (phaseTimeline) {
    phaseTimeline.style.display = "flex";
    phaseTimeline.innerHTML = topics.map((t, idx) => {
      const { isDone, badgeClass } = getTopicStatusInfo(t, progressMap);
      const isCurrent = !isDone && (idx === 0 || badgeClass === "in-progress");
      const phaseMarker = isDone ? "✓" : "●";
      const itemClass = isDone ? "completed" : (isCurrent ? "in-progress" : "upcoming");

      return `
        <div class="phase-item ${itemClass}">
          <span class="phase-marker">${phaseMarker}</span>
          <div class="phase-label">
            <p class="phase-name">Topic ${idx + 1}</p>
            <p class="phase-duration">${escapeHtml(t.topic_name.length > 15 ? t.topic_name.substring(0, 15) + '...' : t.topic_name)}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  let html = "";
  topics.forEach((topic, idx) => {
    html += buildSingleTopicCardHtml(topic, idx, progressMap, roadmap.career_path);
  });
  container.innerHTML = html;
}

function renderPhaseView(container) {
  const phaseTimeline = document.getElementById("dashboardPhaseTimeline");
  if (phaseTimeline) phaseTimeline.style.display = "none";

  const topics = currentDashboardTopics;
  const progressMap = currentProgressMap;
  const roadmap = currentRoadmapData || {};
  const N = topics.length;

  if (N === 0) {
    container.innerHTML = '<div class="milestone-empty-state"><p>No phase curriculum found.</p></div>';
    return;
  }

  // Segment topics into 3 canonical phases
  const p1End = Math.ceil(N / 3);
  const p2End = Math.ceil((2 * N) / 3);

  const phaseDefs = [
    { num: 1, title: "Foundations & Core Concepts", topics: topics.slice(0, p1End) },
    { num: 2, title: "Implementation, Frameworks & APIs", topics: topics.slice(p1End, p2End) },
    { num: 3, title: "Advanced Architecture & Production", topics: topics.slice(p2End) }
  ];

  let html = "";
  phaseDefs.forEach((phase) => {
    if (phase.topics.length === 0) return;

    let phaseDone = 0;
    phase.topics.forEach((t) => {
      const { isDone } = getTopicStatusInfo(t, progressMap);
      if (isDone) phaseDone++;
    });

    const phasePct = Math.round((phaseDone / phase.topics.length) * 100);

    html += `
      <div class="phase-group">
        <div class="phase-group-header">
          <div class="phase-title-wrap">
            <span class="phase-badge-pill">Phase ${phase.num}</span>
            <h3 class="phase-group-title">${escapeHtml(phase.title)}</h3>
          </div>
          <div class="phase-progress-summary">
            <span class="phase-progress-fraction">${phaseDone}/${phase.topics.length} Completed (${phasePct}%)</span>
            <div class="phase-progress-bar">
              <div class="phase-progress-bar-fill" style="width: ${phasePct}%;"></div>
            </div>
          </div>
        </div>
        <div class="phase-topics-list">
          ${phase.topics.map((t, idx) => buildSingleTopicCardHtml(t, idx, progressMap, roadmap.career_path)).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderSkillView(container) {
  const phaseTimeline = document.getElementById("dashboardPhaseTimeline");
  if (phaseTimeline) phaseTimeline.style.display = "none";

  const topics = currentDashboardTopics;
  const progressMap = currentProgressMap;
  const roadmap = currentRoadmapData || {};

  if (topics.length === 0) {
    container.innerHTML = '<div class="milestone-empty-state"><p>No skill categories found.</p></div>';
    return;
  }

  // Categorize topics based on domain keywords
  const categories = {
    "Languages & Core Syntax": { icon: "💻", topics: [] },
    "Frameworks & Architecture": { icon: "⚡", topics: [] },
    "Data, APIs & State": { icon: "🗄️", topics: [] },
    "DevOps, Testing & Quality": { icon: "🚀", topics: [] }
  };

  topics.forEach((t) => {
    const name = t.topic_name.toLowerCase();
    if (/data|api|sql|database|mongo|postgres|orm|rest|graphql|state|redux|store|query/i.test(name)) {
      categories["Data, APIs & State"].topics.push(t);
    } else if (/react|vue|angular|fastapi|django|express|component|routing|node|middleware|controller/i.test(name)) {
      categories["Frameworks & Architecture"].topics.push(t);
    } else if (/test|jest|ci|cd|docker|git|deploy|cloud|security|performance|design pattern|dsa|algorithm/i.test(name)) {
      categories["DevOps, Testing & Quality"].topics.push(t);
    } else {
      categories["Languages & Core Syntax"].topics.push(t);
    }
  });

  let html = "";
  Object.entries(categories).forEach(([catTitle, catData]) => {
    if (catData.topics.length === 0) return;

    let catDone = 0;
    catData.topics.forEach((t) => {
      const { isDone } = getTopicStatusInfo(t, progressMap);
      if (isDone) catDone++;
    });

    html += `
      <div class="skill-group">
        <div class="skill-group-header">
          <h3 class="skill-group-title">
            <span>${catData.icon}</span> ${escapeHtml(catTitle)}
          </h3>
          <span class="skill-group-badge">${catDone}/${catData.topics.length} Completed</span>
        </div>
        <div class="skill-topics-list">
          ${catData.topics.map((t, idx) => buildSingleTopicCardHtml(t, idx, progressMap, roadmap.career_path)).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderUpcomingMilestones(topics, progressMap, overallPercent, roadmap) {
  const container = document.getElementById("dashboardMilestonesContainer");
  if (!container) return;

  if (!Array.isArray(topics) || topics.length === 0) {
    container.innerHTML = `
      <div class="milestone-empty-state">
        <p>🎯 No active milestones yet. Choose a career goal or take an assessment to generate your personalized learning milestones!</p>
      </div>
    `;
    return;
  }

  // 1. Next topic milestone
  let nextIncompleteTopic = null;
  for (const t of topics) {
    const { isDone } = getTopicStatusInfo(t, progressMap);
    if (!isDone) {
      nextIncompleteTopic = t;
      break;
    }
  }

  const topicMilestoneHtml = nextIncompleteTopic ? `
    <a href="roadmap.html" class="milestone-item">
      <div class="milestone-icon-wrap"><span class="milestone-icon">🎯</span></div>
      <div class="milestone-text">
        <p class="milestone-title">Next Topic: ${escapeHtml(nextIncompleteTopic.topic_name)}</p>
        <p class="milestone-time">Topic ${nextIncompleteTopic.sequence_no || 1} of ${topics.length} • In Progress</p>
      </div>
      <span class="milestone-arrow">›</span>
    </a>
  ` : `
    <a href="roadmap.html" class="milestone-item">
      <div class="milestone-icon-wrap success"><span class="milestone-icon">🎉</span></div>
      <div class="milestone-text">
        <p class="milestone-title">All Topics Completed!</p>
        <p class="milestone-time">${topics.length} of ${topics.length} topics mastered</p>
      </div>
      <span class="milestone-arrow">›</span>
    </a>
  `;

  // 2. Current Phase Milestone
  const N = topics.length;
  const p1End = Math.ceil(N / 3);
  const p2End = Math.ceil((2 * N) / 3);

  let activePhaseNum = 1;
  let activePhaseName = "Foundations & Core Concepts";
  let phaseTopics = [];

  if (nextIncompleteTopic) {
    const seq = nextIncompleteTopic.sequence_no || (topics.indexOf(nextIncompleteTopic) + 1);
    if (seq <= p1End) {
      activePhaseNum = 1;
      activePhaseName = "Foundations & Core Concepts";
      phaseTopics = topics.slice(0, p1End);
    } else if (seq <= p2End) {
      activePhaseNum = 2;
      activePhaseName = "Implementation & Frameworks";
      phaseTopics = topics.slice(p1End, p2End);
    } else {
      activePhaseNum = 3;
      activePhaseName = "Advanced Architecture";
      phaseTopics = topics.slice(p2End);
    }
  } else {
    activePhaseNum = 3;
    activePhaseName = "Advanced Architecture";
    phaseTopics = topics.slice(p2End);
  }

  const phaseIncomplete = phaseTopics.filter(t => !getTopicStatusInfo(t, progressMap).isDone).length;

  const phaseMilestoneHtml = nextIncompleteTopic ? `
    <a href="roadmap.html" class="milestone-item">
      <div class="milestone-icon-wrap"><span class="milestone-icon">🚀</span></div>
      <div class="milestone-text">
        <p class="milestone-title">Phase ${activePhaseNum}: ${activePhaseName}</p>
        <p class="milestone-time">${phaseIncomplete} ${phaseIncomplete === 1 ? 'topic' : 'topics'} remaining in this phase</p>
      </div>
      <span class="milestone-arrow">›</span>
    </a>
  ` : `
    <a href="roadmap.html" class="milestone-item">
      <div class="milestone-icon-wrap success"><span class="milestone-icon">🏆</span></div>
      <div class="milestone-text">
        <p class="milestone-title">Curriculum Completed</p>
        <p class="milestone-time">All 3 phases completed successfully</p>
      </div>
      <span class="milestone-arrow">›</span>
    </a>
  `;

  // 3. Certificate Eligibility Milestone
  const isCertEligible = overallPercent >= 100;
  const certMilestoneHtml = `
    <a href="certificates.html" class="milestone-item">
      <div class="milestone-icon-wrap ${isCertEligible ? 'success' : ''}"><span class="milestone-icon">📜</span></div>
      <div class="milestone-text">
        <p class="milestone-title">Course Certificate</p>
        <p class="milestone-time">${isCertEligible ? 'Ready to Claim 🎉' : `${overallPercent}% Complete • Requires 100%`}</p>
      </div>
      <span class="milestone-arrow">›</span>
    </a>
  `;

  container.innerHTML = topicMilestoneHtml + phaseMilestoneHtml + certMilestoneHtml;
}

export function checkAndRenderCareerMismatch(activeRoadmap, dbUser, level, latestAssessment) {
  const mismatchBanner = document.getElementById("careerMismatchBanner");
  const mismatchTargetEl = document.getElementById("mismatchTargetCareer");
  const mismatchActiveEl = document.getElementById("mismatchActiveCareer");
  const btnSync = document.getElementById("btnSyncNewRoadmap");

  if (!mismatchBanner) return;

  if (activeRoadmap && activeRoadmap.career_path && dbUser && dbUser.career_goal && dbUser.career_goal !== "Not Set") {
    const activeCareer = activeRoadmap.career_path.trim().toLowerCase();
    const targetCareer = dbUser.career_goal.trim().toLowerCase();

    if (activeCareer !== targetCareer) {
      mismatchBanner.style.display = "flex";
      if (mismatchTargetEl) mismatchTargetEl.textContent = dbUser.career_goal;
      if (mismatchActiveEl) mismatchActiveEl.textContent = activeRoadmap.career_path;

      if (btnSync) {
        btnSync.onclick = async () => {
          btnSync.disabled = true;
          btnSync.textContent = "Generating...";
          try {
            const score = (latestAssessment && typeof latestAssessment.score === "number") ? latestAssessment.score : 75.0;
            await apiRequest("/generate-roadmap", {
              method: "POST",
              body: JSON.stringify({
                user_id: dbUser.user_id,
                career_goal: dbUser.career_goal,
                current_skills: "",
                interests: dbUser.career_goal,
                skill_level: level || "Intermediate",
                assessment_score: score
              })
            });
            localStorage.setItem("careerPath", dbUser.career_goal);
            localStorage.setItem("skillpath_career", dbUser.career_goal);
            window.location.reload();
          } catch (err) {
            console.error("Roadmap generation failed on dashboard:", err);
            alert("Could not generate a new roadmap right now. Please try again or take the assessment.");
            btnSync.disabled = false;
            btnSync.textContent = "Generate Roadmap";
          }
        };
      }
      return;
    }
  }

  mismatchBanner.style.display = "none";
}

export function renderDashboardRoadmap(topics, progressRecords, roadmap, level) {
  const container = document.getElementById("dashboardRoadmapItems");

  if (!topics || topics.length === 0) {
    renderEmptyRoadmapState();
    return;
  }

  // Cache state for interactive views
  currentDashboardTopics = topics;
  currentRoadmapData = roadmap;
  currentSkillLevel = level || "Beginner";

  // Build progress lookup map by topic_id
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
  currentProgressMap = progressMap;
  currentProgressRecords = Array.isArray(progressRecords) ? progressRecords : [];

  let completedCount = 0;
  let firstIncompleteTopic = null;

  topics.forEach((t) => {
    const { isDone } = getTopicStatusInfo(t, progressMap);
    if (isDone) {
      completedCount++;
    } else if (!firstIncompleteTopic) {
      firstIncompleteTopic = t;
    }
  });

  // Update today's learning goal with the current active topic
  const todayGoalTitle = document.getElementById("todayGoalTitle");
  if (todayGoalTitle) {
    if (firstIncompleteTopic) {
      todayGoalTitle.textContent = firstIncompleteTopic.topic_name;
    } else if (topics.length > 0) {
      todayGoalTitle.textContent = "Roadmap Completed! 🎉";
    }
  }

  const overallPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  updateStatMetrics(completedCount, topics.length, overallPercent);

  // Render the selected view (Overview, Phase View, or Skill View)
  if (container) {
    if (activeRoadmapTab === "phase") {
      renderPhaseView(container);
    } else if (activeRoadmapTab === "skill") {
      renderSkillView(container);
    } else {
      renderOverviewView(container);
    }
  }

  // Render authentic dynamic upcoming milestones
  renderUpcomingMilestones(topics, progressMap, overallPercent, roadmap);

  // Render modern Overall Progress graph
  renderOverallProgressGraph(currentProgressFilter);
}

// ===== PRESERVED DASHBOARD FUNCTIONALITY =====
setupProgressGraphFilters();

// ===== ROADMAP TABS (Overview / Phase View / Skill View) =====
const roadmapTabButtons = document.querySelectorAll(".tab[data-roadmap-tab], .tab");

roadmapTabButtons.forEach(function(tab) {
  tab.addEventListener("click", function(event) {
    event.preventDefault();

    roadmapTabButtons.forEach(function(t) {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    activeRoadmapTab = tab.getAttribute("data-roadmap-tab") || "overview";
    const container = document.getElementById("dashboardRoadmapItems");
    if (container && currentDashboardTopics.length > 0) {
      if (activeRoadmapTab === "phase") {
        renderPhaseView(container);
      } else if (activeRoadmapTab === "skill") {
        renderSkillView(container);
      } else {
        renderOverviewView(container);
      }
    }
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
    // If click originated inside the dropdown menu, let the inner item handle it
    if (profileDropdownMenuEl.contains(event.target)) {
      return;
    }
    event.stopPropagation();
    const isOpen = profileDropdownMenuEl.style.display === "block" || profileDropdownMenuEl.classList.contains("show");
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Prevent clicks inside the dropdown menu from closing it prematurely
  profileDropdownMenuEl.addEventListener("click", function(event) {
    event.stopPropagation();
  });

  // Keyboard accessibility for userProfile button (Enter / Space)
  userProfileEl.addEventListener("keydown", function(event) {
    if (event.key === "Enter" || event.key === " ") {
      if (event.target !== userProfileEl) return;
      event.preventDefault();
      const isOpen = profileDropdownMenuEl.style.display === "block" || profileDropdownMenuEl.classList.contains("show");
      if (isOpen) {
        closeDropdown();
      } else {
        openDropdown();
      }
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
      userProfileEl.focus();
    }
  });
}

if (logoutBtnEl) {
  logoutBtnEl.addEventListener("click", async function(event) {
    event.preventDefault();
    event.stopPropagation();
    const currentUid = auth.currentUser ? auth.currentUser.uid : null;
    try {
      await signOut(auth);
      if (currentUid) {
        sessionStorage.removeItem(`skillpath_first_login_${currentUid}`);
      }
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("skillpath_first_login_")) {
          sessionStorage.removeItem(key);
        }
      });
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to log out. Please check your network connection and try again.");
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

