import { API_STATE, hasGoogleSearchConfig, loadKeys, saveKeys, searchImages as searchImageSource, validateGoogleSearchConfig, validatePexelsKey } from './api.js';
import { ImgEditor, renderImageEditGrid } from './img-editor.js';
import { autoSelectImages, getMontageHash, loadUsedHashes, saveUsedHashes } from './gemini.js';

// ===== TikTreko - App Logic =====
export const APP = {
    selectedImages: [],
    currentQuery: '',
    currentPage: 1,
    searchSource: localStorage.getItem('searchSource') || 'pexels',
    // Editor state
    template: 'notis',
    month: '',
    emojis: '🍀💕',
    fontSize: 72,
    fontWeight: '900',
    fontFamily: "'Outfit', sans-serif",
    textColor: '#ffffff',
    textY: 50,
    outlineEnabled: true,
    outlineWidth: 8,
    outlineColor: '#000000',
    bandEnabled: true,
    bandOpacity: 35,
    bandColor: '#000000',
    customText: '',
    layout: '2x2',
    // Batch
    montages: [],
    currentMontageIdx: 0,
    loadedCanvasImages: [],
    addingToSlot: null,
    // History
    montageHistory: [],
    usedMontageHashes: new Set(),
};

export const LAYOUTS = {
    '1x1': { cols: 1, rows: 1, count: 1 },
    '1x2': { cols: 1, rows: 2, count: 2 },
    '2x1': { cols: 2, rows: 1, count: 2 },
    '2x2': { cols: 2, rows: 2, count: 4 },
    '2x3': { cols: 2, rows: 3, count: 6 },
    '3x3': { cols: 3, rows: 3, count: 9 },
    '3x4': { cols: 3, rows: 4, count: 12 },
    '4x4': { cols: 4, rows: 4, count: 16 },
};

document.addEventListener('DOMContentLoaded', () => {
    setCurrentMonth();
    bindEvents();
    ImgEditor.init();
    
    // Auth observer event
    window.addEventListener('auth-changed', async (e) => {
        if (e.detail.user) {
            await loadKeys();
            loadHistory();
            APP.usedMontageHashes = loadUsedHashes();
            // Show tabs
            document.getElementById('mainTabs').classList.remove('hidden');
            syncSearchSourceUI();
            if (!API_STATE.pexelsKey && !hasGoogleSearchConfig()) {
                showModal();
            } else {
                hideModal();
                if (document.getElementById('galleryGrid').innerHTML === '') {
                    searchImages('beautiful hair balayage');
                }
            }
        } else {
            document.getElementById('mainTabs').classList.add('hidden');
        }
    });

    window.addEventListener('show-toast', (e) => {
        toast(e.detail.message, e.detail.type);
    });
});

function setCurrentMonth() {
    const months = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
                    'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    APP.month = months[new Date().getMonth()];
    const sel = document.getElementById('monthSelect');
    if (sel) sel.value = APP.month;
}

function showModal() { document.getElementById('apiKeyModal').classList.remove('hidden'); }
function hideModal() { document.getElementById('apiKeyModal').classList.add('hidden'); }
function syncSearchSourceUI() {
    const select = document.getElementById('searchSourceSelect');
    if (select) select.value = APP.searchSource;
}

