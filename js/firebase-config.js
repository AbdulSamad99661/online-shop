// Firebase Configuration & Initialization Service (Modular SDK v10)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword as fbSignIn, 
  createUserWithEmailAndPassword as fbCreateUser, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile as fbUpdateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Default or LocalStorage Firebase Config
// Replace with your real Firebase Project credentials from Firebase Console -> Project Settings -> General -> Your Apps
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFJTdKg5Sm5ohRdqMObBGafH2FovizbuU",
  authDomain: "aurastore-ecommerce.firebaseapp.com",
  projectId: "aurastore-ecommerce",
  storageBucket: "aurastore-ecommerce.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Retrieve active config (from LocalStorage if saved by user, or default)
export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem("firebase_custom_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return { config: parsed, isCustom: true };
      }
    }
  } catch (e) {
    console.warn("Could not read saved Firebase config:", e);
  }
  return { config: DEFAULT_FIREBASE_CONFIG, isCustom: false };
}

export function saveCustomFirebaseConfig(configObj) {
  localStorage.setItem("firebase_custom_config", JSON.stringify(configObj));
  window.location.reload();
}

export function resetFirebaseConfig() {
  localStorage.removeItem("firebase_custom_config");
  window.location.reload();
}

// Initialize Firebase App
let app = null;
let auth = null;
let db = null;
let isFirebaseLive = false;

const { config: activeConfig, isCustom } = getActiveFirebaseConfig();

// Check if config has real keys (not the default placeholder)
const isRealConfig = isCustom || (activeConfig.apiKey && !activeConfig.apiKey.includes("YOUR_DEMO_API_KEY"));

try {
  if (getApps().length === 0) {
    app = initializeApp(activeConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseLive = isRealConfig;
} catch (error) {
  console.warn("Firebase initialized in Local/Sandbox fallback mode:", error.message);
  isFirebaseLive = false;
}

export { 
  app, 
  auth, 
  db, 
  isFirebaseLive,
  fbSignIn, 
  fbCreateUser, 
  fbSignOut, 
  fbOnAuthStateChanged,
  fbUpdateProfile,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
};
