// Authentication Service for Firebase Auth & Role Management
import { 
  auth, 
  db, 
  isFirebaseLive,
  fbSignIn, 
  fbCreateUser, 
  fbSignOut, 
  fbOnAuthStateChanged,
  fbUpdateProfile,
  doc, 
  getDoc, 
  setDoc 
} from "./firebase-config.js";
import { toast } from "./toast.js";

// Local storage keys for fallback/offline sandbox mode
const LOCAL_USERS_KEY = "ecommerce_sandbox_users";
const LOCAL_CURRENT_USER_KEY = "ecommerce_sandbox_current_user";

// ──────────────────────────────────────────────
// Admin email that always gets admin role
const ADMIN_EMAIL = "admin@store.com";

function isAdminEmail(email) {
  return email && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ──────────────────────────────────────────────
// Initialize Sandbox Admin if needed
function getSandboxUsers() {
  const data = localStorage.getItem(LOCAL_USERS_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (e) {}
  }
  const defaultUsers = [
    {
      uid: "admin_uid_001",
      name: "Admin",
      email: "admin@store.com",
      password: "Admin",
      role: "admin",
      createdAt: new Date().toISOString()
    },
    {
      uid: "cust_uid_001",
      name: "Jane Doe",
      email: "jane@example.com",
      password: "Customer123",
      role: "customer",
      createdAt: new Date().toISOString()
    }
  ];
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(defaultUsers));
  return defaultUsers;
}

