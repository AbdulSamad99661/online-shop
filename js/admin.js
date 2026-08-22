// Admin Dashboard Controller — real Firebase Auth, product CRUD, orders, Firebase setup
import { dbService } from "./db.js";
import { authService, ADMIN_EMAIL, ADMIN_PASSWORD } from "./auth.js";
import { toast } from "./toast.js";
import {
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
  resetFirebaseConfig,
  isFirebaseLive,
  testFirebaseConnection,
  isPlaceholderConfig
} from "./firebase-config.js";
import { escapeHtml, formatCurrency, parseFirebaseConfigJson } from "./utils.js";
import { sendOrderEmail, getEmailJsConfig, saveEmailJsConfig, buildInvoiceView, printInvoice } from "./email.js";

class AdminDashboard {
  constructor() {
    this.products = [];
    this.orders = [];
    this.users = [];
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
    await this.initAuthGuard();
    this.openHashTab();
  }

  openHashTab() {
    const hash = (window.location.hash || "").replace("#", "");
    if (!hash) return;
    const link = document.querySelector(`.sidebar-link[data-tab="${hash}"]`);
    link?.click();
  }

  async initAuthGuard() {
    const form = document.getElementById("guard-login-form");
    const submitBtn = document.getElementById("btn-guard-submit");
    const errorBox = document.getElementById("guard-login-error");

    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = !message;
    };