function bindEvents() {
    // API Key
    document.getElementById('saveApiKeyBtn').addEventListener('click', async () => {
        const key = document.getElementById('apiKeyInput').value.trim();
        const googleKey = document.getElementById('googleApiKeyInput').value.trim();
        const googleCx = document.getElementById('googleCxInput').value.trim();
        const pexelsKeyToSave = key || API_STATE.pexelsKey || '';
        if (!pexelsKeyToSave && (!googleKey || !googleCx)) {
            return toast('Cole a API key do Pexels ou configure Google API key + cx.', 'error');
        }
        
        const btn = document.getElementById('saveApiKeyBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="icon-inline spinner"></i> Validando...';
        if (window.lucide) window.lucide.createIcons();

        const isValid = pexelsKeyToSave ? await validatePexelsKey(pexelsKeyToSave) : true;
        if (!isValid) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            if (window.lucide) window.lucide.createIcons();
            toast('API Key inválida ou não autorizada.', 'error');
            return;
        }

        if ((googleKey || googleCx) && (!googleKey || !googleCx)) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            if (window.lucide) window.lucide.createIcons();
            toast('Para usar Google, preencha API key e cx.', 'error');
            return;
        }

        if (googleKey && googleCx) {
            const googleValid = await validateGoogleSearchConfig(googleKey, googleCx);
            if (!googleValid) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                if (window.lucide) window.lucide.createIcons();
                toast('Configuração do Google inválida ou sem permissão.', 'error');
                return;
            }
        }

        const success = await saveKeys(pexelsKeyToSave, googleKey, googleCx);
        if (success) {
            hideModal();
            toast('APIs salvas! ✨', 'success');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            searchImages('beautiful hair balayage');
        } else {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            if (window.lucide) window.lucide.createIcons();
            toast('Erro ao salvar API Key.', 'error');
        }
    });
    document.getElementById('changeApiKeyBtn').addEventListener('click', () => {
        document.getElementById('apiKeyInput').value = API_STATE.pexelsKey || '';
        document.getElementById('googleApiKeyInput').value = API_STATE.googleSearchKey || '';
        document.getElementById('googleCxInput').value = API_STATE.googleSearchCx || '';
        showModal();
    });

    // Categories
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('searchInput').value = '';
            searchImages(btn.dataset.query);
        });
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        const q = document.getElementById('searchInput').value.trim();
        if (!q) return toast('Digite algo para buscar', 'error');
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        searchImages(q);
    });
    document.getElementById('searchInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        APP.currentPage++;
        searchImages(APP.currentQuery, true);
    });
    document.getElementById('searchSourceSelect').addEventListener('change', e => {
        APP.searchSource = e.target.value;
        localStorage.setItem('searchSource', APP.searchSource);
        if (APP.searchSource !== 'pexels' && !hasGoogleSearchConfig()) {
            toast('Configure Google API key e cx para buscar na web.', 'info');
            document.getElementById('googleApiKeyInput').value = API_STATE.googleSearchKey || '';
            document.getElementById('googleCxInput').value = API_STATE.googleSearchCx || '';
            showModal();
            return;
        }
        if (APP.currentQuery) searchImages(APP.currentQuery);
    });

    // Selection
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
    document.getElementById('goToEditorBtn').addEventListener('click', openEditor);

    // Editor nav
    document.getElementById('backToSearchBtn').addEventListener('click', closeEditor);
    document.getElementById('newMontageBtn').addEventListener('click', () => { clearSelection(); closeEditor(); });
    document.getElementById('prevMontageBtn').addEventListener('click', () => switchMontage(-1));
    document.getElementById('nextMontageBtn').addEventListener('click', () => switchMontage(1));

    // Templates
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.template = btn.dataset.template;
            document.getElementById('customTextGroup').classList.toggle('hidden', APP.template !== 'custom');
            renderCanvas();
        });
    });

    // Month & custom text
    document.getElementById('monthSelect').addEventListener('change', e => { APP.month = e.target.value; renderCanvas(); });
    document.getElementById('customText').addEventListener('input', e => { APP.customText = e.target.value; renderCanvas(); });

    // Emojis
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.emojis = btn.dataset.emoji;
            renderCanvas();
        });
    });

    // Font picker
    document.querySelectorAll('.font-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.fontFamily = btn.dataset.font;
            renderCanvas();
        });
    });

    // Font size
    document.getElementById('fontSizeRange').addEventListener('input', e => {
        APP.fontSize = parseInt(e.target.value);
        document.getElementById('fontSizeValue').textContent = APP.fontSize;
        renderCanvas();
    });

    // Font weight
    document.getElementById('fontWeightSelect').addEventListener('change', e => {
        APP.fontWeight = e.target.value;
        renderCanvas();
    });

    // Text color
    bindColorPicker('textColorPicker', 'textColorCustom', c => { APP.textColor = c; renderCanvas(); });

    // Outline toggle & controls
    document.getElementById('outlineToggle').addEventListener('change', e => {
        APP.outlineEnabled = e.target.checked;
        document.getElementById('outlineControls').style.display = e.target.checked ? '' : 'none';
        renderCanvas();
    });
    document.getElementById('outlineWidth').addEventListener('input', e => {
        APP.outlineWidth = parseInt(e.target.value);
        document.getElementById('outlineValue').textContent = APP.outlineWidth;
        renderCanvas();
    });
    bindColorPicker('outlineColorPicker', 'outlineColorCustom', c => { APP.outlineColor = c; renderCanvas(); });

    // Band toggle & controls
    document.getElementById('bandToggle').addEventListener('change', e => {
        APP.bandEnabled = e.target.checked;
        document.getElementById('bandControls').style.display = e.target.checked ? '' : 'none';
        renderCanvas();
    });
    document.getElementById('bandOpacity').addEventListener('input', e => {
        APP.bandOpacity = parseInt(e.target.value);
        document.getElementById('bandOpacityValue').textContent = APP.bandOpacity;
        renderCanvas();
    });
    bindColorPicker('bandColorPicker', null, c => { APP.bandColor = c; renderCanvas(); });

    // Text Y
    document.getElementById('textYRange').addEventListener('input', e => {
        APP.textY = parseInt(e.target.value);
        document.getElementById('textYValue').textContent = APP.textY;
        renderCanvas();
    });

    // Layout picker
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.layout = btn.dataset.layout;
            buildMontages();
            APP.currentMontageIdx = 0;
            updateBatchNav();
            loadCurrentMontageImages().then(() => { renderCanvas(); renderImageEditGrid(); });
        });
    });

    // Download
    document.getElementById('downloadBtn').addEventListener('click', downloadCurrent);
    document.getElementById('downloadAllBtn').addEventListener('click', downloadAll);

    // Auto Montage
    document.getElementById('autoMontageOpenBtn').addEventListener('click', () => {
        document.getElementById('autoMontageModal').classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    });
    document.getElementById('autoMontageCloseBtn').addEventListener('click', () => {
        document.getElementById('autoMontageModal').classList.add('hidden');
    });
    document.getElementById('autoMontageStartBtn').addEventListener('click', executeAutoMontage);

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('searchSection').classList.toggle('hidden', tab !== 'search');
            document.getElementById('historySection').classList.toggle('hidden', tab !== 'history');
            document.getElementById('editorSection').classList.add('hidden');
            if (tab === 'history') renderHistory();
        });
    });

    // History clear
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
            APP.montageHistory = [];
            saveHistoryToStorage();
            renderHistory();
            toast('Histórico limpo!', 'success');
        }
    });
}

