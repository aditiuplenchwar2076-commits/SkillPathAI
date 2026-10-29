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

/* ==========================================================================
   1. Responsive Mobile Menu Handler
   ========================================================================== */
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

/* ==========================================================================
   2. Authentication Aware Topbar Buttons
   ========================================================================== */
const navAuthBtn = document.getElementById("navAuthBtn");
const navGetStartedBtn = document.getElementById("navGetStartedBtn");

onAuthStateChanged(auth, (user) => {
  if (user) {
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

/* ==========================================================================
   3. Active Navigation Highlighting (Requirement 1)
   ========================================================================== */
const navLinks = document.querySelectorAll(".nav-menu .nav-link");
const sections = document.querySelectorAll("section[id]");

function setActiveNavLink(targetId) {
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const linkTarget = href ? href.replace("#", "") : "";
    if (linkTarget === targetId) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  });
}

if ("IntersectionObserver" in window && sections.length > 0) {
  // Use IntersectionObserver with rootMargin tuned to the sticky header (74px)
  const observerOptions = {
    root: null,
    rootMargin: "-25% 0px -55% 0px",
    threshold: 0.1
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        if (id) {
          setActiveNavLink(id);
        }
      }
    });
  }, observerOptions);

  sections.forEach((sec) => sectionObserver.observe(sec));
} else {
  // Fallback scroll listener
  window.addEventListener("scroll", () => {
    let currentId = "home";
    const scrollPos = window.scrollY + 120;
    sections.forEach((sec) => {
      if (scrollPos >= sec.offsetTop) {
        currentId = sec.getAttribute("id") || currentId;
      }
    });
    setActiveNavLink(currentId);
  }, { passive: true });
}

// Smooth scrolling with sticky header offset on nav link click
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) {
      e.preventDefault();
      const targetSec = document.querySelector(href);
      if (targetSec) {
        const headerOffset = 76;
        const elementPosition = targetSec.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
        setActiveNavLink(href.replace("#", ""));
      }
    }
  });
});

/* ==========================================================================
   4. Career Catalog Data (9 Official Career Paths)
   ========================================================================== */
const careersData = [
  {
    id: "web-dev",
    name: "Web Developer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    desc: "Build modern, responsive web applications, component architectures, and full-stack cloud interfaces.",
    skills: ["HTML5 / CSS3", "Modern JavaScript", "React", "RESTful APIs", "State Management", "Tailwind CSS"],
    outcome: "Job-ready frontend & full-stack development fluency with verifiable portfolio projects."
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    desc: "Transform complex operational datasets into clear, actionable executive metrics and visual dashboards.",
    skills: ["SQL Querying", "Advanced Excel", "Power BI", "Python (Pandas)", "Tableau", "Data Modeling"],
    outcome: "Master exploratory querying, statistical dashboards, and decision intelligence."
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.66 18.2A2 2 0 0 0 6.36 21h11.28a2 2 0 0 0 1.7-2.8L14 9.31V2"/><line x1="8" y1="2" x2="16" y2="2"/></svg>`,
    desc: "Discover predictive patterns and train machine learning models to solve complex mathematical problems.",
    skills: ["Python", "Applied Statistics", "Scikit-Learn", "Feature Engineering", "Data Wrangling", "Hypothesis Testing"],
    outcome: "Fluency in predictive modeling, exploratory analysis, and production ML pipelines."
  },
  {
    id: "ai-ml",
    name: "AI / ML Engineer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
    desc: "Train and deploy deep neural architectures, LLMs, and autonomous generative AI agents.",
    skills: ["PyTorch / TensorFlow", "Deep Learning", "Transformers & LLMs", "Prompt Engineering", "MLOps", "Vector Databases"],
    outcome: "Design, fine-tune, and deploy intelligent AI systems at scale."
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity Analyst",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    desc: "Safeguard cloud infrastructure, analyze vulnerabilities, monitor threats, and enforce network security.",
    skills: ["Network Security", "Threat Hunting", "Penetration Testing", "SIEM Monitoring", "Linux Security", "Cryptography"],
    outcome: "Defend production networks against intrusions and lead security incident responses."
  },
  {
    id: "ui-ux",
    name: "UI/UX Designer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    desc: "Craft user-centered digital interfaces, design tokens, responsive layouts, and interactive Figma prototypes.",
    skills: ["Figma", "User Research", "Wireframing", "Interaction Design", "Design Systems", "Usability Testing"],
    outcome: "Deliver seamless, accessible user experiences from napkin wireframe to design handoff."
  },
  {
    id: "cloud-eng",
    name: "Cloud Engineer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    desc: "Architect resilient cloud architectures, automate infrastructure deployment, and optimize compute workloads.",
    skills: ["AWS / Azure", "Docker & Kubernetes", "CI/CD Pipelines", "Linux Administration", "Terraform", "Serverless"],
    outcome: "Deploy highly available, scalable cloud infrastructure and automated release pipelines."
  },
  {
    id: "mobile-dev",
    name: "Mobile App Developer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
    desc: "Build performant native and cross-platform mobile experiences for iOS and Android mobile users.",
    skills: ["Flutter & Dart", "React Native", "Mobile UI Patterns", "Push Notifications", "Offline Caching", "App Store Release"],
    outcome: "Publish polished, responsive mobile applications to app stores."
  },
  {
    id: "software-eng",
    name: "Software Engineer",
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    desc: "Master algorithms, data structures, object-oriented software engineering, and scalable distributed systems.",
    skills: ["Data Structures & Algorithms", "System Design", "OOP / Clean Code", "Database Architecture", "Git & CI/CD", "Testing"],
    outcome: "Excel in technical coding rounds and design fault-tolerant backend architectures."
  }
];