    const doAdminLogin = async () => {
      const email = document.getElementById("guard-email")?.value?.trim() || ADMIN_EMAIL;
      const pass = document.getElementById("guard-password")?.value || ADMIN_PASSWORD;
      showError("");

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;
        }
        const user = await authService.login(email, pass);
        if (user.role !== "admin") {
          await authService.logout();
          throw new Error("This account is not an administrator.");
        }
        this._showDashboard(user);
        toast.success("Signed in with Firebase Authentication.");
      } catch (err) {
        showError(err.message || "Login failed.");
        toast.error(err.message || "Login failed.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Sign In as Admin`;
        }
      }
    };

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      doAdminLogin();
    });

    document.getElementById("btn-create-admin-account")?.addEventListener("click", async () => {
      showError("");
      try {
        const user = await authService.bootstrapAdminAccount();
        if (user.role !== "admin") throw new Error("Could not create an admin account.");
        this._showDashboard(user);
        toast.success("Admin account is ready in Firebase Authentication.");
      } catch (err) {
        showError(err.message);
        toast.error(err.message);
      }
    });

    await authService.waitUntilReady();
    if (authService.isAdmin()) {
      this._showDashboard(authService.currentUser);
    } else {
      this._showGuard();
    }

    authService.subscribe((user) => {
      if (user && user.role === "admin") this._showDashboard(user);
      else this._showGuard();
    });
  }

  _showDashboard(user) {
    document.getElementById("admin-auth-guard")?.style.setProperty("display", "none", "important");
    document.getElementById("admin-root-content")?.style.setProperty("display", "flex", "important");
    const nameEl = document.getElementById("admin-user-name");
    if (nameEl) nameEl.textContent = user?.name || "Admin";
    this.loadAllData().catch((err) => console.error("Dashboard load error:", err));
  }

  _showGuard() {
    document.getElementById("admin-auth-guard")?.style.setProperty("display", "flex", "important");
    document.getElementById("admin-root-content")?.style.setProperty("display", "none", "important");
  }

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

  renderMetrics(metrics) {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText("kpi-revenue", formatCurrency(metrics.totalRevenue));
    setText("kpi-orders", metrics.totalOrders);
    setText("kpi-products", metrics.totalProducts);
    setText("kpi-customers", metrics.totalCustomers);
    setText("kpi-pending-orders", metrics.pendingOrders);
  }

  renderRecentOrdersOverview() {
    const tbody = document.getElementById("table-recent-orders-body");
    if (!tbody) return;

    const recent = this.orders.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table-cell">No customer orders yet. Place an order from the storefront after signing in.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map((order) => `
      <tr>
        <td><strong>${escapeHtml(order.id)}</strong></td>
        <td>
          <div style="font-weight:700;">${escapeHtml(order.customerName)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(order.customerEmail)}</div>
        </td>
        <td>
          <span style="font-weight:600;">${order.items?.length || 0} items</span>
        </td>
        <td><strong style="color:var(--admin-primary);">${formatCurrency(order.total)}</strong></td>
        <td><span class="status-badge status-${String(order.status || "pending").toLowerCase()}">${escapeHtml(order.status)}</span></td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}</td>
        <td>
          <button class="btn-icon-action btn-view-recent-order" data-id="${escapeHtml(order.id)}" title="View Order Details">
            <i class="fa-regular fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-view-recent-order").forEach((btn) => {
      btn.addEventListener("click", () => this.openOrderDetailsModal(btn.getAttribute("data-id")));
    });
  }

  getFilteredProducts() {
    let list = [...this.products];
    if (this.productCategoryFilter && this.productCategoryFilter !== "All") {
      list = list.filter((p) => p.category === this.productCategoryFilter);
    }
    if (this.productSearchQuery.trim()) {
      const q = this.productSearchQuery.trim().toLowerCase();
      list = list.filter((p) =>
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
    if (countEl) countEl.textContent = `${filtered.length} products`;

    const totalPages = Math.ceil(filtered.length / this.itemsPerPage) || 1;
    this.currentPage = Math.min(this.currentPage, totalPages);
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    const pagedItems = filtered.slice(startIdx, startIdx + this.itemsPerPage);

    if (pagedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table-cell">No products found. Seed the catalog or add a product.</td></tr>`;
      this.renderPagination(totalPages);
      return;
    }

    tbody.innerHTML = pagedItems.map((p) => `
      <tr data-id="${escapeHtml(p.id)}">
        <td>
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" class="table-img" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'">
        </td>
        <td>
          <div style="font-weight:700; max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.title)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${escapeHtml(p.id)}</div>
        </td>
        <td><span class="brand-badge" style="background:#eef2ff; color:#4f46e5; font-weight:700;">${escapeHtml(p.category || "General")}</span></td>
        <td><strong>${formatCurrency(p.price)}</strong></td>
        <td>
          <span style="font-weight:600; color:${Number(p.stock) < 10 ? "var(--danger)" : "inherit"};">
            ${Number(p.stock) || 0} units
          </span>
        </td>
        <td>
          <i class="fa-solid fa-star" style="color:#f59e0b; font-size:0.8rem;"></i>
          ${Number(p.rating || 4.8).toFixed(1)}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon-action btn-edit-product" data-id="${escapeHtml(p.id)}" title="Edit Product">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="btn-icon-action btn-icon-danger btn-delete-product" data-id="${escapeHtml(p.id)}" title="Delete Product">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-edit-product").forEach((btn) => {
      btn.addEventListener("click", () => this.openEditProductModal(btn.getAttribute("data-id")));
    });

    tbody.querySelectorAll(".btn-delete-product").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const product = this.products.find((p) => p.id === id);
        if (!confirm(`Delete "${product?.title || id}"? This cannot be undone.`)) return;
        try {
          await dbService.deleteProduct(id);
          toast.success("Product deleted.");
          await this.loadAllData();
        } catch (err) {
          toast.error(err.message);
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
        <button class="nav-btn btn-page-num ${i === this.currentPage ? "active" : ""}" data-page="${i}" style="${i === this.currentPage ? "background:#4f46e5; color:white;" : ""}">
          ${i}
        </button>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:0.4rem; padding:1.25rem 0;">
        <button id="btn-prev-page" class="nav-btn" ${this.currentPage === 1 ? 'disabled style="opacity:0.5;"' : ""}>
          <i class="fa-solid fa-chevron-left"></i> Prev
        </button>
        ${pageButtonsHtml}
        <button id="btn-next-page" class="nav-btn" ${this.currentPage === totalPages ? 'disabled style="opacity:0.5;"' : ""}>
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

    container.querySelectorAll(".btn-page-num").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentPage = parseInt(btn.getAttribute("data-page"), 10);
        this.renderProductsTable();
      });
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
    const p = this.products.find((item) => item.id === id);
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

  getFilteredOrders() {
    let list = [...this.orders];
    if (this.orderStatusFilter && this.orderStatusFilter !== "All") {
      list = list.filter((o) => o.status === this.orderStatusFilter);
    }
    return list;
  }

  renderOrdersTable() {
    const tbody = document.getElementById("admin-orders-table-body");
    if (!tbody) return;

    const filtered = this.getFilteredOrders();
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table-cell">No orders found for this status.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((order) => `
      <tr data-id="${escapeHtml(order.id)}">
        <td><strong>${escapeHtml(order.id)}</strong></td>
        <td>
          <div style="font-weight:700;">${escapeHtml(order.customerName)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(order.customerEmail)}</div>
        </td>
        <td>
          <span style="font-weight:600;">${order.items?.length || 0} items</span>
          <div style="font-size:0.75rem; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${(order.items || []).map((i) => escapeHtml(i.title)).join(", ")}
          </div>
        </td>
        <td><strong>${formatCurrency(order.total)}</strong></td>
        <td>
          <select class="status-select status-select-dropdown" data-id="${escapeHtml(order.id)}">
            ${["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((status) =>
              `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}</td>
        <td>
          <button class="btn-icon-action btn-view-order-details" data-id="${escapeHtml(order.id)}" title="View Order Details">
            <i class="fa-regular fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".status-select-dropdown").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          const id = select.getAttribute("data-id");
          const newStatus = select.value;
          await dbService.updateOrderStatus(id, newStatus);
          const order = this.orders.find((o) => o.id === id);
          if (order?.customerEmail) {
            try {
              await sendOrderEmail({ ...order, status: newStatus }, newStatus);
              toast.success(`Status set to ${newStatus}. Invoice emailed to ${order.customerEmail}.`);
            } catch (mailErr) {
              toast.warning(`Status updated, but email failed: ${mailErr.message}`);
            }
          } else {
            toast.success(`Order status updated to ${newStatus}`);
          }
          await this.loadAllData();
        } catch (err) {
          toast.error(err.message);
        }
      });
    });

    tbody.querySelectorAll(".btn-view-order-details").forEach((btn) => {
      btn.addEventListener("click", () => this.openOrderDetailsModal(btn.getAttribute("data-id")));
    });
  }

  openOrderDetailsModal(orderId) {
    const order = this.orders.find((o) => o.id === orderId);
    const modal = document.getElementById("modal-admin-order-details");
    const body = document.getElementById("admin-order-details-body");
    if (!order || !modal || !body) return;

    body.innerHTML = `
      ${buildInvoiceView(order, order.status || "Pending")}
      <div class="invoice-actions">
        <button type="button" id="btn-admin-print-invoice" class="nav-btn" style="border:1px solid var(--admin-border);">
          <i class="fa-solid fa-print"></i> Print / Save invoice
        </button>
        <button type="button" id="btn-admin-resend-invoice" class="btn-admin-primary">
          <i class="fa-solid fa-envelope"></i> Resend invoice email
        </button>
      </div>
    `;

    body.querySelector("#btn-admin-print-invoice")?.addEventListener("click", () => {
      try { printInvoice(order, order.status || "Pending"); }
      catch (err) { toast.error(err.message); }
    });

    body.querySelector("#btn-admin-resend-invoice")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
        await sendOrderEmail(order, order.status || "Pending");
        toast.success(`Invoice emailed to ${order.customerEmail}`);
      } catch (err) {
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-envelope"></i> Resend invoice email`;
      }
    });

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  renderUsersTable() {
    const tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-table-cell">No registered users yet. Customers appear here after they sign up.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.users.map((u) => `
      <tr>
        <td><div style="font-weight:700;">${escapeHtml(u.name || "User")}</div></td>
        <td>${escapeHtml(u.email)}</td>
        <td>
          <span class="brand-badge" style="background:${u.role === "admin" ? "#4f46e5" : "#e2e8f0"}; color:${u.role === "admin" ? "#ffffff" : "#334155"};">
            ${escapeHtml(u.role || "customer")}
          </span>
        </td>
        <td><code style="font-size:0.75rem;">${escapeHtml(u.uid || "usr_gen")}</code></td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Active"}</td>
      </tr>
    `).join("");
  }

  bindSidebarTabs() {
    const closeMobileSidebar = () => {
      document.getElementById("admin-sidebar")?.classList.remove("mobile-open");
      document.getElementById("admin-sidebar-overlay")?.classList.remove("active");
    };

    document.querySelectorAll(".sidebar-link[data-tab]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetTab = link.getAttribute("data-tab");
        document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
        document.getElementById(`tab-pane-${targetTab}`)?.classList.add("active");

        const titleMap = {
          overview: "Dashboard Overview",
          products: "Products Management",
          orders: "Orders Management",
          customers: "Registered Customers",
          firebase: "Firebase Setup"
        };
        const title = document.getElementById("admin-header-title");
        if (title) title.textContent = titleMap[targetTab] || "Admin Dashboard";
        history.replaceState(null, "", `#${targetTab}`);
        closeMobileSidebar();
      });
    });

    document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
      document.getElementById("admin-sidebar")?.classList.toggle("mobile-open");
      document.getElementById("admin-sidebar-overlay")?.classList.toggle("active");
    });
    document.getElementById("admin-sidebar-overlay")?.addEventListener("click", closeMobileSidebar);
    window.addEventListener("resize", () => {
      if (window.innerWidth > 992) closeMobileSidebar();
    });

    document.getElementById("btn-admin-logout")?.addEventListener("click", async () => {
      await authService.logout();
      toast.info("Signed out.");
    });
  }

  bindModals() {
    document.getElementById("btn-admin-add-product")?.addEventListener("click", () => this.openAddProductModal());

    document.getElementById("admin-product-search")?.addEventListener("input", (e) => {
      this.productSearchQuery = e.target.value;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    document.getElementById("admin-product-category-filter")?.addEventListener("change", (e) => {
      this.productCategoryFilter = e.target.value;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    document.getElementById("admin-product-limit")?.addEventListener("change", (e) => {
      this.itemsPerPage = parseInt(e.target.value, 10) || 12;
      this.currentPage = 1;
      this.renderProductsTable();
    });

    document.getElementById("admin-order-status-filter")?.addEventListener("change", (e) => {
      this.orderStatusFilter = e.target.value;
      this.renderOrdersTable();
    });

    [document.getElementById("btn-seed-100-products"), document.getElementById("btn-seed-products-overview"), document.getElementById("btn-fb-seed-products")]
      .forEach((btn) => {
        btn?.addEventListener("click", async () => {
          if (!confirm("Write the 100-product catalog and 8 categories to Firestore?")) return;
          try {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Seeding...`;
            await dbService.seed100Products(true);
            toast.success("Catalog seeded to Firestore.");
            await this.loadAllData();
          } catch (err) {
            toast.error(err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Seed 100 Products`;
          }
        });
      });

    document.getElementById("form-product")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const productPayload = {
        title: document.getElementById("prod-title").value,
        category: document.getElementById("prod-category").value,
        price: parseFloat(document.getElementById("prod-price").value),
        originalPrice: parseFloat(document.getElementById("prod-original-price").value) || null,
        stock: parseInt(document.getElementById("prod-stock").value, 10),
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
          toast.success("Product updated in Firestore.");
        } else {
          await dbService.addProduct(productPayload);
          toast.success("Product created in Firestore.");
        }
        document.getElementById("modal-admin-product").classList.remove("active");
        document.body.style.overflow = "";
        await this.loadAllData();
      } catch (err) {
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = "Save Product";
      }
    });

    document.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target === el) {
          document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.remove("active"));
          document.body.style.overflow = "";
        }
      });
    });

    this.bindFirebaseTab();
  }

  collectFirebaseFormConfig() {
    return {
      apiKey: document.getElementById("admin-cfg-api-key")?.value.trim() || "",
      authDomain: document.getElementById("admin-cfg-auth-domain")?.value.trim() || "",
      projectId: document.getElementById("admin-cfg-project-id")?.value.trim() || "",
      storageBucket: document.getElementById("admin-cfg-storage-bucket")?.value.trim() || "",
      messagingSenderId: document.getElementById("admin-cfg-messaging-sender-id")?.value.trim() || "",
      appId: document.getElementById("admin-cfg-app-id")?.value.trim() || ""
    };
  }

  fillFirebaseForm(config) {
    const map = {
      "admin-cfg-api-key": config.apiKey,
      "admin-cfg-auth-domain": config.authDomain,
      "admin-cfg-project-id": config.projectId,
      "admin-cfg-storage-bucket": config.storageBucket,
      "admin-cfg-messaging-sender-id": config.messagingSenderId,
      "admin-cfg-app-id": config.appId
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    });
  }

  renderFirebaseStatus() {
    const { config, isCustom } = getActiveFirebaseConfig();
    const statusBox = document.getElementById("admin-fb-status-box");
    const placeholder = isPlaceholderConfig(config);
    const live = isFirebaseLive && !placeholder;

    if (statusBox) {
      statusBox.innerHTML = live
        ? `<div class="fb-status-card fb-status-live">
             <strong><i class="fa-solid fa-circle-check"></i> Connected to Firebase</strong>
             <p>Project <code>${escapeHtml(config.projectId)}</code> · Auth ${isCustom ? "using saved web config" : "using project defaults"} · Email/Password ready</p>
           </div>`
        : `<div class="fb-status-card fb-status-sandbox">
             <strong><i class="fa-solid fa-triangle-exclamation"></i> Local sandbox mode</strong>
             <p>Paste your real Firebase web config below, test the connection, then save. Until then the store uses localStorage.</p>
           </div>`;
    }

    this.fillFirebaseForm(config);
    this.renderFirebaseChecklist(live, config);

    const emailCfg = getEmailJsConfig();
    const publicEl = document.getElementById("admin-emailjs-public");
    const serviceEl = document.getElementById("admin-emailjs-service");
    const templateEl = document.getElementById("admin-emailjs-template");
    if (publicEl) publicEl.value = emailCfg.publicKey || "";
    if (serviceEl) serviceEl.value = emailCfg.serviceId || "";
    if (templateEl) templateEl.value = emailCfg.templateId || "";
  }

  renderFirebaseChecklist(live, config) {
    const list = document.getElementById("fb-setup-checklist");
    if (!list) return;
    const steps = [
      { done: Boolean(config.apiKey && config.projectId), label: "Paste Firebase web app keys" },
      { done: live, label: "Save config and confirm Cloud Firestore is reachable" },
      { done: live, label: "Enable Email/Password in Authentication" },
      { done: this.users.some((u) => u.role === "admin" || u.email === ADMIN_EMAIL), label: "Create the admin@store.com account" },
      { done: this.products.length > 0, label: "Seed products and categories to Firestore" }
    ];
    list.innerHTML = steps.map((step) => `
      <li class="${step.done ? "done" : ""}">
        <i class="fa-solid ${step.done ? "fa-circle-check" : "fa-circle"}"></i>
        <span>${step.label}</span>
      </li>
    `).join("");
  }

  bindFirebaseTab() {
    document.getElementById("btn-parse-fb-json")?.addEventListener("click", () => {
      try {
        const parsed = parseFirebaseConfigJson(document.getElementById("admin-cfg-json")?.value || "");
        this.fillFirebaseForm(parsed);
        toast.success("Firebase config parsed. Review the fields, then test or save.");
      } catch (err) {
        toast.error(err.message);
      }
    });

    document.getElementById("btn-test-fb-connection")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const resultBox = document.getElementById("admin-fb-test-result");
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Testing...`;
      const result = await testFirebaseConnection(this.collectFirebaseFormConfig());
      if (resultBox) {
        resultBox.hidden = false;
        resultBox.className = `fb-test-result ${result.ok ? "ok" : "fail"}`;
        resultBox.innerHTML = `
          <strong>${result.ok ? "Connection successful" : "Connection failed"}</strong>
          <p>${escapeHtml(result.message)}</p>
          ${result.hint ? `<p class="fb-hint">${escapeHtml(result.hint)}</p>` : ""}
        `;
      }
      toast[result.ok ? "success" : "error"](result.message);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-plug"></i> Test Connection`;
    });

    document.getElementById("admin-firebase-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const config = this.collectFirebaseFormConfig();
      if (!config.apiKey || !config.projectId || !config.authDomain) {
        toast.error("apiKey, authDomain, and projectId are required.");
        return;
      }
      saveCustomFirebaseConfig(config);
    });

    document.getElementById("btn-save-emailjs")?.addEventListener("click", () => {
      saveEmailJsConfig({
        publicKey: document.getElementById("admin-emailjs-public")?.value || "",
        serviceId: document.getElementById("admin-emailjs-service")?.value || "",
        templateId: document.getElementById("admin-emailjs-template")?.value || ""
      });
      toast.success("Customer email settings saved.");
    });

    document.getElementById("btn-admin-reset-fb")?.addEventListener("click", () => {
      if (confirm("Remove the saved Firebase config and reload?")) resetFirebaseConfig();
    });

    document.getElementById("btn-fb-bootstrap-admin")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating...`;
        await authService.bootstrapAdminAccount();
        toast.success("Admin account is available. Use admin@store.com / Admin123.");
        await this.loadAllData();
      } catch (err) {
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-user-shield"></i> Create Admin Account`;
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.adminDashboard = new AdminDashboard();
  });
} else {
  window.adminDashboard = new AdminDashboard();
}
