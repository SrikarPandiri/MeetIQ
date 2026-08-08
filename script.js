const notesInput = document.querySelector("#notesInput");
const summarizeBtn = document.querySelector("#summarizeBtn");
const clearBtn = document.querySelector("#clearBtn");
const copyBtn = document.querySelector("#copyBtn");
const wordCount = document.querySelector("#wordCount");
const actionCount = document.querySelector("#actionCount");
const decisionCount = document.querySelector("#decisionCount");
const toast = document.querySelector("#toast");
const toneButtons = [...document.querySelectorAll(".tone-option")];
const tabs = [...document.querySelectorAll(".tab")];
const sections = [...document.querySelectorAll(".result-section")];
const themeButtons = [...document.querySelectorAll(".theme-option")];
const sidebarLinks = [...document.querySelectorAll(".sidebar-item")];

let activeTone = "brief";
let currentResult = null;

const NOT_SPECIFIED = "Not specified";
const savedTheme = getSavedTheme();

setTheme(savedTheme);

const sampleNotes = `Product planning sync - May 19

Priya said beta usage has reached 42 active accounts and support tickets are trending down.
Decision: keep the public launch date on June 12, but narrow the first launch region to North America.
Rahul will send revised onboarding copy by Friday.
Action: Maya to review the pricing page with legal before next Wednesday.
The team discussed analytics issues between web and mobile.
Risk: mobile event tracking is still inconsistent.
Question: should customer success own the migration email or should marketing send it?
Next step - schedule a launch readiness review for Monday.`;

notesInput.value = sampleNotes;

const actionPatterns = [
  /\b(action|todo|next step|follow up|follow-up)\b/i,
  /\b(will|needs to|need to|should|must|to)\b.+\b(by|before|after|on|for)\b/i,
  /\b(assign(?:ed)?|owner|responsible)\b/i,
];

const decisionPatterns = [
  /\b(decision|decided|agreed|approved|confirmed|resolved|finalized)\b/i,
  /\bwe will\b/i,
];

const questionPatterns = [
  /\?/,
  /\b(question|open issue|unclear|need clarity|blocker|risk)\b/i,
];

function splitNotes(text) {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function detectOwner(text) {
  const ownerMatch =
    text.match(/\b([A-Z][a-z]+)\s+(?:will|to|should|needs to|must)\b/) ||
    text.match(/\b(?:owner|assigned to|responsible):?\s*([A-Z][a-z]+)/i);
  return ownerMatch ? ownerMatch[1] : NOT_SPECIFIED;
}

function detectDeadline(text) {
  const dueMatch = text.match(
    /\b(by|before|after|on|for)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|today|tomorrow|eod|[A-Z][a-z]+\s+\d{1,2}|[A-Z][a-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2})\b/i
  );
  return dueMatch ? dueMatch[2] : NOT_SPECIFIED;
}

function detectPriority(text) {
  if (/\b(urgent|critical|blocked|blocker|risk|asap)\b/i.test(text)) return "High";
  if (/\b(important|priority|launch|legal|customer)\b/i.test(text)) return "Medium";
  return NOT_SPECIFIED;
}

function cleanPrefix(text) {
  return text.replace(/^(action|todo|next step|decision|question|risk|blocker)\s*[:-]\s*/i, "");
}

function scoreSentence(text) {
  const importantWords = /\b(launch|customer|revenue|risk|deadline|approved|blocked|priority|beta|support|pricing|legal|migration|decision|tracking)\b/gi;
  const matches = text.match(importantWords) || [];
  return matches.length + Math.min(text.length / 90, 2);
}

function buildSummary(sentences, tone) {
  if (!sentences.length) return [];

  const limits = {
    brief: 2,
    balanced: 4,
    detailed: 6,
  };

  return [...sentences]
    .sort((a, b) => scoreSentence(b) - scoreSentence(a))
    .slice(0, limits[tone])
    .map(cleanPrefix);
}

