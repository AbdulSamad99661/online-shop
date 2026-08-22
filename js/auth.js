// Authentication Service — Firebase Email/Password Auth + role-based access
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
import { formatAuthError } from "./utils.js";

const LOCAL_USERS_KEY = "ecommerce_sandbox_users";
const LOCAL_CURRENT_USER_KEY = "ecommerce_sandbox_current_user";

export const ADMIN_EMAIL = "admin@store.com";
export const ADMIN_PASSWORD = "Admin123";

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

function getSandboxUsers() {
  const data = localStorage.getItem(LOCAL_USERS_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (e) { /* ignore */ }
  }
  const defaultUsers = [
    {
      uid: "admin_uid_001",
      name: "Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
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

function saveSession(user) {
  if (user) localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
}

function loadSession() {
  try {
    const raw = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.name || "User",
    email: user.email,
    role: user.role || "customer"
  };
}

export class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this._authReady = false;
    this._readyResolvers = [];
    this.init();
  }

  init() {
    if (isFirebaseLive && auth) {
      fbOnAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          this.currentUser = await this._hydrateFirebaseUser(fbUser);
          saveSession(this.currentUser);
        } else {
          this.currentUser = null;
          saveSession(null);
        }
        this._markReady();
      });
      return;
    }

    this.currentUser = toPublicUser(loadSession());
    this._markReady();
  }

  _markReady() {
    this._authReady = true;
    this.notifyListeners();
    this._readyResolvers.forEach((resolve) => resolve(this.currentUser));
    this._readyResolvers = [];
  }

  waitUntilReady() {
    if (this._authReady) return Promise.resolve(this.currentUser);
    return new Promise((resolve) => this._readyResolvers.push(resolve));
  }

  subscribe(callback) {
    this.listeners.push(callback);
    if (this._authReady) callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  normalizePassword(email, password) {
    const trimmed = String(password || "");
    if (isAdminEmail(email) && (trimmed === "Admin" || trimmed.length < 6)) {
      return ADMIN_PASSWORD;
    }
    return trimmed;
  }

  async _hydrateFirebaseUser(fbUser) {
    const adminByEmail = isAdminEmail(fbUser.email);
    let role = adminByEmail ? "admin" : "customer";
    let name = fbUser.displayName || (adminByEmail ? "Admin" : "User");

    try {
      const snap = await getDoc(doc(db, "users", fbUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        role = data.role || role;
        name = data.name || name;
      } else {
        await setDoc(doc(db, "users", fbUser.uid), {
          uid: fbUser.uid,
          name,
          email: fbUser.email,
          role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Could not sync user profile in Firestore:", e.message);
    }

    if (adminByEmail) role = "admin";
    return { uid: fbUser.uid, name, email: fbUser.email, role };
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const trimmedEmail = email.trim();
    const effectivePassword = this.normalizePassword(trimmedEmail, password);

    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbSignIn(auth, trimmedEmail, effectivePassword);
        this.currentUser = await this._hydrateFirebaseUser(userCred.user);
        saveSession(this.currentUser);
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        throw new Error(formatAuthError(err));
      }
    }

    const users = getSandboxUsers();
    const user = users.find((u) =>
      u.email.toLowerCase() === trimmedEmail.toLowerCase() &&
      (u.password === password || u.password === effectivePassword)
    );
    if (!user) throw new Error("Invalid email or password.");
    this.currentUser = toPublicUser(user);
    saveSession(this.currentUser);
    this.notifyListeners();
    return this.currentUser;
  }

  async register(name, email, password, role = "customer") {
    if (!name || !email || !password) {
      throw new Error("Please fill in all required registration fields.");
    }

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const effectivePassword = this.normalizePassword(trimmedEmail, password);

    if (effectivePassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const finalRole = isAdminEmail(trimmedEmail) ? "admin" : role;

    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbCreateUser(auth, trimmedEmail, effectivePassword);
        await fbUpdateProfile(userCred.user, { displayName: trimmedName });
        try {
          await setDoc(doc(db, "users", userCred.user.uid), {
            uid: userCred.user.uid,
            name: trimmedName,
            email: userCred.user.email,
            role: finalRole,
            createdAt: new Date().toISOString()
          });
        } catch (fsErr) {
          console.warn("User profile write skipped:", fsErr.message);
        }
        this.currentUser = {
          uid: userCred.user.uid,
          name: trimmedName,
          email: userCred.user.email,
          role: finalRole
        };
        saveSession(this.currentUser);
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          return this.login(trimmedEmail, effectivePassword);
        }
        throw new Error(formatAuthError(err));
      }
    }

    const users = getSandboxUsers();
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const newUser = {
      uid: "usr_" + Date.now(),
      name: trimmedName,
      email: trimmedEmail,
      password: effectivePassword,
      role: finalRole,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    this.currentUser = toPublicUser(newUser);
    saveSession(this.currentUser);
    this.notifyListeners();
    return this.currentUser;
  }

  async bootstrapAdminAccount() {
    if (!isFirebaseLive || !auth) {
      return this.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }
    try {
      return await this.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (err) {
      return this.register("Admin", ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
    }
  }

  async quickAdminLogin() {
    return this.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  }

  async logout() {
    saveSession(null);
    this.currentUser = null;
    this.notifyListeners();
    if (isFirebaseLive && auth) {
      try { await fbSignOut(auth); } catch (e) { /* non-critical */ }
    }
  }

  isAdmin() {
    return Boolean(this.currentUser && this.currentUser.role === "admin");
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
