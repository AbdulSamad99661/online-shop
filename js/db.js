// Firestore Database Service for Products, Orders, Users & Analytics
import { 
  db, 
  isFirebaseLive,
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
  writeBatch,
  serverTimestamp
} from "./firebase-config.js";
import { INITIAL_PRODUCTS, PRODUCT_CATEGORIES } from "./products-data.js";
import { formatAuthError } from "./utils.js";

const LOCAL_PRODUCTS_KEY = "ecommerce_sandbox_products";
const LOCAL_ORDERS_KEY = "ecommerce_sandbox_orders";

// Sandbox Local Data Helpers
function getLocalProducts() {
  const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  // Initialize with the 100 products
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
  return [...INITIAL_PRODUCTS];
}

function setLocalProducts(products) {
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
}

function getLocalOrders() {
  const data = localStorage.getItem(LOCAL_ORDERS_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  // Demo initial orders for instant dashboard demonstration
  const demoOrders = [
    {
      id: "ORD-98421",
      userId: "cust_uid_001",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerPhone: "+1 (555) 234-5678",
      shippingAddress: "742 Evergreen Terrace, Springfield, OR 97477",
      paymentMethod: "Credit Card (Demo)",
      items: [
        {
          id: "prod-001",
          title: "ProSound Wireless Noise-Cancelling Headphones",
          price: 149.99,
          quantity: 1,
          image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80"
        },
        {
          id: "prod-046",
          title: "Hyaluronic Acid Hydrating Facial Serum 50ml",
          price: 22.50,
          quantity: 2,
          image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80"
        }
      ],
      subtotal: 194.99,
      tax: 15.60,
      shipping: 0,
      total: 210.59,
      status: "Processing",
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: "ORD-98420",
      userId: "usr_alex_02",
      customerName: "Alex Rivera",
      customerEmail: "alex.rivera@example.com",
      customerPhone: "+1 (555) 876-1234",
      shippingAddress: "1200 Market Street, Suite 400, San Francisco, CA 94102",
      paymentMethod: "Cash on Delivery",
      items: [
        {
          id: "prod-076",
          title: "AirCloud Cushion Pro Running Sneakers",
          price: 89.99,
          quantity: 1,
          image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80"
        },
        {
          id: "prod-063",
          title: "Insulated Stainless Steel 32oz Sports Water Bottle",
          price: 24.99,
          quantity: 1,
          image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80"
        }
      ],
      subtotal: 114.98,
      tax: 9.20,
      shipping: 0,
      total: 124.18,
      status: "Shipped",
      createdAt: new Date(Date.now() - 3600000 * 26).toISOString()
    },
    {
      id: "ORD-98419",
      userId: "usr_sam_03",
      customerName: "Sam Mitchell",
      customerEmail: "sam.m@example.com",
      customerPhone: "+1 (555) 432-8901",
      shippingAddress: "450 Oak Avenue, Seattle, WA 98101",
      paymentMethod: "Credit Card (Demo)",
      items: [
        {
          id: "prod-086",
          title: "Chronograph Stainless Steel Sapphire Watch",
          price: 159.00,
          quantity: 1,
          image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80"
        }
      ],
      subtotal: 159.00,
      tax: 12.72,
      shipping: 0,
      total: 171.72,
      status: "Delivered",
      createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
    }
  ];
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(demoOrders));
  return demoOrders;
}

function setLocalOrders(orders) {
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
}

export class DatabaseService {
  // ==========================================
  // PRODUCTS CRUD & BATCH SEEDING
  // ==========================================

  // Fetch all products
  async getProducts() {
    if (isFirebaseLive && db) {
      try {
        const colRef = collection(db, "products");
        const snapshot = await getDocs(colRef);
        if (snapshot.empty) {
          return getLocalProducts();
        }
        return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      } catch (err) {
        console.error("Firestore getProducts error, falling back to local dataset:", err);
        return getLocalProducts();
      }
    }
    return getLocalProducts();
  }