function bindColorPicker(containerId, customInputId, onChange) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(btn.dataset.color);
        });
    });
    if (customInputId) {
        document.getElementById(customInputId).addEventListener('input', e => {
            container.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            onChange(e.target.value);
        });
    }
}

// ===== Image Search API =====
async function searchImages(query, append = false) {
    if (APP.searchSource === 'pexels' && !API_STATE.pexelsKey) { showModal(); return; }
    if (APP.searchSource !== 'pexels' && !hasGoogleSearchConfig()) {
        toast('Configure Google API key e cx para buscar nesta fonte.', 'error');
        showModal();
        return;
    }
    if (!append) { APP.currentPage = 1; APP.currentQuery = query; document.getElementById('galleryGrid').innerHTML = ''; }

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('loadMoreBtn').classList.add('hidden');

    try {
        const data = await searchImageSource(query, APP.currentPage, APP.searchSource);
        renderGallery(data.photos, append);
        if (data.has_more) {
            document.getElementById('loadMoreBtn').classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        if (err.message === "INVALID_KEY") {
            toast('API Key inválida!', 'error');
            showModal();
        } else if (err.message === "NO_API_KEY") {
            showModal();
        } else if (err.message === "MISSING_GOOGLE_CONFIG") {
            toast('Configure Google API key e cx para buscar na web.', 'error');
            showModal();
        } else if (err.message === "INVALID_GOOGLE_CONFIG") {
            toast('Configuração do Google inválida ou sem permissão.', 'error');
            showModal();
        } else {
            toast('Erro ao buscar imagens.', 'error');
        }
    } finally {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
}

// ===== Gallery =====
function renderGallery(photos, append) {
    const grid = document.getElementById('galleryGrid');
    if (!append) grid.innerHTML = '';
    if (photos.length === 0 && !append) {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }
    photos.forEach((photo, i) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.dataset.id = photo.id;
        const selIdx = APP.selectedImages.findIndex(s => String(s.id) === String(photo.id));
        if (selIdx >= 0) div.classList.add('selected');
        div.innerHTML = `
            <img src="${photo.src.medium}" alt="${photo.alt || ''}" loading="lazy">
            <div class="select-badge">${selIdx >= 0 ? (selIdx + 1) : ''}</div>
            <div class="img-credit">${photo.photographer}</div>
        `;
        div.addEventListener('click', () => toggleSelect(photo, div));
        grid.appendChild(div);
        div.style.animationDelay = `${(i % 10) * 0.04}s`;
    });
}

function toggleSelect(photo, el) {
    const idx = APP.selectedImages.findIndex(s => String(s.id) === String(photo.id));
    
    if (APP.addingToSlot) {
        if (idx >= 0) {
            toast('Esta imagem já está na seleção!', 'error');
            return;
        }
        const newImg = {
            id: photo.id,
            url: photo.src.large2x || photo.src.large,
            thumb: photo.src.medium,
            photographer: photo.photographer,
        };
        const need = LAYOUTS[APP.layout].count;
        const flatIdx = APP.addingToSlot.montageIdx * need + APP.addingToSlot.slotIdx;
        
        APP.selectedImages.splice(flatIdx, 0, newImg);
        APP.addingToSlot = null;
        
        updateSelectionBadges();
        updateSelectionBar();
        
        buildMontages();
        document.getElementById('searchSection').classList.add('hidden');
        document.getElementById('editorSection').classList.remove('hidden');
        updateBatchNav();
        loadCurrentMontageImages().then(() => { renderCanvas(); renderImageEditGrid(); });
        
        toast('Imagem adicionada!', 'success');
        return;
    }

    if (idx >= 0) {
        APP.selectedImages.splice(idx, 1);
    } else {
        APP.selectedImages.push({
            id: photo.id,
            url: photo.src.large2x || photo.src.large,
            thumb: photo.src.medium,
            photographer: photo.photographer,
        });
    }
    updateSelectionBadges();
    updateSelectionBar();
}

export function updateSelectionBadges() {
    document.querySelectorAll('.gallery-item').forEach(item => {
        const id = item.dataset.id;
        const idx = APP.selectedImages.findIndex(s => String(s.id) === String(id));
        const badge = item.querySelector('.select-badge');
        if (idx >= 0) {
            item.classList.add('selected');
            badge.textContent = idx + 1;
        } else {
            item.classList.remove('selected');
            badge.textContent = '';
        }
    });
}

export function updateSelectionBar() {
    const bar = document.getElementById('selectionBar');
    const count = APP.selectedImages.length;
    const need = LAYOUTS[APP.layout].count;
    const montageNum = Math.ceil(count / need);

    if (count > 0) bar.classList.remove('hidden'); else bar.classList.add('hidden');

    document.getElementById('selCount').textContent = count;
    document.getElementById('montageCount').textContent =
        montageNum > 0 ? `${montageNum} montagem${montageNum > 1 ? 'ns' : ''}` : `selecione fotos`;
    document.getElementById('goToEditorBtn').disabled = count < 1;

    // Render thumbs with group dividers
    const thumbsContainer = document.getElementById('selectionThumbs');
    thumbsContainer.innerHTML = '';
    APP.selectedImages.forEach((img, i) => {
        if (i > 0 && i % need === 0) {
            const divider = document.createElement('div');
            divider.className = 'sel-divider';
            thumbsContainer.appendChild(divider);
        }
        const thumb = document.createElement('div');
        thumb.className = 'sel-thumb';
        thumb.draggable = true;
        thumb.dataset.index = i;
        thumb.innerHTML = `<img src="${img.thumb}" alt=""><div class="sel-num">${i + 1}</div>`;
        thumb.addEventListener('click', e => {
            if (thumb.dataset.dragged === 'true') {
                e.preventDefault();
                thumb.dataset.dragged = 'false';
                return;
            }
            APP.selectedImages.splice(i, 1);
            updateSelectionBadges();
            updateSelectionBar();
        });
        thumb.addEventListener('dragstart', e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(i));
            thumb.classList.add('dragging');
        });
        thumb.addEventListener('dragend', () => {
            thumb.classList.remove('dragging');
            thumb.dataset.dragged = 'true';
            document.querySelectorAll('.sel-thumb').forEach(t => t.classList.remove('drag-over'));
            setTimeout(() => { thumb.dataset.dragged = 'false'; }, 200);
        });
        thumb.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            thumb.classList.add('drag-over');
        });
        thumb.addEventListener('dragleave', () => {
            thumb.classList.remove('drag-over');
        });
        thumb.addEventListener('drop', e => {
            e.preventDefault();
            thumb.classList.remove('drag-over');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            reorderSelectedImages(fromIdx, i);
        });
        thumbsContainer.appendChild(thumb);
    });
}

