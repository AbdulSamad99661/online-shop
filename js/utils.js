// Shared helpers used across storefront and admin modules

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function debounce(fn, wait = 280) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export function formatAuthError(err) {
  const map = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/email-already-in-use": "An account with this email already exists. Please sign in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled. Open Firebase Console > Authentication > Sign-in method and enable Email/Password.",
    "auth/user-disabled": "This account has been disabled.",
    "permission-denied": "Firestore permission denied. Publish the rules from firestore.rules in Firebase Console."
  };
  if (err?.code && map[err.code]) return map[err.code];
  if (typeof err?.message === "string" && err.message.toLowerCase().includes("permission")) {
    return map["permission-denied"];
  }
  return err?.message || "Something went wrong. Please try again.";
}

export function parseFirebaseConfigJson(raw) {
  if (!raw || !raw.trim()) {
    throw new Error("Paste your Firebase web config JSON first.");
  }

  let text = raw.trim();
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) text = objectMatch[0];

  text = text
    .replace(/(\w+)\s*:/g, '"$1":')
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/'/g, '"');

  const parsed = JSON.parse(text);
  const config = {
    apiKey: (parsed.apiKey || "").trim(),
    authDomain: (parsed.authDomain || "").trim(),
    projectId: (parsed.projectId || "").trim(),
    storageBucket: (parsed.storageBucket || "").trim(),
    messagingSenderId: String(parsed.messagingSenderId || "").trim(),
    appId: (parsed.appId || "").trim()
  };

  if (!config.apiKey || !config.projectId || !config.authDomain) {
    throw new Error("Config must include apiKey, authDomain, and projectId.");
  }
  return config;
}
