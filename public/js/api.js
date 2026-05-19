import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { currentUser } from './auth.js';

export const DEFAULT_PEXELS_KEY = 'GT4C95DArz9RdeYMsU2sHVTz8GqDeOLuCn84ganU';

export const API_STATE = {
    pexelsKey: DEFAULT_PEXELS_KEY,
    googleSearchKey: '',
    googleSearchCx: '',
};

export async function loadKeys() {
    // Tenta carregar do localStorage primeiro para ser instantâneo
    const localKey = localStorage.getItem('pexelsKey');
    const localGoogleKey = localStorage.getItem('googleSearchKey');
    const localGoogleCx = localStorage.getItem('googleSearchCx');
    if (localKey) {
        API_STATE.pexelsKey = localKey;
    }
    if (localGoogleKey) API_STATE.googleSearchKey = localGoogleKey;
    if (localGoogleCx) API_STATE.googleSearchCx = localGoogleCx;

    if (!currentUser) return hasAnySearchProvider();

    try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'keys');
        // Adiciona um timeout no getDoc caso o Firestore não esteja criado
        const docSnap = await Promise.race([
            getDoc(docRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout loading from Firestore")), 3000))
        ]);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pexelsKey) {
                API_STATE.pexelsKey = data.pexelsKey;
                localStorage.setItem('pexelsKey', data.pexelsKey);
            }
            if (data.googleSearchKey) {
                API_STATE.googleSearchKey = data.googleSearchKey;
                localStorage.setItem('googleSearchKey', data.googleSearchKey);
            }
            if (data.googleSearchCx) {
                API_STATE.googleSearchCx = data.googleSearchCx;
                localStorage.setItem('googleSearchCx', data.googleSearchCx);
            }
            return hasAnySearchProvider();
        }
        return hasAnySearchProvider();
    } catch (e) {
        console.warn("Firestore inacessível, usando local storage se disponível.", e);
        return hasAnySearchProvider();
    }
}

export async function validatePexelsKey(key) {
    try {
        const url = `https://api.pexels.com/v1/search?query=nature&per_page=1`;
        const resp = await fetch(url, { headers: { 'Authorization': key } });
        return resp.ok;
    } catch (e) {
        return false;
    }
}

export async function saveKeys(pexelsKey, googleSearchKey = '', googleSearchCx = '') {
    // Salva no estado da aplicação e localStorage sempre
    API_STATE.pexelsKey = pexelsKey;
    API_STATE.googleSearchKey = googleSearchKey;
    API_STATE.googleSearchCx = googleSearchCx;
    localStorage.setItem('pexelsKey', pexelsKey);
    localStorage.setItem('googleSearchKey', googleSearchKey);
    localStorage.setItem('googleSearchCx', googleSearchCx);

    if (!currentUser) return true; // Funciona mesmo sem login

    try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'keys');
        // Evita travamento infinito com Promise.race de 4 segundos
        await Promise.race([
            setDoc(docRef, { pexelsKey, googleSearchKey, googleSearchCx }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout saving to Firestore")), 4000))
        ]);
        return true;
    } catch (e) {
        console.warn("Erro ao salvar no Firestore (banco pode não estar criado). Salvo localmente.", e);
        // Retornamos true pois a chave foi salva no localStorage e o app pode funcionar
        return true;
    }
}

export async function searchPexels(query, page = 1) {
    if (!API_STATE.pexelsKey) {
        throw new Error("NO_API_KEY");
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&page=${page}&orientation=portrait`;
    const resp = await fetch(url, { headers: { 'Authorization': API_STATE.pexelsKey } });
    
    if (!resp.ok) {
        if (resp.status === 401) { throw new Error("INVALID_KEY"); }
        throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    return {
        photos: data.photos || [],
        total_results: data.total_results || 0,
        per_page: 30,
        has_more: (data.photos || []).length > 0 && page * 30 < (data.total_results || 0),
    };
}

export function hasGoogleSearchConfig() {
    return Boolean(API_STATE.googleSearchKey && API_STATE.googleSearchCx);
}

export function hasAnySearchProvider() {
    return Boolean(API_STATE.pexelsKey || hasGoogleSearchConfig());
}

export async function validateGoogleSearchConfig(key, cx) {
    if (!key || !cx) return false;
    try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', key);
        url.searchParams.set('cx', cx);
        url.searchParams.set('q', 'nature');
        url.searchParams.set('searchType', 'image');
        url.searchParams.set('num', '1');
        const resp = await fetch(url);
        return resp.ok;
    } catch {
        return false;
    }
}

function sourceQuery(query, source) {
    if (source === 'pinterest') return `${query} site:pinterest.com`;
    if (source === 'tumblr') return `${query} site:tumblr.com`;
    return query;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function normalizeGoogleItem(item) {
    const thumb = item.image?.thumbnailLink || item.link;
    return {
        id: `google-${item.cacheId || hashString(item.link || item.title || Math.random().toString())}`,
        src: {
            medium: thumb,
            large: item.link,
            large2x: item.link,
        },
        url: item.link,
        thumb,
        photographer: item.displayLink || 'Google Imagens',
        alt: item.title || item.snippet || '',
        source: 'google',
        pageUrl: item.image?.contextLink || item.link,
    };
}

export async function searchGoogleImages(query, page = 1, source = 'google') {
    if (!hasGoogleSearchConfig()) {
        throw new Error('MISSING_GOOGLE_CONFIG');
    }

    const start = ((page - 1) * 10) + 1;
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', API_STATE.googleSearchKey);
    url.searchParams.set('cx', API_STATE.googleSearchCx);
    url.searchParams.set('q', sourceQuery(query, source));
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '10');
    url.searchParams.set('start', String(start));
    url.searchParams.set('safe', 'active');

    const resp = await fetch(url);
    if (!resp.ok) {
        if (resp.status === 400 || resp.status === 403) throw new Error('INVALID_GOOGLE_CONFIG');
        throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const total = parseInt(data.searchInformation?.totalResults || '0', 10) || 0;
    return {
        photos: (data.items || []).map(normalizeGoogleItem),
        total_results: total,
        per_page: 10,
        has_more: Boolean(data.queries?.nextPage?.length),
    };
}

export async function searchImages(query, page = 1, source = 'pexels') {
    if (source === 'pexels') return searchPexels(query, page);
    return searchGoogleImages(query, page, source);
}