/* ==========================================================================
   5. Career Selection State & Details Panel Rendering (Requirements 7 & 8)
   ========================================================================== */
let selectedCareer = localStorage.getItem("skillpath_career") || localStorage.getItem("careerPath") || "Web Developer";

const panelTitle = document.getElementById("panelTitle");
const panelDesc = document.getElementById("panelDesc");
const panelSkills = document.getElementById("panelSkills");
const panelOutcome = document.getElementById("panelOutcome");
const panelBadge = document.getElementById("panelBadge");
const btnStartAssessment = document.getElementById("btnStartAssessment");
const panelCloseBtn = document.getElementById("panelCloseBtn");

function updateDetailsPanel(careerName) {
  const careerObj = careersData.find((c) => c.name.toLowerCase() === careerName.toLowerCase()) || careersData[0];
  selectedCareer = careerObj.name;

  if (panelTitle) panelTitle.textContent = careerObj.name;
  if (panelDesc) panelDesc.textContent = careerObj.desc;
  if (panelOutcome) panelOutcome.textContent = careerObj.outcome;
  if (panelBadge) panelBadge.textContent = "Selected Career";

  if (panelSkills) {
    panelSkills.innerHTML = careerObj.skills
      .map((skill) => `<span class="career-skill-tag">${skill}</span>`)
      .join("");
  }

  // Update selected class across 3D cube tiles and arc cards
  document.querySelectorAll(".cube-tile").forEach((tile) => {
    const tileName = tile.dataset.career;
    if (tileName && tileName.toLowerCase() === selectedCareer.toLowerCase()) {
      tile.classList.add("selected");
      tile.setAttribute("aria-selected", "true");
    } else {
      tile.classList.remove("selected");
      tile.setAttribute("aria-selected", "false");
    }
  });

  document.querySelectorAll(".arc-card").forEach((card) => {
    const cardName = card.dataset.career;
    if (cardName && cardName.toLowerCase() === selectedCareer.toLowerCase()) {
      card.classList.add("selected");
      card.setAttribute("aria-selected", "true");
    } else {
      card.classList.remove("selected");
      card.setAttribute("aria-selected", "false");
    }
  });

  // Persist choice into existing localStorage keys
  try {
    localStorage.setItem("skillpath_career", selectedCareer);
    localStorage.setItem("careerPath", selectedCareer);
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

// Connect Start Skill Assessment button directly to existing assessment flow
if (btnStartAssessment) {
  btnStartAssessment.addEventListener("click", () => {
    try {
      localStorage.setItem("skillpath_career", selectedCareer);
      localStorage.setItem("careerPath", selectedCareer);
    } catch (e) {}
    window.location.href = "asses.html";
  });
}

if (panelCloseBtn) {
  panelCloseBtn.addEventListener("click", () => {
    updateDetailsPanel(careersData[0].name);
  });
}

/* ==========================================================================
   6. Render 3D Career Cube (Requirement 8)
   ========================================================================== */
const cubeFrontTiles = document.getElementById("cubeFrontTiles");
const cube3D = document.getElementById("cube3D");
const cubeViewport = document.getElementById("cubeViewport");

let currentRotX = -12;
let currentRotY = -18;
let isDragging = false;
let startPointerX = 0;
let startPointerY = 0;
let startRotX = 0;
let startRotY = 0;
let wasDragging = false;
let totalDragDistance = 0;

function renderCubeFront() {
  if (!cubeFrontTiles) return;
  cubeFrontTiles.innerHTML = careersData
    .map(
      (career, index) => `
    <button type="button" class="cube-tile ${career.name.toLowerCase() === selectedCareer.toLowerCase() ? "selected" : ""}"
            data-career="${career.name}"
            data-index="${index}"
            tabindex="0"
            role="button"
            aria-selected="${career.name.toLowerCase() === selectedCareer.toLowerCase() ? "true" : "false"}"
            aria-label="${career.name}">
      <span class="cube-tile-icon" aria-hidden="true">${career.iconSvg}</span>
      <span class="cube-tile-name">${career.name}</span>
    </button>
  `
    )
    .join("");

  // Tile selection event listeners
  cubeFrontTiles.querySelectorAll(".cube-tile").forEach((tile) => {
    tile.addEventListener("click", (e) => {
      if (wasDragging) {
        wasDragging = false;
        return;
      }
      const career = tile.dataset.career;
      if (career) updateDetailsPanel(career);
    });

    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const career = tile.dataset.career;
        if (career) updateDetailsPanel(career);
      }
    });
  });
}