function reorderSelectedImages(fromIdx, toIdx) {
    if (Number.isNaN(fromIdx) || fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= APP.selectedImages.length || toIdx >= APP.selectedImages.length) return;
    const [moved] = APP.selectedImages.splice(fromIdx, 1);
    APP.selectedImages.splice(toIdx, 0, moved);
    updateSelectionBadges();
    updateSelectionBar();
}

function clearSelection() {
    APP.selectedImages = [];
    updateSelectionBadges();
    updateSelectionBar();
}

// ===== Batch Montages =====
export function buildMontages() {
    APP.montages = [];
    const need = LAYOUTS[APP.layout].count;
    const imgs = [...APP.selectedImages];
    while (imgs.length > 0) {
        APP.montages.push(imgs.splice(0, need));
    }
    APP.currentMontageIdx = 0;
}

function switchMontage(delta) {
    const newIdx = APP.currentMontageIdx + delta;
    if (newIdx < 0 || newIdx >= APP.montages.length) return;
    APP.currentMontageIdx = newIdx;
    loadCurrentMontageImages().then(() => {
        renderCanvas();
        updateBatchNav();
        renderImageEditGrid();
    });
}

export function updateBatchNav() {
    const nav = document.getElementById('batchNav');
    const total = APP.montages.length;
    if (total > 1) {
        nav.classList.remove('hidden');
        document.getElementById('batchIndicator').textContent = `${APP.currentMontageIdx + 1} / ${total}`;
        document.getElementById('prevMontageBtn').disabled = APP.currentMontageIdx === 0;
        document.getElementById('nextMontageBtn').disabled = APP.currentMontageIdx === total - 1;
        document.getElementById('downloadAllBtn').classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
        document.getElementById('downloadAllBtn').classList.add('hidden');
    }
    document.getElementById('editorSubtitle').textContent =
        total > 1 ? `${total} montagens prontas para editar` : '';
}

