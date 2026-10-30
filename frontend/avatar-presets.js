/**
 * SkillPathAI Built-in Profile Avatar Presets
 * Six distinct learner avatars rendered as standalone, lightweight SVGs.
 * Requires zero external services or third-party dependencies.
 */

export const AVATAR_PRESETS = [
  {
    id: "avatar-1",
    name: "Tech Pioneer",
    role: "Full-Stack AI",
    accent: "#4f46e5",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av1)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><rect x="28" y="28" width="24" height="7" rx="3.5" fill="#4f46e5"/><circle cx="34" cy="31.5" r="1.5" fill="#38bdf8"/><circle cx="46" cy="31.5" r="1.5" fill="#38bdf8"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  },
  {
    id: "avatar-2",
    name: "Code Architect",
    role: "Backend & Systems",
    accent: "#059669",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av2)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><circle cx="34" cy="31" r="4" fill="none" stroke="#059669" stroke-width="2"/><circle cx="46" cy="31" r="4" fill="none" stroke="#059669" stroke-width="2"/><line x1="38" y1="31" x2="42" y2="31" stroke="#059669" stroke-width="2"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  },
  {
    id: "avatar-3",
    name: "Data Alchemist",
    role: "Data Science & ML",
    accent: "#d97706",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av3)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><rect x="30" y="24" width="20" height="4" rx="2" fill="#d97706"/><circle cx="35" cy="33" r="2" fill="#d97706"/><circle cx="45" cy="33" r="2" fill="#d97706"/><path d="M36 38q4 3 8 0" stroke="#d97706" stroke-width="2" fill="none"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  },
  {
    id: "avatar-4",
    name: "Cloud Specialist",
    role: "DevOps & Cloud",
    accent: "#1e40af",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e40af"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av4)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><circle cx="35" cy="31" r="2.5" fill="#1e40af"/><circle cx="45" cy="31" r="2.5" fill="#1e40af"/><path d="M34 38c3 3 9 3 12 0" stroke="#1e40af" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  },
  {
    id: "avatar-5",
    name: "Creative Designer",
    role: "UI/UX & Design",
    accent: "#db2777",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#db2777"/><stop offset="100%" stop-color="#9333ea"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av5)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><circle cx="34" cy="31" r="2.5" fill="#9333ea"/><circle cx="46" cy="31" r="2.5" fill="#9333ea"/><path d="M36 37q4 3 8 0" stroke="#db2777" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="30" cy="22" r="3" fill="#fb7185"/><circle cx="50" cy="22" r="3" fill="#fb7185"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  },
  {
    id: "avatar-6",
    name: "Cyber Sentinel",
    role: "Cybersecurity",
    accent: "#0f172a",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="av6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#av6)"/><circle cx="40" cy="32" r="14" fill="#ffffff"/><rect x="32" y="27" width="16" height="8" rx="2" fill="#0f172a"/><line x1="34" y1="31" x2="38" y2="31" stroke="#38bdf8" stroke-width="1.5"/><line x1="42" y1="31" x2="46" y2="31" stroke="#38bdf8" stroke-width="1.5"/><path d="M22 64c0-10 8-16 18-16s18 6 18 16" fill="#ffffff"/></svg>`
  }
].map(item => ({
  ...item,
  dataUrl: "data:image/svg+xml;utf8," + encodeURIComponent(item.svg)
}));

/**
 * Returns the currently active avatar data URL from localStorage or default.
 */
export function getActiveAvatar() {
  try {
    const saved = localStorage.getItem("skillpath_user_avatar");
    if (saved && (saved.startsWith("data:image/svg+xml") || saved.startsWith("http"))) {
      return saved;
    }
  } catch (e) {}
  return AVATAR_PRESETS[0].dataUrl;
}

/**
 * Returns the matched avatar preset or null.
 */
export function findPresetByUrl(url) {
  if (!url) return null;
  return AVATAR_PRESETS.find(p => p.dataUrl === url || url.includes(p.id)) || null;
}

/**
 * Updates all .user-avatar images on the current document.
 */
export function applyAvatarToDOM(avatarUrl) {
  const targetUrl = avatarUrl || getActiveAvatar();
  const avatarEls = document.querySelectorAll(".user-avatar");
  avatarEls.forEach(img => {
    if (img.src !== targetUrl) {
      img.src = targetUrl;
    }
  });
}
