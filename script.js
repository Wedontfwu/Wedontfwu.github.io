// Simple timeline renderer (GitHub Pages ready).
// - Loads timeline.json from the same directory
// - Merges with items added locally via the form (stored in localStorage)
// - Sorts ascending by date and renders the timeline

const TIMELINE_JSON = 'timeline.json';
const LOCAL_KEY = 'timeline_custom_v1';

async function loadTimeline() {
  let base = [];
  try {
    const r = await fetch(TIMELINE_JSON, {cache: "no-store"});
    if (!r.ok) throw new Error('Could not load timeline.json');
    base = await r.json();
  } catch (e) {
    console.warn('Could not fetch timeline.json:', e);
  }
  const local = loadLocal();
  const all = [...base, ...local];
  const valid = all.filter(it => it.date && !Number.isNaN(new Date(it.date).getTime()));
  valid.sort((a,b)=> new Date(a.date) - new Date(b.date));
  return valid;
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }catch(e){
    console.warn('Failed to parse local timeline items', e);
    return [];
  }
}

function saveLocal(items){
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function addLocalItem(item){
  const items = loadLocal();
  items.push(item);
  saveLocal(items);
}

function clearLocalItems(){
  localStorage.removeItem(LOCAL_KEY);
}

function renderTimeline(items){
  const container = document.getElementById('timeline');
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<p class="no-items">No timeline items yet.</p>';
    return;
  }
  items.forEach((it, idx) => {
    const side = (idx % 2 === 0) ? 'left' : 'right';
    const el = document.createElement('article');
    el.className = `item ${side}`;
    el.innerHTML = `
      <div class="dot" aria-hidden="true"></div>
      <div class="card">
        <div class="date">${escapeHtml(formatDate(it.date))}</div>
        <h3 class="title">${escapeHtml(it.title)}</h3>
        ${it.subtitle ? `<div class="subtitle">${escapeHtml(it.subtitle)}</div>` : ''}
        <div class="content">${escapeHtml(it.content)}</div>
        ${it.image ? `<img class="thumb" src="${escapeAttr(it.image)}" alt="" loading="lazy">` : ''}
      </div>
    `;
    container.appendChild(el);
  });
}

function formatDate(d){
  try{
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  }catch(e){
    return d;
  }
}

function escapeHtml(s){
  if (!s) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function escapeAttr(s){
  if (!s) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('addForm');
  const clearBtn = document.getElementById('clearLocal');

  async function refresh() {
    const items = await loadTimeline();
    renderTimeline(items);
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const date = document.getElementById('itemDate').value;
    const title = document.getElementById('itemTitle').value.trim();
    const subtitle = document.getElementById('itemSubtitle').value.trim();
    const content = document.getElementById('itemContent').value.trim();
    const image = document.getElementById('itemImage').value.trim();

    if (!date || !title || !content) {
      alert('Please provide date, title and description.');
      return;
    }

    const item = { date, title, subtitle, content, image };
    addLocalItem(item);

    // Clear only the form inputs (not saved items)
    form.reset();
    refresh();
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all items added locally in this browser?')) return;
    clearLocalItems();
    refresh();
  });

  // initial render
  refresh();
});
