/**
 * SkillPathAI Global Search Bar Handler
 * Enables search across all topbars: Pressing Enter or clicking the search icon
 * navigates to roadmap or practice filtered by the entered query.
 */
document.addEventListener("DOMContentLoaded", () => {
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

  // Global handler for help boxes (chat bot shortcut)
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
