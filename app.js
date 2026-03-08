// ===== RetroVault - レトロゲームコレクション管理 =====
const STORAGE_KEY = 'retrovault_games';
const PLATFORMS = {
  'ファミコン':'fc','スーパーファミコン':'sfc','メガドライブ':'md','ゲームボーイ':'gb',
  'ゲームボーイアドバンス':'gba','NINTENDO64':'n64','PlayStation':'ps1','セガサターン':'ss',
  'PCエンジン':'pce','ネオジオ':'neo','その他':'other'
};

let games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let wikiThumbUrl = '';
let suggestTimer = null;
let activePlatform = ''; // '' = すべて
let currentSort = 'title'; // 'title' or 'year'
let sortAsc = true; // true = ascending, false = descending

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  populateMakers();
  renderList();
  updateCount();
  // Ownership search
  document.getElementById('ownership-search-input').addEventListener('input', onOwnershipSearch);
  // Form events
  document.getElementById('f-title').addEventListener('input', onTitleInput);
  document.getElementById('f-photo').addEventListener('change', onPhotoSelect);
  // Close suggest on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.form-group')) document.getElementById('suggest-list').style.display = 'none';
  });
  // Touch swipe-down to close detail sheet
  setupSheetSwipe();
});

// ===== SORTING =====
function sortGames(list) {
  const sorted = [...list];
  if (currentSort === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  } else if (currentSort === 'year') {
    sorted.sort((a, b) => {
      const ya = parseInt(a.year) || 0;
      const yb = parseInt(b.year) || 0;
      return ya - yb;
    });
  }
  if (!sortAsc) sorted.reverse();
  return sorted;
}

function setSort(type) {
  if (currentSort === type) {
    sortAsc = !sortAsc;
  } else {
    currentSort = type;
    sortAsc = true;
  }
  updateSortButtons();
  renderList();
}

function updateSortButtons() {
  const titleBtn = document.getElementById('sort-title');
  const yearBtn = document.getElementById('sort-year');
  titleBtn.classList.toggle('active', currentSort === 'title');
  yearBtn.classList.toggle('active', currentSort === 'year');
  titleBtn.querySelector('.sort-arrow').textContent = currentSort === 'title' ? (sortAsc ? '▲' : '▼') : '▲';
  yearBtn.querySelector('.sort-arrow').textContent = currentSort === 'year' ? (sortAsc ? '▲' : '▼') : '▲';
}

