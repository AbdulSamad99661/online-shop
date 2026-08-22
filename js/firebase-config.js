// Firebase Configuration, Initialization, and Connection Diagnostics (Modular SDK v10)
import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONFIG_STORAGE_KEY = "firebase_custom_config";

// Replace these with your real Firebase web app keys from
// Firebase Console → Project settings → General → Your apps
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFJTdKg5Sm5ohRdqMObBGafH2FovizbuU",
  authDomain: "aurastore-ecommerce.firebaseapp.com",
  projectId: "aurastore-ecommerce",
  storageBucket: "aurastore-ecommerce.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

export function isPlaceholderConfig(config = {}) {
  const apiKey = String(config.apiKey || "");
  const projectId = String(config.projectId || "");
  const senderId = String(config.messagingSenderId || "");
  const appId = String(config.appId || "");

  return (
    !apiKey ||
    apiKey.includes("YOUR_") ||
    apiKey.includes("XXXX") ||
    projectId.includes("your-project") ||
    senderId === "123456789012" ||
    appId.includes("abcdef1234567890")
  );
}

export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.apiKey && parsed?.projectId) {
        return { config: parsed, isCustom: true };
      }
    }
  } catch (e) {
    console.warn("Could not read saved Firebase config:", e);
  }
  return { config: DEFAULT_FIREBASE_CONFIG, isCustom: false };
}

export function saveCustomFirebaseConfig(configObj) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configObj));
  window.location.reload();
}

export function resetFirebaseConfig() {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  window.location.reload();
}

let app = null;
let auth = null;
let db = null;
let isFirebaseLive = false;
let firebaseInitError = "";

const { config: activeConfig } = getActiveFirebaseConfig();

try {
  if (getApps().length === 0) {
    app = initializeApp(activeConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseLive = !isPlaceholderConfig(activeConfig);
} catch (error) {
  firebaseInitError = error.message;
  console.warn("Firebase initialized in Local/Sandbox fallback mode:", error.message);
  isFirebaseLive = false;
}

export async function testFirebaseConnection(configInput) {
  const config = configInput || activeConfig;
  const missing = [];
  if (!config?.apiKey) missing.push("apiKey");
  if (!config?.authDomain) missing.push("authDomain");
  if (!config?.projectId) missing.push("projectId");
  if (missing.length) {
    return {
      ok: false,
      authReady: false,
      firestoreReady: false,
      projectId: config?.projectId || "",
      message: `Missing required fields: ${missing.join(", ")}`,
      hint: "Copy the full firebaseConfig object from Firebase Console → Project settings → Your apps."
    };
  }

  if (isPlaceholderConfig(config) && !configInput) {
    return {
      ok: false,
      authReady: false,
      firestoreReady: false,
      projectId: config.projectId,
      message: "Placeholder Firebase keys are still in use.",
      hint: "Paste your real web app config in the Admin → Firebase tab, then click Save & Apply."
    };
  }

  let testApp = null;
  try {
    testApp = initializeApp(config, `aura-connection-test-${Date.now()}`);
    const testAuth = getAuth(testApp);
    const testDb = getFirestore(testApp);

    let firestoreReady = false;
    let firestoreError = "";
    try {
      await getDocs(query(collection(testDb, "products"), limit(1)));
      firestoreReady = true;
    } catch (err) {
      firestoreError = err.code === "permission-denied"
        ? "Firestore is reachable, but security rules blocked the read. Publish firestore.rules (or use test mode) in Firebase Console."
        : (err.message || "Could not read the products collection.");
    }

    return {
      ok: firestoreReady,
      authReady: Boolean(testAuth),
      firestoreReady,
      projectId: config.projectId,
      message: firestoreReady
        ? `Connected to Cloud Firestore project "${config.projectId}".`
        : firestoreError,
      hint: firestoreReady
        ? "Enable Email/Password in Authentication, then create the admin account and seed products."
        : "Create a Firestore database and publish the project rules before seeding data."
    };
  } catch (err) {
    return {
      ok: false,
      authReady: false,
      firestoreReady: false,
      projectId: config.projectId,
      message: err.message || "Firebase failed to initialize with this config.",
      hint: "Double-check apiKey, authDomain, and projectId. They must match the same Firebase project."
    };
  } finally {
    if (testApp) {
      try { await deleteApp(testApp); } catch (e) { /* ignore */ }
    }
  }
}

export {
  app,
  auth,
  db,
  isFirebaseLive,
  firebaseInitError,
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
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
};