// ===== Editor =====
function openEditor() {
    if (APP.selectedImages.length < 1) { toast('Selecione pelo menos 1 imagem!', 'error'); return; }
    buildMontages();
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('editorSection').classList.remove('hidden');
    updateBatchNav();
    loadCurrentMontageImages().then(() => { renderCanvas(); renderImageEditGrid(); });
}

export function closeEditor() {
    document.getElementById('editorSection').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
}

export async function loadCurrentMontageImages() {
    const group = APP.montages[APP.currentMontageIdx];
    if (!group) return;
    APP.loadedCanvasImages = [];
    const promises = group.map((item, i) => new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { APP.loadedCanvasImages[i] = img; resolve(); };
        img.onerror = () => { APP.loadedCanvasImages[i] = null; resolve(); };
        img.src = item.url;
    }));
    await Promise.all(promises);
}

function getTextContent() {
    if (APP.template === 'none') return '';
    let text;
    switch (APP.template) {
        case 'notis': text = `${APP.month} DE QUEM DER 5 NOTIS`; break;
        case 'seguir': text = `${APP.month} DE QUEM SEGUIR E COMPARTILHAR`; break;
        case 'curtir': text = `${APP.month} DE QUEM CURTIR E SALVAR`; break;
        case 'so': text = `${APP.month} SÓ DE QUEM DER 5 NOTIS`; break;
        case 'custom': text = APP.customText || `${APP.month} DE QUEM DER 5 NOTIS`; break;
        default: text = `${APP.month} DE QUEM DER 5 NOTIS`;
    }
    if (APP.emojis) text += ` ${APP.emojis}`;
    return text;
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

export function renderCanvas() {
    const canvas = document.getElementById('montageCanvas');
    const ctx = canvas.getContext('2d');
    const W = 1080, H = 1920;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Draw images in dynamic grid
    const layout = LAYOUTS[APP.layout];
    const cellW = W / layout.cols, cellH = H / layout.rows;
    const positions = [];
    for (let r = 0; r < layout.rows; r++)
        for (let c = 0; c < layout.cols; c++)
            positions.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });

    const group = APP.montages[APP.currentMontageIdx];
    positions.forEach((pos, i) => {
        const img = APP.loadedCanvasImages[i];
        if (img) {
            const s = group && group[i] ? ImgEditor.getSettings(group[i].id) : null;
            ctx.save();
            if (s) ctx.filter = ImgEditor.buildFilter(s);
            if (s && s.zoom > 100) {
                ImgEditor.drawCropped(ctx, img, pos.x, pos.y, pos.w, pos.h, s);
            } else {
                drawImageCover(ctx, img, pos.x, pos.y, pos.w, pos.h);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
        }
    });

    // Text
    const textContent = getTextContent();
    if (!textContent) return;

    const fontStr = `${APP.fontWeight} ${APP.fontSize}px ${APP.fontFamily}`;
    ctx.font = fontStr;

    const lines = wrapText(ctx, textContent, W - 80);
    const lineHeight = APP.fontSize * 1.25;
    const totalTextH = lines.length * lineHeight;
    const textCenterY = H * (APP.textY / 100);

    // Band
    if (APP.bandEnabled) {
        const bandY = textCenterY - totalTextH / 2 - 24;
        const bandH = totalTextH + 48;
        const alpha = APP.bandOpacity / 100;
        // Parse band color to RGB
        const r = parseInt(APP.bandColor.slice(1, 3), 16);
        const g = parseInt(APP.bandColor.slice(3, 5), 16);
        const b = parseInt(APP.bandColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(0, bandY, W, bandH);
    }

    // Draw text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    lines.forEach((line, i) => {
        const y = textCenterY - (totalTextH / 2) + (i * lineHeight) + lineHeight / 2;

        // Outline
        if (APP.outlineEnabled && APP.outlineWidth > 0) {
            ctx.strokeStyle = APP.outlineColor;
            ctx.lineWidth = APP.outlineWidth;
            ctx.lineJoin = 'round';
            ctx.font = fontStr;
            ctx.strokeText(line, W / 2, y);
        }

        // Fill
        ctx.fillStyle = APP.textColor;
        ctx.font = fontStr;
        ctx.fillText(line, W / 2, y);
    });
}

