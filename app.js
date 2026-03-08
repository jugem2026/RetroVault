// ===== RetroVault - レトロゲームコレクション管理 =====
const STORAGE_KEY = 'retrovault_games';
const PLATFORMS = {
  'ファミコン':'fc','スーパーファミコン':'sfc','メガドライブ':'md','ゲームボーイ':'gb',
  'ゲームボーイアドバンス':'gba','NINTENDO64':'n64','PlayStation':'ps1','セガサターン':'ss',
  'PCエンジン':'pce','ネオジオ':'neo','その他':'other'
};
const GENRES = ['アクション','RPG','シューティング','パズル','アドベンチャー','シミュレーション','スポーツ','レース','格闘','テーブル','その他'];

let games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let wikiThumbUrl = '';
let suggestTimer = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  updateCount();
  populateFilters();
  document.getElementById('search-input').addEventListener('input', renderGrid);
  document.getElementById('filter-platform').addEventListener('change', renderGrid);
  document.getElementById('filter-genre').addEventListener('change', renderGrid);
  document.getElementById('f-title').addEventListener('input', onTitleInput);
  document.getElementById('f-photo').addEventListener('change', onPhotoSelect);
  // Close suggest on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.form-group')) document.getElementById('suggest-list').style.display = 'none';
  });
});

// ===== RENDER =====
function renderGrid() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const pf = document.getElementById('filter-platform').value;
  const gf = document.getElementById('filter-genre').value;
  const filtered = games.filter(g => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (pf && g.platform !== pf) return false;
    if (gf && g.genre !== gf) return false;
    return true;
  });
  const grid = document.getElementById('game-grid');
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🎮</div><p class="pixel" style="font-size:12px">ゲームが登録されていません</p><p style="margin-top:8px;color:var(--text-dim)">「＋ ゲーム登録」ボタンから追加してください</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(g => {
    const pk = PLATFORMS[g.platform] || 'other';
    const imgHtml = g.photo
      ? `<div class="card-img"><img src="${g.photo}" alt="${g.title}" loading="lazy"></div>`
      : `<div class="card-img"><span class="no-img">🎮</span></div>`;
    return `<div class="game-card card-border-${pk}" onclick="showDetail('${g.id}')">
      ${imgHtml}
      <div class="card-body">
        <div class="card-title">${esc(g.title)}</div>
        <div class="card-meta">${esc(g.maker||'')} ${g.year?'('+g.year+')':''}</div>
        <div class="card-meta">${esc(g.genre||'')}</div>
        <span class="card-platform plat-${pk}">${esc(g.platform||'不明')}</span>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-edit" onclick="editGame('${g.id}')">✏️ 編集</button>
        <button class="btn-delete" onclick="deleteGame('${g.id}')">🗑 削除</button>
      </div>
    </div>`;
  }).join('');
}

function updateCount() {
  document.getElementById('total-count').textContent = `所有数: ${games.length}`;
}

function populateFilters() {
  const pSel = document.getElementById('filter-platform');
  const gSel = document.getElementById('filter-genre');
  const pUsed = [...new Set(games.map(g=>g.platform).filter(Boolean))];
  const gUsed = [...new Set(games.map(g=>g.genre).filter(Boolean))];
  pSel.innerHTML = '<option value="">すべての機種</option>' + pUsed.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  gSel.innerHTML = '<option value="">すべてのジャンル</option>' + gUsed.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
}

// ===== FORM =====
function openForm() {
  resetForm();
  document.getElementById('form-modal').classList.add('active');
  setTimeout(()=>document.getElementById('f-title').focus(), 100);
}
function closeForm() { document.getElementById('form-modal').classList.remove('active'); }
function resetForm() {
  ['edit-id','f-title','f-genre','f-year','f-maker','f-memo','f-photo-data'].forEach(id=>document.getElementById(id).value='');
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
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    title,
    platform: document.getElementById('f-platform').value,
    genre: document.getElementById('f-genre').value.trim(),
    year: document.getElementById('f-year').value.trim(),
    maker: document.getElementById('f-maker').value.trim(),
    memo: document.getElementById('f-memo').value.trim(),
    photo: document.getElementById('f-photo-data').value || (editId ? (games.find(g=>g.id===editId)||{}).photo||'' : '')
  };
  if (editId) { const idx = games.findIndex(g=>g.id===editId); if(idx>=0) games[idx]=data; }
  else games.unshift(data);
  persist(); closeForm(); renderGrid(); updateCount(); populateFilters();
}

function editGame(id) {
  const g = games.find(x=>x.id===id); if(!g) return;
  document.getElementById('edit-id').value = g.id;
  document.getElementById('f-title').value = g.title;
  document.getElementById('f-platform').value = g.platform;
  document.getElementById('f-genre').value = g.genre||'';
  document.getElementById('f-year').value = g.year||'';
  document.getElementById('f-maker').value = g.maker||'';
  document.getElementById('f-memo').value = g.memo||'';
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
  games = games.filter(g=>g.id!==id);
  persist(); renderGrid(); updateCount(); populateFilters();
}

// ===== PHOTO =====
function onPhotoSelect(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    // Resize for localStorage
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w*=r; h*=r; }
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

