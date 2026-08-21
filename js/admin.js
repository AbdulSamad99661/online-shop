// Admin Dashboard Controller & CRUD Operations
import { dbService } from "./db.js";
import { authService } from "./auth.js";
import { toast } from "./toast.js";
import { 
  getActiveFirebaseConfig, 
  saveCustomFirebaseConfig, 
  resetFirebaseConfig, 
  isFirebaseLive 
} from "./firebase-config.js";

class AdminDashboard {
  constructor() {
    this.products = [];
    this.orders = [];
    this.users = [];
    this.activeTab = "overview";
    this.productSearchQuery = "";
    this.productCategoryFilter = "All";
    this.orderStatusFilter = "All";
    this.currentPage = 1;
    this.itemsPerPage = 12;
    this.editingProductId = null;

    this.init();
  }

  async init() {
    this.bindSidebarTabs();
    this.bindModals();
    this.initAuthGuard();
  }

  initAuthGuard() {
    authService.subscribe(async (user) => {
      const guardEl = document.getElementById("admin-auth-guard");
      const contentEl = document.getElementById("admin-root-content");

      if (user && user.role === "admin") {
        if (guardEl) guardEl.style.display = "none";
        if (contentEl) contentEl.style.display = "flex";
        
        document.getElementById("admin-user-name").textContent = user.name || "Admin";
        await this.loadAllData();
      } else {
        if (contentEl) contentEl.style.display = "none";
        if (guardEl) {
          guardEl.style.display = "flex";
          this.renderAuthGuardUI(user);
        }
      }
    });
  }

