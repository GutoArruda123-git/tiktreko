import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { currentUser } from './auth.js';

export const API_STATE = {
    pexelsKey: '',
};

export async function loadKeys() {
    if (!currentUser) return false;
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'keys');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            API_STATE.pexelsKey = data.pexelsKey || '';
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error loading keys:", e);
        return false;
    }
}

export async function saveKeys(pexelsKey) {
    if (!currentUser) return false;
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'keys');
        await setDoc(docRef, { pexelsKey }, { merge: true });
        API_STATE.pexelsKey = pexelsKey;
        return true;
    } catch (e) {
        console.error("Error saving keys:", e);
        return false;
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
