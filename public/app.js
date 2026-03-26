// ===== STATE =====
let dragSrcId = null;
let state = {
  slideshows: [],
  currentId: null,
  currentSlideId: null,
  serverInfo: { ips: ['localhost'], port: 3000 },
  dirty: false
};

// ===== API =====
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ===== INIT =====
async function init() {
  try {
    state.serverInfo = await api('GET', '/api/server-info');
  } catch {}
  await loadSlideshows();
}

async function loadSlideshows() {
  state.slideshows = await api('GET', '/api/slideshows');
  renderSidebar();
}

// ===== SIDEBAR =====
function ratioLabel(ratio) {
  const labels = {
    '16:9': '16:9', '9:16': '9:16', '4:3': '4:3',
    '1:1': '1:1', 'banner': 'バナー'
  };
  return labels[ratio] || ratio;
}

function renderSidebar() {
  const list = document.getElementById('sidebarList');
  if (state.slideshows.length === 0) {
    list.innerHTML = '<div class="sidebar-empty">スライドショーがまだありません<br>「New Slideshow」で作成できます</div>';
    return;
  }
  list.innerHTML = state.slideshows.map(s => `
    <div class="sidebar-item ${s.id === state.currentId ? 'active' : ''}" onclick="selectSlideshow('${s.id}')">
      <div class="sidebar-item-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="10" rx="2" stroke="${s.id === state.currentId ? '#4f8ef7' : '#7a8fb5'}" stroke-width="1.5"/>
          <path d="M1 5h12" stroke="${s.id === state.currentId ? '#4f8ef7' : '#7a8fb5'}" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="sidebar-item-text">
        <div class="sidebar-item-title">${escHtml(s.title)}</div>
        <div class="sidebar-item-meta">${s.slides.length}枚 • ${ratioLabel(s.aspectRatio)}</div>
      </div>
    </div>
  `).join('');
}

// ===== SELECT SLIDESHOW =====
function selectSlideshow(id) {
  state.currentId = id;
  state.currentSlideId = null;
  state.dirty = false;
  renderSidebar();
  renderEditor();
}

function getCurrentSlideshow() {
  return state.slideshows.find(s => s.id === state.currentId);
}

function getCurrentSlide() {
  const ss = getCurrentSlideshow();
  if (!ss) return null;
  return ss.slides.find(s => s.id === state.currentSlideId);
}

// ===== EDITOR =====
const STANDARD_RATIOS = ['16:9', '9:16', '4:3', '1:1', 'banner'];

function isCustomRatio(ratio) {
  return !STANDARD_RATIOS.includes(ratio);
}

function renderEditor() {
  const ss = getCurrentSlideshow();
  document.getElementById('emptyState').style.display = ss ? 'none' : 'flex';
  const editorView = document.getElementById('editorView');
  editorView.style.display = ss ? 'flex' : 'none';
  if (!ss) return;

  document.getElementById('titleInput').value = ss.title;
  const ratioVal = isCustomRatio(ss.aspectRatio) ? 'custom' : ss.aspectRatio;
  document.getElementById('ratioSelect').value = ratioVal;
  handleRatioSelectChange(ratioVal, ss.aspectRatio);

  // OBS URL
  const ip = state.serverInfo.ips[0] || 'localhost';
  const port = state.serverInfo.port || 3000;
  document.getElementById('urlDisplay').textContent = `http://${ip}:${port}/view/${ss.id}`;
  updateUrlNote(ss.aspectRatio);

  // Settings
  const s = ss.settings || {};
  document.getElementById('transitionSelect').value = s.transition || 'fade';
  document.getElementById('intervalInput').value = s.interval || 5;
  document.getElementById('autoplayCheck').checked = s.autoplay !== false;
  document.getElementById('loopCheck').checked = s.loop !== false;

  renderSlides();
  renderSlideEditor();
}