function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
        sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0;
    } else {
        sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ===== Downloads =====
function downloadCurrent() {
    const canvas = document.getElementById('montageCanvas');
    try {
        canvas.toBlob(blob => {
            if (!blob) { toast('Erro ao gerar imagem.', 'error'); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const m = APP.month.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            a.download = `tiktreko_${m}_${APP.currentMontageIdx + 1}_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast('Montagem baixada! 🎉', 'success');

            // Save to history
            saveToHistory(canvas);

            // Track dedup hash
            const group = APP.montages[APP.currentMontageIdx];
            if (group) {
                const hash = getMontageHash(group.map(img => img.id));
                APP.usedMontageHashes.add(hash);
                saveUsedHashes(APP.usedMontageHashes);
            }
        }, 'image/jpeg', 0.95);
    } catch (e) {
        console.error('Canvas export failed:', e);
        toast('Uma imagem externa bloqueou o download. Tente outra imagem ou use Pexels.', 'error');
    }
}

async function downloadAll() {
    const total = APP.montages.length;
    toast(`Gerando ${total} montagens...`, 'info');

    for (let i = 0; i < total; i++) {
        APP.currentMontageIdx = i;
        updateBatchNav();
        await loadCurrentMontageImages();
        renderCanvas();

        // Small delay to ensure render completes
        await new Promise(r => setTimeout(r, 200));

        const canvas = document.getElementById('montageCanvas');
        await new Promise(resolve => {
            try {
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const m = APP.month.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        a.download = `tiktreko_${m}_${i + 1}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        // Save to history
                        saveToHistory(canvas);

                        // Track dedup hash
                        const group = APP.montages[i];
                        if (group) {
                            const hash = getMontageHash(group.map(img => img.id));
                            APP.usedMontageHashes.add(hash);
                        }
                    }
                    resolve();
                }, 'image/jpeg', 0.95);
            } catch (e) {
                console.error('Canvas export failed:', e);
                toast('Uma imagem externa bloqueou uma montagem. Pulei este download.', 'error');
                resolve();
            }
        });

        // Small delay between downloads
        await new Promise(r => setTimeout(r, 500));
    }

    toast(`${total} montagens baixadas! 🎉🎉`, 'success');
    saveUsedHashes(APP.usedMontageHashes);
}

