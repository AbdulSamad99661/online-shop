# AuraStore &mdash; Advanced E-Commerce Platform & Admin Dashboard with Firebase

A full-featured, responsive, modern E-Commerce web application built with **HTML5, CSS3, ES6 Modules**, integrated with **Firebase Authentication** and **Cloud Firestore Database**, pre-loaded with a dataset of **100 categorized products**.

---

## Quick Start & Running the Project

Because this application uses modern JavaScript ES6 modules (`import`/`export`), it should be served via an HTTP server.

### Option 1: Using Python (Built-in)
In PowerShell or Command Prompt inside the `ecommerce-store` directory:
```powershell
python -m http.server 8080
```
Then open: **`http://localhost:8080`**

### Option 2: Using Node.js / npx
```powershell
npx serve .
```

### Option 3: VS Code Live Server extension
Right-click on `index.html` and select **"Open with Live Server"**.

---

## 1. Firebase Authentication & Firestore Setup Guide

Follow these simple steps in the Firebase Console to connect real cloud database & authentication:

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add Project"** (or select an existing project).
3. Enter a project name (e.g., `aurastore-ecommerce`) and click **Continue**.

### Step 2: Enable Firebase Email/Password Authentication
1. In the Firebase Console left sidebar, click **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Toggle **Enable** for **Email/Password** (keep "Email link" disabled) and click **Save**.

### Step 3: Create Cloud Firestore Database
1. In the left sidebar, click **Build > Firestore Database**.
2. Click **Create Database**.
3. Choose a location (e.g., `nam5 (us-central)` or your closest region) and click **Next**.
4. Choose **Start in test mode** (or paste the rules from `firestore.rules`) and click **Create**.

### Step 4: Obtain Web App Configuration Keys
1. In the Firebase Console, click the **Gear Icon ⚙️ (Project settings)** in the top left.
2. In the **General** tab, scroll down to **Your apps** and click the **Web icon (`</>`)**.
3. Register your app (e.g., `AuraStore Web`).
4. Copy the `firebaseConfig` object values:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "aurastore-ecommerce.firebaseapp.com",
     projectId: "aurastore-ecommerce",
     storageBucket: "aurastore-ecommerce.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:..."
   };
   ```

### Step 5: Connect Firebase to AuraStore
You have **two easy ways** to apply your configuration:
- **Method A (In-App GUI)**: Open the website in your browser, click **User Avatar / Gear Icon > Firebase Settings**, paste your keys, and click **Save & Connect Firebase**!
- **Method B (Code)**: Open `js/firebase-config.js` and replace the `DEFAULT_FIREBASE_CONFIG` values with your Firebase keys.

---

## 2. Admin Credentials & Authentication

As requested, Admin access is pre-configured with default credentials:

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `Admin` | Stored in Firestore `users` collection |
| **Email** | `admin@store.com` | Primary administrator account |
| **Password** | `Admin123` | Meets Firebase's 6+ character password security rule |
| **Role** | `admin` | Unlocks full Admin Dashboard access & CRUD |

### Admin Login (Firebase Authentication)
Open `admin.html` and sign in with **admin@store.com** / **Admin123**.  
If the account does not exist yet, use **Create Admin Account in Firebase** (or the same button on the Firebase Setup tab). This uses real Email/Password Authentication — it no longer bypasses Firebase with a localStorage shortcut.

After the first successful login, go to **Firebase Setup** (`admin.html#firebase`) to:
1. Paste your `firebaseConfig` JSON
2. Test the Cloud Firestore connection
3. Save & apply the keys
4. Create the admin account
5. Seed 100 products and 8 categories

---

## 3. Seeding 100 Products to Cloud Firestore

The project includes a curated database of **100 e-commerce products** across 8 categories:
- **Electronics** (Headphones, Smart TVs, Gaming mice, Keyboards, Drones, Tablets, Projectors)
- **Fashion & Apparel** (Denim jackets, Hoodies, Cargo joggers, Wool overcoats, Maxi dresses)
- **Home & Living** (Ceramic lamps, Essential oil diffusers, Area rugs, Dutch ovens, Coffee drippers)
- **Beauty & Care** (Hyaluronic serums, Hair dryers, Vitamin C creams, Face rollers, Beard kits)
- **Sports & Fitness** (Yoga mats, Adjustable dumbbells, Water bottles, Jump ropes, Massage guns)
- **Footwear** (Running sneakers, Leather Chelsea boots, Walking loafers, Hiking boots)
- **Watches & Accessories** (Chronograph watches, Polarized sunglasses, Leather wallets, Backpacks)
- **Books & Stationery** (Dotted bullet journals, Brass fountain pens, Desk organizers, Highlighters)

### How to Seed:
1. Open the **Admin Dashboard** (`admin.html`).
2. Log in as **Admin**.
3. In the Overview or Products tab, click the **"Seed 100 Products to Database"** button.
4. All 100 items will be written directly to your Cloud Firestore `products` collection!

---

## 4. Architecture & Technical Features

```
ecommerce-store/
├── index.html                    # Customer Storefront (Listing, Cart, Checkout, Auth, Orders)
├── admin.html                    # Admin Dashboard (KPIs, Products CRUD, Orders, Customers)
├── firestore.rules               # Cloud Firestore Security Rules
├── README.md                     # Documentation & Setup Guide
├── css/
│   ├── style.css                 # Storefront design system, responsive layout, cart drawer
│   └── admin.css                 # Admin layout, sidebar navigation, data tables, status badges
└── js/
    ├── firebase-config.js        # Firebase SDK v10 initialization, config, connection test
    ├── products-data.js          # 100 curated products + category list
    ├── utils.js                  # Shared helpers (errors, debounce, config parser)
    ├── auth.js                   # Firebase Email/Password Auth + admin/customer roles
    ├── db.js                     # Cloud Firestore CRUD, orders, categories, seeder
    ├── cart.js                   # Shopping cart state manager & total calculations
    ├── store.js                  # Storefront UI controller & instant search
    ├── admin.js                  # Admin dashboard, product CRUD, orders, Firebase setup
    └── toast.js                  # Toast notification utility
```

### Key Highlights:
- **Real-Time Synchronized State**: Updates in the Admin dashboard (new products, price edits, order status updates) immediately sync with the Customer storefront.
- **Dynamic Cart & Checkout**: Slide-out cart drawer with live subtotal, 8% tax calculation, free shipping over \$50, and order tracking.
- **Instant Search & Filter**: Instant search with debounce, category shortcut pills, and sorting by Price / Rating / Name.
- **Role-Protected Admin Panel**: Firebase Email/Password login plus a role check. Only `admin` users can open the dashboard, manage products, and update order statuses.
- **Offline / Sandbox Fallback**: If Firebase API keys are not yet configured, the app seamlessly runs in Local Sandbox Mode with full persistence in LocalStorage!
