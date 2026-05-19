import { auth } from './firebase-config.js';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// DOM Elements
const authSection = document.getElementById('authSection');
const searchSection = document.getElementById('searchSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');

// User Profile in Header
const userProfile = document.getElementById('userProfile');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const logoutBtn = document.getElementById('logoutBtn');

// Login Elements
const googleLoginBtn = document.getElementById('googleLoginBtn');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');

// Register Elements
const regEmailInput = document.getElementById('regEmailInput');
const regPasswordInput = document.getElementById('regPasswordInput');

// State
export let currentUser = null;

// Toggle Forms
showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Providers
const googleProvider = new GoogleAuthProvider();
let googleLoginInProgress = false;

// Google Login
googleLoginBtn.addEventListener('click', async () => {
    if (googleLoginInProgress) return;
    googleLoginInProgress = true;
    googleLoginBtn.disabled = true;

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        showToast("Erro ao fazer login com Google: " + error.message, 'error');
    } finally {
        googleLoginInProgress = false;
        googleLoginBtn.disabled = false;
    }
});

// Email Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showToast("Preencha email e senha", "error");
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showToast("Erro ao entrar: " + error.message, 'error');
    }
});

// Email Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = regEmailInput.value;
    const password = regPasswordInput.value;
    if (!email || !password) return showToast("Preencha email e senha", "error");
    if (password.length < 6) return showToast("Senha deve ter no mínimo 6 caracteres", "error");

    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showToast("Erro ao registrar: " + error.message, 'error');
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        showToast("Erro ao sair: " + error.message, "error");
    }
});

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logged in
        currentUser = user;
        authSection.classList.add('hidden');
        searchSection.classList.remove('hidden');
        userProfile.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
        
        // Dispatch custom event to notify other modules (like api.js)
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
    } else {
        // Logged out
        currentUser = null;
        authSection.classList.remove('hidden');
        searchSection.classList.add('hidden');
        userProfile.classList.add('hidden');
        document.getElementById('editorSection').classList.add('hidden'); // just in case
        
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
    }
});

// Simple toast for auth errors (will be overridden by app.js toast if needed)
function showToast(message, type = 'info') {
    const evt = new CustomEvent('show-toast', { detail: { message, type } });
    window.dispatchEvent(evt);
}