// Cube Drag-to-Rotate Gesture
if (cubeViewport && cube3D) {
  cubeViewport.addEventListener("pointerdown", (e) => {
    isDragging = true;
    wasDragging = false;
    totalDragDistance = 0;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startRotX = currentRotX;
    startRotY = currentRotY;
    cube3D.classList.remove("animating");
    cubeViewport.setPointerCapture(e.pointerId);
  });

  cubeViewport.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;
    totalDragDistance = Math.hypot(dx, dy);

    if (totalDragDistance > 7) {
      wasDragging = true;
    }

    currentRotY = startRotY + dx * 0.42;
    currentRotX = Math.max(-42, Math.min(42, startRotX - dy * 0.42));
    cube3D.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      try {
        cubeViewport.releasePointerCapture(e.pointerId);
      } catch (err) {}
      setTimeout(() => {
        wasDragging = false;
      }, 50);
    }
  };

  cubeViewport.addEventListener("pointerup", stopDrag);
  cubeViewport.addEventListener("pointercancel", stopDrag);

  // Rotation Control Buttons
  const btnRotateLeft = document.getElementById("btnRotateLeft");
  const btnResetCube = document.getElementById("btnResetCube");
  const btnRotateRight = document.getElementById("btnRotateRight");

  if (btnRotateLeft) {
    btnRotateLeft.addEventListener("click", () => {
      cube3D.classList.add("animating");
      currentRotY -= 40;
      cube3D.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
    });
  }

  if (btnRotateRight) {
    btnRotateRight.addEventListener("click", () => {
      cube3D.classList.add("animating");
      currentRotY += 40;
      cube3D.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
    });
  }

  if (btnResetCube) {
    btnResetCube.addEventListener("click", () => {
      cube3D.classList.add("animating");
      currentRotX = -12;
      currentRotY = -18;
      cube3D.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
    });
  }

  // Keyboard accessibility on cube viewport
  cubeViewport.setAttribute("tabindex", "0");
  cubeViewport.addEventListener("keydown", (e) => {
    cube3D.classList.add("animating");
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      currentRotY -= 20;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      currentRotY += 20;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentRotX = Math.min(42, currentRotX + 15);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      currentRotX = Math.max(-42, currentRotX - 15);
    }
    cube3D.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
  });
}

/* ==========================================================================
   7. Render Semicircular Arc View (Requirement 7)
   ========================================================================== */
const arcCardsRow = document.getElementById("arcCardsRow");

function renderArcCards() {
  if (!arcCardsRow) return;
  arcCardsRow.innerHTML = careersData
    .map(
      (career, index) => `
    <button type="button" class="arc-card ${career.name.toLowerCase() === selectedCareer.toLowerCase() ? "selected" : ""}"
            data-career="${career.name}"
            data-index="${index}"
            tabindex="0"
            role="button"
            aria-selected="${career.name.toLowerCase() === selectedCareer.toLowerCase() ? "true" : "false"}"
            aria-label="${career.name}">
      <span class="arc-card-icon" aria-hidden="true">${career.iconSvg}</span>
      <span class="arc-card-title">${career.name}</span>
    </button>
  `
    )
    .join("");

  arcCardsRow.querySelectorAll(".arc-card").forEach((card) => {
    card.addEventListener("click", () => {
      const career = card.dataset.career;
      if (career) updateDetailsPanel(career);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const career = card.dataset.career;
        if (career) updateDetailsPanel(career);
      }
    });
  });
}

/* ==========================================================================
   8. View Switcher (3D Cube vs Semicircular Arc View)
   ========================================================================== */
const btnCubeView = document.getElementById("btnCubeView");
const btnArcView = document.getElementById("btnArcView");
const cubeContainer = document.getElementById("cubeContainer");
const arcContainer = document.getElementById("arcContainer");

if (btnCubeView && btnArcView && cubeContainer && arcContainer) {
  btnCubeView.addEventListener("click", () => {
    btnCubeView.classList.add("active");
    btnCubeView.setAttribute("aria-selected", "true");
    btnArcView.classList.remove("active");
    btnArcView.setAttribute("aria-selected", "false");

    cubeContainer.classList.remove("hidden");
    arcContainer.classList.remove("active");
  });

  btnArcView.addEventListener("click", () => {
    btnArcView.classList.add("active");
    btnArcView.setAttribute("aria-selected", "true");
    btnCubeView.classList.remove("active");
    btnCubeView.setAttribute("aria-selected", "false");

    cubeContainer.classList.add("hidden");
    arcContainer.classList.add("active");
  });
}

// Initialize on DOM load
renderCubeFront();
renderArcCards();
updateDetailsPanel(selectedCareer);