function handleRatioSelectChange(selectVal, storedRatio) {
  const customDiv = document.getElementById('customRatioInputs');
  if (selectVal === 'custom') {
    customDiv.style.display = 'flex';
    // Pre-populate with stored custom values
    if (storedRatio && isCustomRatio(storedRatio)) {
      const parts = storedRatio.split('x');
      if (parts.length === 2) {
        document.getElementById('customW').value = parts[0];
        document.getElementById('customH').value = parts[1];
      }
    }
  } else {
    customDiv.style.display = 'none';
  }
}

function updateUrlNote(ratio) {
  const dims = {
    '16:9':  '1920×1080',
    '9:16':  '1080×1920',
    '4:3':   '1024×768',
    '1:1':   '1080×1080',
    'banner': '1200×300'
  };
  const note = document.getElementById('urlNote');
  if (dims[ratio]) {
    note.textContent = `OBSブラウザソース: ${dims[ratio]}px 推奨`;
  } else {
    const parts = ratio.split('x').map(Number);
    if (parts.length === 2 && parts[0] && parts[1]) {
      note.textContent = `OBSブラウザソース: ${parts[0]}×${parts[1]}px`;
    } else {
      note.textContent = 'OBSブラウザソースにペーストしてください';
    }
  }
}

// ===== SLIDES =====
function renderSlides() {
  const ss = getCurrentSlideshow();
  const grid = document.getElementById('slidesGrid');
  if (!ss || ss.slides.length === 0) {
    grid.innerHTML = '<div class="slides-empty">スライドがありません。「スライドを追加」ボタンで追加してください。</div>';
    return;
  }
  const thumbClass = getRatioClass(ss.aspectRatio);
  grid.innerHTML = ss.slides.map((slide, i) => `
    <div class="slide-thumb ${thumbClass} ${slide.id === state.currentSlideId ? 'active' : ''}"
         draggable="true" data-id="${slide.id}"
         onclick="selectSlide('${slide.id}')">
      <div class="slide-thumb-inner">${renderThumbInner(slide)}</div>
      <div class="slide-thumb-overlay">
        <button class="slide-thumb-del" onclick="deleteSlide(event, '${slide.id}')">✕</button>
      </div>
      <span class="slide-thumb-num">${i + 1}</span>
    </div>
  `).join('');
  setupSlideDrag();
}

// ===== DRAG & DROP REORDER =====
function setupSlideDrag() {
  document.querySelectorAll('.slide-thumb').forEach(thumb => {
    thumb.addEventListener('dragstart', onThumbDragStart);
    thumb.addEventListener('dragend',   onThumbDragEnd);
    thumb.addEventListener('dragover',  onThumbDragOver);
    thumb.addEventListener('dragleave', onThumbDragLeave);
    thumb.addEventListener('drop',      onThumbDrop);
  });
}

function onThumbDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
}

function onThumbDragEnd() {
  dragSrcId = null;
  this.classList.remove('dragging');
  document.querySelectorAll('.slide-thumb').forEach(t =>
    t.classList.remove('drop-before', 'drop-after')
  );
}

function onThumbDragOver(e) {
  e.preventDefault();
  if (this.dataset.id === dragSrcId) return;
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.slide-thumb').forEach(t =>
    t.classList.remove('drop-before', 'drop-after')
  );
  const rect = this.getBoundingClientRect();
  if (e.clientX < rect.left + rect.width / 2) {
    this.classList.add('drop-before');
  } else {
    this.classList.add('drop-after');
  }
}

function onThumbDragLeave(e) {
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drop-before', 'drop-after');
  }
}

function onThumbDrop(e) {
  e.preventDefault();
  const targetId = this.dataset.id;
  if (!dragSrcId || targetId === dragSrcId) return;
  const insertBefore = this.classList.contains('drop-before');
  this.classList.remove('drop-before', 'drop-after');
  reorderSlides(dragSrcId, targetId, insertBefore);
}

