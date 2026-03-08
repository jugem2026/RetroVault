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
  populateGenres();
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

function populateGenres() {
  const genreSet = new Set(games.map(g => g.genre).filter(Boolean));
  const sel = document.getElementById('genre-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">すべてのジャンル</option>' +
    [...genreSet].sort((a, b) => a.localeCompare(b, 'ja')).map(g =>
      `<option value="${esc(g)}">${esc(g)}</option>`
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
  // Genre filter
  const genreVal = document.getElementById('genre-filter').value;
  if (genreVal) {
    filtered = filtered.filter(g => g.genre === genreVal);
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
  persist(); closeDetail(); renderTabs(); populateMakers(); populateGenres(); renderList(); updateCount();
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
  document.getElementById('photo-preview').src = '';
  document.getElementById('upload-text').style.display = '';
  document.getElementById('btn-clear-photo').style.display = 'none';
  document.getElementById('f-photo').value = '';
  document.getElementById('wiki-thumb-area').style.display = 'none';
  document.getElementById('suggest-list').style.display = 'none';
  wikiThumbUrl = '';
}

function clearPhoto(e) {
  e.stopPropagation();
  document.getElementById('f-photo-data').value = '';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('photo-preview').src = '';
  document.getElementById('upload-text').style.display = '';
  document.getElementById('btn-clear-photo').style.display = 'none';
  document.getElementById('f-photo').value = '';
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
  persist(); closeForm(); renderTabs(); populateMakers(); populateGenres(); renderList(); updateCount();
}

function editGame(id) {
  resetForm();
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
    document.getElementById('btn-clear-photo').style.display = 'block';
  }
  document.getElementById('form-modal').classList.add('active');
}

function deleteGame(id) {
  if (!confirm('このゲームを削除しますか？')) return;
  games = games.filter(g => g.id !== id);
  persist(); renderTabs(); populateMakers(); populateGenres(); renderList(); updateCount();
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
      document.getElementById('btn-clear-photo').style.display = 'block';
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

    // Sort: game-related results first
    results.sort((a, b) => (b.isGame ? 1 : 0) - (a.isGame ? 1 : 0));

    sl.innerHTML = results.map(r => {
      const badge = r.isGame ? '<span style="color:#e85d5d;font-size:10px;margin-left:4px">🎮</span>' : '';
      const desc = r.snippet ? `<span style="font-size:10px;color:var(--text-dim);display:block;margin-top:2px">${r.snippet}</span>` : '';
      return `<div class="suggest-item" onclick="selectSuggest('${escAttr(r.title)}','${r.lang}')">${esc(r.title)}${badge}${desc}</div>`;
    }).join('');
    sl.style.display = 'block';
  } catch (err) { console.error('Wiki search error:', err); }
  finally { loading.style.display = 'none'; }
}

// Game-related category keywords
const GAME_CAT_KEYWORDS = [
  'ゲーム', 'ソフト', 'コンピュータ', 'ファミコン', 'ファミリーコンピュータ',
  'スーパーファミコン', 'メガドライブ', 'ゲームボーイ', 'プレイステーション',
  'セガサターン', 'nintendo', 'playstation', 'sega', 'game', 'video game',
  'ネオジオ', 'pcエンジン', 'アーケード', 'コンソール'
];

async function fetchSuggest(lang, query) {
  // Use generator=search with prop=categories to get results + their categories in one call
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&gsrnamespace=0&prop=categories&clshow=!hidden&cllimit=20&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.query || !data.query.pages) return [];

  const pages = Object.values(data.query.pages);
  // Sort by search index
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));

  return pages.map(page => {
    const cats = (page.categories || []).map(c => c.title.toLowerCase());
    const isGame = cats.some(cat => GAME_CAT_KEYWORDS.some(kw => cat.includes(kw)));
    // Build a short snippet from category names
    const gameCat = (page.categories || []).find(c =>
      GAME_CAT_KEYWORDS.some(kw => c.title.toLowerCase().includes(kw))
    );
    const snippet = gameCat ? gameCat.title.replace('Category:', '').replace('カテゴリ:', '') : '';
    return { title: page.title, lang, isGame, snippet };
  }).slice(0, 8);
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
  // Use redirects=1 to follow redirects (important for popular games)
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&piprop=thumbnail&pithumbsize=400&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (!page || page.missing) return;

  const resolvedTitle = page.title || title;
  const extract = page.extract || '';
  const summary = extract.slice(0, 300);
  document.getElementById('f-memo').value = summary;

  // Try to extract info from the text as a fallback
  parseExtractInfo(extract, lang);

  if (page.thumbnail && page.thumbnail.source) {
    wikiThumbUrl = page.thumbnail.source;
    const area = document.getElementById('wiki-thumb-area');
    document.getElementById('wiki-thumb-img').src = wikiThumbUrl;
    area.style.display = 'block';
  }

  // Fetch infobox using the resolved title (after redirects)
  await fetchInfobox(resolvedTitle, lang);
}

