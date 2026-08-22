// Customer Storefront UI Controller & Interaction Logic
import { dbService } from "./db.js";
import { cartService } from "./cart.js";
import { authService } from "./auth.js";
import { toast } from "./toast.js";
import { 
  getActiveFirebaseConfig, 
  saveCustomFirebaseConfig, 
  resetFirebaseConfig, 
  isFirebaseLive 
} from "./firebase-config.js";
import { debounce, escapeHtml, formatCurrency } from "./utils.js";

class StoreApp {
  constructor() {
    this.products = [];
    this.activeCategory = "All";
    this.searchQuery = "";
    this.sortBy = "default";
    this.selectedProductForQuickView = null;
    this.currentUser = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.initAuth();
    this.initCart();
    await this.loadProducts();
  }

  // ==========================================
  // AUTHENTICATION UI BINDINGS
  // ==========================================
  initAuth() {
    authService.subscribe((user) => {
      this.currentUser = user;
      this.renderAuthUI();
    });
  }

  renderAuthUI() {
    const authBtnContainer = document.getElementById("nav-auth-container");
    if (!authBtnContainer) return;

    if (this.currentUser) {
      const initials = (this.currentUser.name || "User")
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      authBtnContainer.innerHTML = `
        <div class="user-menu-dropdown">
          <button id="user-profile-trigger" class="user-profile-btn">
            <div class="user-avatar">${initials}</div>
            <span class="user-display-name">${this.currentUser.name}</span>
            <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; margin-left: 2px;"></i>
          </button>
          <div id="user-dropdown-menu" class="dropdown-menu">
            <div class="dropdown-header">
              <div class="user-name">${this.currentUser.name}</div>
              <div class="user-email">${this.currentUser.email}</div>
            </div>
            <button id="btn-view-my-orders" class="dropdown-item">
              <i class="fa-solid fa-box-open"></i> My Orders
            </button>
            <button id="btn-open-firebase-config" class="dropdown-item">
              <i class="fa-solid fa-gear"></i> Firebase Settings
            </button>
            <button id="btn-auth-logout" class="dropdown-item text-danger">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
            </button>
          </div>
        </div>
      `;

      // Profile menu toggle
      const trigger = document.getElementById("user-profile-trigger");
      const menu = document.getElementById("user-dropdown-menu");
      if (trigger && menu) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.classList.toggle("show");
        });
      }

      // Logout handler
      const logoutBtn = document.getElementById("btn-auth-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          await authService.logout();
          toast.info("Signed out successfully.");
        });
      }

      // My Orders modal handler
      const myOrdersBtn = document.getElementById("btn-view-my-orders");
      if (myOrdersBtn) {
        myOrdersBtn.addEventListener("click", () => {
          this.openMyOrdersModal();
        });
      }

      // Firebase Config handler
      const configBtn = document.getElementById("btn-open-firebase-config");
      if (configBtn) {
        configBtn.addEventListener("click", () => {
          this.openFirebaseConfigModal();
        });
      }
    } else {
      authBtnContainer.innerHTML = "";
    }
  }

  // ==========================================
  // CART STATE BINDINGS
  // ==========================================
  initCart() {
    cartService.subscribe((summary) => {
      this.renderCartSummary(summary);
    });
  }

  renderCartSummary(summary) {
    // Update navbar badges
    const badge = document.getElementById("nav-cart-badge");
    if (badge) {
      badge.textContent = summary.count;
      badge.style.display = summary.count > 0 ? "flex" : "none";
    }

    // Render cart items inside drawer
    const body = document.getElementById("cart-drawer-items");
    if (!body) return;

    if (summary.items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty-state">
          <i class="fa-solid fa-basket-shopping"></i>
          <h4>Your cart is empty</h4>
          <p style="font-size:0.85rem; margin-top:0.4rem;">Browse our 100 products and add items to your cart!</p>
        </div>
      `;
    } else {
      body.innerHTML = summary.items.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <img src="${item.image}" alt="${item.title}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.title}</h4>
            <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
            <div class="cart-item-actions">
              <div class="qty-counter">
                <button class="qty-btn btn-cart-minus" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn btn-cart-plus" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
              </div>
              <button class="btn-remove-item" data-id="${item.id}">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `).join("");

      // Bind quantity and remove buttons
      body.querySelectorAll(".btn-cart-minus").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const item = summary.items.find(i => i.id === id);
          if (item) cartService.updateQuantity(id, item.quantity - 1);
        });
      });

      body.querySelectorAll(".btn-cart-plus").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const item = summary.items.find(i => i.id === id);
          if (item) cartService.updateQuantity(id, item.quantity + 1);
        });
      });

      body.querySelectorAll(".btn-remove-item").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          cartService.removeItem(id);
          toast.info("Item removed from cart.");
        });
      });
    }

    // Update totals
    document.getElementById("cart-subtotal").textContent = `$${summary.subtotal}`;
    document.getElementById("cart-tax").textContent = `$${summary.tax}`;
    document.getElementById("cart-shipping").textContent = summary.isFreeShipping ? "FREE" : `$${summary.shipping}`;
    document.getElementById("cart-total").textContent = `$${summary.total}`;

    const checkoutBtn = document.getElementById("btn-cart-checkout");
    if (checkoutBtn) {
      checkoutBtn.disabled = summary.items.length === 0;
      checkoutBtn.style.opacity = summary.items.length === 0 ? "0.5" : "1";
    }
  }

  // ==========================================
  // PRODUCTS FETCHING & RENDERING
  // ==========================================
  async loadProducts() {
    const grid = document.getElementById("products-grid");
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--primary);"></i>
          <p style="margin-top: 1rem; color: var(--text-muted); font-weight: 600;">Loading 100 premium products...</p>
        </div>
      `;
    }

    try {
      this.products = await dbService.getProducts();
      this.updateCategoryCounts();
      this.renderFeaturedProducts();
      this.renderProducts();
    } catch (err) {
      console.error("Failed to load products:", err);
      if (grid) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--danger); padding:2rem;">Failed to load products. Please check connection.</div>`;
      }
    }
  }

  getFilteredProducts() {
    let filtered = [...this.products];

    // Filter by Category
    if (this.activeCategory && this.activeCategory !== "All") {
      filtered = filtered.filter(p => p.category?.toLowerCase() === this.activeCategory.toLowerCase());
    }

    // Filter by Search Query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(q) || 
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (this.sortBy === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === "name-asc") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (this.sortBy === "rating-desc") {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return filtered;
  }

  updateCategoryCounts() {
    document.querySelectorAll(".category-pill").forEach((pill) => {
      const category = pill.getAttribute("data-category");
      const count = category === "All"
        ? this.products.length
        : this.products.filter((p) => p.category === category).length;
      let countEl = pill.querySelector(".pill-count");
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "pill-count";
        pill.appendChild(countEl);
      }
      countEl.textContent = count;
    });
  }

  renderFeaturedProducts() {
    const grid = document.getElementById("featured-products-grid");
    if (!grid || this.products.length === 0) return;

    const featured = [...this.products]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 8);

    grid.innerHTML = featured.map((product) => this.productCardHtml(product)).join("");
    this.bindProductCardEvents(grid);
  }

  productCardHtml(product) {
    const discountPercent = product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

    return `
      <div class="product-card" data-id="${escapeHtml(product.id)}">
        <div class="product-image-wrap">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'">
          ${discountPercent > 0 ? `<span class="badge-discount">-${discountPercent}%</span>` : ""}
          <span class="badge-stock">${product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
          <button class="btn-quick-view" data-id="${escapeHtml(product.id)}">
            <i class="fa-regular fa-eye"></i> View Details
          </button>
        </div>
        <div class="product-info">
          <span class="product-category">${escapeHtml(product.category || "General")}</span>
          <h3 class="product-title" title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</h3>
          <div class="product-rating">
            <i class="fa-solid fa-star"></i>
            <span>${product.rating ? product.rating.toFixed(1) : "4.8"}</span>
            <span class="rating-count">(${product.reviews || 120})</span>
          </div>
          <div class="product-footer">
            <div class="price-wrap">
              <span class="product-price">${formatCurrency(product.price)}</span>
              ${product.originalPrice ? `<span class="original-price">${formatCurrency(product.originalPrice)}</span>` : ""}
            </div>
            <button class="btn-add-cart" data-id="${escapeHtml(product.id)}" title="Add to Cart">
              <i class="fa-solid fa-cart-plus"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindProductCardEvents(root) {
    root.querySelectorAll(".btn-add-cart").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const product = this.products.find((p) => p.id === btn.getAttribute("data-id"));
        if (!product) return;
        cartService.addItem(product, 1);
        toast.success(`Added "${product.title.slice(0, 28)}" to cart`);
      });
    });

    root.querySelectorAll(".btn-quick-view").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const product = this.products.find((p) => p.id === btn.getAttribute("data-id"));
        if (product) this.openQuickViewModal(product);
      });
    });
  }

  renderProducts() {
    const grid = document.getElementById("products-grid");
    const countEl = document.getElementById("products-count-display");
    if (!grid) return;

    const filtered = this.getFilteredProducts();

    if (countEl) {
      countEl.innerHTML = `Showing <span>${filtered.length}</span> of <span>${this.products.length}</span> products`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--text-light); margin-bottom: 1rem;"></i>
          <h3>No products match your search</h3>
          <p style="margin-top: 0.5rem;">Try changing your category filter or search keywords.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((product) => this.productCardHtml(product)).join("");
    this.bindProductCardEvents(grid);
  }

  // ==========================================
  // MODALS & EVENT HANDLERS
  // ==========================================
  bindEvents() {
    // Close dropdowns on outside click
    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("show"));
    });

    // Cart Drawer Toggle
    const cartTrigger = document.getElementById("nav-cart-trigger");
    const cartDrawer = document.getElementById("cart-drawer");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartClose = document.getElementById("btn-close-cart");

    const openCart = () => {
      cartDrawer.classList.add("active");
      cartOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    };

    const closeCart = () => {
      cartDrawer.classList.remove("active");
      cartOverlay.classList.remove("active");
      document.body.style.overflow = "";
    };

    cartTrigger?.addEventListener("click", openCart);
    cartClose?.addEventListener("click", closeCart);
    cartOverlay?.addEventListener("click", closeCart);

    // Search Inputs (Navbar and Header)
    const navSearch = document.getElementById("nav-search-input");
    const mainSearch = document.getElementById("main-search-input");
    const mobileSearch = document.getElementById("mobile-search-input");
    const mobileToggle = document.getElementById("btn-mobile-nav");
    const mobileDrawer = document.getElementById("mobile-nav-drawer");

    const syncSearchFields = (value, source) => {
      if (navSearch && source !== navSearch) navSearch.value = value;
      if (mainSearch && source !== mainSearch) mainSearch.value = value;
      if (mobileSearch && source !== mobileSearch) mobileSearch.value = value;
    };

    const handleSearch = debounce((e) => {
      this.searchQuery = e.target.value;
      syncSearchFields(this.searchQuery, e.target);
      this.renderProducts();
      document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);

    navSearch?.addEventListener("input", handleSearch);
    mainSearch?.addEventListener("input", handleSearch);
    mobileSearch?.addEventListener("input", handleSearch);

    const setMobileMenu = (open) => {
      mobileDrawer?.classList.toggle("open", open);
      mobileToggle?.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("mobile-menu-open", open);
    };

    mobileToggle?.addEventListener("click", () => {
      setMobileMenu(!mobileDrawer?.classList.contains("open"));
    });
    mobileDrawer?.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMobileMenu(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) setMobileMenu(false);
    });

    const applyCategory = (category) => {
      document.querySelector(`.category-pill[data-category="${category}"]`)?.click();
      document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    document.querySelectorAll("[data-footer-category]").forEach((link) => {
      link.addEventListener("click", () => applyCategory(link.getAttribute("data-footer-category")));
    });

    document.querySelectorAll(".category-card").forEach((card) => {
      card.addEventListener("click", () => applyCategory(card.getAttribute("data-category")));
    });

    document.getElementById("btn-hero-featured")?.addEventListener("click", () => {
      const product = this.products.find((p) => p.id === "prod-001") || this.products[0];
      if (!product) return;
      cartService.addItem(product, 1);
      toast.success(`Added "${product.title.slice(0, 28)}" to cart`);
    });

    document.getElementById("newsletter-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("newsletter-email")?.value.trim();
      if (!email) return;
      e.target.reset();
      toast.success("You're on the list. We'll send drop alerts to your inbox.");
    });

    const backToTop = document.getElementById("btn-back-to-top");
    window.addEventListener("scroll", () => {
      backToTop?.classList.toggle("visible", window.scrollY > 480);
    });
    backToTop?.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Category Filter Pills
    document.querySelectorAll(".category-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.activeCategory = pill.getAttribute("data-category");
        this.renderProducts();
      });
    });

    // Sort Dropdown
    const sortSelect = document.getElementById("store-sort-select");
    sortSelect?.addEventListener("change", (e) => {
      this.sortBy = e.target.value;
      this.renderProducts();
    });

    // Checkout button inside Cart
    document.getElementById("btn-cart-checkout")?.addEventListener("click", () => {
      closeCart();
      if (!this.currentUser) {
        toast.warning("Please sign in to checkout.");
        this.openAuthModal("login");
        return;
      }
      this.openCheckoutModal();
    });

    // Setup Modals Close buttons
    document.querySelectorAll(".modal-close, .modal-backdrop").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target === el) {
          document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("active"));
          document.body.style.overflow = "";
        }
      });
    });

    // Auth Forms Submission
    this.bindAuthForms();
    this.bindCheckoutForm();
    this.bindFirebaseConfigForm();
  }

  // ==========================================
  // QUICK VIEW MODAL
  // ==========================================
  openQuickViewModal(product) {
    this.selectedProductForQuickView = product;
    const modal = document.getElementById("modal-quick-view");
    const body = document.getElementById("quick-view-body");
    if (!modal || !body) return;

    let qty = 1;

    body.innerHTML = `
      <div class="quick-view-grid">
        <div>
          <img src="${product.image}" alt="${product.title}" class="quick-view-img" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'">
        </div>
        <div style="display: flex; flex-direction: column;">
          <span class="product-category">${product.category}</span>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0.25rem 0 0.5rem;">${product.title}</h2>
          <div class="product-rating" style="margin-bottom: 1rem;">
            <i class="fa-solid fa-star"></i>
            <span>${product.rating ? product.rating.toFixed(1) : '4.8'}</span>
            <span class="rating-count">(${product.reviews || 140} verified reviews)</span>
          </div>
          <div class="price-wrap" style="margin-bottom: 1rem;">
            <span style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">$${parseFloat(product.price).toFixed(2)}</span>
            ${product.originalPrice ? `<span class="original-price" style="font-size: 0.95rem;">Was: $${parseFloat(product.originalPrice).toFixed(2)}</span>` : ''}
          </div>
          <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; margin-bottom: 1.5rem;">
            ${product.description}
          </p>
          <div style="margin-top: auto;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <span style="font-weight: 600; font-size: 0.9rem;">Quantity:</span>
              <div class="qty-counter">
                <button id="qv-minus" class="qty-btn"><i class="fa-solid fa-minus"></i></button>
                <span id="qv-qty-val" class="qty-value">1</span>
                <button id="qv-plus" class="qty-btn"><i class="fa-solid fa-plus"></i></button>
              </div>
              <span style="font-size: 0.82rem; color: var(--text-muted);">${product.stock} in stock</span>
            </div>
            <button id="btn-qv-add-cart" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.8rem;">
              <i class="fa-solid fa-cart-plus"></i> Add to Cart
            </button>
          </div>
        </div>
      </div>
    `;

    const qtyVal = body.querySelector("#qv-qty-val");
    body.querySelector("#qv-minus")?.addEventListener("click", () => {
      if (qty > 1) {
        qty--;
        qtyVal.textContent = qty;
      }
    });

    body.querySelector("#qv-plus")?.addEventListener("click", () => {
      if (qty < (product.stock || 99)) {
        qty++;
        qtyVal.textContent = qty;
      }
    });

    body.querySelector("#btn-qv-add-cart")?.addEventListener("click", () => {
      cartService.addItem(product, qty);
      modal.classList.remove("active");
      document.body.style.overflow = "";
      toast.success(`Added ${qty}x "${product.title.slice(0, 20)}..." to cart!`);
    });

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // ==========================================
  // AUTH MODAL
  // ==========================================
  openAuthModal(initialTab = "login") {
    const modal = document.getElementById("modal-auth");
    if (!modal) return;

    this.switchAuthTab(initialTab);
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  switchAuthTab(tab) {
    const loginForm = document.getElementById("auth-login-form");
    const signupForm = document.getElementById("auth-signup-form");
    const tabLogin = document.getElementById("tab-auth-login");
    const tabSignup = document.getElementById("tab-auth-signup");

    if (tab === "login") {
      loginForm.style.display = "block";
      signupForm.style.display = "none";
      tabLogin.classList.add("active");
      tabSignup.classList.remove("active");
    } else {
      loginForm.style.display = "none";
      signupForm.style.display = "block";
      tabLogin.classList.remove("active");
      tabSignup.classList.add("active");
    }
  }

  bindAuthForms() {
    document.getElementById("tab-auth-login")?.addEventListener("click", () => this.switchAuthTab("login"));
    document.getElementById("tab-auth-signup")?.addEventListener("click", () => this.switchAuthTab("signup"));

    // Login Form Submit
    document.getElementById("auth-login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;
      const btn = e.target.querySelector("button[type=submit]");
      const errorBox = document.getElementById("login-form-error");
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
      }

      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Signing In...`;
        const user = await authService.login(email, pass);
        document.getElementById("modal-auth").classList.remove("active");
        document.body.style.overflow = "";

        if (user && user.role === "admin") {
          toast.success("Admin authenticated! Redirecting to Admin Dashboard...");
          setTimeout(() => {
            window.location.href = "admin.html";
          }, 400);
        } else {
          toast.success(`Welcome back, ${user.name || 'User'}!`);
        }
      } catch (err) {
        if (errorBox) {
          errorBox.hidden = false;
          errorBox.textContent = err.message;
        }
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `Sign In`;
      }
    });

    // Quick Admin Login inside Modal
    document.getElementById("btn-quick-admin-modal")?.addEventListener("click", async () => {
      try {
        await authService.quickAdminLogin();
        document.getElementById("modal-auth").classList.remove("active");
        document.body.style.overflow = "";
        toast.success("Logged in as Admin successfully!");
      } catch (err) {
        toast.error(err.message);
      }
    });

    // Signup Form Submit
    document.getElementById("auth-signup-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("signup-name").value;
      const email = document.getElementById("signup-email").value;
      const pass = document.getElementById("signup-password").value;
      const btn = e.target.querySelector("button[type=submit]");
      const errorBox = document.getElementById("signup-form-error");
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
      }

      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...`;
        await authService.register(name, email, pass);
        document.getElementById("modal-auth").classList.remove("active");
        document.body.style.overflow = "";
        toast.success(`Account created! Welcome, ${name}!`);
      } catch (err) {
        if (errorBox) {
          errorBox.hidden = false;
          errorBox.textContent = err.message;
        }
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `Create Account`;
      }
    });
  }

  // ==========================================
  // CHECKOUT MODAL & ORDER CREATION
  // ==========================================
  openCheckoutModal() {
    if (!this.currentUser) {
      toast.warning("Please sign in to checkout.");
      this.openAuthModal("login");
      return;
    }

    const summary = cartService.getSummary();
    if (summary.items.length === 0) {
      toast.warning("Your cart is empty.");
      return;
    }

    const modal = document.getElementById("modal-checkout");
    if (!modal) return;

    // Pre-fill user data if logged in
    if (this.currentUser) {
      document.getElementById("checkout-name").value = this.currentUser.name || "";
      document.getElementById("checkout-email").value = this.currentUser.email || "";
    }

    // Render Order Items Summary inside Checkout Modal
    const summaryList = document.getElementById("checkout-items-summary");
    if (summaryList) {
      summaryList.innerHTML = summary.items.map(item => `
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding: 0.35rem 0;">
          <span style="color:var(--text-muted);">${item.quantity}x ${item.title.slice(0, 28)}...</span>
          <span style="font-weight:600;">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      `).join("");
    }

    document.getElementById("checkout-total-val").textContent = `$${summary.total}`;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  bindCheckoutForm() {
    const form = document.getElementById("checkout-form");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const summary = cartService.getSummary();
      const name = document.getElementById("checkout-name").value;
      const email = document.getElementById("checkout-email").value;
      const phone = document.getElementById("checkout-phone").value;
      const address = document.getElementById("checkout-address").value;
      const payment = document.getElementById("checkout-payment").value;
      const btn = document.getElementById("btn-submit-order");

      try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Order...`;

        const order = await dbService.createOrder({
          userId: this.currentUser?.uid || "guest",
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: address,
          paymentMethod: payment,
          items: summary.items,
          subtotal: summary.subtotal,
          tax: summary.tax,
          shipping: summary.shipping,
          total: summary.total
        });

        cartService.clearCart();
        document.getElementById("modal-checkout").classList.remove("active");
        this.openOrderConfirmationModal(order);
      } catch (err) {
        toast.error("Failed to place order. " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> Place Order Now`;
      }
    });
  }

  // ==========================================
  // ORDER CONFIRMATION MODAL
  // ==========================================
  openOrderConfirmationModal(order) {
    const modal = document.getElementById("modal-order-confirm");
    const body = document.getElementById("order-confirm-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="text-align:center; padding: 1.5rem 0;">
        <div style="width:70px; height:70px; border-radius:50%; background:#d1fae5; color:#059669; display:inline-flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:1rem;">
          <i class="fa-solid fa-check"></i>
        </div>
        <h2 style="font-size:1.4rem; font-weight:800; margin-bottom:0.4rem;">Thank You for Your Order!</h2>
        <p style="color:var(--text-muted); font-size:0.9rem;">Your order <strong style="color:var(--primary);">${order.id}</strong> has been successfully placed.</p>
      </div>

      <div style="background:var(--bg-surface-alt); border-radius:var(--radius-md); padding:1rem; margin-bottom:1.5rem; font-size:0.88rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Customer:</span>
          <strong>${order.customerName}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Email:</span>
          <span>${order.customerEmail}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Status:</span>
          <span class="status-badge status-pending">Pending</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border-color); padding-top:0.5rem; margin-top:0.5rem;">
          <span>Total Paid:</span>
          <strong style="font-size:1.05rem; color:var(--primary);">${formatCurrency(order.total)}</strong>
        </div>
      </div>

      <button id="btn-confirm-continue" class="btn-primary" style="width:100%; justify-content:center; padding:0.8rem;">
        Continue Shopping
      </button>
    `;

    body.querySelector("#btn-confirm-continue")?.addEventListener("click", () => {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    });

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // ==========================================
  // CUSTOMER "MY ORDERS" MODAL
  // ==========================================
  async openMyOrdersModal() {
    const modal = document.getElementById("modal-my-orders");
    const body = document.getElementById("my-orders-body");
    if (!modal || !body) return;

    body.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i></div>`;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    try {
      const orders = await dbService.getOrdersByUser(this.currentUser?.uid, this.currentUser?.email);
      if (orders.length === 0) {
        body.innerHTML = `
          <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
            <i class="fa-solid fa-box-open" style="font-size:3rem; color:var(--text-light); margin-bottom:1rem;"></i>
            <h4>No orders placed yet</h4>
            <p style="font-size:0.85rem; margin-top:0.4rem;">When you complete checkout, your order updates will appear here in real time!</p>
          </div>
        `;
        return;
      }

      body.innerHTML = orders.map(order => {
        let badgeClass = "status-pending";
        if (order.status === "Processing") badgeClass = "status-processing";
        if (order.status === "Shipped") badgeClass = "status-shipped";
        if (order.status === "Delivered") badgeClass = "status-delivered";
        if (order.status === "Cancelled") badgeClass = "status-cancelled";

        return `
          <div class="order-card-item">
            <div class="order-card-header">
              <div>
                <strong>${order.id}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem;">${new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <span class="status-badge ${badgeClass}">${order.status}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
              Items: ${order.items.map(i => `${i.quantity}x ${i.title}`).join(", ")}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">
              <span>Total: <strong style="color:var(--text-main);">$${parseFloat(order.total).toFixed(2)}</strong></span>
              <span style="font-size:0.8rem; color:var(--text-light);">${order.paymentMethod || 'Credit Card'}</span>
            </div>
          </div>
        `;
      }).join("");
    } catch (e) {
      body.innerHTML = `<div style="color:var(--danger); text-align:center; padding:2rem;">Failed to fetch orders.</div>`;
    }
  }

  // ==========================================
  // FIREBASE CONFIG SETTINGS MODAL
  // ==========================================
  openFirebaseConfigModal() {
    const modal = document.getElementById("modal-firebase-config");
    if (!modal) return;

    const { config, isCustom } = getActiveFirebaseConfig();
    const statusText = document.getElementById("firebase-status-indicator");
    if (statusText) {
      statusText.innerHTML = isFirebaseLive 
        ? `<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Connected to Real Firebase (${config.projectId})</span>`
        : `<span style="color:#f59e0b; font-weight:700;"><i class="fa-solid fa-circle-info"></i> Running in Local Sandbox Mode</span>`;
    }

    document.getElementById("cfg-api-key").value = config.apiKey || "";
    document.getElementById("cfg-auth-domain").value = config.authDomain || "";
    document.getElementById("cfg-project-id").value = config.projectId || "";
    document.getElementById("cfg-storage-bucket").value = config.storageBucket || "";
    document.getElementById("cfg-messaging-sender-id").value = config.messagingSenderId || "";
    document.getElementById("cfg-app-id").value = config.appId || "";

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  bindFirebaseConfigForm() {
    document.getElementById("firebase-config-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const newConfig = {
        apiKey: document.getElementById("cfg-api-key").value.trim(),
        authDomain: document.getElementById("cfg-auth-domain").value.trim(),
        projectId: document.getElementById("cfg-project-id").value.trim(),
        storageBucket: document.getElementById("cfg-storage-bucket").value.trim(),
        messagingSenderId: document.getElementById("cfg-messaging-sender-id").value.trim(),
        appId: document.getElementById("cfg-app-id").value.trim()
      };
      saveCustomFirebaseConfig(newConfig);
    });

    document.getElementById("btn-reset-firebase-cfg")?.addEventListener("click", () => {
      if (confirm("Reset Firebase config back to default?")) {
        resetFirebaseConfig();
      }
    });
  }
}

// Initialize on DOM ready or immediate execution
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.storeApp = new StoreApp();
  });
} else {
  window.storeApp = new StoreApp();
}