function reorderSlides(srcId, targetId, insertBefore) {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const srcIdx = ss.slides.findIndex(s => s.id === srcId);
  if (srcIdx === -1) return;
  const [moved] = ss.slides.splice(srcIdx, 1);
  const targetIdx = ss.slides.findIndex(s => s.id === targetId);
  if (targetIdx === -1) { ss.slides.push(moved); }
  else if (insertBefore) { ss.slides.splice(targetIdx, 0, moved); }
  else                   { ss.slides.splice(targetIdx + 1, 0, moved); }
  state.dirty = true;
  renderSlides();
}

function getRatioClass(ratio) {
  const map = {
    '9:16':   'ratio-9-16',
    '4:3':    'ratio-4-3',
    '1:1':    'ratio-1-1',
    'banner': 'ratio-banner'
  };
  return map[ratio] || '';
}

function renderThumbInner(slide) {
  const c = slide.content || {};
  if (slide.type === 'image') {
    if (c.url) return `<img src="${escAttr(c.url)}" onerror="this.style.display='none'">`;
    return `<div style="width:100%;height:100%;background:#dde3ed;display:flex;align-items:center;justify-content:center;font-size:20px;">🖼</div>`;
  }
  if (slide.type === 'text') {
    const bg = c.backgroundColor || '#000';
    const color = c.color || '#fff';
    return `<div class="slide-thumb-text-preview" style="background:${bg};color:${color};text-align:${c.textAlign||'center'};">${escHtml(c.text || '')}</div>`;
  }
  if (slide.type === 'html') {
    return `<div style="width:100%;height:100%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:20px;">💻</div>`;
  }
  if (slide.type === 'color') {
    return `<div style="width:100%;height:100%;background:${c.backgroundColor || '#000'}"></div>`;
  }
  return '';
}

// ===== SELECT SLIDE =====
function selectSlide(id) {
  state.currentSlideId = id;
  renderSlides();
  renderSlideEditor();
}

// ===== SLIDE EDITOR =====
function renderSlideEditor() {
  const slide = getCurrentSlide();
  const editor = document.getElementById('slideEditor');
  if (!slide) {
    editor.style.display = 'none';
    return;
  }
  editor.style.display = 'block';

  const ss = getCurrentSlideshow();
  const slideIndex = ss.slides.findIndex(s => s.id === slide.id);
  document.getElementById('slideEditorTitle').textContent = `スライド ${slideIndex + 1} を編集`;
  document.getElementById('slideDuration').value = slide.duration || (ss.settings && ss.settings.interval) || 5;
  document.getElementById('slideTransition').value = slide.transition || '';

  const tabs = document.getElementById('slideTypeTabs');
  tabs.querySelectorAll('.slide-type-tab').forEach((tab, i) => {
    const types = ['image', 'text', 'html', 'color'];
    tab.classList.toggle('active', types[i] === slide.type);
  });

  renderSlideTypeFields(slide);
  renderSlidePreview(slide);
  updatePreviewRatio();
}

