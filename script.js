/* script.js - Improved Timeline Application */

// Constants
const CONFIG = {
  TIMELINE_JSON: 'timeline.json',
  SCROLL_AMOUNT: 400,
  GRAPH_START_YEAR: 2010,
  GRAPH_PIXELS_PER_YEAR: 200,
  GRAPH_BASE_OFFSET: 50,
  GRAPH_Y_POSITIONS: ['50px', '250px', '450px', '150px', '350px']
};

// Month mapping with cleaner approach
const MONTH_MAP = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4],
  ['may', 5], ['june', 6], ['july', 7], ['august', 8],
  ['september', 9], ['october', 10], ['november', 11], ['december', 12],
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4],
  ['jun', 6], ['jul', 7], ['aug', 8], ['sep', 9],
  ['sept', 9], ['oct', 10], ['nov', 11], ['dec', 12]
]);

// State management
const state = {
  events: [],
  currentView: 'graph',
  currentTheme: 'default',
  sortOrder: 'asc'
};

// DOM element cache
const dom = {
  timeline: null,
  scrollLeftBtn: null,
  scrollRightBtn: null,
  sortOrderSel: null,
  viewModeSel: null,
  themeSel: null,
  loading: null,
  timelineWrapper: null
};

/**
 * Initialize DOM references
 */
function initDOM() {
  dom.timeline = document.getElementById('timeline');
  dom.scrollLeftBtn = document.getElementById('scroll-left');
  dom.scrollRightBtn = document.getElementById('scroll-right');
  dom.sortOrderSel = document.getElementById('sort-order');
  dom.viewModeSel = document.getElementById('view-mode');
  dom.themeSel = document.getElementById('theme-select');
  dom.loading = document.getElementById('loading');
  dom.timelineWrapper = document.getElementById('timeline-wrapper');
}

/**
 * Parse month from various formats (string, number)
 * @param {string|number} month - Month to parse
 * @returns {number|null} Month number 1-12 or null
 */
function parseMonth(month) {
  if (month === undefined || month === null) return null;
  
  // Handle numeric input
  if (typeof month === 'number' && Number.isFinite(month)) {
    const n = Math.trunc(month);
    return (n >= 1 && n <= 12) ? n : null;
  }
  
  // Handle string input
  if (typeof month === 'string') {
    const trimmed = month.trim().toLowerCase();
    
    // Try parsing as number
    const n = Number(trimmed);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      return (n >= 1 && n <= 12) ? n : null;
    }
    
    // Look up in month map
    return MONTH_MAP.get(trimmed) || null;
  }
  
  return null;
}

/**
 * Format month and year into readable label
 * @param {number|null} monthNum - Month number
 * @param {number} year - Year
 * @returns {string} Formatted date string
 */