  renderAuthGuardUI(user) {
    const guardBody = document.getElementById("guard-card-body");
    if (!guardBody) return;

    let userStatusNotice = "";
    if (user && user.role !== "admin") {
      userStatusNotice = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:0.75rem; margin-bottom:1rem; text-align:left; font-size:0.85rem; color:#991b1b;">
          <i class="fa-solid fa-triangle-exclamation"></i> Signed in as Customer (<strong>${user.email}</strong>). Enter Admin credentials below to access Admin Dashboard:
        </div>
      `;
    }

    guardBody.innerHTML = `
      <div style="text-align:center; padding:0.5rem 0.5rem;">
        <div style="width:56px; height:56px; border-radius:50%; background:#eef2ff; color:#4f46e5; display:inline-flex; align-items:center; justify-content:center; font-size:1.6rem; margin-bottom:0.75rem;">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h2 style="font-size:1.35rem; font-weight:800; margin-bottom:0.35rem;">Admin Dashboard Login</h2>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">
          Enter Admin credentials to manage products, orders, and view store analytics.
        </p>

        ${userStatusNotice}

        <form id="guard-login-form">
          <div class="form-group" style="text-align:left; margin-bottom:1rem;">
            <label style="font-weight:700; font-size:0.85rem;">Admin Email</label>
            <input type="email" id="guard-email" class="form-control" value="admin@store.com" placeholder="admin@store.com" required>
          </div>
          <div class="form-group" style="text-align:left; margin-bottom:1.25rem;">
            <label style="font-weight:700; font-size:0.85rem;">Admin Password</label>
            <input type="password" id="guard-password" class="form-control" value="Admin" placeholder="Admin" required>
          </div>
          <button type="submit" class="btn-primary" style="width:100%; justify-content:center; padding:0.75rem; margin-bottom:0.75rem; font-weight:700;">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In as Admin
          </button>
        </form>

        <a href="index.html" class="nav-btn" style="width:100%; justify-content:center; border:1px solid var(--admin-border); padding:0.6rem; font-size:0.85rem;">
          <i class="fa-solid fa-arrow-left"></i> Back to Storefront
        </a>
      </div>
    `;

    document.getElementById("guard-login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("guard-email").value;
      const pass = document.getElementById("guard-password").value;
      try {
        await authService.login(email, pass);
        toast.success("Admin authenticated successfully!");
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  // ==========================================
  // DATA LOADING & REFRESH
  // ==========================================
  async loadAllData() {
    try {
      const [products, orders, users, metrics] = await Promise.all([
        dbService.getProducts(),
        dbService.getOrders(),
        dbService.getUsers(),
        dbService.getMetrics()
      ]);

      this.products = products;
      this.orders = orders;
      this.users = users;

      this.renderMetrics(metrics);
      this.renderRecentOrdersOverview();
      this.renderProductsTable();
      this.renderOrdersTable();
      this.renderUsersTable();
      this.renderFirebaseStatus();
    } catch (e) {
      console.error("Error loading admin data:", e);
      toast.error("Failed to load dashboard data.");
    }
  }

  // ==========================================
  // METRICS & OVERVIEW
  // ==========================================
  renderMetrics(metrics) {
    document.getElementById("kpi-revenue").textContent = `$${metrics.totalRevenue}`;
    document.getElementById("kpi-orders").textContent = metrics.totalOrders;
    document.getElementById("kpi-products").textContent = metrics.totalProducts;
    document.getElementById("kpi-customers").textContent = metrics.totalCustomers;
    document.getElementById("kpi-pending-orders").textContent = metrics.pendingOrders;
  }

  renderRecentOrdersOverview() {
    const tbody = document.getElementById("table-recent-orders-body");
    if (!tbody) return;

    const recent = this.orders.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No customer orders placed yet. Place an order on the storefront to test!</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(order => `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td>
          <div style="font-weight:700;">${order.customerName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${order.customerEmail}</div>
        </td>
        <td>
          <span style="font-weight:600;">${order.items.length} items</span>
          <div style="font-size:0.75rem; color:var(--text-muted); max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${order.items.map(i => i.title).join(", ")}
          </div>
        </td>
        <td><strong style="color:var(--admin-primary); font-size:0.95rem;">$${parseFloat(order.total).toFixed(2)}</strong></td>
        <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
        <td>
          <button class="btn-icon-action btn-view-recent-order" data-id="${order.id}" title="View Order Details">
            <i class="fa-regular fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-view-recent-order").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openOrderDetailsModal(id);
      });
    });
  }

  // ==========================================
  // PRODUCTS CRUD MANAGEMENT
  // ==========================================
  getFilteredProducts() {
    let list = [...this.products];
    if (this.productCategoryFilter && this.productCategoryFilter !== "All") {
      list = list.filter(p => p.category === this.productCategoryFilter);
    }
    if (this.productSearchQuery.trim()) {
      const q = this.productSearchQuery.trim().toLowerCase();
      list = list.filter(p => 
        p.title?.toLowerCase().includes(q) || 
        p.category?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  renderProductsTable() {
    const tbody = document.getElementById("admin-products-table-body");
    const countEl = document.getElementById("admin-products-count");
    if (!tbody) return;

    const filtered = this.getFilteredProducts();
    if (countEl) countEl.textContent = `${filtered.length} products total`;

    const totalPages = Math.ceil(filtered.length / this.itemsPerPage) || 1;
    this.currentPage = Math.min(this.currentPage, totalPages);
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    const pagedItems = filtered.slice(startIdx, startIdx + this.itemsPerPage);

    if (pagedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No products found matching filters.</td></tr>`;
      this.renderPagination(totalPages);
      return;
    }

    tbody.innerHTML = pagedItems.map(p => `
      <tr data-id="${p.id}">
        <td>
          <img src="${p.image}" alt="${p.title}" class="table-img" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'">
        </td>
        <td>
          <div style="font-weight:700; max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${p.id}</div>
        </td>
        <td><span class="brand-badge" style="background:#eef2ff; color:#4f46e5; font-weight:700;">${p.category || 'General'}</span></td>
        <td><strong>$${parseFloat(p.price).toFixed(2)}</strong></td>
        <td>
          <span style="font-weight:600; color:${p.stock < 10 ? 'var(--danger)' : 'inherit'};">
            ${p.stock} units
          </span>
        </td>
        <td>
          <i class="fa-solid fa-star" style="color:#f59e0b; font-size:0.8rem;"></i>
          ${p.rating ? p.rating.toFixed(1) : '4.8'}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon-action btn-edit-product" data-id="${p.id}" title="Edit Product">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="btn-icon-action btn-icon-danger btn-delete-product" data-id="${p.id}" title="Delete Product">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    // Bind Edit and Delete
    tbody.querySelectorAll(".btn-edit-product").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openEditProductModal(id);
      });
    });

    tbody.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const product = this.products.find(p => p.id === id);
        if (confirm(`Are you sure you want to delete "${product?.title || id}"?`)) {
          try {
            await dbService.deleteProduct(id);
            toast.success("Product deleted successfully!");
            await this.loadAllData();
          } catch (err) {
            toast.error("Failed to delete product: " + err.message);
          }
        }
      });
    });

    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    const container = document.getElementById("admin-products-pagination");
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let pageButtonsHtml = "";
    for (let i = 1; i <= totalPages; i++) {
      pageButtonsHtml += `
        <button class="nav-btn btn-page-num ${i === this.currentPage ? 'active' : ''}" data-page="${i}" style="${i === this.currentPage ? 'background:#4f46e5; color:white;' : ''}">
          ${i}
        </button>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:0.4rem; padding:1.25rem 0;">
        <button id="btn-prev-page" class="nav-btn" ${this.currentPage === 1 ? 'disabled style="opacity:0.5;"' : ''}>
          <i class="fa-solid fa-chevron-left"></i> Prev
        </button>
        ${pageButtonsHtml}
        <button id="btn-next-page" class="nav-btn" ${this.currentPage === totalPages ? 'disabled style="opacity:0.5;"' : ''}>
          Next <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    `;

    container.querySelector("#btn-prev-page")?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderProductsTable();
      }
    });

    container.querySelector("#btn-next-page")?.addEventListener("click", () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderProductsTable();
      }
    });

    container.querySelectorAll(".btn-page-num").forEach(btn => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.getAttribute("data-page"));
        this.currentPage = page;
        this.renderProductsTable();
      });
    });
  }
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderProductsTable();
      }
    });
  }

  openAddProductModal() {
    this.editingProductId = null;
    document.getElementById("modal-product-title").textContent = "Add New Product";
    document.getElementById("form-product").reset();
    document.getElementById("prod-stock").value = "25";
    document.getElementById("prod-rating").value = "4.8";
    document.getElementById("modal-admin-product").classList.add("active");
    document.body.style.overflow = "hidden";
  }

  openEditProductModal(id) {
    const p = this.products.find(item => item.id === id);
    if (!p) return;

    this.editingProductId = id;
    document.getElementById("modal-product-title").textContent = "Edit Product";
    document.getElementById("prod-title").value = p.title || "";
    document.getElementById("prod-category").value = p.category || "Electronics";
    document.getElementById("prod-price").value = p.price || "";
    document.getElementById("prod-original-price").value = p.originalPrice || "";
    document.getElementById("prod-stock").value = p.stock || 20;
    document.getElementById("prod-rating").value = p.rating || 4.8;
    document.getElementById("prod-image").value = p.image || "";
    document.getElementById("prod-description").value = p.description || "";

    document.getElementById("modal-admin-product").classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // ==========================================
  // ORDERS MANAGEMENT
  // ==========================================
  getFilteredOrders() {
    let list = [...this.orders];
    if (this.orderStatusFilter && this.orderStatusFilter !== "All") {
      list = list.filter(o => o.status === this.orderStatusFilter);
    }
    return list;
  }

  renderOrdersTable() {
    const tbody = document.getElementById("admin-orders-table-body");
    if (!tbody) return;

    const filtered = this.getFilteredOrders();
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No orders found matching filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(order => `
      <tr data-id="${order.id}">
        <td><strong>${order.id}</strong></td>
        <td>
          <div style="font-weight:700;">${order.customerName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${order.customerEmail}</div>
        </td>
        <td>
          <span style="font-weight:600;">${order.items.length} items</span>
          <div style="font-size:0.75rem; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${order.items.map(i => i.title).join(", ")}
          </div>
        </td>
        <td><strong style="color:#0f172a; font-size:0.95rem;">$${parseFloat(order.total).toFixed(2)}</strong></td>
        <td>
          <select class="status-select status-select-dropdown" data-id="${order.id}">
            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(order.createdAt).toLocaleString()}</td>
        <td>
          <button class="btn-icon-action btn-view-order-details" data-id="${order.id}" title="View Order Details">
            <i class="fa-regular fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join("");

    // Bind inline status change
    tbody.querySelectorAll(".status-select-dropdown").forEach(select => {
      select.addEventListener("change", async () => {
        const id = select.getAttribute("data-id");
        const newStatus = select.value;
        try {
          await dbService.updateOrderStatus(id, newStatus);
          toast.success(`Order ${id} status updated to ${newStatus}`);
          await this.loadAllData();
        } catch (err) {
          toast.error("Failed to update status: " + err.message);
        }
      });
    });

    // Bind Order Details Modal
    tbody.querySelectorAll(".btn-view-order-details").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openOrderDetailsModal(id);
      });
    });
  }

  openOrderDetailsModal(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById("modal-admin-order-details");
    const body = document.getElementById("admin-order-details-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:800;">Order: ${order.id}</h3>
          <span style="font-size:0.8rem; color:var(--text-muted);">Placed on ${new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; background:var(--admin-bg); padding:1rem; border-radius:8px; margin-bottom:1.5rem; font-size:0.88rem;">
        <div>
          <h4 style="font-weight:700; margin-bottom:0.4rem; color:var(--admin-primary);">Customer Info</h4>
          <p><strong>Name:</strong> ${order.customerName}</p>
          <p><strong>Email:</strong> ${order.customerEmail}</p>
          <p><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</p>
        </div>
        <div>
          <h4 style="font-weight:700; margin-bottom:0.4rem; color:var(--admin-primary);">Shipping & Payment</h4>
          <p><strong>Address:</strong> ${order.shippingAddress || 'Standard Delivery'}</p>
          <p><strong>Method:</strong> ${order.paymentMethod || 'Credit Card'}</p>
        </div>
      </div>

      <h4 style="font-weight:700; margin-bottom:0.75rem;">Items Purchased (${order.items.length})</h4>
      <div style="border:1px solid var(--admin-border); border-radius:8px; overflow:hidden; margin-bottom:1.5rem;">
        ${order.items.map(item => `
          <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; border-bottom:1px solid var(--admin-border);">
            <img src="${item.image}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
            <div style="flex:1;">
              <div style="font-weight:600; font-size:0.9rem;">${item.title}</div>
              <div style="font-size:0.78rem; color:var(--text-muted);">$${parseFloat(item.price).toFixed(2)} each</div>
            </div>
            <div style="font-weight:700;">${item.quantity}x</div>
            <div style="font-weight:800; min-width:70px; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</div>
          </div>
        `).join("")}
      </div>

      <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.9rem; padding:0.5rem; background:#f1f5f9; border-radius:8px;">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span> <span>$${parseFloat(order.subtotal || order.total).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Tax:</span> <span>$${parseFloat(order.tax || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Shipping:</span> <span>${order.shipping == 0 ? 'FREE' : '$' + parseFloat(order.shipping).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; border-top:1px dashed var(--admin-border); padding-top:0.5rem; margin-top:0.25rem;">
          <span>Total:</span> <span style="color:var(--admin-primary);">$${parseFloat(order.total).toFixed(2)}</span>
        </div>
      </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // ==========================================
  // USERS LIST
  // ==========================================
  renderUsersTable() {
    const tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.users.map(u => `
      <tr>
        <td>
          <div style="font-weight:700;">${u.name || 'User'}</div>
        </td>
        <td>${u.email}</td>
        <td>
          <span class="brand-badge" style="background:${u.role === 'admin' ? '#4f46e5' : '#e2e8f0'}; color:${u.role === 'admin' ? '#ffffff' : '#334155'};">
            ${u.role || 'customer'}
          </span>
        </td>
        <td><code style="font-size:0.75rem;">${u.uid || 'usr_gen'}</code></td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}</td>
      </tr>
    `).join("");
  }

  // ==========================================
  // SIDEBAR & TAB SWITCHING
  // ==========================================
  bindSidebarTabs() {
    document.querySelectorAll(".sidebar-link[data-tab]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetTab = link.getAttribute("data-tab");

        document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
        document.getElementById(`tab-pane-${targetTab}`)?.classList.add("active");

        const titleMap = {
          overview: "Dashboard Overview",
          products: "Products Management",
          orders: "Orders Management",
          customers: "Registered Customers",
          firebase: "Firebase Settings"
        };
        document.getElementById("admin-header-title").textContent = titleMap[targetTab] || "Admin Dashboard";

        // Mobile drawer auto-close
        document.getElementById("admin-sidebar")?.classList.remove("mobile-open");
      });
    });

    // Mobile sidebar hamburger
    document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
      document.getElementById("admin-sidebar")?.classList.toggle("mobile-open");
    });

    // Admin Header Logout
    document.getElementById("btn-admin-logout")?.addEventListener("click", async () => {
      await authService.logout();
      toast.info("Logged out from Admin.");
    });
  }

  // ==========================================
  // MODALS & ACTIONS BINDINGS
  // ==========================================
  bindModals() {
    // Add Product button
    document.getElementById("btn-admin-add-product")?.addEventListener("click", () => {
      this.openAddProductModal();
    });

    // Product Search and Category Filter
    const searchInput = document.getElementById("admin-product-search");
    searchInput?.addEventListener("input", (e) => {
      this.productSearchQuery = e.target.value;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    const categorySelect = document.getElementById("admin-product-category-filter");
    categorySelect?.addEventListener("change", (e) => {
      this.productCategoryFilter = e.target.value;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    const limitSelect = document.getElementById("admin-product-limit");
    limitSelect?.addEventListener("change", (e) => {
      this.itemsPerPage = parseInt(e.target.value) || 12;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    // Orders Status Filter
    const orderFilter = document.getElementById("admin-order-status-filter");
    orderFilter?.addEventListener("change", (e) => {
      this.orderStatusFilter = e.target.value;
      this.renderOrdersTable();
    });

    // Seed 100 Products Button
    const seedBtns = [
      document.getElementById("btn-seed-100-products"),
      document.getElementById("btn-seed-products-overview")
    ];
    seedBtns.forEach(btn => {
      btn?.addEventListener("click", async () => {
        if (confirm("Populate Firestore / Local Database with the full 100 categorized products dataset?")) {
          try {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Seeding 100 Products...`;
            await dbService.seed100Products(true);
            toast.success("Successfully seeded 100 products!");
            await this.loadAllData();
          } catch (err) {
            toast.error("Failed to seed products: " + err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Seed 100 Products`;
          }
        }
      });
    });

    // Product Form Submit (Create / Edit)
    document.getElementById("form-product")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const productPayload = {
        title: document.getElementById("prod-title").value,
        category: document.getElementById("prod-category").value,
        price: parseFloat(document.getElementById("prod-price").value),
        originalPrice: parseFloat(document.getElementById("prod-original-price").value) || null,
        stock: parseInt(document.getElementById("prod-stock").value),
        rating: parseFloat(document.getElementById("prod-rating").value) || 4.8,
        image: document.getElementById("prod-image").value,
        description: document.getElementById("prod-description").value
      };

      const btn = e.target.querySelector("button[type=submit]");

      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        if (this.editingProductId) {
          await dbService.updateProduct(this.editingProductId, productPayload);
          toast.success("Product updated successfully!");
        } else {
          await dbService.addProduct(productPayload);
          toast.success("New product created successfully!");
        }

        document.getElementById("modal-admin-product").classList.remove("active");
        document.body.style.overflow = "";
        await this.loadAllData();
      } catch (err) {
        toast.error("Error saving product: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `Save Product`;
      }
    });

    // Close buttons for admin modals
    document.querySelectorAll(".modal-close, .modal-backdrop").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target === el) {
          document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("active"));
          document.body.style.overflow = "";
        }
      });
    });

    // Firebase Settings tab form
    this.bindFirebaseTab();
  }

  renderFirebaseStatus() {
    const { config, isCustom } = getActiveFirebaseConfig();
    const statusBox = document.getElementById("admin-fb-status-box");
    if (statusBox) {
      statusBox.innerHTML = isFirebaseLive
        ? `<div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:1rem; border-radius:8px; color:#065f46;">
             <strong style="display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-circle-check"></i> Connected to Real Cloud Firestore</strong>
             <p style="font-size:0.85rem; margin-top:0.3rem;">Project ID: <code>${config.projectId}</code> | Auth: Active</p>
           </div>`
        : `<div style="background:#fffbeb; border:1px solid #fde68a; padding:1rem; border-radius:8px; color:#92400e;">
             <strong style="display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-circle-info"></i> Running in Local Sandbox Mode</strong>
             <p style="font-size:0.85rem; margin-top:0.3rem;">All 100 products, cart, and admin CRUD work fully locally. Enter your Firebase project keys below to connect real cloud database!</p>
           </div>`;
    }

    document.getElementById("admin-cfg-api-key").value = config.apiKey || "";
    document.getElementById("admin-cfg-auth-domain").value = config.authDomain || "";
    document.getElementById("admin-cfg-project-id").value = config.projectId || "";
    document.getElementById("admin-cfg-storage-bucket").value = config.storageBucket || "";
    document.getElementById("admin-cfg-messaging-sender-id").value = config.messagingSenderId || "";
    document.getElementById("admin-cfg-app-id").value = config.appId || "";
  }

  bindFirebaseTab() {
    document.getElementById("admin-firebase-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const newConfig = {
        apiKey: document.getElementById("admin-cfg-api-key").value.trim(),
        authDomain: document.getElementById("admin-cfg-auth-domain").value.trim(),
        projectId: document.getElementById("admin-cfg-project-id").value.trim(),
        storageBucket: document.getElementById("admin-cfg-storage-bucket").value.trim(),
        messagingSenderId: document.getElementById("admin-cfg-messaging-sender-id").value.trim(),
        appId: document.getElementById("admin-cfg-app-id").value.trim()
      };
      saveCustomFirebaseConfig(newConfig);
    });

    document.getElementById("btn-admin-reset-fb")?.addEventListener("click", () => {
      if (confirm("Reset Firebase config back to default?")) {
        resetFirebaseConfig();
      }
    });
  }
}

// Initialize Admin Dashboard on DOM load or immediate execution
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.adminDashboard = new AdminDashboard();
  });
} else {
  window.adminDashboard = new AdminDashboard();
}