function renderSlideTypeFields(slide) {
  const c = slide.content || {};
  const fields = document.getElementById('slideTypeFields');

  if (slide.type === 'image') {
    const hasImage = !!c.url;
    fields.innerHTML = `
      <div class="field-group">
        <div class="drop-zone" id="imageDropZone">
          ${hasImage ? `
            <div class="drop-zone-preview">
              <img src="${escAttr(c.url)}" alt="preview">
              <button class="drop-zone-preview-clear" type="button">✕</button>
            </div>
            <div style="margin-top:8px;">
              <button class="drop-zone-btn" type="button" id="changeImgBtn" style="font-size:11px;padding:5px 10px;">
                画像を変更
              </button>
            </div>
          ` : `
            <div class="drop-zone-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="drop-zone-text">ここにドラッグ＆ドロップ</div>
            <div class="drop-zone-sub">または</div>
            <button class="drop-zone-btn" type="button" id="pickImgBtn">
              フォルダから選択
            </button>
          `}
        </div>
        <div class="upload-progress" id="uploadProgress">
          <div class="upload-progress-bar" id="uploadProgressBar"></div>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">表示方法</label>
        <select class="field-select" onchange="updateField('objectFit', this.value)">
          <option value="cover"   ${(c.objectFit||'cover')==='cover'   ?'selected':''}>カバー（全体を埋める）</option>
          <option value="contain" ${c.objectFit==='contain'?'selected':''}>コンテイン（全体を表示）</option>
          <option value="fill"    ${c.objectFit==='fill'   ?'selected':''}>フィル（引き伸ばす）</option>
        </select>
      </div>
      <div class="field-group">
        <label class="field-label">背景色</label>
        <div class="color-with-text">
          <input type="color" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorText(this)">
          <input type="text" class="field-input" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorPicker(this)" style="font-family:monospace;">
        </div>
      </div>
    `;
    setupImageDropZone();

  } else if (slide.type === 'text') {
    fields.innerHTML = `
      <div class="field-group">
        <label class="field-label">テキスト</label>
        <textarea class="field-textarea" oninput="updateField('text', this.value)" placeholder="テキストを入力...">${escHtml(c.text || '')}</textarea>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">フォントサイズ</label>
          <input type="number" class="field-input" value="${c.fontSize || 48}" min="8" max="400" oninput="updateField('fontSize', Number(this.value))">
        </div>
        <div class="field-group">
          <label class="field-label">テキスト配置</label>
          <select class="field-select" onchange="updateField('textAlign', this.value)">
            <option value="center" ${(c.textAlign||'center')==='center'?'selected':''}>中央</option>
            <option value="left"   ${c.textAlign==='left'  ?'selected':''}>左</option>
            <option value="right"  ${c.textAlign==='right' ?'selected':''}>右</option>
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">フォント</label>
        <select class="field-select" onchange="updateField('fontFamily', this.value)">
          <option value="sans-serif" ${(!c.fontFamily||c.fontFamily==='sans-serif')?'selected':''}>Sans-serif</option>
          <option value="serif"      ${c.fontFamily==='serif'     ?'selected':''}>Serif</option>
          <option value="monospace"  ${c.fontFamily==='monospace' ?'selected':''}>Monospace</option>
          <option value="'Noto Sans JP', sans-serif" ${c.fontFamily&&c.fontFamily.includes('Noto')?'selected':''}>Noto Sans JP</option>
        </select>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label">文字色</label>
          <div class="color-with-text">
            <input type="color" value="${c.color || '#ffffff'}" oninput="updateField('color', this.value); syncColorText(this)">
            <input type="text" class="field-input" value="${c.color || '#ffffff'}" oninput="updateField('color', this.value); syncColorPicker(this)" style="font-family:monospace;">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">背景色</label>
          <div class="color-with-text">
            <input type="color" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorText(this)">
            <input type="text" class="field-input" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorPicker(this)" style="font-family:monospace;">
          </div>
        </div>
      </div>
    `;

  } else if (slide.type === 'html') {
    fields.innerHTML = `
      <div class="field-group">
        <label class="field-label">HTMLコード</label>
        <textarea class="field-textarea code" oninput="updateField('html', this.value)" placeholder="<div style='color:white'>Hello World</div>">${escHtml(c.html || '')}</textarea>
      </div>
      <div class="field-group">
        <label class="field-label">背景色</label>
        <div class="color-with-text">
          <input type="color" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorText(this)">
          <input type="text" class="field-input" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorPicker(this)" style="font-family:monospace;">
        </div>
      </div>
      <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">※ HTMLは直接レンダリングされます。スタイルはインラインで記述してください。</p>
    `;

  } else if (slide.type === 'color') {
    fields.innerHTML = `
      <div class="field-group">
        <label class="field-label">背景色</label>
        <div class="color-with-text">
          <input type="color" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorText(this)">
          <input type="text" class="field-input" value="${c.backgroundColor || '#000000'}" oninput="updateField('backgroundColor', this.value); syncColorPicker(this)" style="font-family:monospace; flex:1;">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">テキスト（オプション）</label>
        <textarea class="field-textarea" oninput="updateField('text', this.value)" placeholder="オーバーレイテキスト...">${escHtml(c.text || '')}</textarea>
      </div>
      <div class="field-group">
        <label class="field-label">文字色</label>
        <div class="color-with-text">
          <input type="color" value="${c.color || '#ffffff'}" oninput="updateField('color', this.value); syncColorText(this)">
          <input type="text" class="field-input" value="${c.color || '#ffffff'}" oninput="updateField('color', this.value); syncColorPicker(this)" style="font-family:monospace;">
        </div>
      </div>
    `;
  }
}