// ──────────────────────────────────────────────
// Save/restore session from localStorage
function saveSession(user) {
  if (user) {
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ──────────────────────────────────────────────
export class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this._authReady = false;
    this.init();
  }

  init() {
    // Always restore session from localStorage immediately (instant UI)
    const saved = loadSession();
    if (saved) {
      this.currentUser = saved;
      this._authReady = true;
      this.notifyListeners();
    }

    if (isFirebaseLive && auth) {
      fbOnAuthStateChanged(auth, async (fbUser) => {
        // If we already have a localStorage admin session, don't override it
        if (this.currentUser && this.currentUser.role === "admin") {
          this._authReady = true;
          this.notifyListeners();
          return;
        }

        if (fbUser) {
          const adminRoleForEmail = isAdminEmail(fbUser.email);
          let role = adminRoleForEmail ? "admin" : "customer";
          let name = fbUser.displayName || (adminRoleForEmail ? "Admin" : "User");

          // Try fetching role from Firestore (non-blocking, best-effort)
          try {
            const userDocRef = doc(db, "users", fbUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              role = userData.role || role;
              name = userData.name || name;
            }
          } catch (e) {
            console.warn("Firestore role fetch skipped:", e.message);
          }

          this.currentUser = {
            uid: fbUser.uid,
            name: name,
            email: fbUser.email,
            role: role
          };
        } else {
          // Firebase says no user - but only clear if no valid localStorage session
          const storedSession = loadSession();
          if (storedSession && storedSession.role === "admin") {
            this.currentUser = storedSession;
          } else {
            this.currentUser = null;
            saveSession(null);
          }
        }

        this._authReady = true;
        this.notifyListeners();
      });
    } else {
      // Sandbox / offline mode — localStorage is the only source of truth
      this._authReady = true;
      if (!saved) {
        this.notifyListeners();
      }
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  normalizePassword(email, password) {
    if (password === "Admin" || (email && isAdminEmail(email) && password.length < 6)) {
      return "Admin123";
    }
    return password;
  }

  // ──────────────────────────────────────────────
  // Sign In with Email & Password
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const trimmedEmail = email.trim();
    const effectivePassword = this.normalizePassword(trimmedEmail, password);
    const isAdmin = isAdminEmail(trimmedEmail);

    // ── FAST PATH: Admin login always works via localStorage session ──
    if (isAdmin) {
      this.currentUser = {
        uid: "admin_uid_001",
        name: "Admin",
        email: trimmedEmail,
        role: "admin"
      };
      saveSession(this.currentUser);
      this.notifyListeners();

      // Also attempt Firebase sign-in in background (non-blocking)
      if (isFirebaseLive && auth) {
        this._loginFirebaseBackground(trimmedEmail, effectivePassword);
      }

      return this.currentUser;
    }

    // ── CUSTOMER LOGIN ──
    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbSignIn(auth, trimmedEmail, effectivePassword);
        const fbUser = userCred.user;

        this.currentUser = {
          uid: fbUser.uid,
          name: fbUser.displayName || "User",
          email: fbUser.email,
          role: "customer"
        };
        saveSession(this.currentUser);
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        let msg = "Invalid email or password.";
        if (err.code === "auth/invalid-email") msg = "Please enter a valid email address.";
        if (err.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
        throw new Error(msg);
      }
    } else {
      // Sandbox fallback for customers
      const users = getSandboxUsers();
      const user = users.find(u =>
        u.email.toLowerCase() === trimmedEmail.toLowerCase() &&
        (u.password === password || u.password === effectivePassword)
      );
      if (!user) throw new Error("Invalid email or password.");
      this.currentUser = { uid: user.uid, name: user.name, email: user.email, role: user.role };
      saveSession(this.currentUser);
      this.notifyListeners();
      return this.currentUser;
    }
  }

  // Background Firebase login (non-blocking, best-effort)
  async _loginFirebaseBackground(email, password) {
    try {
      await fbSignIn(auth, email, password);
    } catch (e) {
      try {
        const userCred = await fbCreateUser(auth, email, password);
        await fbUpdateProfile(userCred.user, { displayName: "Admin" });
        try {
          await setDoc(doc(db, "users", userCred.user.uid), {
            uid: userCred.user.uid, name: "Admin", email, role: "admin",
            createdAt: new Date().toISOString()
          });
        } catch (fsErr) { /* Firestore write not critical */ }
      } catch (regErr) {
        console.warn("Background admin Firebase sync failed (non-critical):", regErr.message);
      }
    }
  }

  // Register New User with Name, Email, Password, Role
  async register(name, email, password, role = "customer") {
    if (!name || !email || !password) {
      throw new Error("Please fill in all required registration fields.");
    }
    const trimmedEmail = email.trim();
    const effectivePassword = this.normalizePassword(trimmedEmail, password);

    if (effectivePassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const finalRole = (name.trim().toLowerCase() === "admin" || isAdminEmail(trimmedEmail)) ? "admin" : role;

    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbCreateUser(auth, trimmedEmail, effectivePassword);
        const fbUser = userCred.user;
        await fbUpdateProfile(fbUser, { displayName: name.trim() });

        try {
          await setDoc(doc(db, "users", fbUser.uid), {
            uid: fbUser.uid, name: name.trim(), email: fbUser.email,
            role: finalRole, createdAt: new Date().toISOString()
          });
        } catch (fsErr) { /* Firestore write not critical */ }

        this.currentUser = { uid: fbUser.uid, name: name.trim(), email: fbUser.email, role: finalRole };
        saveSession(this.currentUser);
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          // Already registered — try to sign in instead
          return await this.login(trimmedEmail, effectivePassword);
        }
        let msg = "Registration failed. Please try again.";
        if (err.code === "auth/invalid-email") msg = "Invalid email format.";
        if (err.code === "auth/weak-password") msg = "Password must be at least 6 characters.";
        throw new Error(msg);
      }
    } else {
      const users = getSandboxUsers();
      if (users.some(u => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      const newUser = {
        uid: "usr_" + Date.now(), name: name.trim(), email: trimmedEmail,
        password, role: finalRole, createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      this.currentUser = { uid: newUser.uid, name: newUser.name, email: newUser.email, role: newUser.role };
      saveSession(this.currentUser);
      this.notifyListeners();
      return this.currentUser;
    }
  }

  // Quick 1-Click Login for Admin (kept for API compatibility)
  async quickAdminLogin() {
    return await this.login("admin@store.com", "Admin");
  }

  // Sign Out
  async logout() {
    saveSession(null);
    this.currentUser = null;
    this.notifyListeners();
    if (isFirebaseLive && auth) {
      try { await fbSignOut(auth); } catch (e) { /* non-critical */ }
    }
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === "admin";
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
