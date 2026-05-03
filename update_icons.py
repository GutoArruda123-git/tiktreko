import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

replacements = {
    '🔑': '<i data-lucide="key"></i>',
    '🚀': '<i data-lucide="rocket"></i>',
    '<span class="logo-icon">✨</span>': '<i data-lucide="sparkles" class="logo-icon"></i>',
    '<div class="logo">': '<a href="/" class="logo">',
    '<h1>TikTreko</h1>\n                <span class="logo-badge">5 Notis</span>\n            </div>': '<h1>TikTreko</h1>\n                <span class="logo-badge">5 Notis</span>\n            </a>',
    '<span class="cat-emoji">🪮</span>': '<i data-lucide="scissors" class="cat-icon"></i>',
    '<span class="cat-emoji">💅</span>': '<i data-lucide="sparkles" class="cat-icon"></i>',
    '<span class="cat-emoji">💄</span>': '<i data-lucide="brush" class="cat-icon"></i>',
    '<span class="cat-emoji">✨</span>': '<i data-lucide="sparkles" class="cat-icon"></i>',
    '<span class="cat-emoji">💑</span>': '<i data-lucide="heart-handshake" class="cat-icon"></i>',
    '<span class="cat-emoji">🎁</span>': '<i data-lucide="gift" class="cat-icon"></i>',
    '<span class="cat-emoji">👗</span>': '<i data-lucide="shirt" class="cat-icon"></i>',
    '<span class="cat-emoji">🌸</span>': '<i data-lucide="flower" class="cat-icon"></i>',
    '<span class="cat-emoji">〰️</span>': '<i data-lucide="waves" class="cat-icon"></i>',
    '<span class="cat-emoji">👁️</span>': '<i data-lucide="eye" class="cat-icon"></i>',
    '<span class="cat-emoji">🧴</span>': '<i data-lucide="flask-conical" class="cat-icon"></i>',
    '<span class="cat-emoji">👟</span>': '<i data-lucide="footprints" class="cat-icon"></i>',
    '<span>🔍</span>': '<i data-lucide="search" class="icon-inline"></i>',
    'Montar →': 'Montar <i data-lucide="arrow-right" class="icon-inline"></i>',
    '← Voltar': '<i data-lucide="arrow-left" class="icon-inline"></i> Voltar',
    '← Anterior': '<i data-lucide="arrow-left" class="icon-inline"></i> Anterior',
    'Próxima →': 'Próxima <i data-lucide="arrow-right" class="icon-inline"></i>',
    '📐 Layout da Montagem': '<i data-lucide="ruler"></i> Layout da Montagem',
    '📝 Texto da Montagem': '<i data-lucide="type"></i> Texto da Montagem',
    '✏️ Personalizado': '<i data-lucide="pen" class="icon-inline"></i> Personalizado',
    '🚫 Sem Texto': '<i data-lucide="ban" class="icon-inline"></i> Sem Texto',
    '🎨 Fonte & Estilo': '<i data-lucide="palette"></i> Fonte & Estilo',
    '✏️ Contorno & Tarja': '<i data-lucide="pen-tool"></i> Contorno & Tarja',
    '🖼️ Editar Imagens': '<i data-lucide="image"></i> Editar Imagens',
    '📥 Baixar Montagem Atual': '<i data-lucide="download" class="icon-inline"></i> Baixar Montagem Atual',
    '📦 Baixar TODAS as Montagens': '<i data-lucide="package" class="icon-inline"></i> Baixar TODAS as Montagens',
    '🔄 Nova Montagem': '<i data-lucide="refresh-cw" class="icon-inline"></i> Nova Montagem',
    '✂️ Editar Imagem': '<i data-lucide="crop"></i> Editar Imagem',
    '✕': '<i data-lucide="x"></i>',
    '📐 Corte & Zoom': '<i data-lucide="zoom-in"></i> Corte & Zoom',
    '↺ Resetar posição': '<i data-lucide="rotate-ccw" class="icon-inline"></i> Resetar posição',
    '🎨 Ajustes': '<i data-lucide="sliders"></i> Ajustes',
    '✨ Filtros': '<i data-lucide="sparkles"></i> Filtros',
    '✅ Aplicar': '<i data-lucide="check" class="icon-inline"></i> Aplicar',
    '<div class="empty-icon">📸</div>': '<div class="empty-icon"><i data-lucide="camera"></i></div>',
}

for k, v in replacements.items():
    html = html.replace(k, v)

# Add Lucide script
if 'unpkg.com/lucide' not in html:
    html = html.replace('</body>', '    <script src="https://unpkg.com/lucide@latest"></script>\n    <script>\n      lucide.createIcons();\n    </script>\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