// ===== Auto Montage =====
async function executeAutoMontage() {
    const category = document.getElementById('autoCategory').value.trim();
    const numMontages = parseInt(document.getElementById('autoNumMontages').value) || 5;
    const imagesPerMontage = parseInt(document.getElementById('autoImagesPerMontage').value) || 4;

    if (!category) {
        toast('Digite uma categoria ou busca!', 'error');
        return;
    }

    // Map images per montage to layout
    const layoutMap = { 1: '1x1', 2: '1x2', 4: '2x2', 6: '2x3', 9: '3x3', 12: '3x4', 16: '4x4' };
    APP.layout = layoutMap[imagesPerMontage] || '2x2';
    // Update layout picker UI
    document.querySelectorAll('.layout-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.layout === APP.layout);
    });

    // Close modal, show loading
    document.getElementById('autoMontageModal').classList.add('hidden');
    const overlay = document.getElementById('aiLoadingOverlay');
    const msgEl = document.getElementById('aiLoadingMsg');
    overlay.classList.remove('hidden');

    try {
        const montageGroups = await autoSelectImages(
            category, numMontages, imagesPerMontage,
            (msg) => { msgEl.textContent = msg; },
            APP.searchSource
        );

        // Set selected images from all groups
        APP.selectedImages = montageGroups.flat();
        updateSelectionBadges();
        updateSelectionBar();

        // Build montages and go to editor
        buildMontages();
        APP.currentMontageIdx = 0;

        // Switch to search tab first (to hide history)
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="search"]').classList.add('active');
        document.getElementById('historySection').classList.add('hidden');

        document.getElementById('searchSection').classList.add('hidden');
        document.getElementById('editorSection').classList.remove('hidden');
        updateBatchNav();
        await loadCurrentMontageImages();
        renderCanvas();
        renderImageEditGrid();

        toast(`${montageGroups.length} montagens geradas pela IA! 🤖✨`, 'success');
    } catch (err) {
        console.error('Auto montage error:', err);
        if (['INVALID_KEY', 'NO_API_KEY', 'MISSING_GOOGLE_CONFIG', 'INVALID_GOOGLE_CONFIG'].includes(err.message)) {
            const msg = APP.searchSource === 'pexels'
                ? 'Configure uma API key válida do Pexels para auto montar.'
                : 'Configure Google API key e cx para auto montar com esta fonte.';
            toast(msg, 'error');
            showModal();
        } else {
            toast(err.message || 'Erro ao gerar montagens.', 'error');
        }
    } finally {
        overlay.classList.add('hidden');
    }
}

