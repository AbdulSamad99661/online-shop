// Shopping Cart State Manager with dynamic calculations and persistence
const CART_STORAGE_KEY = "ecommerce_shopping_cart";

export class CartService {
  constructor() {
    this.items = [];
    this.listeners = [];
    this.taxRate = 0.08; // 8% sales tax
    this.freeShippingThreshold = 50.00;
    this.standardShippingCost = 9.99;
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        this.items = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load cart from storage:", e);
      this.items = [];
    }
  }

  save() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn("Failed to save cart:", e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getSummary());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    const summary = this.getSummary();
    this.listeners.forEach(cb => cb(summary));
  }

  // Add product to cart
  addItem(product, quantity = 1) {
    const existingIndex = this.items.findIndex(item => item.id === product.id);
    const qtyToAdd = Math.max(1, parseInt(quantity) || 1);

    if (existingIndex > -1) {
      const newQty = this.items[existingIndex].quantity + qtyToAdd;
      const maxStock = product.stock || 99;
      this.items[existingIndex].quantity = Math.min(newQty, maxStock);
    } else {
      this.items.push({
        id: product.id,
        title: product.title,
        price: parseFloat(product.price),
        image: product.image,
        category: product.category,
        quantity: qtyToAdd,
        stock: product.stock || 50
      });
    }
    this.save();
  }

  // Update specific item quantity
  updateQuantity(productId, quantity) {
    const qty = parseInt(quantity);
    const index = this.items.findIndex(item => item.id === productId);

    if (index > -1) {
      if (qty <= 0) {
        this.items.splice(index, 1);
      } else {
        const maxStock = this.items[index].stock || 99;
        this.items[index].quantity = Math.min(qty, maxStock);
      }
      this.save();
    }
  }

  // Remove item completely
  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.save();
  }

  // Empty cart
  clearCart() {
    this.items = [];
    this.save();
  }

  // Calculate Subtotal
  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Calculate Tax
  getTax() {
    return this.getSubtotal() * this.taxRate;
  }

  // Calculate Shipping
  getShipping() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0 || subtotal >= this.freeShippingThreshold) {
      return 0.00;
    }
    return this.standardShippingCost;
  }

  // Calculate Total
  getTotal() {
    if (this.items.length === 0) return 0.00;
    return this.getSubtotal() + this.getTax() + this.getShipping();
  }

  // Total item count in cart
  getItemCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  // Returns full summary object
  getSummary() {
    const subtotal = this.getSubtotal();
    const tax = this.getTax();
    const shipping = this.getShipping();
    const total = this.getTotal();
    const count = this.getItemCount();

    return {
      items: [...this.items],
      count,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      shipping: shipping.toFixed(2),
      total: total.toFixed(2),
      isFreeShipping: shipping === 0 && subtotal > 0
    };
  }
}

export const cartService = new CartService();