// ===== COLOR SYNC HELPERS =====
function syncColorText(colorInput) {
  const sibling = colorInput.nextElementSibling || colorInput.previousElementSibling;
  if (sibling && sibling !== colorInput) sibling.value = colorInput.value;
}
function syncColorPicker(textInput) {
  const sibling = textInput.nextElementSibling || textInput.previousElementSibling;
  if (sibling && sibling !== textInput && /^#[0-9a-fA-F]{6}$/.test(textInput.value)) {
    sibling.value = textInput.value;
  }
}

// ===== IMAGE DROP ZONE =====
function setupImageDropZone() {
  const zone = document.getElementById('imageDropZone');
  if (!zone) return;

  // Clear button
  const clearBtn = zone.querySelector('.drop-zone-preview-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearImage();
    });
  }

  // Pick button
  const pickBtn = zone.querySelector('#pickImgBtn') || zone.querySelector('#changeImgBtn');
  if (pickBtn) {
    pickBtn.addEventListener('click', e => {
      e.stopPropagation();
      openFilePicker();
    });
  }

  // Click zone to pick (only if no image)
  if (!zone.querySelector('.drop-zone-preview')) {
    zone.addEventListener('click', e => {
      if (e.target === zone || e.target.classList.contains('drop-zone-text') ||
          e.target.classList.contains('drop-zone-sub') || e.target.classList.contains('drop-zone-icon')) {
        openFilePicker();
      }
    });
  }

  // Drag events
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) uploadImage(files[0]);
  });
}

function openFilePicker() {
  document.getElementById('globalFileInput').click();
}

function handleFileInputChange(input) {
  if (input.files && input.files[0]) {
    uploadImage(input.files[0]);
    input.value = ''; // reset so same file can be selected again
  }
}

async function uploadImage(file) {
  const progress = document.getElementById('uploadProgress');
  const bar = document.getElementById('uploadProgressBar');
  if (progress) { progress.classList.add('active'); bar.style.width = '30%'; }

  try {
    const formData = new FormData();
    formData.append('image', file);
    if (progress) bar.style.width = '60%';

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const { url } = await res.json();

    if (progress) { bar.style.width = '100%'; }
    updateField('url', url);

    // Re-render the fields to show preview
    const slide = getCurrentSlide();
    if (slide) renderSlideTypeFields(slide);

    setTimeout(() => { if (progress) progress.classList.remove('active'); }, 400);
    showToast('画像をアップロードしました', 'success');
  } catch (e) {
    if (progress) progress.classList.remove('active');
    showToast('アップロードに失敗しました', 'error');
  }
}

function clearImage() {
  updateField('url', '');
  const slide = getCurrentSlide();
  if (slide) renderSlideTypeFields(slide);
}

