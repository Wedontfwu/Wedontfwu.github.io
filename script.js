/* script.js - Improved Timeline Application */

const CONFIG = {
  dataSource: 'timeline.json',
  defaultView: 'graph',
  defaultTheme: 'default',
  defaultSort: 'asc',
  
  layout: {
    pixelsPerYear: 300,
    startYear: 2010,
    cardWidth: 260,
    yPositions: [50, 250, 450, 150, 350, 200, 400, 100, 300, 500],
    minGraphHeight: 700,
    scrollAmount: 400
  }
};

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
  events: [],
  currentView: CONFIG.defaultView,
  currentTheme: CONFIG.defaultTheme,
  sortOrder: CONFIG.defaultSort
};

// ============================================
// DOM REFERENCES
// ============================================

const DOM = {
  timeline: document.getElementById('timeline'),
  wrapper: document.getElementById('timeline-wrapper'),
  viewSelect: document.getElementById('view-mode'),
  themeSelect: document.getElementById('theme-select'),
  sortSelect: document.getElementById('sort-order'),
  scrollLeftBtn: document.getElementById('scroll-left'),
  scrollRightBtn: document.getElementById('scroll-right')
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format date for display
 * Expects month as full name (e.g., "January") and year as number
 */
function formatDate(month, year) {
  if (!year) return '';
  if (!month) return String(year);
  return `${month} ${year}`;
}

/**
 * Calculate position for graph view
 */
function calculateGraphPosition(event, index) {
  const { pixelsPerYear, startYear, yPositions } = CONFIG.layout;
  
  // Calculate X position based on year and month
  const yearDiff = event.year - startYear;
  const monthOffset = event.monthNumber / 12;
  const x = (yearDiff + monthOffset) * pixelsPerYear + 50;
  
  // Calculate Y position using rotation pattern
  const y = yPositions[index % yPositions.length];
  
  return { x, y };
}

/**
 * Display error message
 */
function showError(message) {
  DOM.timeline.innerHTML = `
    <div class="event" style="max-width: 500px; border-color: #ff6b6b;">
      <div class="event-title" style="color: #ff6b6b;">Error Loading Timeline</div>
      <div class="event-desc">${message}</div>
    </div>
  `;
}

// ============================================
// DATA LOADING & PROCESSING
// ============================================

/**
 * Load timeline data from JSON
 */
async function loadTimelineData() {
  try {
    // Add cache-busting timestamp
    const url = `${CONFIG.dataSource}?t=${Date.now()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // Fallback without query params
      if (response.status === 404) {
        const retryResponse = await fetch(CONFIG.dataSource);
        if (retryResponse.ok) {
          return await retryResponse.json();
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Failed to load timeline data:', error);
    
    // Provide helpful error messages
    if (window.location.protocol === 'file:') {
      showError(`
        <strong>CORS Error:</strong> Browsers block reading JSON files from local filesystem.<br><br>
        <strong>Solutions:</strong><br>
        • Deploy to GitHub Pages<br>
        • Run a local server: <code>python -m http.server</code><br>
        • Use VS Code "Live Server" extension
      `);
    } else {
      showError(`Failed to load data: ${error.message}`);
    }
    
    return null;
  }
}

/**
 * Process and normalize raw event data
 * Expected JSON format:
 * {
 *   "name": "Event Name",
 *   "description": "Event description",
 *   "month": "January",  // Full month name
 *   "year": 2010,        // Number
 *   "color": "#ff0000"   // Optional
 * }
 */
function processEvents(rawData) {
  if (!Array.isArray(rawData)) {
    console.error('Invalid data format: expected array');
    return [];
  }
  
  return rawData
    .map((event, index) => {
      const year = Number(event.year);
      
      // Validate required fields
      if (!event.name || !year || isNaN(year)) {
        console.warn('Skipping invalid event:', event);
        return null;
      }
      
      // Get month number for sorting and positioning
      const monthNumber = getMonthNumber(event.month);
      
      return {
        name: event.name,
        description: event.description || '',
        month: event.month || '', // Keep original month name for display
        year: year,
        monthNumber: monthNumber, // For sorting and positioning
        color: event.color || null,
        originalIndex: index
      };
    })
    .filter(Boolean); // Remove null entries
}

/**
 * Sort events based on current sort order
 */
function sortEvents(events) {
  const order = state.sortOrder;
  
  return [...events].sort((a, b) => {
    // Sort by year first
    if (a.year !== b.year) {
      return order === 'asc' ? a.year - b.year : b.year - a.year;
    }
    
    // Then by month number
    return order === 'asc' 
      ? a.monthNumber - b.monthNumber 
      : b.monthNumber - a.monthNumber;
  });
}

// ============================================
// RENDERING
// ============================================

/**
 * Create an event card element
 */
function createEventCard(event, index) {
  const card = document.createElement('article');
  card.className = 'event';
  card.tabIndex = 0;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${event.name} - ${formatDate(event.month, event.year)}`);
  
  // Apply graph view positioning
  if (state.currentView === 'graph') {
    const { x, y } = calculateGraphPosition(event, index);
    card.style.position = 'absolute';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }
  
  // Build card content
  const accentStyle = event.color ? `style="background: ${event.color};"` : '';
  const titleStyle = event.color ? `style="color: ${event.color};"` : '';
  
  card.innerHTML = `
    <span class="event-accent" ${accentStyle}></span>
    <div class="event-date">${formatDate(event.month, event.year)}</div>
    <h3 class="event-title" ${titleStyle}>${event.name}</h3>
    <div class="event-desc">${event.description}</div>
  `;
  
  return card;
}

/**
 * Calculate and set timeline dimensions for graph view
 */
function setGraphDimensions() {
  if (state.currentView !== 'graph' || state.events.length === 0) {
    return;
  }
  
  const { pixelsPerYear, minGraphHeight } = CONFIG.layout;
  
  // Find date range
  const years = state.events.map(e => e.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // Calculate required width
  const yearSpan = maxYear - minYear + 1;
  const calculatedWidth = yearSpan * pixelsPerYear + 400;
  const finalWidth = Math.max(calculatedWidth, window.innerWidth);
  
  // Calculate required height
  const finalHeight = Math.max(minGraphHeight, window.innerHeight - 200);
  
  // Apply dimensions
  DOM.timeline.style.width = `${finalWidth}px`;
  DOM.timeline.style.height = `${finalHeight}px`;
  DOM.timeline.style.minHeight = `${finalHeight}px`;
}

/**
 * Reset timeline dimensions for non-graph views
 */
function resetDimensions() {
  DOM.timeline.style.width = '';
  DOM.timeline.style.height = '';
  DOM.timeline.style.minHeight = '';
}

/**
 * Render the timeline with current events and view
 */
function renderTimeline() {
  // Clear existing content
  DOM.timeline.innerHTML = '';
  
  // Handle empty state
  if (state.events.length === 0) {
    DOM.timeline.innerHTML = '<div class="loading">No events to display</div>';
    return;
  }
  
  // Sort events
  const sortedEvents = sortEvents(state.events);
  
  // Set dimensions for graph view
  if (state.currentView === 'graph') {
    setGraphDimensions();
  } else {
    resetDimensions();
  }
  
  // Create and append event cards
  const fragment = document.createDocumentFragment();
  sortedEvents.forEach((event, index) => {
    const card = createEventCard(event, index);
    fragment.appendChild(card);
  });
  
  DOM.timeline.appendChild(fragment);
}

// ============================================
// VIEW MANAGEMENT
// ============================================

/**
 * Switch timeline view mode
 */
function changeView(newView) {
  state.currentView = newView;
  
  // Update timeline classes
  DOM.timeline.classList.remove('view-graph', 'view-vertical', 'view-horizontal');
  DOM.timeline.classList.add(`view-${newView}`);
  
  // Re-render with new view
  renderTimeline();
}

/**
 * Change color theme
 */
function changeTheme(newTheme) {
  state.currentTheme = newTheme;
  document.body.setAttribute('data-theme', newTheme);
}

/**
 * Change sort order
 */
function changeSortOrder(newOrder) {
  state.sortOrder = newOrder;
  renderTimeline();
}

// ============================================
// SCROLLING
// ============================================

/**
 * Scroll timeline in specified direction
 */
function scrollTimeline(amount) {
  const target = state.currentView === 'vertical' 
    ? DOM.timeline 
    : DOM.wrapper;
  
  const scrollProperty = state.currentView === 'vertical' 
    ? 'scrollTop' 
    : 'scrollLeft';
  
  target[scrollProperty] += amount;
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
  // View mode changes
  DOM.viewSelect.addEventListener('change', (e) => {
    changeView(e.target.value);
  });
  
  // Theme changes
  DOM.themeSelect.addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
  
  // Sort order changes
  DOM.sortSelect.addEventListener('change', (e) => {
    changeSortOrder(e.target.value);
  });
  
  // Scroll buttons
  DOM.scrollLeftBtn.addEventListener('click', () => {
    scrollTimeline(-CONFIG.layout.scrollAmount);
  });
  
  DOM.scrollRightBtn.addEventListener('click', () => {
    scrollTimeline(CONFIG.layout.scrollAmount);
  });
  
  // Keyboard navigation
  DOM.timeline.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      scrollTimeline(-CONFIG.layout.scrollAmount);
    } else if (e.key === 'ArrowRight') {
      scrollTimeline(CONFIG.layout.scrollAmount);
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the timeline application
 */
async function init() {
  console.log('Initializing Anarchy Client Timeline...');
  
  // Load and process data
  const rawData = await loadTimelineData();
  if (!rawData) return; // Error already displayed
  
  state.events = processEvents(rawData);
  
  if (state.events.length === 0) {
    showError('No valid events found in timeline data');
    return;
  }
  
  console.log(`Loaded ${state.events.length} events`);
  
  // Set initial view
  changeView(state.currentView);
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('Timeline initialized successfully');
}

// Start the application
init();