// ===== DETAIL =====
function showDetail(id) {
  const g = games.find(x=>x.id===id); if(!g) return;
  const pk = PLATFORMS[g.platform]||'other';
  document.getElementById('detail-content').innerHTML = `
    ${g.photo ? `<img class="detail-img" src="${g.photo}" alt="${esc(g.title)}">` : ''}
    <div class="detail-title">${esc(g.title)}</div>
    <span class="card-platform plat-${pk}" style="margin-bottom:12px;display:inline-block">${esc(g.platform||'不明')}</span>
    <div class="detail-meta">🏭 ${esc(g.maker||'不明')} ｜ 📅 ${esc(g.year||'不明')}</div>
    <div class="detail-meta">🎯 ${esc(g.genre||'不明')}</div>
    ${g.memo ? `<div class="detail-memo">${esc(g.memo)}</div>` : ''}
  `;
  document.getElementById('detail-modal').classList.add('active');
}
function closeDetail() { document.getElementById('detail-modal').classList.remove('active'); }

// ===== WIKIPEDIA API =====
function onTitleInput(e) {
  clearTimeout(suggestTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { document.getElementById('suggest-list').style.display='none'; return; }
  suggestTimer = setTimeout(() => wikiSearch(q), 400);
}

async function wikiSearch(query) {
  const sl = document.getElementById('suggest-list');
  const loading = document.getElementById('wiki-loading');
  loading.style.display = 'inline';
  try {
    // Try Japanese first
    let results = await fetchSuggest('ja', query);
    if (results.length === 0) results = await fetchSuggest('en', query);
    if (results.length === 0) { sl.style.display='none'; return; }
    sl.innerHTML = results.map(r => `<div class="suggest-item" onclick="selectSuggest('${escAttr(r.title)}','${r.lang}')">${esc(r.title)}</div>`).join('');
    sl.style.display = 'block';
  } catch(err) { console.error('Wiki search error:', err); }
  finally { loading.style.display = 'none'; }
}

async function fetchSuggest(lang, query) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data[1] || data[1].length === 0) return [];
  return data[1].map(title => ({title, lang}));
}

async function selectSuggest(title, lang) {
  document.getElementById('suggest-list').style.display = 'none';
  document.getElementById('f-title').value = title;
  document.getElementById('wiki-loading').style.display = 'inline';
  try {
    await fetchWikiDetails(title, lang);
  } catch(err) { console.error('Wiki detail error:', err); }
  finally { document.getElementById('wiki-loading').style.display = 'none'; }
}

async function fetchWikiDetails(title, lang) {
  // Get extract + pageimage
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (!page || page.missing) return;

  // Extract text → parse info
  const extract = page.extract || '';
  const summary = extract.slice(0, 300);
  document.getElementById('f-memo').value = summary;

  // Try to parse structured info from extract
  parseExtractInfo(extract, lang);

  // Thumbnail
  if (page.thumbnail && page.thumbnail.source) {
    wikiThumbUrl = page.thumbnail.source;
    const area = document.getElementById('wiki-thumb-area');
    document.getElementById('wiki-thumb-img').src = wikiThumbUrl;
    area.style.display = 'block';
  }

  // Also try getting infobox data through the parse API
  await fetchInfobox(title, lang);
}

async function fetchInfobox(title, lang) {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=0&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.parse || !data.parse.wikitext) return;
    const wt = data.parse.wikitext['*'] || '';
    
    // Parse infobox fields
    const getField = (...names) => {
      for (const n of names) {
        const re = new RegExp(`\\|\\s*${n}\\s*=\\s*(.+?)(?:\\n|$)`, 'i');
        const m = wt.match(re);
        if (m) return cleanWikiText(m[1].trim());
      }
      return '';
    };

    const platform = getField('対応機種','機種','plat','platform','platforms');
    const genre = getField('ジャンル','genre','genres');
    const year = getField('発売日','発売年','date','released','release','release date');
    const maker = getField('開発元','発売元','dev','developer','publisher','pub','販売元');

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
  } catch(e) { console.warn('Infobox parse failed:', e); }
}

function parseExtractInfo(text, lang) {
  // Fallback: try to extract info from the plain text extract
  const yearMatch = text.match(/((?:19|20)\d{2})年/);
  if (yearMatch && !document.getElementById('f-year').value) {
    document.getElementById('f-year').value = yearMatch[1];
  }
}

function matchPlatform(text) {
  const t = text.toLowerCase();
  const map = [
    [['ファミリーコンピュータ','ファミコン','famicom','nes','nintendo entertainment'],'ファミコン'],
    [['スーパーファミコン','super famicom','snes','super nes','super nintendo'],'スーパーファミコン'],
    [['メガドライブ','mega drive','genesis','sega genesis'],'メガドライブ'],
    [['ゲームボーイアドバンス','game boy advance','gba'],'ゲームボーイアドバンス'],
    [['ゲームボーイ','game boy'],'ゲームボーイ'],
    [['nintendo 64','nintendo64','ニンテンドウ64','ニンテンドー64','n64'],'NINTENDO64'],
    [['playstation','プレイステーション','ps1','ps one','psone'],'PlayStation'],
    [['セガサターン','sega saturn','saturn'],'セガサターン'],
    [['pcエンジン','pc engine','pc-engine','turbografx'],'PCエンジン'],
    [['ネオジオ','neo geo','neogeo','neo-geo'],'ネオジオ'],
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
  } catch(e) { console.warn('Thumb fetch failed:', e); alert('画像の取得に失敗しました'); }
}

// ===== UTILS =====
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(games)); }
  catch(e) { alert('保存容量を超えました。写真のサイズを小さくするか、不要なデータを削除してください。'); }
}
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function escAttr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
