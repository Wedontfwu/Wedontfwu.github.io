/* script.js */

const TIMELINE_JSON = 'timeline.json';

// DOM elements
const timelineEl = document.getElementById('timeline');
const scrollLeftBtn = document.getElementById('scroll-left');
const scrollRightBtn = document.getElementById('scroll-right');
const sortOrderSel = document.getElementById('sort-order');
const viewModeSel = document.getElementById('view-mode');
const themeSel = document.getElementById('theme-select');

let events = [];
let currentView = 'graph';
timelineEl.classList.add('view-graph');

// Theme Handling
themeSel.addEventListener('change', (e) => {
  document.body.setAttribute('data-theme', e.target.value);
});

// View Handling
viewModeSel.addEventListener('change', (e) => {
  currentView = e.target.value;

  // Reset classes
  timelineEl.classList.remove('view-graph', 'view-vertical', 'view-horizontal');
  timelineEl.classList.add(`view-${currentView}`);

  // Rerender (Graph view needs specific positioning calculation)
  renderTimeline();
});

// Month Mapping
const MONTHS = { //this is prolly the worst fucking thing ive ever seen in coding // am fixing this today
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

function parseMonth(m) {
  if (m === undefined || m === null) return null;
  if (typeof m === 'number' && Number.isFinite(m)) {
    const n = Math.trunc(m);
    return (n >= 1 && n <= 12) ? n : null;
  }
  if (typeof m === 'string') {
    const trimmed = m.trim().toLowerCase();
    const n = Number(trimmed);
    if (!Number.isNaN(n) && Number.isFinite(n)) return (n >= 1 && n <= 12) ? n : null;
    return MONTHS[trimmed] || null;
  }
  return null;
}

function monthYearLabel(monthNum, year) {
  if (!year) return '';
  if (!monthNum) return String(year);
  const d = new Date(year, monthNum - 1, 1);
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function buildEventCard(ev, index) {
  const card = document.createElement('article');
  card.className = 'event';
  card.tabIndex = 0;

  // Graph View Positioning Logic
  if (currentView === 'graph') {
    // Calculate X based on date (approx pixels)
    // Assume 2010 is start (0px). 
    // 1 Year = 300px width?
    const startYear = 2010;
    const yearDiff = ev.year - startYear;
    const monthOffset = (ev.__monthNum || 1) / 12;
    const xPos = (yearDiff + monthOffset) * 200 + 50; // 200px per year

    // Calculate Y based on index (Simple staggering)
    // Top range: 50px to 400px
    const yStrata = ['50px', '250px', '450px', '150px', '350px'];
    const yPos = yStrata[index % 5];

    card.style.left = `${xPos}px`;
    card.style.top = yPos;
  } else {
    card.style.left = '';
    card.style.top = '';
  }

  const accent = document.createElement('span');
  accent.className = 'event-accent';
  if (ev.color) accent.style.background = ev.color;
  card.appendChild(accent);

  const date = document.createElement('div');
  date.className = 'event-date';
  date.textContent = monthYearLabel(ev.__monthNum, ev.year);
  card.appendChild(date);

  const h = document.createElement('h3');
  h.className = 'event-title';
  h.textContent = ev.name || 'Untitled';
  // Use theme color for title if specific color not provided, using CSS var usually better
  // but here we let specific JSON color override logic if we added that CSS rule.
  if (ev.color) h.style.color = ev.color;
  card.appendChild(h);

  const desc = document.createElement('div');
  desc.className = 'event-desc';
  desc.textContent = ev.description || '';
  card.appendChild(desc);

  return card;
}

function renderTimeline() {
  timelineEl.innerHTML = '';
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'event';
    empty.textContent = 'No events loaded.';
    timelineEl.appendChild(empty);
    return;
  }

  // For graph view, we might want a wider container
  if (currentView === 'graph') {
    // Estimate width based on last event year
    const lastEv = events[events.length - 1];
    const startYear = 2010;
    const width = ((lastEv.year - startYear) * 250) + 500;
    timelineEl.style.width = `${Math.max(width, window.innerWidth)}px`;
  } else {
    timelineEl.style.width = '100%';
  }

  events.forEach((ev, idx) => {
    const el = buildEventCard(ev, idx);
    timelineEl.appendChild(el);
  });
}

// Data Loading
async function loadTimeline() {
  try {
    // GitHub Pages caches heavily; add timestamp to force fresh data
    const url = `${TIMELINE_JSON}?t=${new Date().getTime()}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      // Fallback for some servers that might reject query params on static files (rare but possible)
      if (resp.status === 404) {
        const retry = await fetch(TIMELINE_JSON);
        if (retry.ok) {
          processJson(await retry.json());
          return;
        }
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    const json = await resp.json();
    processJson(json);

  } catch (err) {
    console.warn("Fetch error:", err);

    let msg = `Error loading data: ${err.message}`;
    if (window.location.protocol === 'file:') {
      msg = `<b>Local File Error:</b><br>Browsers block reading JSON files directly from your hard drive (CORS).<br><br>
        To fix:<br>
        1. Push to GitHub Pages (It will work there!)<br>
        2. Or run a local server (e.g., <code>python -m http.server</code>)<br>
        3. Or use VS Code "Live Server" extension.`;
    }

    timelineEl.innerHTML = `<div class="event" style="min-width: 300px; color: #ff6b6b; border-color: #ff6b6b;">${msg}</div>`;
  }
}

function processJson(json) {
  // Normalize
  events = json.map((e, idx) => {
    const monthNum = parseMonth(e.month);
    const yearNum = Number(e.year);
    if (!e.name || !yearNum) return null;
    return {
      ...e,
      year: yearNum,
      __monthNum: monthNum || 1, // default Jan if missing for sorting
      __originalIndex: idx
    };
  }).filter(x => x);

  applySort();
}

function applySort() {
  const order = sortOrderSel.value;
  events.sort((a, b) => {
    if (a.year !== b.year) return order === 'asc' ? a.year - b.year : b.year - a.year;
    return order === 'asc' ? a.__monthNum - b.__monthNum : b.__monthNum - a.__monthNum;
  });
  renderTimeline();
}

function scrollTimelineBy(px) {
  // Vertical view uses window scroll or wrapper scroll? 
  // Our CSS says .timeline has overflow, so we scroll that.

  if (currentView === 'vertical') {
    timelineEl.scrollTop += px;
  } else {
    timelineEl.scrollLeft += px;
  }
}

scrollLeftBtn.addEventListener('click', () => scrollTimelineBy(-400));
scrollRightBtn.addEventListener('click', () => scrollTimelineBy(400));
sortOrderSel.addEventListener('change', applySort);

loadTimeline();