// ===== SLIDE PREVIEW =====
function renderSlidePreview(slide) {
  const inner = document.getElementById('slidePreviewInner');
  const c = slide.content || {};

  if (slide.type === 'image') {
    inner.style.background = c.backgroundColor || '#000';
    if (c.url) {
      inner.innerHTML = `<img src="${escAttr(c.url)}" style="width:100%;height:100%;object-fit:${c.objectFit||'cover'};" onerror="this.remove()">`;
    } else {
      inner.innerHTML = `<div style="color:#888;font-size:12px;text-align:center;padding:8px;">画像を選択してください</div>`;
    }
  } else if (slide.type === 'text') {
    const bg = c.backgroundColor || '#000';
    const color = c.color || '#fff';
    const size = Math.max(8, Math.min((c.fontSize || 48) * 0.22, 40));
    inner.style.background = bg;
    inner.innerHTML = `<div style="color:${color};font-size:${size}px;font-family:${c.fontFamily||'sans-serif'};text-align:${c.textAlign||'center'};padding:12px;word-break:break-word;white-space:pre-wrap;">${escHtml(c.text || '')}</div>`;
  } else if (slide.type === 'html') {
    const bg = c.backgroundColor || '#000';
    inner.style.background = bg;
    inner.innerHTML = `<div style="transform:scale(0.25);transform-origin:center center;width:400%;height:400%;display:flex;align-items:center;justify-content:center;">${c.html || ''}</div>`;
  } else if (slide.type === 'color') {
    inner.style.background = c.backgroundColor || '#000';
    if (c.text) {
      inner.innerHTML = `<div style="color:${c.color||'#fff'};font-size:14px;text-align:center;padding:8px;">${escHtml(c.text)}</div>`;
    } else {
      inner.innerHTML = '';
    }
  }
}

function updatePreviewRatio() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const preview = document.getElementById('slidePreview');
  preview.className = 'slide-preview';
  preview.style.aspectRatio = '';

  const cssMap = {
    '9:16': 'ratio-9-16', '4:3': 'ratio-4-3',
    '1:1': 'ratio-1-1', 'banner': 'ratio-banner'
  };
  if (cssMap[ss.aspectRatio]) {
    preview.classList.add(cssMap[ss.aspectRatio]);
  } else if (isCustomRatio(ss.aspectRatio)) {
    const parts = ss.aspectRatio.split('x').map(Number);
    if (parts.length === 2 && parts[0] && parts[1]) {
      preview.style.aspectRatio = `${parts[0]}/${parts[1]}`;
    }
  }
}

// ===== FIELD UPDATE =====
function updateField(key, value) {
  const slide = getCurrentSlide();
  if (!slide) return;
  slide.content = slide.content || {};
  slide.content[key] = value;
  state.dirty = true;
  renderThumbForSlide(slide.id);
  renderSlidePreview(slide);
}

function renderThumbForSlide(id) {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const thumbs = document.querySelectorAll('.slide-thumb');
  ss.slides.forEach((slide, i) => {
    if (slide.id === id && thumbs[i]) {
      thumbs[i].querySelector('.slide-thumb-inner').innerHTML = renderThumbInner(slide);
    }
  });
}

// ===== ACTIONS =====
function setSlideType(type) {
  const slide = getCurrentSlide();
  if (!slide) return;
  slide.type = type;
  slide.content = {};
  state.dirty = true;
  renderSlideEditor();
  renderSlides();
}

function onSlideDurationChange() {
  const slide = getCurrentSlide();
  if (!slide) return;
  slide.duration = Number(document.getElementById('slideDuration').value);
  state.dirty = true;
}

function onSlideTransitionChange() {
  const slide = getCurrentSlide();
  if (!slide) return;
  slide.transition = document.getElementById('slideTransition').value;
  state.dirty = true;
}

function onTitleChange() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  ss.title = document.getElementById('titleInput').value;
  state.dirty = true;
  renderSidebar();
}

