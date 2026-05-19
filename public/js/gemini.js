import { app } from './firebase-config.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-ai.js";
import { searchPexels } from './api.js';

// ===== Gemini AI Module =====
let aiModel = null;

function getModel() {
    if (!aiModel) {
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        aiModel = getGenerativeModel(ai, { model: "gemini-2.0-flash" });
    }
    return aiModel;
}

// Simple string hash for deduplication
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36);
}

export function getMontageHash(imageIds) {
    const sorted = [...imageIds].map(id => String(id)).sort();
    return hashString(sorted.join(','));
}

// Load used hashes from localStorage
export function loadUsedHashes() {
    try {
        const stored = localStorage.getItem('montageHashes');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
}

// Save used hashes to localStorage
export function saveUsedHashes(hashSet) {
    try {
        localStorage.setItem('montageHashes', JSON.stringify([...hashSet]));
    } catch (e) {
        console.warn('Failed to save montage hashes:', e);
    }
}

// Fetch enough images from Pexels for the requested montages
async function fetchEnoughImages(query, totalNeeded) {
    const allImages = [];
    const seenIds = new Set();
    let page = 1;
    const maxPages = 10;

    while (allImages.length < totalNeeded && page <= maxPages) {
        try {
            const data = await searchPexels(query, page);
            if (!data.photos || data.photos.length === 0) break;

            for (const photo of data.photos) {
                if (!seenIds.has(photo.id)) {
                    seenIds.add(photo.id);
                    allImages.push({
                        id: photo.id,
                        url: photo.src.large2x || photo.src.large,
                        thumb: photo.src.medium,
                        photographer: photo.photographer,
                        alt: photo.alt || '',
                    });
                }
            }
            page++;
        } catch (e) {
            console.error('Error fetching images page', page, e);
            break;
        }
    }

    return allImages;
}

/**
 * Use Gemini to automatically select and organize images into montages.
 * @param {string} query - Search query / category
 * @param {number} numMontages - Number of montages to create
 * @param {number} imagesPerMontage - Number of images per montage
 * @param {Function} onProgress - Progress callback (message)
 * @returns {Promise<Array<Array<Object>>>} - Array of montage groups
 */
export async function autoSelectImages(query, numMontages, imagesPerMontage, onProgress = () => {}) {
    const totalNeeded = numMontages * imagesPerMontage;
    const usedHashes = loadUsedHashes();

    // Step 1: Fetch enough images
    onProgress(`Buscando imagens para "${query}"...`);
    const allImages = await fetchEnoughImages(query, Math.max(totalNeeded * 2, 60));

    if (allImages.length < totalNeeded) {
        throw new Error(`Só encontramos ${allImages.length} imagens, mas precisamos de ${totalNeeded}. Tente uma busca mais ampla.`);
    }

    // Step 2: Build metadata for Gemini
    onProgress('Analisando imagens com IA...');
    const imageList = allImages.map((img, i) => ({
        index: i,
        id: img.id,
        description: img.alt || `Foto por ${img.photographer}`,
        photographer: img.photographer,
    }));

    const usedHashList = usedHashes.size > 0 
        ? `\n\nIMPORTANTE: As seguintes combinações de IDs JÁ FORAM USADAS e NÃO podem ser repetidas: ${JSON.stringify([...usedHashes].slice(-50))}`
        : '';

    const prompt = `Você é um curador visual especializado em montagens para TikTok.

Tenho ${allImages.length} imagens disponíveis da categoria "${query}".
Preciso criar ${numMontages} montagens, cada uma com ${imagesPerMontage} imagens.

REGRAS:
1. Cada imagem só pode aparecer em UMA montagem (sem repetir imagens entre montagens)
2. As imagens de cada montagem devem ser visualmente harmoniosas entre si
3. Distribua variedade entre as montagens (diferentes fotógrafos quando possível)
4. Nenhuma combinação de IDs pode se repetir com montagens anteriores${usedHashList}

LISTA DE IMAGENS DISPONÍVEIS:
${JSON.stringify(imageList)}

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem explicação):
{"montages": [[0, 3, 7, 2], [1, 5, 8, 4], ...]}

Onde cada array interno contém os ÍNDICES das imagens (campo "index") que devem compor cada montagem.
Retorne exatamente ${numMontages} montagens com ${imagesPerMontage} índices cada.`;

    // Step 3: Call Gemini
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Step 4: Parse response
    onProgress('Organizando montagens...');
    let parsed;
    try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error('Gemini response parsing error:', text);
        throw new Error('A IA retornou uma resposta inválida. Tente novamente.');
    }

    if (!parsed.montages || !Array.isArray(parsed.montages)) {
        throw new Error('Formato de resposta inválido da IA.');
    }

    // Step 5: Map indices back to image objects and validate
    const montageGroups = [];
    const usedIndices = new Set();

    for (const group of parsed.montages) {
        if (montageGroups.length >= numMontages) break;

        const montageImages = [];
        for (const idx of group) {
            if (idx >= 0 && idx < allImages.length && !usedIndices.has(idx)) {
                usedIndices.add(idx);
                montageImages.push(allImages[idx]);
            }
        }

        // Only add if we got enough images
        if (montageImages.length >= imagesPerMontage) {
            const imageIds = montageImages.map(img => img.id);
            const hash = getMontageHash(imageIds);

            if (!usedHashes.has(hash)) {
                montageGroups.push(montageImages.slice(0, imagesPerMontage));
                usedHashes.add(hash);
            }
        }
    }

    // If Gemini didn't give us enough valid montages, fill with random remaining
    if (montageGroups.length < numMontages) {
        const remainingImages = allImages.filter((_, i) => !usedIndices.has(i));
        let rIdx = 0;
        while (montageGroups.length < numMontages && rIdx + imagesPerMontage <= remainingImages.length) {
            const group = remainingImages.slice(rIdx, rIdx + imagesPerMontage);
            const hash = getMontageHash(group.map(g => g.id));
            if (!usedHashes.has(hash)) {
                montageGroups.push(group);
                usedHashes.add(hash);
            }
            rIdx += imagesPerMontage;
        }
    }

    // Save updated hashes
    saveUsedHashes(usedHashes);

    if (montageGroups.length === 0) {
        throw new Error('Não foi possível criar montagens únicas. Tente com outra categoria ou mais imagens.');
    }

    onProgress(`${montageGroups.length} montagens criadas!`);
    return montageGroups;
}
