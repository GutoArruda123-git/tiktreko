import { APP, LAYOUTS, toast, closeEditor, renderCanvas, updateSelectionBadges, updateSelectionBar, buildMontages, loadCurrentMontageImages } from './app.js';

// ===== Image Editor Module =====
export const ImgEditor = {
    imageSettings: {}, // keyed by image id
    editingIdx: -1,
    editingImg: null,
    dragStart: null,
    tempPan: { x: 0.5, y: 0.5 },

    FILTER_PRESETS: {
        normal:   { brightness: 100, contrast: 100, saturate: 100 },
        warm:     { brightness: 105, contrast: 105, saturate: 120, hueRotate: -15 },
        cool:     { brightness: 100, contrast: 105, saturate: 90, hueRotate: 180 },
        bw:       { brightness: 100, contrast: 110, saturate: 0 },
        vintage:  { brightness: 95, contrast: 85, saturate: 70, sepia: 40 },
        pink:     { brightness: 105, contrast: 100, saturate: 130, hueRotate: 330 },
        vivid:    { brightness: 110, contrast: 130, saturate: 150 },
        soft:     { brightness: 115, contrast: 85, saturate: 90 },
        dramatic: { brightness: 90, contrast: 150, saturate: 110 },
    },

    getSettings(id) {
        if (!this.imageSettings[id]) {
            this.imageSettings[id] = { zoom: 100, panX: 0.5, panY: 0.5, brightness: 100, contrast: 100, saturate: 100, filter: 'normal' };
        }
        return this.imageSettings[id];
    },

    init() {
        const cc = document.getElementById('cropCanvas');
        cc.addEventListener('mousedown', e => this.onDragStart(e));
        cc.addEventListener('mousemove', e => this.onDragMove(e));
        cc.addEventListener('mouseup', () => this.onDragEnd());
        cc.addEventListener('mouseleave', () => this.onDragEnd());
        cc.addEventListener('wheel', e => { e.preventDefault(); this.onWheel(e); }, { passive: false });
        // Touch
        cc.addEventListener('touchstart', e => { e.preventDefault(); this.onDragStart(e.touches[0]); }, { passive: false });
        cc.addEventListener('touchmove', e => { e.preventDefault(); this.onDragMove(e.touches[0]); }, { passive: false });
        cc.addEventListener('touchend', () => this.onDragEnd());

        document.getElementById('zoomRange').addEventListener('input', e => {
            const s = this.getSettings(this.editingId());
            s.zoom = parseInt(e.target.value);
            document.getElementById('zoomValue').textContent = s.zoom;
            this.renderPreview();
        });
        document.getElementById('brightnessRange').addEventListener('input', e => {
            const s = this.getSettings(this.editingId());
            s.brightness = parseInt(e.target.value);
            document.getElementById('brightnessValue').textContent = s.brightness;
            this.renderPreview();
        });
        document.getElementById('contrastRange').addEventListener('input', e => {
            const s = this.getSettings(this.editingId());
            s.contrast = parseInt(e.target.value);
            document.getElementById('contrastValue').textContent = s.contrast;
            this.renderPreview();
        });
        document.getElementById('saturateRange').addEventListener('input', e => {
            const s = this.getSettings(this.editingId());
            s.saturate = parseInt(e.target.value);
            document.getElementById('saturateValue').textContent = s.saturate;
            this.renderPreview();
        });

        document.querySelectorAll('#filterPresets .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#filterPresets .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const preset = this.FILTER_PRESETS[btn.dataset.filter];
                const s = this.getSettings(this.editingId());
                s.filter = btn.dataset.filter;
                s.brightness = preset.brightness;
                s.contrast = preset.contrast;
                s.saturate = preset.saturate;
                document.getElementById('brightnessRange').value = s.brightness;
                document.getElementById('brightnessValue').textContent = s.brightness;
                document.getElementById('contrastRange').value = s.contrast;
                document.getElementById('contrastValue').textContent = s.contrast;
                document.getElementById('saturateRange').value = s.saturate;
                document.getElementById('saturateValue').textContent = s.saturate;
                this.renderPreview();
            });
        });

        document.getElementById('cropResetBtn').addEventListener('click', () => {
            const s = this.getSettings(this.editingId());
            s.panX = 0.5; s.panY = 0.5; s.zoom = 100;
            document.getElementById('zoomRange').value = 100;
            document.getElementById('zoomValue').textContent = '100';
            this.renderPreview();
        });

        document.getElementById('imgEditorApply').addEventListener('click', () => this.apply());
        document.getElementById('imgEditorClose').addEventListener('click', () => this.close());
    },

    editingId() {
        const group = APP.montages[APP.currentMontageIdx];
        return group ? group[this.editingIdx].id : 0;
    },

    open(idx) {
        this.editingIdx = idx;
        const group = APP.montages[APP.currentMontageIdx];
        if (!group || !group[idx]) return;

        this.editingImg = APP.loadedCanvasImages[idx];
        if (!this.editingImg) { toast('Imagem não carregada', 'error'); return; }

        const s = this.getSettings(group[idx].id);
        // Set UI
        document.getElementById('zoomRange').value = s.zoom;
        document.getElementById('zoomValue').textContent = s.zoom;
        document.getElementById('brightnessRange').value = s.brightness;
        document.getElementById('brightnessValue').textContent = s.brightness;
        document.getElementById('contrastRange').value = s.contrast;
        document.getElementById('contrastValue').textContent = s.contrast;
        document.getElementById('saturateRange').value = s.saturate;
        document.getElementById('saturateValue').textContent = s.saturate;
        // Active filter btn
        document.querySelectorAll('#filterPresets .filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === s.filter);
        });

        document.getElementById('imgEditorModal').classList.remove('hidden');
        this.renderPreview();
    },

    close() {
        document.getElementById('imgEditorModal').classList.add('hidden');
        this.editingIdx = -1;
        this.editingImg = null;
    },

    apply() {
        this.close();
        renderCanvas();
        renderImageEditGrid();
        toast('Edição aplicada! ✨', 'success');
    },

    onDragStart(e) {
        this.dragStart = { x: e.clientX, y: e.clientY };
        const s = this.getSettings(this.editingId());
        this.tempPan = { x: s.panX, y: s.panY };
    },
    onDragMove(e) {
        if (!this.dragStart) return;
        const cc = document.getElementById('cropCanvas');
        const dx = (e.clientX - this.dragStart.x) / cc.offsetWidth;
        const dy = (e.clientY - this.dragStart.y) / cc.offsetHeight;
        const s = this.getSettings(this.editingId());
        s.panX = Math.max(0, Math.min(1, this.tempPan.x - dx));
        s.panY = Math.max(0, Math.min(1, this.tempPan.y - dy));
        this.renderPreview();
    },
    onDragEnd() { this.dragStart = null; },
    onWheel(e) {
        const s = this.getSettings(this.editingId());
        s.zoom = Math.max(100, Math.min(300, s.zoom + (e.deltaY > 0 ? -10 : 10)));
        document.getElementById('zoomRange').value = s.zoom;
        document.getElementById('zoomValue').textContent = s.zoom;
        this.renderPreview();
    },

    renderPreview() {
        const cc = document.getElementById('cropCanvas');
        const ctx = cc.getContext('2d');
        const img = this.editingImg;
        if (!img) return;

        const W = cc.width, H = cc.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, W, H);

        const s = this.getSettings(this.editingId());
        ctx.save();
        ctx.filter = this.buildFilter(s);
        this.drawCropped(ctx, img, 0, 0, W, H, s);
        ctx.restore();
    },

    buildFilter(s) {
        let f = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturate}%)`;
        const p = this.FILTER_PRESETS[s.filter];
        if (p && p.hueRotate) f += ` hue-rotate(${p.hueRotate}deg)`;
        if (p && p.sepia) f += ` sepia(${p.sepia}%)`;
        return f;
    },

    drawCropped(ctx, img, x, y, w, h, s) {
        const scale = s.zoom / 100;
        const imgR = img.width / img.height;
        const boxR = w / h;
        let sw, sh;
        if (imgR > boxR) { sh = img.height / scale; sw = sh * boxR; }
        else { sw = img.width / scale; sh = sw / boxR; }
        const maxSx = img.width - sw, maxSy = img.height - sh;
        const sx = maxSx * s.panX, sy = maxSy * s.panY;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    },
};

export function renderImageEditGrid() {
    const grid = document.getElementById('imageEditGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const group = APP.montages[APP.currentMontageIdx];
    if (!group) return;

    const need = LAYOUTS[APP.layout].count;

    for (let i = 0; i < need; i++) {
        const item = group[i];
        const tile = document.createElement('div');

        if (item) {
            const s = ImgEditor.getSettings(item.id);
            const edited = s.zoom !== 100 || s.brightness !== 100 || s.contrast !== 100 || s.saturate !== 100 || s.filter !== 'normal';
            
            tile.className = 'img-edit-tile';
            tile.draggable = true;
            tile.innerHTML = `
                <img src="${item.thumb}" alt="">
                <div class="img-edit-badge">${i + 1}</div>
                ${edited ? '<div class="img-edit-edited">EDITADA</div>' : ''}
                <div class="img-edit-overlay"><span>✂️</span><small>EDITAR</small></div>
            `;
            
            // Editor Click
            tile.addEventListener('click', () => ImgEditor.open(i));
            
            // Drag and Drop Events
            tile.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', i);
                tile.classList.add('dragging');
            });
            tile.addEventListener('dragend', () => {
                tile.classList.remove('dragging');
                document.querySelectorAll('.img-edit-tile').forEach(t => t.classList.remove('drag-over'));
            });
            tile.addEventListener('dragover', e => {
                e.preventDefault();
                tile.classList.add('drag-over');
            });
            tile.addEventListener('dragleave', () => {
                tile.classList.remove('drag-over');
            });
            tile.addEventListener('drop', e => {
                e.preventDefault();
                tile.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = i;
                
                if (fromIdx !== toIdx && !isNaN(fromIdx)) {
                    swapImages(fromIdx, toIdx);
                }
            });
        } else {
            tile.className = 'img-edit-tile empty-slot';
            tile.innerHTML = `
                <div class="empty-icon-wrap"><i data-lucide="plus"></i></div>
                <small>Adicionar</small>
            `;
            tile.addEventListener('click', () => {
                APP.addingToSlot = { montageIdx: APP.currentMontageIdx, slotIdx: i };
                closeEditor();
                toast('Selecione uma imagem para preencher o espaço', 'info');
            });
        }
        
        grid.appendChild(tile);
    }
    
    if (window.lucide) window.lucide.createIcons();
}

function swapImages(fromIdx, toIdx) {
    const need = LAYOUTS[APP.layout].count;
    const flatFrom = APP.currentMontageIdx * need + fromIdx;
    const flatTo = APP.currentMontageIdx * need + toIdx;
    
    // Check if target is not empty, can't swap with nothing in a pure array without padding
    // But actually, if they drag a real image to an empty slot, they shouldn't swap.
    // They should just move it there? But moving shifts array.
    // It's better to prevent dropping onto an empty slot if it's tricky, or pad the array.
    if (flatTo >= APP.selectedImages.length || flatFrom >= APP.selectedImages.length) {
        toast('Não é possível arrastar para um espaço vazio', 'error');
        return;
    }

    const temp = APP.selectedImages[flatFrom];
    APP.selectedImages[flatFrom] = APP.selectedImages[flatTo];
    APP.selectedImages[flatTo] = temp;
    
    buildMontages();
    updateSelectionBadges();
    updateSelectionBar();
    loadCurrentMontageImages().then(() => {
        renderCanvas();
        renderImageEditGrid();
    });
}