function formatMonthYear(monthNum, year) {
  if (!year) return '';
  if (!monthNum) return String(year);
  
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleString(undefined, { 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Calculate graph view positioning for an event
 * @param {Object} event - Event object
 * @param {number} index - Event index
 * @returns {Object} Position object with left and top
 */
function calculateGraphPosition(event, index) {
  const yearDiff = event.year - CONFIG.GRAPH_START_YEAR;
  const monthOffset = (event.__monthNum || 1) / 12;
  const xPos = (yearDiff + monthOffset) * CONFIG.GRAPH_PIXELS_PER_YEAR + CONFIG.GRAPH_BASE_OFFSET;
  const yPos = CONFIG.GRAPH_Y_POSITIONS[index % CONFIG.GRAPH_Y_POSITIONS.length];
  
  return { left: `${xPos}px`, top: yPos };
}

/**
 * Create an event card element
 * @param {Object} event - Event data
 * @param {number} index - Event index
 * @returns {HTMLElement} Event card element
 */
function buildEventCard(event, index) {
  const card = document.createElement('article');
  card.className = 'event';
  card.tabIndex = 0;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${event.name} - ${formatMonthYear(event.__monthNum, event.year)}`);

  // Apply graph positioning if in graph view
  if (state.currentView === 'graph') {
    const position = calculateGraphPosition(event, index);
    card.style.left = position.left;
    card.style.top = position.top;
  } else {
    card.style.left = '';
    card.style.top = '';
  }

  // Accent dot
  const accent = document.createElement('span');
  accent.className = 'event-accent';
  accent.setAttribute('aria-hidden', 'true');
  if (event.color) {
    accent.style.background = event.color;
  }
  card.appendChild(accent);

  // Date
  const date = document.createElement('time');
  date.className = 'event-date';
  date.textContent = formatMonthYear(event.__monthNum, event.year);
  if (event.year && event.__monthNum) {
    date.setAttribute('datetime', `${event.year}-${String(event.__monthNum).padStart(2, '0')}`);
  }
  card.appendChild(date);

  // Title
  const title = document.createElement('h3');
  title.className = 'event-title';
  title.textContent = event.name || 'Untitled';
  if (event.color) {
    title.style.color = event.color;
  }
  card.appendChild(title);

  // Description
  const desc = document.createElement('p');
  desc.className = 'event-desc';
  desc.textContent = event.description || '';
  card.appendChild(desc);

  return card;
}

/**
 * Calculate timeline width for graph view
 * @returns {number} Width in pixels
 */
function calculateGraphWidth() {
  if (state.events.length === 0) return window.innerWidth;
  
  const lastEvent = state.events[state.events.length - 1];
  const width = ((lastEvent.year - CONFIG.GRAPH_START_YEAR) * 250) + 500;
  return Math.max(width, window.innerWidth);
}

/**
 * Render the timeline with current events
 */
function renderTimeline() {
  // Clear existing content
  dom.timeline.innerHTML = '';
  
  // Handle empty state
  if (state.events.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'event empty-state';
    emptyMessage.textContent = 'No events loaded.';
    dom.timeline.appendChild(emptyMessage);
    return;
  }

  // Set timeline width for graph view
  if (state.currentView === 'graph') {
    dom.timeline.style.width = `${calculateGraphWidth()}px`;
  } else {
    dom.timeline.style.width = '100%';
  }

  // Create and append event cards
  const fragment = document.createDocumentFragment();
  state.events.forEach((event, index) => {
    const card = buildEventCard(event, index);
    fragment.appendChild(card);
  });
  
  dom.timeline.appendChild(fragment);
  dom.timeline.setAttribute('aria-busy', 'false');
}

/**
 * Process and normalize JSON data
 * @param {Array} json - Raw JSON data
 */
function processJSON(json) {
  if (!Array.isArray(json)) {
    throw new Error('Timeline data must be an array');
  }

  state.events = json
    .map((event, index) => {
      const monthNum = parseMonth(event.month);
      const yearNum = Number(event.year);
      
      // Skip invalid events
      if (!event.name || !yearNum || !Number.isFinite(yearNum)) {
        console.warn('Skipping invalid event:', event);
        return null;
      }
      
      return {
        ...event,
        year: yearNum,
        __monthNum: monthNum || 1, // Default to January
        __originalIndex: index
      };
    })
    .filter(Boolean); // Remove null entries

  applySort();
}

/**
 * Sort events based on current sort order
 */
function applySort() {
  const order = state.sortOrder;
  
  state.events.sort((a, b) => {
    // Sort by year first
    if (a.year !== b.year) {
      return order === 'asc' ? a.year - b.year : b.year - a.year;
    }
    // Then by month
    return order === 'asc' 
      ? a.__monthNum - b.__monthNum 
      : b.__monthNum - a.__monthNum;
  });
  
  renderTimeline();
}

/**
 * Show loading state
 */
function showLoading() {
  if (dom.loading) {
    dom.loading.style.display = 'flex';
  }
  if (dom.timelineWrapper) {
    dom.timelineWrapper.style.display = 'none';
  }
}

/**
 * Hide loading state
 */
function hideLoading() {
  if (dom.loading) {
    dom.loading.style.display = 'none';
  }
  if (dom.timelineWrapper) {
    dom.timelineWrapper.style.display = 'flex';
  }
}

/**
 * Display error message to user
 * @param {string} message - Error message
 */
function showError(message) {
  hideLoading();
  dom.timeline.innerHTML = `
    <div class="event error-state" role="alert">
      <h3>⚠️ Error Loading Timeline</h3>
      <p>${message}</p>
    </div>
  `;
  dom.timeline.setAttribute('aria-busy', 'false');
}

/**
 * Load timeline data from JSON file
 */
async function loadTimeline() {
  showLoading();
  
  try {
    // Add cache-busting timestamp
    const url = `${CONFIG.TIMELINE_JSON}?t=${Date.now()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // Try without cache-busting on 404
      if (response.status === 404) {
        const retryResponse = await fetch(CONFIG.TIMELINE_JSON);
        if (retryResponse.ok) {
          const json = await retryResponse.json();
          processJSON(json);
          hideLoading();
          return;
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const json = await response.json();
    processJSON(json);
    hideLoading();
    
  } catch (error) {
    console.error('Failed to load timeline:', error);
    
    let errorMessage = `Error loading timeline: ${error.message}`;
    
    // Special handling for file:// protocol
    if (window.location.protocol === 'file:') {
      errorMessage = `
        <strong>Local File Error</strong><br><br>
        Browsers block reading JSON files directly from your hard drive (CORS policy).<br><br>
        <strong>Solutions:</strong><br>
        • Push to GitHub Pages (it will work there!)<br>
        • Run a local server: <code>python -m http.server</code><br>
        • Use VS Code's "Live Server" extension
      `;
    }
    
    showError(errorMessage);
  }
}

/**
 * Scroll the timeline by a specified amount
 * @param {number} pixels - Amount to scroll
 */
function scrollTimelineBy(pixels) {
  if (state.currentView === 'vertical') {
    dom.timeline.scrollTop += pixels;
  } else {
    dom.timeline.scrollLeft += pixels;
  }
}

/**
 * Handle theme change
 * @param {string} theme - Theme name
 */
function handleThemeChange(theme) {
  state.currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  
  // Save preference to localStorage
  try {
    localStorage.setItem('timeline-theme', theme);
  } catch (e) {
    // localStorage might be disabled
    console.warn('Could not save theme preference:', e);
  }
}

/**
 * Handle view mode change
 * @param {string} view - View mode
 */
function handleViewChange(view) {
  state.currentView = view;
  
  // Update timeline classes
  dom.timeline.classList.remove('view-graph', 'view-vertical', 'view-horizontal');
  dom.timeline.classList.add(`view-${view}`);
  
  // Re-render for new positioning
  renderTimeline();
  
  // Save preference
  try {
    localStorage.setItem('timeline-view', view);
  } catch (e) {
    console.warn('Could not save view preference:', e);
  }
}

/**
 * Handle sort order change
 * @param {string} order - Sort order ('asc' or 'desc')
 */
function handleSortChange(order) {
  state.sortOrder = order;
  applySort();
  
  // Save preference
  try {
    localStorage.setItem('timeline-sort', order);
  } catch (e) {
    console.warn('Could not save sort preference:', e);
  }
}

/**
 * Load saved preferences from localStorage
 */
function loadPreferences() {
  try {
    const savedTheme = localStorage.getItem('timeline-theme');
    const savedView = localStorage.getItem('timeline-view');
    const savedSort = localStorage.getItem('timeline-sort');
    
    if (savedTheme && dom.themeSel) {
      dom.themeSel.value = savedTheme;
      handleThemeChange(savedTheme);
    }
    
    if (savedView && dom.viewModeSel) {
      dom.viewModeSel.value = savedView;
      state.currentView = savedView;
    }
    
    if (savedSort && dom.sortOrderSel) {
      dom.sortOrderSel.value = savedSort;
      state.sortOrder = savedSort;
    }
  } catch (e) {
    console.warn('Could not load preferences:', e);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Theme selector
  dom.themeSel?.addEventListener('change', (e) => {
    handleThemeChange(e.target.value);
  });

  // View mode selector
  dom.viewModeSel?.addEventListener('change', (e) => {
    handleViewChange(e.target.value);
  });

  // Sort order selector
  dom.sortOrderSel?.addEventListener('change', (e) => {
    handleSortChange(e.target.value);
  });

  // Scroll buttons
  dom.scrollLeftBtn?.addEventListener('click', () => {
    scrollTimelineBy(-CONFIG.SCROLL_AMOUNT);
  });
  
  dom.scrollRightBtn?.addEventListener('click', () => {
    scrollTimelineBy(CONFIG.SCROLL_AMOUNT);
  });

  // Keyboard navigation for timeline
  dom.timeline?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      scrollTimelineBy(-CONFIG.SCROLL_AMOUNT);
    } else if (e.key === 'ArrowRight') {
      scrollTimelineBy(CONFIG.SCROLL_AMOUNT);
    }
  });
}

/**
 * Initialize the application
 */
function init() {
  initDOM();
  loadPreferences();
  setupEventListeners();
  loadTimeline();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
