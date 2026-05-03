import { API_STATE, loadKeys, saveKeys, searchPexels } from './api.js';
import { ImgEditor, renderImageEditGrid } from './img-editor.js';

// ===== TikTreko - App Logic =====
export const APP = {
    selectedImages: [],
    currentQuery: '',
    currentPage: 1,
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
            if (!API_STATE.pexelsKey) {
                showModal();
            } else {
                hideModal();
                // Optional: run a default search
            }
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

function bindEvents() {
    // API Key
    document.getElementById('saveApiKeyBtn').addEventListener('click', async () => {
        const key = document.getElementById('apiKeyInput').value.trim();
        if (!key) return toast('Cole sua API key!', 'error');
        
        const success = await saveKeys(key);
        if (success) {
            hideModal();
            toast('API Key salva na nuvem! ✨', 'success');
        } else {
            toast('Erro ao salvar API Key.', 'error');
        }
    });
    document.getElementById('changeApiKeyBtn').addEventListener('click', () => {
        document.getElementById('apiKeyInput').value = API_STATE.pexelsKey || '';
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

// ===== Pexels API =====
async function searchImages(query, append = false) {
    if (!API_STATE.pexelsKey) { showModal(); return; }
    if (!append) { APP.currentPage = 1; APP.currentQuery = query; document.getElementById('galleryGrid').innerHTML = ''; }

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('loadMoreBtn').classList.add('hidden');

    try {
        const data = await searchPexels(query, APP.currentPage);
        renderGallery(data.photos, append);
        if (data.photos.length > 0 && APP.currentPage * 30 < data.total_results) {
            document.getElementById('loadMoreBtn').classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        if (err.message === "INVALID_KEY") {
            toast('API Key inválida!', 'error');
            showModal();
        } else if (err.message === "NO_API_KEY") {
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
        const selIdx = APP.selectedImages.findIndex(s => s.id === photo.id);
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
    const idx = APP.selectedImages.findIndex(s => s.id === photo.id);
    
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
        const id = parseInt(item.dataset.id);
        const idx = APP.selectedImages.findIndex(s => s.id === id);
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
        thumb.innerHTML = `<img src="${img.thumb}" alt=""><div class="sel-num">${i + 1}</div>`;
        thumb.addEventListener('click', () => {
            APP.selectedImages.splice(i, 1);
            updateSelectionBadges();
            updateSelectionBar();
        });
        thumbsContainer.appendChild(thumb);
    });
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
    }, 'image/jpeg', 0.95);
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
                }
                resolve();
            }, 'image/jpeg', 0.95);
        });

        // Small delay between downloads
        await new Promise(r => setTimeout(r, 500));
    }

    toast(`${total} montagens baixadas! 🎉🎉`, 'success');
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
