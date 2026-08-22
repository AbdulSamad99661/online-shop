// Toast Notification Utility
class ToastNotification {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('toast-container')) {
      this.container = document.getElementById('toast-container');
      return;
    }
    if (!document.body) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    this.container = container;
  }

  show(message, type = 'info', duration = 3500) {
    this.init();
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <div class="toast-content">
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    // Trigger entry animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    const timeout = setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timeout));
  }

  dismiss(toast) {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  success(msg, duration) { this.show(msg, 'success', duration); }
  error(msg, duration) { this.show(msg, 'error', duration); }
  warning(msg, duration) { this.show(msg, 'warning', duration); }
  info(msg, duration) { this.show(msg, 'info', duration); }
}

export const toast = new ToastNotification();