async function fetchInfobox(title, lang) {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=0&redirects=1&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.parse || !data.parse.wikitext) return;
    const wt = data.parse.wikitext['*'] || '';

    // Improved field extraction: capture value until next "|field=" or "}}"
    const getField = (...names) => {
      for (const n of names) {
        // Match |fieldname = value (can span multiple lines, until next | or }})
        const re = new RegExp(`\\|\\s*${n}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\||\\}\\})`, 'i');
        const m = wt.match(re);
        if (m) {
          const val = cleanWikiText(m[1].trim());
          if (val) return val;
        }
      }
      return '';
    };

    const platform = getField('対応機種', '機種', 'plat', 'platform', 'platforms');
    const genre = getField('ジャンル', 'genre', 'genres');
    const year = getField('発売日', '発売年', 'date', 'released', 'release', 'release date', '発売元.*?年');
    const maker = getField('開発元', '発売元', 'dev', 'developer', 'publisher', 'pub', '販売元', '開発・発売元');

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
  // Extract year from text
  const yearMatch = text.match(/((?:19|20)\d{2})年/);
  if (yearMatch && !document.getElementById('f-year').value) {
    document.getElementById('f-year').value = yearMatch[1];
  }
  // Try to extract genre from common patterns in Japanese text
  const genrePatterns = [
    /ジャンルは(.+?)(?:。|、|の)/,
    /(.+?)ゲーム(?:である|です|。)/,
  ];
  for (const p of genrePatterns) {
    const gm = text.match(p);
    if (gm && !document.getElementById('f-genre').value) {
      const genre = gm[1].trim();
      if (genre.length < 20) document.getElementById('f-genre').value = genre;
      break;
    }
  }
  // Try to extract maker from text
  const makerPatterns = [
    /(?:が|は)(.+?)(?:が開発|より発売|から発売|が発売)/,
    /開発元[はが](.+?)(?:。|、|で)/,
  ];
  for (const p of makerPatterns) {
    const mm = text.match(p);
    if (mm && !document.getElementById('f-maker').value) {
      const maker = mm[1].trim();
      if (maker.length < 30) document.getElementById('f-maker').value = maker;
      break;
    }
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

// ===== DATA MANAGEMENT (Export / Import) =====
function toggleDataMenu(e) {
  e.stopPropagation();
  const panel = document.getElementById('data-menu-panel');
  panel.classList.toggle('active');
}

// Close menu when clicking outside
document.addEventListener('click', e => {
  const panel = document.getElementById('data-menu-panel');
  if (panel && !e.target.closest('#data-menu-panel') && !e.target.closest('.data-menu-btn')) {
    panel.classList.remove('active');
  }
});

function exportData() {
  const dataStr = JSON.stringify(games, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `retrovault_backup_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  document.getElementById('data-menu-panel').classList.remove('active');
  alert(`✅ ${games.length}件のデータをエクスポートしました`);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) { alert('❌ 無効なファイル形式です'); return; }
      const mode = confirm(
        `📥 ${imported.length}件のデータが見つかりました。\n\n` +
        `「OK」→ 既存データに追加（マージ）\n` +
        `「キャンセル」→ 既存データを置き換え`
      );
      if (mode) {
        // Merge: add only games with IDs not already in the list
        const existingIds = new Set(games.map(g => g.id));
        const newGames = imported.filter(g => !existingIds.has(g.id));
        games = [...games, ...newGames];
        alert(`✅ ${newGames.length}件の新しいデータを追加しました（重複 ${imported.length - newGames.length}件はスキップ）`);
      } else {
        games = imported;
        alert(`✅ ${imported.length}件のデータで置き換えました`);
      }
      persist();
      renderTabs(); populateMakers(); populateGenres(); renderList(); updateCount();
    } catch (err) {
      alert('❌ ファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset so same file can be re-selected
  document.getElementById('data-menu-panel').classList.remove('active');
}
