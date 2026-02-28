/**
 * tag-service.js - タグ検索・Tooltip
 */
let currentSearchResults = [];
let currentSearchIndex = 0;
const SEARCH_BATCH_SIZE = 50;

async function fetchFromDB() {
  const btn = document.getElementById("statusBtn");
  try {
    const response = await fetch("danboru_dictionary.json");
    if (!response.ok) throw new Error("データの読み込みに失敗しました");
    const data = await response.json();
    tagDatabase = data.tags;
    tagMap = new Map(
      tagDatabase.map((i) => [
        i.t.trim().toLowerCase().replace(/_/g, " "),
        i.c,
      ]),
    );
    allThresholds = data.thresholds || [];
    currentThresholds =
      allThresholds.length > 0
        ? allThresholds
        : [
            { minCount: 10000, colorCode: "#3498db", label: "Very Common" },
            { minCount: 1000, colorCode: "#2ecc71", label: "Common" },
            { minCount: 0, colorCode: "#e74c3c", label: "Rare" },
          ];
    renderLegend();
    btn.innerText =
      i18n[currentLang].loaded +
      tagDatabase.length.toLocaleString() +
      (currentLang === "ja" ? "件" : " tags");
    btn.className = "refresh-btn status-success";
    document.getElementById("tagSearch").disabled = false;
  } catch (err) {
    console.error(err);
    btn.innerText = i18n[currentLang].loadFail;
    btn.style.backgroundColor = "#e74c3c";
  }
}

function renderLegend() {
  if (!currentThresholds || currentThresholds.length === 0) return;
  document.getElementById("legendArea").innerHTML = currentThresholds
    .map((t) => {
      const labelText =
        currentLang === "en" && t.label_en
          ? t.label_en
          : t.label_ja || t.label || "";
      const titleText =
        currentLang === "en"
          ? `${t.minCount.toLocaleString()}+`
          : `${t.minCount.toLocaleString()} ～`;
      return `<div class="legend-item" title="${titleText}"><span class="color-dot" style="background-color: ${t.colorCode}"></span><span>${labelText.split("(")[0].trim()}</span></div>`;
    })
    .join("");
}

function searchTags() {
  const query = document
    .getElementById("tagSearch")
    .value.toLowerCase()
    .replace(/_/g, " ");
  const resultDiv = document.getElementById("searchResult");
  if (!query) {
    resultDiv.innerHTML = "";
    currentSearchResults = [];
    return;
  }
  currentSearchResults = tagDatabase
    .filter(
      (i) =>
        i.t.toLowerCase().replace(/_/g, " ").includes(query) ||
        (i.tr && i.tr.toLowerCase().includes(query)) ||
        (i.j && i.j.includes(query)),
    )
    .sort((a, b) => b.c - a.c);
  currentSearchIndex = 0;
  resultDiv.innerHTML = "";
  renderNextSearchBatch();
}

function renderNextSearchBatch() {
  if (currentSearchIndex >= currentSearchResults.length) return;
  const resultDiv = document.getElementById("searchResult");
  const nextBatch = currentSearchResults.slice(
    currentSearchIndex,
    currentSearchIndex + SEARCH_BATCH_SIZE,
  );
  const html = nextBatch
    .map((i) => {
      return `<div class="tag-item" draggable="true" data-tag="${i.t}" data-detail="${JSON.stringify(i).replace(/"/g, "&quot;")}"
                 onclick="copyTag('${i.t}', this)" onmouseenter="showTooltip(event, this)" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
            <span style="font-weight:bold; color:var(--text-color);">${i.t}</span> 
            <span style="background-color: var(--tag-bg); padding: 2px 8px; border-radius: 12px; color:${getColorByCount(i.c)}; float:right; font-weight:bold;">${i.c.toLocaleString()}</span>
            <div class="tag-subtext">${i.j || i.tr || ""}</div>
          </div>`;
    })
    .join("");
  resultDiv.insertAdjacentHTML("beforeend", html);
  currentSearchIndex += SEARCH_BATCH_SIZE;
}

function handleSearchScroll() {
  const resultDiv = document.getElementById("searchResult");
  if (
    resultDiv.scrollTop + resultDiv.clientHeight >=
    resultDiv.scrollHeight - 50
  )
    renderNextSearchBatch();
}

const tooltipEl = document.createElement("div");
tooltipEl.id = "customTooltip";
tooltipEl.style.maxHeight = "80vh";
tooltipEl.style.overflowY = "auto";
document.body.appendChild(tooltipEl);

function showTooltip(e, element) {
  const t = document.getElementById("customTooltip");
  if (!t) return;
  const data = JSON.parse(element.dataset.detail);
  t.innerHTML = `
    <div class="tooltip-row"><span class="tooltip-label">TAG</span><span class="tooltip-value val-tag">${escapeHTML(data.t)}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">TRANS</span><span class="tooltip-value val-trans">${escapeHTML(data.tr || "-")}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">JP</span><span class="tooltip-value">${escapeHTML(data.j || "-")}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">COUNT</span><span class="tooltip-value val-count">${(data.c || 0).toLocaleString()}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">GROUP</span><span class="tooltip-value">${escapeHTML(data.g || "-")}</span></div>
  `;
  t.style.display = "block";
  moveTooltip(e);
}

function hideTooltip() {
  const t = document.getElementById("customTooltip");
  if (t) t.style.display = "none";
}

function moveTooltip(e) {
  const t = document.getElementById("customTooltip");
  if (!t || t.style.display === "none") return;
  let left = e.clientX - t.offsetWidth - 20,
    top = e.clientY + 20;
  if (left < 10) left = e.clientX + 20;
  if (top + t.offsetHeight > window.innerHeight)
    top = Math.max(10, window.innerHeight - t.offsetHeight - 10);
  t.style.left = left + "px";
  t.style.top = top + "px";
}