function onRatioChange() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const val = document.getElementById('ratioSelect').value;
  handleRatioSelectChange(val, ss.aspectRatio);
  if (val !== 'custom') {
    ss.aspectRatio = val;
    state.dirty = true;
    updateUrlNote(val);
    renderSlides();
    updatePreviewRatio();
    renderSidebar();
  }
}

function onCustomRatioInput() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const w = parseInt(document.getElementById('customW').value) || 1920;
  const h = parseInt(document.getElementById('customH').value) || 1080;
  ss.aspectRatio = `${w}x${h}`;
  state.dirty = true;
  updateUrlNote(ss.aspectRatio);
  renderSlides();
  updatePreviewRatio();
  renderSidebar();
}

function onSettingChange() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  ss.settings = {
    transition: document.getElementById('transitionSelect').value,
    interval: Number(document.getElementById('intervalInput').value),
    autoplay: document.getElementById('autoplayCheck').checked,
    loop: document.getElementById('loopCheck').checked
  };
  state.dirty = true;
}

async function addSlide() {
  const ss = getCurrentSlideshow();
  if (!ss) return;
  const slide = {
    id: generateId(),
    type: 'color',
    duration: null,
    transition: '',
    content: { backgroundColor: '#000000' }
  };
  ss.slides.push(slide);
  state.dirty = true;
  renderSlides();
  selectSlide(slide.id);
}

async function deleteSlide(event, id) {
  event.stopPropagation();
  const ss = getCurrentSlideshow();
  if (!ss) return;
  ss.slides = ss.slides.filter(s => s.id !== id);
  if (state.currentSlideId === id) {
    state.currentSlideId = ss.slides.length > 0 ? ss.slides[ss.slides.length - 1].id : null;
  }
  state.dirty = true;
  renderSlides();
  renderSlideEditor();
}

async function saveSlideshow() {
  const ss = getCurrentSlideshow();
  if (!ss) return;

  // Commit custom ratio
  if (document.getElementById('ratioSelect').value === 'custom') {
    const w = parseInt(document.getElementById('customW').value) || 1920;
    const h = parseInt(document.getElementById('customH').value) || 1080;
    ss.aspectRatio = `${w}x${h}`;
  }

  try {
    const updated = await api('PUT', `/api/slideshows/${ss.id}`, ss);
    const index = state.slideshows.findIndex(s => s.id === ss.id);
    state.slideshows[index] = updated;
    state.dirty = false;
    renderSidebar();
    showToast('保存しました', 'success');
  } catch {
    showToast('保存に失敗しました', 'error');
  }
}

async function createSlideshow() {
  try {
    const ss = await api('POST', '/api/slideshows', { title: '新しいスライドショー' });
    state.slideshows.push(ss);
    selectSlideshow(ss.id);
    showToast('スライドショーを作成しました', 'success');
  } catch {
    showToast('作成に失敗しました', 'error');
  }
}

function confirmDelete() {
  document.getElementById('deleteModal').classList.add('show');
}

function closeModal() {
  document.getElementById('deleteModal').classList.remove('show');
}

async function deleteSlideshow() {
  const id = state.currentId;
  if (!id) return;
  closeModal();
  try {
    await api('DELETE', `/api/slideshows/${id}`);
    state.slideshows = state.slideshows.filter(s => s.id !== id);
    state.currentId = null;
    state.currentSlideId = null;
    renderSidebar();
    renderEditor();
    showToast('削除しました');
  } catch {
    showToast('削除に失敗しました', 'error');
  }
}

// ===== URL COPY =====
async function copyUrl() {
  const url = document.getElementById('urlDisplay').textContent;
  const btn = document.getElementById('copyBtn');
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = 'コピー済み ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('copied'); }, 2000);
  } catch {
    showToast('コピーに失敗しました', 'error');
  }
}

// ===== TOAST =====
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== UTILS =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Close modal on overlay click
document.getElementById('deleteModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Ctrl+S to save
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveSlideshow();
  }
});

init();