// ===== History =====
function saveToHistory(canvas) {
    // Create a smaller thumbnail
    const thumbCanvas = document.createElement('canvas');
    const thumbW = 270, thumbH = 480;
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const tCtx = thumbCanvas.getContext('2d');
    let thumbDataUrl = '';
    try {
        tCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
        thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
        console.warn('Could not save montage thumbnail:', e);
        return;
    }

    const group = APP.montages[APP.currentMontageIdx];
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
        thumbnailDataUrl: thumbDataUrl,
        layout: APP.layout,
        template: APP.template,
        imageCount: group ? group.length : 0,
    };

    APP.montageHistory.unshift(entry);
    // Keep max 100 entries to avoid localStorage overflow
    if (APP.montageHistory.length > 100) {
        APP.montageHistory = APP.montageHistory.slice(0, 100);
    }
    saveHistoryToStorage();
}

function saveHistoryToStorage() {
    try {
        localStorage.setItem('montageHistory', JSON.stringify(APP.montageHistory));
    } catch (e) {
        console.warn('Failed to save history to localStorage:', e);
        // If storage is full, remove oldest entries
        if (APP.montageHistory.length > 20) {
            APP.montageHistory = APP.montageHistory.slice(0, 20);
            try {
                localStorage.setItem('montageHistory', JSON.stringify(APP.montageHistory));
            } catch (e2) {
                console.error('Still failed to save history:', e2);
            }
        }
    }
}

function loadHistory() {
    try {
        const stored = localStorage.getItem('montageHistory');
        APP.montageHistory = stored ? JSON.parse(stored) : [];
    } catch {
        APP.montageHistory = [];
    }
}

function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmpty');
    grid.innerHTML = '';

    if (APP.montageHistory.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    APP.montageHistory.forEach((entry, i) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        div.innerHTML = `
            <img src="${entry.thumbnailDataUrl}" alt="Montagem" loading="lazy">
            <div class="history-item-info">
                <div class="history-item-date">📅 ${dateStr}</div>
                <div class="history-item-meta">${entry.layout} • ${entry.imageCount} imagens</div>
            </div>
            <div class="history-item-actions">
                <button class="history-action-btn download-btn" title="Baixar">
                    <i data-lucide="download" style="width:16px;height:16px"></i>
                </button>
                <button class="history-action-btn delete-btn" title="Excluir">
                    <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                </button>
            </div>
        `;

        // Download saved thumbnail
        div.querySelector('.download-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = entry.thumbnailDataUrl;
            a.download = `tiktreko_history_${entry.id}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast('Montagem baixada do histórico! 📦', 'success');
        });

        // Delete entry
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            APP.montageHistory.splice(i, 1);
            saveHistoryToStorage();
            renderHistory();
            toast('Montagem removida do histórico', 'info');
        });

        grid.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
}

// ===== Toast =====
export function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    div.innerHTML = `<span>${icon}</span> ${msg}`;
    container.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translateX(40px)';
        div.style.transition = '0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}