// ===== MAKER FILTER =====
function populateMakers() {
  const makerSet = new Set(games.map(g => g.maker).filter(Boolean));
  const sel = document.getElementById('maker-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">すべてのメーカー</option>' +
    [...makerSet].sort((a, b) => a.localeCompare(b, 'ja')).map(m =>
      `<option value="${esc(m)}">${esc(m)}</option>`
    ).join('');
  sel.value = current;
}

// ===== PLATFORM TABS =====
function renderTabs() {
  const container = document.getElementById('platform-tabs');
  // Get platforms used in registered games
  const platformCounts = {};
  games.forEach(g => {
    const p = g.platform || 'その他';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });
  const usedPlatforms = Object.keys(platformCounts);

  let html = `<button class="platform-tab${activePlatform === '' ? ' active' : ''}" onclick="selectPlatform('')">
    すべて<span class="tab-count">(${games.length})</span></button>`;

  // Order by predefined order, then any extras
  const orderedPlatforms = Object.keys(PLATFORMS);
  const sorted = usedPlatforms.sort((a, b) => {
    const ia = orderedPlatforms.indexOf(a);
    const ib = orderedPlatforms.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  sorted.forEach(p => {
    const isActive = activePlatform === p;
    const pk = PLATFORMS[p] || 'other';
    html += `<button class="platform-tab${isActive ? ' active' : ''}" 
      style="${isActive ? `background:var(--${getPlatformCSSColor(pk)});border-color:var(--${getPlatformCSSColor(pk)})` : ''}"
      onclick="selectPlatform('${escAttr(p)}')">
      ${esc(p)}<span class="tab-count">(${platformCounts[p]})</span></button>`;
  });

  container.innerHTML = html;
}

function getPlatformCSSColor(pk) {
  const map = {
    'fc':'fc-red','sfc':'sfc-purple','md':'md-black','gb':'gb-olive',
    'gba':'gba-indigo','n64':'n64-green','ps1':'ps1-blue','ss':'ss-navy',
    'pce':'pce-orange','neo':'neo-gold','other':'text-dim'
  };
  return map[pk] || 'text-dim';
}

function selectPlatform(platform) {
  activePlatform = platform;
  renderTabs();
  renderList();
}

// ===== GAME LIST (title-only, sorted) =====
function renderList() {
  let filtered = activePlatform
    ? games.filter(g => g.platform === activePlatform)
    : games;
  // Maker filter
  const makerVal = document.getElementById('maker-filter').value;
  if (makerVal) {
    filtered = filtered.filter(g => g.maker === makerVal);
  }
  const sorted = sortGames(filtered);
  const container = document.getElementById('game-list');

  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">🎮</div>
      <p class="pixel" style="font-size:11px">ゲームが登録されていません</p>
      <p style="margin-top:8px;color:var(--text-dim)">「＋ 登録」ボタンから追加してください</p>
    </div>`;
    return;
  }

  container.innerHTML = sorted.map(g => {
    const pk = PLATFORMS[g.platform] || 'other';
    return `<div class="list-item" onclick="showDetail('${g.id}')">
      <div class="list-color-bar bar-${pk}"></div>
      <div class="list-title">${esc(g.title)}</div>
      <span class="list-platform-badge plat-${pk}">${esc(g.platform || '不明')}</span>
    </div>`;
  }).join('');
}

function updateCount() {
  document.getElementById('count-number').textContent = games.length;
}

// ===== OWNERSHIP SEARCH =====
function onOwnershipSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  const resultEl = document.getElementById('ownership-result');

  if (!q) {
    resultEl.innerHTML = '';
    return;
  }

  const found = games.filter(g => g.title.toLowerCase().includes(q));

  if (found.length > 0) {
    const matches = found.map(g => `✅ 所持しています（${esc(g.platform || '不明')}）— ${esc(g.title)}`).join('<br>');
    resultEl.innerHTML = `<div class="result-found">${matches}</div>`;
  } else {
    resultEl.innerHTML = `<div class="result-not-found">❌ 所持していません</div>`;
  }
}

// ===== DETAIL SHEET (Slide-up) =====
function showDetail(id) {
  const g = games.find(x => x.id === id); if (!g) return;
  const pk = PLATFORMS[g.platform] || 'other';

  let html = '';
  if (g.photo) {
    html += `<img class="detail-img" src="${g.photo}" alt="${esc(g.title)}">`;
  }
  html += `<div class="detail-title">${esc(g.title)}</div>`;
  html += `<span class="detail-platform-badge plat-${pk}">${esc(g.platform || '不明')}</span>`;
  html += `<div class="detail-info">
    <div class="detail-info-row"><span class="detail-info-label">🎯 ジャンル</span><span class="detail-info-value">${esc(g.genre || '不明')}</span></div>
    <div class="detail-info-row"><span class="detail-info-label">📅 発売年</span><span class="detail-info-value">${esc(g.year || '不明')}</span></div>
    <div class="detail-info-row"><span class="detail-info-label">🏭 メーカー</span><span class="detail-info-value">${esc(g.maker || '不明')}</span></div>
  </div>`;

  if (g.memo) {
    html += `<div class="detail-memo-title">📝 メモ・概要</div>
      <div class="detail-memo">${esc(g.memo)}</div>`;
  }

  html += `<div class="detail-actions">
    <button class="btn-edit-detail" onclick="closeDetail(); editGame('${g.id}')">✏️ 編集</button>
    <button class="btn-delete-detail" onclick="deleteGameFromDetail('${g.id}')">🗑 削除</button>
  </div>`;

  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('sheet-overlay').classList.add('active');
  // Slight delay for transition
  requestAnimationFrame(() => {
    document.getElementById('detail-sheet').classList.add('active');
  });
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-sheet').classList.remove('active');
  setTimeout(() => {
    document.getElementById('sheet-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }, 350);
}

function deleteGameFromDetail(id) {
  if (!confirm('このゲームを削除しますか？')) return;
  games = games.filter(g => g.id !== id);
  persist(); closeDetail(); renderTabs(); populateMakers(); renderList(); updateCount();
}

// Swipe-down to close
function setupSheetSwipe() {
  const sheet = document.getElementById('detail-sheet');
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  sheet.addEventListener('touchstart', e => {
    if (sheet.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      sheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentY - startY;
    if (diff > 100) {
      closeDetail();
    }
    sheet.style.transform = '';
    currentY = 0;
  });
}

// ===== FORM =====
function openForm() {
  resetForm();
  document.getElementById('form-modal').classList.add('active');
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}
function closeForm() { document.getElementById('form-modal').classList.remove('active'); }
function resetForm() {
  ['edit-id','f-title','f-genre','f-year','f-maker','f-memo','f-photo-data'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-platform').value = '';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('upload-text').style.display = '';
  document.getElementById('wiki-thumb-area').style.display = 'none';
  document.getElementById('suggest-list').style.display = 'none';
  wikiThumbUrl = '';
}

function saveGame() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { alert('タイトルを入力してください'); return; }
  const editId = document.getElementById('edit-id').value;
  const data = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    platform: document.getElementById('f-platform').value,
    genre: document.getElementById('f-genre').value.trim(),
    year: document.getElementById('f-year').value.trim(),
    maker: document.getElementById('f-maker').value.trim(),
    memo: document.getElementById('f-memo').value.trim(),
    photo: document.getElementById('f-photo-data').value || (editId ? (games.find(g => g.id === editId) || {}).photo || '' : '')
  };
  if (editId) { const idx = games.findIndex(g => g.id === editId); if (idx >= 0) games[idx] = data; }
  else games.unshift(data);
  persist(); closeForm(); renderTabs(); populateMakers(); renderList(); updateCount();
}

function editGame(id) {
  const g = games.find(x => x.id === id); if (!g) return;
  document.getElementById('edit-id').value = g.id;
  document.getElementById('f-title').value = g.title;
  document.getElementById('f-platform').value = g.platform;
  document.getElementById('f-genre').value = g.genre || '';
  document.getElementById('f-year').value = g.year || '';
  document.getElementById('f-maker').value = g.maker || '';
  document.getElementById('f-memo').value = g.memo || '';
  if (g.photo) {
    document.getElementById('f-photo-data').value = g.photo;
    document.getElementById('photo-preview').src = g.photo;
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('upload-text').style.display = 'none';
  }
  document.getElementById('form-modal').classList.add('active');
}

function deleteGame(id) {
  if (!confirm('このゲームを削除しますか？')) return;
  games = games.filter(g => g.id !== id);
  persist(); renderTabs(); populateMakers(); renderList(); updateCount();
}

// ===== PHOTO =====
function onPhotoSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w *= r; h *= r; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('f-photo-data').value = dataUrl;
      document.getElementById('photo-preview').src = dataUrl;
      document.getElementById('photo-preview').style.display = 'block';
      document.getElementById('upload-text').style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== WIKIPEDIA API =====
function onTitleInput(e) {
  clearTimeout(suggestTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { document.getElementById('suggest-list').style.display = 'none'; return; }
  suggestTimer = setTimeout(() => wikiSearch(q), 400);
}

async function wikiSearch(query) {
  const sl = document.getElementById('suggest-list');
  const loading = document.getElementById('wiki-loading');
  loading.style.display = 'inline';
  try {
    let results = await fetchSuggest('ja', query);
    if (results.length === 0) results = await fetchSuggest('en', query);
    if (results.length === 0) { sl.style.display = 'none'; return; }
    sl.innerHTML = results.map(r => `<div class="suggest-item" onclick="selectSuggest('${escAttr(r.title)}','${r.lang}')">${esc(r.title)}</div>`).join('');
    sl.style.display = 'block';
  } catch (err) { console.error('Wiki search error:', err); }
  finally { loading.style.display = 'none'; }
}

async function fetchSuggest(lang, query) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data[1] || data[1].length === 0) return [];
  return data[1].map(title => ({ title, lang }));
}

async function selectSuggest(title, lang) {
  document.getElementById('suggest-list').style.display = 'none';
  document.getElementById('f-title').value = title;
  document.getElementById('wiki-loading').style.display = 'inline';
  try {
    await fetchWikiDetails(title, lang);
  } catch (err) { console.error('Wiki detail error:', err); }
  finally { document.getElementById('wiki-loading').style.display = 'none'; }
}

async function fetchWikiDetails(title, lang) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (!page || page.missing) return;

  const extract = page.extract || '';
  const summary = extract.slice(0, 300);
  document.getElementById('f-memo').value = summary;
  parseExtractInfo(extract, lang);

  if (page.thumbnail && page.thumbnail.source) {
    wikiThumbUrl = page.thumbnail.source;
    const area = document.getElementById('wiki-thumb-area');
    document.getElementById('wiki-thumb-img').src = wikiThumbUrl;
    area.style.display = 'block';
  }
  await fetchInfobox(title, lang);
}

async function fetchInfobox(title, lang) {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=0&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.parse || !data.parse.wikitext) return;
    const wt = data.parse.wikitext['*'] || '';

    const getField = (...names) => {
      for (const n of names) {
        const re = new RegExp(`\\|\\s*${n}\\s*=\\s*(.+?)(?:\\n|$)`, 'i');
        const m = wt.match(re);
        if (m) return cleanWikiText(m[1].trim());
      }
      return '';
    };

    const platform = getField('対応機種', '機種', 'plat', 'platform', 'platforms');
    const genre = getField('ジャンル', 'genre', 'genres');
    const year = getField('発売日', '発売年', 'date', 'released', 'release', 'release date');
    const maker = getField('開発元', '発売元', 'dev', 'developer', 'publisher', 'pub', '販売元');

    if (platform && !document.getElementById('f-platform').value) {
      const matched = matchPlatform(platform);
      if (matched) document.getElementById('f-platform').value = matched;
    }
    if (genre && !document.getElementById('f-genre').value) document.getElementById('f-genre').value = genre;
    if (year && !document.getElementById('f-year').value) {
      const ym = year.match(/((?:19|20)\d{2})/);
      if (ym) document.getElementById('f-year').value = ym[1];
    }
    if (maker && !document.getElementById('f-maker').value) document.getElementById('f-maker').value = maker;
  } catch (e) { console.warn('Infobox parse failed:', e); }
}

function parseExtractInfo(text, lang) {
  const yearMatch = text.match(/((?:19|20)\d{2})年/);
  if (yearMatch && !document.getElementById('f-year').value) {
    document.getElementById('f-year').value = yearMatch[1];
  }
}

function matchPlatform(text) {
  const t = text.toLowerCase();
  const map = [
    [['ファミリーコンピュータ', 'ファミコン', 'famicom', 'nes', 'nintendo entertainment'], 'ファミコン'],
    [['スーパーファミコン', 'super famicom', 'snes', 'super nes', 'super nintendo'], 'スーパーファミコン'],
    [['メガドライブ', 'mega drive', 'genesis', 'sega genesis'], 'メガドライブ'],
    [['ゲームボーイアドバンス', 'game boy advance', 'gba'], 'ゲームボーイアドバンス'],
    [['ゲームボーイ', 'game boy'], 'ゲームボーイ'],
    [['nintendo 64', 'nintendo64', 'ニンテンドウ64', 'ニンテンドー64', 'n64'], 'NINTENDO64'],
    [['playstation', 'プレイステーション', 'ps1', 'ps one', 'psone'], 'PlayStation'],
    [['セガサターン', 'sega saturn', 'saturn'], 'セガサターン'],
    [['pcエンジン', 'pc engine', 'pc-engine', 'turbografx'], 'PCエンジン'],
    [['ネオジオ', 'neo geo', 'neogeo', 'neo-geo'], 'ネオジオ'],
  ];
  for (const [keys, val] of map) {
    if (keys.some(k => t.includes(k))) return val;
  }
  return '';
}

function cleanWikiText(t) {
  return t.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .trim();
}

async function useWikiThumb() {
  if (!wikiThumbUrl) return;
  try {
    const res = await fetch(wikiThumbUrl);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('f-photo-data').value = e.target.result;
      document.getElementById('photo-preview').src = e.target.result;
      document.getElementById('photo-preview').style.display = 'block';
      document.getElementById('upload-text').style.display = 'none';
      document.getElementById('wiki-thumb-area').classList.add('selected');
    };
    reader.readAsDataURL(blob);
  } catch (e) { console.warn('Thumb fetch failed:', e); alert('画像の取得に失敗しました'); }
}

// ===== UTILS =====
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(games)); }
  catch (e) { alert('保存容量を超えました。写真のサイズを小さくするか、不要なデータを削除してください。'); }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