function classifyNotes(text) {
  const sentences = splitNotes(text);
  const actions = [];
  const decisions = [];
  const questions = [];

  sentences.forEach((sentence) => {
    if (decisionPatterns.some((pattern) => pattern.test(sentence))) {
      decisions.push(cleanPrefix(sentence));
    }

    if (questionPatterns.some((pattern) => pattern.test(sentence))) {
      questions.push(cleanPrefix(sentence));
    }

    if (actionPatterns.some((pattern) => pattern.test(sentence))) {
      actions.push({
        text: cleanPrefix(sentence),
        owner: detectOwner(sentence),
        deadline: detectDeadline(sentence),
        priority: detectPriority(sentence),
        status: "Open",
      });
    }
  });

  return {
    summary: buildSummary(sentences, activeTone),
    actions: dedupeActions(actions),
    decisions: [...new Set(decisions)],
    questions: [...new Set(questions)],
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = action.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderSummary(items) {
  const summary = document.querySelector("#summary");
  if (!items.length) {
    summary.innerHTML = emptyMarkup("No summary yet", "Add notes with concrete updates or outcomes.");
    return;
  }

  summary.innerHTML = items
    .map((item) => `<article class="summary-card"><p>${escapeHtml(item)}</p></article>`)
    .join("");
}

function renderActions(items) {
  const actions = document.querySelector("#actions");
  if (!items.length) {
    actions.innerHTML = emptyMarkup("No action items found", "Try including tasks, owners, follow-ups, or deadlines.");
    return;
  }

  actions.innerHTML = items
    .map(
      (item) => `
        <article class="item-card">
          <div class="item-meta">
            <span class="pill green">Owner: ${escapeHtml(item.owner)}</span>
            <span class="pill gold">Deadline: ${escapeHtml(item.deadline)}</span>
            <span class="pill gray">Priority: ${escapeHtml(item.priority)}</span>
            <span class="pill">Status: ${escapeHtml(item.status)}</span>
          </div>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderDeadlines(items) {
  const deadlines = document.querySelector("#deadlines");
  if (!items.length) {
    deadlines.innerHTML = emptyMarkup("No deadlines found", "Any missing or unclear dates are labeled Not specified in action items.");
    return;
  }

  deadlines.innerHTML = items
    .map(
      (item) => `
        <article class="item-card">
          <div class="item-meta">
            <span class="pill gold">${escapeHtml(item.deadline)}</span>
            <span class="pill green">${escapeHtml(item.owner)}</span>
          </div>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderList(selector, items, emptyTitle, emptyCopy, pillText, pillClass = "") {
  const target = document.querySelector(selector);
  if (!items.length) {
    target.innerHTML = emptyMarkup(emptyTitle, emptyCopy);
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
        <article class="item-card">
          <div class="item-meta">
            <span class="pill ${pillClass}">${pillText}</span>
          </div>
          <p>${escapeHtml(item)}</p>
        </article>
      `
    )
    .join("");
}

function emptyMarkup(title, copy) {
  return `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${copy}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function summarize() {
  const text = notesInput.value.trim();
  if (!text) {
    showToast("Paste meeting notes first.");
    return;
  }

  currentResult = classifyNotes(text);
  renderSummary(currentResult.summary);
  renderActions(currentResult.actions);
  renderDeadlines(currentResult.actions.filter((item) => item.deadline !== NOT_SPECIFIED));
  renderList("#decisions", currentResult.decisions, "No decisions found", "Decisions usually include agreed, approved, confirmed, or decided language.", "Decision");
  renderList("#questions", currentResult.questions, "No open questions found", "Questions, risks, and unclear items will collect here.", "Open", "rose");
  updateStats();
  showToast("MeetIQ analysis generated.");
}

function updateStats() {
  const words = notesInput.value.trim().match(/\S+/g) || [];
  wordCount.textContent = words.length;
  actionCount.textContent = currentResult?.actions.length || 0;
  decisionCount.textContent = currentResult?.decisions.length || 0;
}

function setActiveTab(tabId) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
  sections.forEach((section) => section.classList.toggle("active", section.id === tabId));
}

function routeHash(hash = window.location.hash) {
  const target = hash.replace("#", "");
  const tabTargets = ["summary", "actions", "decisions", "deadlines", "questions"];

  if (target === "summarizer") {
    setActiveTab("summary");
    setActiveSidebar("#summarizer");
    return;
  }

  if (tabTargets.includes(target)) {
    setActiveTab(target);
    setActiveSidebar(target === "summary" ? "#summarizer" : `#${target}`);
    document.querySelector("#summarizer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setActiveSidebar(href) {
  sidebarLinks.forEach((item) => item.classList.toggle("active", item.getAttribute("href") === href));
}

function makeCopyText() {
  if (!currentResult) return "";

  const actionLines = currentResult.actions.map(
    (item) =>
      `- ${item.text} (Owner: ${item.owner}; Deadline: ${item.deadline}; Priority: ${item.priority}; Status: ${item.status})`
  );
  const decisionLines = currentResult.decisions.map((item) => `- ${item}`);
  const questionLines = currentResult.questions.map((item) => `- ${item}`);
  const summaryLines = currentResult.summary.map((item) => `- ${item}`);
  const deadlineLines = currentResult.actions
    .filter((item) => item.deadline !== NOT_SPECIFIED)
    .map((item) => `- ${item.deadline}: ${item.text}`);

  return [
    "MeetIQ Meeting Recap",
    "",
    "Summary",
    ...(summaryLines.length ? summaryLines : ["- None found"]),
    "",
    "Action Items",
    ...(actionLines.length ? actionLines : ["- None found"]),
    "",
    "Decisions",
    ...(decisionLines.length ? decisionLines : ["- None found"]),
    "",
    "Deadlines",
    ...(deadlineLines.length ? deadlineLines : ["- None found"]),
    "",
    "Open Questions / Risks",
    ...(questionLines.length ? questionLines : ["- None found"]),
  ].join("\n");
}

async function copySummary() {
  const text = makeCopyText();
  if (!text) {
    showToast("Generate a summary first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch {
    showToast("Clipboard permission is blocked.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  saveTheme(nextTheme);
  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeOption === nextTheme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getSavedTheme() {
  try {
    return localStorage.getItem("meetiq-theme") || "light";
  } catch {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("meetiq-theme", theme);
  } catch {
    return;
  }
}

function resetOutput() {
  currentResult = null;
  renderSummary([]);
  renderActions([]);
  renderDeadlines([]);
  renderList("#decisions", [], "No decisions found", "Decisions usually include agreed, approved, confirmed, or decided language.", "Decision");
  renderList("#questions", [], "No open questions found", "Questions, risks, and unclear items will collect here.", "Open", "rose");
  updateStats();
}

toneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTone = button.dataset.tone;
    toneButtons.forEach((item) => item.classList.toggle("active", item === button));
    if (notesInput.value.trim()) summarize();
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

sidebarLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    setActiveSidebar(link.getAttribute("href"));
    const tabId = link.getAttribute("href")?.replace("#", "");
    if (["actions", "decisions", "deadlines", "questions"].includes(tabId)) {
      event.preventDefault();
      setActiveTab(tabId);
      document.querySelector("#summarizer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${tabId}`);
    }

    if (tabId === "summarizer") {
      setActiveTab("summary");
    }
  });
});

document.addEventListener("click", (event) => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;

  const tabId = anchor.getAttribute("href").replace("#", "");
  if (!["summary", "actions", "decisions", "deadlines", "questions"].includes(tabId)) return;

  event.preventDefault();
  setActiveTab(tabId);
  setActiveSidebar(tabId === "summary" ? "#summarizer" : `#${tabId}`);
  document.querySelector("#summarizer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${tabId}`);
});

window.addEventListener("hashchange", () => routeHash());

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
});

notesInput.addEventListener("input", updateStats);
summarizeBtn.addEventListener("click", summarize);
copyBtn.addEventListener("click", copySummary);
clearBtn.addEventListener("click", () => {
  notesInput.value = "";
  resetOutput();
  notesInput.focus();
});

updateStats();
routeHash();