  // Get product by ID
  async getProductById(id) {
    if (isFirebaseLive && db) {
      try {
        const docRef = doc(db, "products", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (e) {
        console.warn("Firestore getProductById error:", e);
      }
    }
    const list = getLocalProducts();
    return list.find(p => p.id === id) || null;
  }

  // Add a new product
  async addProduct(product) {
    const productData = {
      title: product.title.trim(),
      price: parseFloat(product.price) || 0,
      originalPrice: parseFloat(product.originalPrice) || parseFloat(product.price) * 1.25,
      category: product.category || "General",
      image: product.image.trim() || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
      description: product.description.trim() || "High quality premium product.",
      rating: parseFloat(product.rating) || 5.0,
      reviews: parseInt(product.reviews) || 1,
      stock: parseInt(product.stock) || 20,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseLive && db) {
      try {
        const docRef = await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp()
        });
        return { id: docRef.id, ...productData };
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not create product in Firestore.");
      }
    }

    // Local fallback
    const list = getLocalProducts();
    const newProduct = {
      id: "prod-" + (list.length + 1).toString().padStart(3, "0") + "-" + Date.now().toString().slice(-4),
      ...productData
    };
    list.unshift(newProduct);
    setLocalProducts(list);
    return newProduct;
  }

  // Update existing product
  async updateProduct(id, updatedFields) {
    const fieldsToUpdate = { ...updatedFields };
    if (fieldsToUpdate.price) fieldsToUpdate.price = parseFloat(fieldsToUpdate.price);
    if (fieldsToUpdate.stock) fieldsToUpdate.stock = parseInt(fieldsToUpdate.stock);
    if (fieldsToUpdate.originalPrice) fieldsToUpdate.originalPrice = parseFloat(fieldsToUpdate.originalPrice);

    if (isFirebaseLive && db) {
      try {
        const docRef = doc(db, "products", id);
        await updateDoc(docRef, fieldsToUpdate);
        return { id, ...fieldsToUpdate };
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not update product in Firestore.");
      }
    }

    // Local fallback
    const list = getLocalProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...fieldsToUpdate };
      setLocalProducts(list);
      return list[idx];
    }
    throw new Error("Product not found");
  }

  // Delete a product
  async deleteProduct(id) {
    if (isFirebaseLive && db) {
      try {
        const docRef = doc(db, "products", id);
        await deleteDoc(docRef);
        return true;
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not delete product in Firestore.");
      }
    }

    // Local fallback
    let list = getLocalProducts();
    list = list.filter(p => p.id !== id);
    setLocalProducts(list);
    return true;
  }

  // Bulk Seed 100 Products to Firestore / LocalDB
  async seed100Products(force = false) {
    if (isFirebaseLive && db) {
      try {
        // Write in batches of up to 100
        const batch = writeBatch(db);
        for (const item of INITIAL_PRODUCTS) {
          const docRef = doc(db, "products", item.id);
          batch.set(docRef, {
            ...item,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
        await batch.commit();
        await this.seedCategories();
        console.log("Successfully seeded 100 products to Firestore!");
        return true;
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not seed products to Firestore.");
      }
    }

    // Local Storage seed
    setLocalProducts(INITIAL_PRODUCTS);
    return true;
  }

  // ==========================================
  // ORDERS MANAGEMENT
  // ==========================================

  // Create new customer order
  async createOrder(orderPayload) {
    const orderId = "ORD-" + Math.floor(10000 + Math.random() * 90000);
    const orderDoc = {
      id: orderId,
      userId: orderPayload.userId || "guest",
      customerName: orderPayload.customerName,
      customerEmail: orderPayload.customerEmail,
      customerPhone: orderPayload.customerPhone || "N/A",
      shippingAddress: orderPayload.shippingAddress,
      paymentMethod: orderPayload.paymentMethod || "Credit Card",
      items: orderPayload.items.map(item => ({
        id: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      })),
      subtotal: parseFloat(orderPayload.subtotal) || 0,
      tax: parseFloat(orderPayload.tax) || 0,
      shipping: parseFloat(orderPayload.shipping) || 0,
      total: parseFloat(orderPayload.total) || 0,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, "orders", orderId), {
          ...orderDoc,
          createdAt: orderDoc.createdAt,
          createdAtServer: serverTimestamp()
        });
        return orderDoc;
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not save the order to Firestore.");
      }
    }

    // Local fallback
    const orders = getLocalOrders();
    orders.unshift(orderDoc);
    setLocalOrders(orders);
    return orderDoc;
  }

  // Fetch all orders (Admin)
  async getOrders() {
    if (isFirebaseLive && db) {
      try {
        const colRef = collection(db, "orders");
        const snap = await getDocs(colRef);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return list;
      } catch (err) {
        console.warn("Firestore getOrders warning, using local dataset fallback:", err.message);
        return getLocalOrders();
      }
    }
    return getLocalOrders();
  }

  async getOrdersByUser(userId, email = null) {
    if (isFirebaseLive && db && (userId || email)) {
      try {
        const byId = new Map();
        if (userId) {
          const snap = await getDocs(query(collection(db, "orders"), where("userId", "==", userId)));
          snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
        }
        if (email) {
          const snap = await getDocs(query(collection(db, "orders"), where("customerEmail", "==", email)));
          snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
        }
        return [...byId.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      } catch (err) {
        console.warn("Firestore getOrdersByUser warning:", err.message);
      }
    }

    const all = await this.getOrders();
    return all.filter((o) =>
      (userId && o.userId === userId) ||
      (email && o.customerEmail?.toLowerCase() === email.toLowerCase())
    );
  }

  // Update order status (Pending, Processing, Shipped, Delivered, Cancelled)
  async updateOrderStatus(orderId, newStatus) {
    if (isFirebaseLive && db) {
      try {
        const docRef = doc(db, "orders", orderId);
        await updateDoc(docRef, { status: newStatus });
        return true;
      } catch (err) {
        throw new Error(formatAuthError(err) || "Could not update order status in Firestore.");
      }
    }

    const orders = getLocalOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = newStatus;
      setLocalOrders(orders);
      return true;
    }
    throw new Error("Order not found");
  }

  // ==========================================
  // USERS & ANALYTICS
  // ==========================================

  // Get all registered users (Admin view)
  async getUsers() {
    const defaultLocalUsers = [
      { uid: "admin_uid_001", name: "Admin", email: "admin@store.com", role: "admin", createdAt: new Date().toISOString() },
      { uid: "cust_uid_001", name: "Jane Doe", email: "jane@example.com", role: "customer", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { uid: "cust_uid_002", name: "Alex Rivera", email: "alex.rivera@example.com", role: "customer", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
      { uid: "cust_uid_003", name: "Sam Mitchell", email: "sam.m@example.com", role: "customer", createdAt: new Date(Date.now() - 86400000 * 8).toISOString() }
    ];

    if (isFirebaseLive && db) {
      try {
        const snap = await getDocs(collection(db, "users"));
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      } catch (err) {
        console.warn("Firestore getUsers warning, using local dataset fallback:", err.message);
      }
    }
    const localUsers = localStorage.getItem("ecommerce_sandbox_users");
    if (localUsers) {
      try {
        const parsed = JSON.parse(localUsers);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return defaultLocalUsers;
  }

  // Calculate high-level KPIs for Admin Overview
  async getMetrics() {
    const [products, orders, users] = await Promise.all([
      this.getProducts(),
      this.getOrders(),
      this.getUsers()
    ]);

    const totalRevenue = orders.reduce((sum, order) => {
      // Exclude cancelled orders from revenue calculation
      if (order.status !== "Cancelled") {
        return sum + (parseFloat(order.total) || 0);
      }
      return sum;
    }, 0);

    const pendingOrdersCount = orders.filter(o => o.status === "Pending" || o.status === "Processing").length;

    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      pendingOrders: pendingOrdersCount,
      totalRevenue: totalRevenue.toFixed(2),
      totalCustomers: users.filter((u) => u.role !== "admin").length || users.length
    };
  }

  async seedCategories() {
    if (!(isFirebaseLive && db)) return true;
    const batch = writeBatch(db);
    PRODUCT_CATEGORIES.forEach((name) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      batch.set(doc(db, "categories", slug), {
        name,
        slug,
        createdAt: new Date().toISOString()
      }, { merge: true });
    });
    await batch.commit();
    return true;
  }

  async getCategories() {
    if (isFirebaseLive && db) {
      try {
        const snap = await getDocs(collection(db, "categories"));
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } catch (err) {
        console.warn("Firestore getCategories warning:", err.message);
      }
    }
    return PRODUCT_CATEGORIES.map((name) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name
    }));
  }
}

export const dbService = new DatabaseService();
