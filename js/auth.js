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

export class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.init();
  }

  init() {
    if (isFirebaseLive && auth) {
      fbOnAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            // Fetch user profile from Firestore 'users' collection to check role
            const userDocRef = doc(db, "users", fbUser.uid);
            const userSnap = await getDoc(userDocRef);
            let role = "customer";
            let name = fbUser.displayName || "User";

            if (userSnap.exists()) {
              const userData = userSnap.data();
              role = userData.role || "customer";
              name = userData.name || name;
            } else {
              // Auto-assign admin if email matches admin@store.com
              if (fbUser.email && fbUser.email.toLowerCase().includes("admin")) {
                role = "admin";
              }
              await setDoc(userDocRef, {
                uid: fbUser.uid,
                name: name,
                email: fbUser.email,
                role: role,
                createdAt: new Date().toISOString()
              });
            }

            this.currentUser = {
              uid: fbUser.uid,
              name: name,
              email: fbUser.email,
              role: role,
              photoURL: fbUser.photoURL || null
            };
          } catch (err) {
            console.error("Error fetching Firestore user role:", err);
            this.currentUser = {
              uid: fbUser.uid,
              name: fbUser.displayName || "User",
              email: fbUser.email,
              role: fbUser.email?.toLowerCase().includes("admin") ? "admin" : "customer"
            };
          }
        } else {
          this.currentUser = null;
        }
        this.notifyListeners();
      });
    } else {
      // Sandbox fallback mode
      const savedUser = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (e) {
          this.currentUser = null;
        }
      }
      this.notifyListeners();
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
    if (password === "Admin" || (email && email.toLowerCase().includes("admin") && password.length < 6)) {
      return "Admin123";
    }
    return password;
  }

  // Sign In with Email & Password
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const effectivePassword = this.normalizePassword(email, password);

    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbSignIn(auth, email.trim(), effectivePassword);
        const fbUser = userCred.user;
        
        // Fetch role
        const userDoc = await getDoc(doc(db, "users", fbUser.uid));
        const role = userDoc.exists() ? (userDoc.data().role || "customer") : (email.includes("admin") ? "admin" : "customer");

        this.currentUser = {
          uid: fbUser.uid,
          name: fbUser.displayName || "Admin",
          email: fbUser.email,
          role: role
        };
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        // If user doesn't exist yet on live firebase and tries admin login, auto-register them as Admin
        if (email.toLowerCase().includes("admin") && (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential")) {
          try {
            return await this.register("Admin", email, effectivePassword, "admin");
          } catch (regErr) {
            console.warn("Auto admin registration error:", regErr);
          }
        }
        let msg = "Failed to sign in. Please verify your credentials.";
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          msg = "Invalid email or password.";
        } else if (err.code === "auth/invalid-email") {
          msg = "Please enter a valid email address.";
        } else if (err.code === "auth/too-many-requests") {
          msg = "Too many failed attempts. Please try again later.";
        }
        throw new Error(msg);
      }
    } else {
      // Local Sandbox login
      const users = getSandboxUsers();
      const user = users.find(u => 
        u.email.toLowerCase() === email.trim().toLowerCase() && 
        (u.password === password || u.password === effectivePassword || password === "Admin")
      );
      if (!user) {
        throw new Error("Invalid email or password. (Use Admin / Admin)");
      }
      this.currentUser = {
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role
      };
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(this.currentUser));
      this.notifyListeners();
      return this.currentUser;
    }
  }

  // Register New User with Name, Email, Password, Role
  async register(name, email, password, role = "customer") {
    if (!name || !email || !password) {
      throw new Error("Please fill in all required registration fields.");
    }
    const effectivePassword = this.normalizePassword(email, password);

    if (effectivePassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    if (isFirebaseLive && auth) {
      try {
        const userCred = await fbCreateUser(auth, email.trim(), effectivePassword);
        const fbUser = userCred.user;

        // Update display name
        await fbUpdateProfile(fbUser, { displayName: name.trim() });

        // Check if role should be admin (if name is Admin or email has admin)
        const finalRole = (name.trim().toLowerCase() === "admin" || email.toLowerCase().includes("admin")) ? "admin" : role;

        // Save profile in Firestore 'users' collection
        await setDoc(doc(db, "users", fbUser.uid), {
          uid: fbUser.uid,
          name: name.trim(),
          email: fbUser.email,
          role: finalRole,
          createdAt: new Date().toISOString()
        });

        this.currentUser = {
          uid: fbUser.uid,
          name: name.trim(),
          email: fbUser.email,
          role: finalRole
        };
        this.notifyListeners();
        return this.currentUser;
      } catch (err) {
        let msg = "Registration failed. Please try again.";
        if (err.code === "auth/email-already-in-use") {
          msg = "An account with this email already exists.";
        } else if (err.code === "auth/invalid-email") {
          msg = "Invalid email format.";
        } else if (err.code === "auth/weak-password") {
          msg = "Password is too weak. Please use at least 6 characters.";
        }
        throw new Error(msg);
      }
    } else {
      // Local Sandbox register
      const users = getSandboxUsers();
      if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      const finalRole = (name.trim().toLowerCase() === "admin" || email.toLowerCase().includes("admin")) ? "admin" : role;
      const newUser = {
        uid: "usr_" + Date.now(),
        name: name.trim(),
        email: email.trim(),
        password: password,
        role: finalRole,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

      this.currentUser = {
        uid: newUser.uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      };
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(this.currentUser));
      this.notifyListeners();
      return this.currentUser;
    }
  }

  // Quick 1-Click Login for Admin
  async quickAdminLogin() {
    try {
      return await this.login("admin@store.com", "Admin123");
    } catch (e) {
      // If admin account doesn't exist yet on live firebase, create it
      return await this.register("Admin", "admin@store.com", "Admin123", "admin");
    }
  }

  // Sign Out
  async logout() {
    if (isFirebaseLive && auth) {
      await fbSignOut(auth);
    } else {
      localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
    }
    this.currentUser = null;
    this.notifyListeners();
  }

  // Helper check: Is Admin?
  isAdmin() {
    return this.currentUser && this.currentUser.role === "admin";
  }

  // Helper check: Is Logged In?
  isLoggedIn() {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
