const API_BASE = window.location.origin;
const API_KEY = process.env.API_KEYS;

// Professional SVG Icons
const ICONS = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  browser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  command: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m8 8 4 4-4 4"/><path d="M16 16h-4"/></svg>`,
  windows: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91v-6.99l10 .15z"/></svg>`,
  macos: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.01.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
  linux: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-1.36.108-2.85.908-3.966 2.157-1.053 1.178-1.824 2.695-2.314 4.228-.473 1.48-.742 2.954-.758 4.138-.016 1.057.091 1.863.305 2.309.191.397.478.478.478.478.218 0 .364-.064.472-.136.134-.09.23-.212.324-.356.188-.287.38-.684.59-1.158.422-.948.904-2.2 1.496-3.334.296-.567.62-1.08.984-1.49.363-.408.778-.715 1.26-.855.45-.13.92-.12 1.39.038.469.157.89.457 1.23.86.338.404.595.91.79 1.48.19.57.32 1.19.42 1.82.1.63.18 1.25.28 1.82.1.57.22 1.09.39 1.51.16.42.38.74.68.91.3.17.67.19 1.1.03.43-.16.89-.47 1.31-.89.42-.42.8-.95 1.09-1.52.29-.57.5-1.18.6-1.76.1-.58.1-1.14.01-1.6-.09-.46-.28-.83-.57-1.05-.29-.22-.67-.29-1.11-.19-.44.1-.92.36-1.38.72-.46.36-.9.82-1.26 1.31-.36.49-.64 1.01-.79 1.49-.08.24-.13.46-.16.63-.03.17-.04.3-.04.37l.06-.06c.18-.18.45-.38.8-.57.35-.19.77-.36 1.23-.47.46-.11.95-.16 1.42-.1.47.06.91.23 1.27.53.36.3.64.73.81 1.28.17.55.23 1.21.14 1.94-.09.73-.33 1.52-.7 2.29-.37.77-.86 1.51-1.44 2.14-.58.63-1.24 1.14-1.94 1.47-.7.33-1.44.48-2.16.39-.72-.09-1.4-.42-1.98-1.02-.58-.6-1.05-1.46-1.35-2.5-.3-1.04-.43-2.26-.35-3.55.08-1.29.35-2.65.82-3.94.47-1.29 1.14-2.51 2.01-3.5.87-.99 1.94-1.74 3.19-2.05 1.25-.31 2.67-.18 4.18.51 1.51.69 3.11 1.94 4.64 3.66 1.53 1.72 2.98 3.91 4.17 6.4.6 1.25 1.11 2.56 1.48 3.9.37 1.34.6 2.7.66 4.05.06 1.35-.06 2.69-.32 3.99-.13.65-.29 1.29-.5 1.92l-.08.24.21-.13c.33-.21.62-.45.87-.71.25-.26.46-.54.63-.83.17-.29.3-.59.4-.89.1-.3.16-.61.2-.92.04-.31.04-.62.02-.93-.02-.31-.08-.62-.17-.92-.09-.3-.21-.6-.36-.88-.15-.28-.33-.55-.53-.8z"/></svg>`,
  package: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/><path d="M2.32 6.16L12 11l9.68-4.84"/><path d="M12 22.76V11"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.1.8-.26.8-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.86 2.84 1.32 3.53 1.01.11-.79.42-1.32.77-1.63-2.7-.31-5.53-1.35-5.53-6 0-1.33.47-2.41 1.25-3.26-.13-.31-.54-1.54.12-3.21 0 0 1.02-.33 3.34 1.24.97-.27 2.01-.4 3.04-.41 1.03.01 2.07.14 3.04.41 2.32-1.57 3.34-1.24 3.34-1.24.66 1.67.25 2.9.12 3.21.78.85 1.25 1.93 1.25 3.26 0 4.66-2.84 5.69-5.54 5.99.44.38.83 1.12.83 2.26 0 1.63-.01 2.94-.01 3.34 0 .32.2.69.8.57C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
};

// App configurations with SVG icons
const APPS = [
  {
    id: "Defcomm-chat-app",
    name: "Defcomm Chat",
    icon: ICONS.chat,
    color: "#3b82f6",
  },
  {
    id: "Defcomm-browser",
    name: "Defcomm Browser",
    icon: ICONS.browser,
    color: "#10b981",
  },
  {
    id: "Defcommand",
    name: "Defcomm Command Center",
    icon: ICONS.command,
    color: "#8b5cf6",
  },
];

// Platform display names and icons
const PLATFORM_INFO = {
  windows: { name: "Windows", icon: ICONS.windows },
  darwin: { name: "macOS", icon: ICONS.macos },
  linux: { name: "Linux", icon: ICONS.linux },
};

