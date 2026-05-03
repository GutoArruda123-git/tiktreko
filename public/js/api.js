import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { currentUser } from './auth.js';

export const DEFAULT_PEXELS_KEY = 'GT4C95DArz9RdeYMsU2sHVTz8GqDeOLuCn84ganU';

export const API_STATE = {
    pexelsKey: DEFAULT_PEXELS_KEY,
};

export async function loadKeys() {
    // Tenta carregar do localStorage primeiro para ser instantâneo
    const localKey = localStorage.getItem('pexelsKey');
    if (localKey) {
        API_STATE.pexelsKey = localKey;
    }

    if (!currentUser) return !!localKey;

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
                return true;
            }
        }
        return !!localKey;
    } catch (e) {
        console.warn("Firestore inacessível, usando local storage se disponível.", e);
        return !!localKey;
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

export async function saveKeys(pexelsKey) {
    // Salva no estado da aplicação e localStorage sempre
    API_STATE.pexelsKey = pexelsKey;
    localStorage.setItem('pexelsKey', pexelsKey);

    if (!currentUser) return true; // Funciona mesmo sem login

    try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'keys');
        // Evita travamento infinito com Promise.race de 4 segundos
        await Promise.race([
            setDoc(docRef, { pexelsKey }, { merge: true }),
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
    
    return await resp.json();
}
