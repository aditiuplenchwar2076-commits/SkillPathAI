/**
 * SkillPathAI Global Navigation, Search, and UI Controller
 * - Search bar navigation on Enter or Icon click
 * - Collapsible Desktop Sidebar rail (with auto tooltips and localStorage state persistence)
 * - Mobile Slide-in Navigation Drawer (with backdrop, scroll lock, and touch-friendly close)
 * - Global Avatar Synchronization from localStorage / Firebase profile
 */
document.addEventListener("DOMContentLoaded", () => {
  /* ==========================================================================
     1. GLOBAL AVATAR INITIALIZATION
     ========================================================================== */
  try {
    const savedAvatar = localStorage.getItem("skillpath_user_avatar");
    if (savedAvatar) {
      document.querySelectorAll(".user-avatar").forEach((img) => {
        if (img.src !== savedAvatar) {
          img.src = savedAvatar;
        }
      });
    }
  } catch (e) {
    console.warn("Could not apply stored avatar:", e);
  }

  /* ==========================================================================
     2. COLLAPSIBLE SIDEBAR & MOBILE NAVIGATION DRAWER
     ========================================================================== */
  const sidebar = document.querySelector(".sidebar");
  let backdrop = document.getElementById("sidebarBackdrop");

  // Ensure backdrop element exists for mobile slide-in drawer
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "sidebarBackdrop";
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  // Ensure every sidebar link has a data-tooltip for collapsed desktop mode
  if (sidebar) {
    const navLinks = sidebar.querySelectorAll(".nav-menu a");
    navLinks.forEach((link) => {
      if (!link.getAttribute("data-tooltip")) {
        const text = (link.textContent || "").replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").trim();
        if (text) {
          link.setAttribute("data-tooltip", text);
        }
      }
    });

    // Restore desktop collapsed preference (only on desktop screens > 768px)
    if (window.innerWidth > 768) {
      try {
        const isCollapsed = localStorage.getItem("skillpath_sidebar_collapsed") === "true";
        if (isCollapsed) {
          sidebar.classList.add("collapsed");
        }
      } catch (e) {}
    }

    // Update ARIA on toggle buttons
    const updateAriaState = () => {
      const isDesktop = window.innerWidth > 768;
      const isExpanded = isDesktop
        ? !sidebar.classList.contains("collapsed")
        : sidebar.classList.contains("drawer-open");
      const toggles = document.querySelectorAll("#menuToggle, .sidebar-toggle, .mobile-menu-btn");
      toggles.forEach((btn) => {
        btn.setAttribute("aria-expanded", String(isExpanded));
      });
    };
    updateAriaState();

    // Open/Close Mobile Drawer helpers
    const openMobileDrawer = () => {
      sidebar.classList.add("drawer-open");
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";
      updateAriaState();
    };

    const closeMobileDrawer = () => {
      sidebar.classList.remove("drawer-open");
      backdrop.classList.remove("active");
      document.body.style.overflow = "";
      updateAriaState();
    };

    // Toggle Desktop Sidebar Collapse
    const toggleDesktopCollapse = () => {
      const willBeCollapsed = !sidebar.classList.contains("collapsed");
      if (willBeCollapsed) {
        sidebar.classList.add("collapsed");
      } else {
        sidebar.classList.remove("collapsed");
      }
      try {
        localStorage.setItem("skillpath_sidebar_collapsed", String(willBeCollapsed));
      } catch (e) {}
      updateAriaState();
    };

    // Unified toggle click handler
    const handleToggleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        if (sidebar.classList.contains("drawer-open")) {
          closeMobileDrawer();
        } else {
          openMobileDrawer();
        }
      } else {
        toggleDesktopCollapse();
      }
    };

    // Ensure topbar has mobile-menu-btn on mobile viewports
    const topbar = document.querySelector(".topbar");
    if (topbar && !topbar.querySelector(".mobile-menu-btn")) {
      const mobileBtn = document.createElement("button");
      mobileBtn.className = "mobile-menu-btn";
      mobileBtn.id = "mobileMenuBtn";
      mobileBtn.setAttribute("aria-label", "Open navigation menu");
      mobileBtn.textContent = "☰";
      topbar.insertBefore(mobileBtn, topbar.firstChild);
    }

    // Attach to any sidebar toggle or menu toggle buttons
    const toggleButtons = document.querySelectorAll("#menuToggle, .sidebar-toggle, .mobile-menu-btn");
    toggleButtons.forEach((btn) => {
      btn.addEventListener("click", handleToggleClick);
    });

    // Close mobile drawer when clicking backdrop
    backdrop.addEventListener("click", closeMobileDrawer);

    // Close mobile drawer when clicking a navigation link
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          closeMobileDrawer();
        }
      });
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("drawer-open")) {
        closeMobileDrawer();
      }
    });

    // Reset drawer state on window resize
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && sidebar.classList.contains("drawer-open")) {
        closeMobileDrawer();
      }
    });
  }

  /* ==========================================================================
     3. SEARCH BAR HANDLER
     ========================================================================== */
  const searchInputs = document.querySelectorAll(".search-input");
  searchInputs.forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `practice.html?topic_name=${encodeURIComponent(query)}`;
        }
      }
    });

    const searchContainer = input.closest(".search-bar");
    if (searchContainer) {
      const icon = searchContainer.querySelector(".search-icon");
      if (icon) {
        icon.style.cursor = "pointer";
        icon.setAttribute("title", "Click to search");
        icon.addEventListener("click", () => {
          const query = input.value.trim();
          if (query) {
            window.location.href = `practice.html?topic_name=${encodeURIComponent(query)}`;
          } else {
            input.focus();
          }
        });
      }
    }
  });

  /* ==========================================================================
     4. HELP BOX (SAFE SHORTCUT)
     ========================================================================== */
  const helpBoxes = document.querySelectorAll(".help-box");
  helpBoxes.forEach((box) => {
    box.style.cursor = "pointer";
    box.setAttribute("title", "Open AI Assistant");
    box.addEventListener("click", () => {
      const openChatBtn = document.getElementById("openChatBtn");
      if (openChatBtn) {
        openChatBtn.click();
      } else {
        window.location.href = "dashboard.html";
      }
    });
  });
});