function formatBytes(bytes) {
  if (!bytes) return "N/A";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchAppData(appId) {
  try {
    const response = await fetch(`${API_BASE}/api/updates/${appId}/latest`, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${appId}:`, error);
    return null;
  }
}

async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    document.getElementById("serverStatus").textContent = "● Online";
    document.getElementById("serverStatus").style.color = "#22c55e";
    document.getElementById("statusIndicator").innerHTML =
      `<span style="color: #22c55e;">●</span>`;

    return data;
  } catch (error) {
    document.getElementById("serverStatus").textContent = "● Offline";
    document.getElementById("serverStatus").style.color = "#ef4444";
    document.getElementById("statusIndicator").innerHTML =
      `<span style="color: #ef4444;">●</span>`;
    return null;
  }
}

function renderAppCard(app, data) {
  const hasData = data && data.version;
  const platforms = data?.platforms || {};
  const platformCount = Object.keys(platforms).length;

  let platformsHtml = "";
  if (platformCount > 0) {
    Object.entries(platforms).forEach(([key, platform]) => {
      const [target, arch] = key.split("-");
      const platformInfo = PLATFORM_INFO[target] || {
        name: target,
        icon: ICONS.package,
      };
      const archBadge = arch === "aarch64" ? "ARM64" : "x64";

      platformsHtml += `
        <div class="platform-item">
          <span class="platform-icon">${platformInfo.icon}</span>
          <span class="platform-name">${platformInfo.name} (${archBadge})</span>
          <span class="platform-size">${formatBytes(platform.size)}</span>
          <a href="${platform.url}" class="download-btn" target="_blank">Download</a>
        </div>
      `;
    });
  } else {
    platformsHtml =
      '<div class="empty-state" style="padding: 1rem; font-size: 0.8rem;">No builds available</div>';
  }

  return `
    <div class="app-card">
      <div class="app-header">
        <div class="app-icon" style="background: ${app.color}">${app.icon}</div>
        <span class="app-name">${app.name}</span>
        <span class="app-version">${hasData ? `v${data.version}` : "N/A"}</span>
      </div>
      <div class="app-body">
        ${
          hasData
            ? `
          <div class="release-info">
            <div class="release-date">
              Released: ${formatDate(data.pub_date)} • ${timeAgo(data.pub_date)}
            </div>
            <div class="release-notes">${data.notes || "No release notes"}</div>
          </div>
        `
            : `
          <div class="release-info">
            <div class="release-notes" style="color: #64748b;">No release data available</div>
          </div>
        `
        }
        <div class="platforms">
          ${platformsHtml}
        </div>
      </div>
      <div class="app-footer">
        <a href="https://github.com/SilexsecureTeam/${app.id}" class="repo-link" target="_blank">
          ${ICONS.github} github.com/SilexsecureTeam/${app.id}
        </a>
      </div>
    </div>
  `;
}

function updateStats(appsData) {
  const validApps = appsData.filter((d) => d !== null);
  const totalApps = validApps.length;
  const totalPlatforms = validApps.reduce(
    (sum, app) => sum + Object.keys(app.platforms || {}).length,
    0,
  );

  let latestDate = null;
  validApps.forEach((app) => {
    if (app?.pub_date) {
      const date = new Date(app.pub_date);
      if (!latestDate || date > latestDate) latestDate = date;
    }
  });

  document.getElementById("totalApps").textContent = totalApps;
  document.getElementById("totalPlatforms").textContent = totalPlatforms;
  document.getElementById("latestRelease").textContent = latestDate
    ? formatDate(latestDate)
    : "N/A";
}

async function loadAllData() {
  const grid = document.getElementById("appsGrid");
  grid.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading applications...</p>
    </div>
  `;

  await checkServerHealth();

  const appsData = await Promise.all(APPS.map((app) => fetchAppData(app.id)));

  updateStats(appsData.filter((d) => d !== null));

  const cardsHtml = APPS.map((app, index) =>
    renderAppCard(app, appsData[index]),
  ).join("");
  grid.innerHTML = cardsHtml;
}

// Set up refresh button with SVG
document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.querySelector(".refresh-btn");
  if (refreshBtn) {
    refreshBtn.innerHTML = `${ICONS.refresh} Refresh`;
  }

  // Update logo icon
  const logoIcon = document.querySelector(".logo-icon");
  if (logoIcon) {
    logoIcon.innerHTML = ICONS.package;
  }
});

setInterval(loadAllData, 5 * 60 * 1000);
loadAllData();
