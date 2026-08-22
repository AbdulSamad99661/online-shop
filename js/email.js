// Customer invoices + status emails (checkout and every admin status change)
import { escapeHtml, formatCurrency } from "./utils.js";

const EMAILJS_KEY = "aurastore_emailjs_config";
const EMAIL_LOG_KEY = "aurastore_email_log";

const STATUS_FLOW = ["Pending", "Processing", "Shipped", "Delivered"];

const STATUS_COPY = {
  Pending: {
    title: "Order confirmed",
    headline: "We've got your order",
    body: "Thanks for shopping with AuraStore. Your payment details and invoice are below. We'll email you again as soon as packing starts.",
    next: "Next update: Processing"
  },
  Processing: {
    title: "Order is being packed",
    headline: "Your items are being prepared",
    body: "The warehouse has started packing your order. You'll receive a shipment email with this same invoice when it leaves.",
    next: "Next update: Shipped"
  },
  Shipped: {
    title: "Your order has shipped",
    headline: "It's on the way",
    body: "Your parcel is with the courier. Keep this invoice handy for delivery or returns.",
    next: "Next update: Delivered"
  },
  Delivered: {
    title: "Order delivered",
    headline: "Your order arrived",
    body: "This delivery is complete. Save the invoice below for your records. We hope you enjoy your purchase.",
    next: "No further shipping updates"
  },
  Cancelled: {
    title: "Order cancelled",
    headline: "This order was cancelled",
    body: "No further charges will be taken for this invoice. If this was unexpected, reply to this email.",
    next: "This order is closed"
  }
};

export function getEmailJsConfig() {
  try {
    const raw = localStorage.getItem(EMAILJS_KEY);
    return raw ? JSON.parse(raw) : { publicKey: "", serviceId: "", templateId: "" };
  } catch (e) {
    return { publicKey: "", serviceId: "", templateId: "" };
  }
}

export function saveEmailJsConfig(config) {
  localStorage.setItem(EMAILJS_KEY, JSON.stringify({
    publicKey: (config.publicKey || "").trim(),
    serviceId: (config.serviceId || "").trim(),
    templateId: (config.templateId || "").trim()
  }));
}

function rememberSend(entry) {
  try {
    const log = JSON.parse(localStorage.getItem(EMAIL_LOG_KEY) || "[]");
    log.unshift(entry);
    localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(log.slice(0, 40)));
  } catch (e) { /* ignore */ }
}

export function invoiceNumber(order) {
  return `INV-${String(order?.id || "ORDER").replace(/^ORD-/, "")}`;
}

function orderDate(order) {
  const value = order?.createdAt ? new Date(order.createdAt) : new Date();
  return Number.isNaN(value.getTime()) ? "—" : value.toLocaleString();
}

function shippingLabel(order) {
  return Number(order.shipping) === 0 ? "FREE" : formatCurrency(order.shipping);
}

function timeline(status) {
  if (status === "Cancelled") return "Pending → Cancelled";
  return STATUS_FLOW.map((step) => (step === status ? `[${step}]` : step)).join("  →  ");
}

export function buildInvoiceText(order, status = order.status || "Pending") {
  const copy = STATUS_COPY[status] || STATUS_COPY.Pending;
  const items = (order.items || []).map((item, index) => {
    const line = Number(item.price) * Number(item.quantity);
    return `${index + 1}. ${item.title}\n    Qty ${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(line)}`;
  }).join("\n\n");

  return [
    `AURASTORE  |  OFFICIAL INVOICE`,
    `================================`,
    `${copy.headline}`,
    copy.body,
    ``,
    `Invoice: ${invoiceNumber(order)}`,
    `Order:   ${order.id}`,
    `Date:    ${orderDate(order)}`,
    `Status:  ${status}`,
    `Track:   ${timeline(status)}`,
    `${copy.next}`,
    ``,
    `BILL TO`,
    `${order.customerName || "Customer"}`,
    `${order.customerEmail || ""}`,
    `${order.customerPhone || ""}`,
    ``,
    `SHIP TO`,
    `${order.shippingAddress || "Standard delivery"}`,
    `Payment: ${order.paymentMethod || "Card"}`,
    ``,
    `ITEMS`,
    items || "No items",
    ``,
    `Subtotal     ${formatCurrency(order.subtotal || order.total)}`,
    `Tax (8%)     ${formatCurrency(order.tax || 0)}`,
    `Shipping     ${shippingLabel(order)}`,
    `--------------------------------`,
    `AMOUNT DUE   ${formatCurrency(order.total)}`,
    ``,
    `You will receive a fresh invoice email at every status change.`,
    `AuraStore  •  aurastore.app  •  Keep this invoice for your records.`
  ].join("\n");
}

export function buildInvoiceHtml(order, status = order.status || "Pending") {
  const copy = STATUS_COPY[status] || STATUS_COPY.Pending;
  const rows = (order.items || []).map((item) => {
    const line = Number(item.price) * Number(item.quantity);
    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(item.title)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCurrency(item.price)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatCurrency(line)}</td>
    </tr>`;
  }).join("");

  const steps = status === "Cancelled"
    ? `<span style="color:#b91c1c;font-weight:700;">Cancelled</span>`
    : STATUS_FLOW.map((step) => {
      const active = step === status;
      return `<span style="display:inline-block;margin:0 4px 6px 0;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;${active ? "background:#4f46e5;color:#fff;" : "background:#e2e8f0;color:#475569;"}">${step}</span>`;
    }).join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#312e81;padding:22px 28px;color:#fff;">
          <div style="font-size:13px;letter-spacing:0.12em;font-weight:700;color:#c7d2fe;">AURASTORE</div>
          <div style="font-size:24px;font-weight:800;margin-top:6px;">${escapeHtml(copy.headline)}</div>
          <div style="font-size:14px;color:#e0e7ff;margin-top:8px;line-height:1.5;">${escapeHtml(copy.body)}</div>
        </td></tr>
        <tr><td style="padding:22px 28px;">
          <table width="100%" style="font-size:13px;color:#475569;">
            <tr>
              <td><strong style="color:#0f172a;">Invoice</strong><br>${escapeHtml(invoiceNumber(order))}</td>
              <td><strong style="color:#0f172a;">Order</strong><br>${escapeHtml(order.id)}</td>
              <td><strong style="color:#0f172a;">Date</strong><br>${escapeHtml(orderDate(order))}</td>
            </tr>
          </table>
          <div style="margin:16px 0 8px;">${steps}</div>
          <p style="font-size:13px;color:#64748b;margin:0 0 18px;">${escapeHtml(copy.next)}</p>
          <table width="100%" style="font-size:13px;margin-bottom:18px;">
            <tr>
              <td style="vertical-align:top;width:50%;padding-right:10px;">
                <strong>Bill to</strong><br>
                ${escapeHtml(order.customerName || "Customer")}<br>
                ${escapeHtml(order.customerEmail || "")}<br>
                ${escapeHtml(order.customerPhone || "")}
              </td>
              <td style="vertical-align:top;width:50%;">
                <strong>Ship to</strong><br>
                ${escapeHtml(order.shippingAddress || "Standard delivery")}<br>
                Payment: ${escapeHtml(order.paymentMethod || "Card")}
              </td>
            </tr>
          </table>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;color:#475569;">
                <th align="left" style="padding:10px 8px;">Item</th>
                <th align="center" style="padding:10px 8px;">Qty</th>
                <th align="right" style="padding:10px 8px;">Price</th>
                <th align="right" style="padding:10px 8px;">Line</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="4" style="padding:12px;">No items</td></tr>`}</tbody>
          </table>
          <table width="100%" style="margin-top:14px;font-size:14px;">
            <tr><td>Subtotal</td><td align="right">${formatCurrency(order.subtotal || order.total)}</td></tr>
            <tr><td>Tax</td><td align="right">${formatCurrency(order.tax || 0)}</td></tr>
            <tr><td>Shipping</td><td align="right">${shippingLabel(order)}</td></tr>
            <tr><td style="padding-top:8px;font-weight:800;font-size:16px;">Amount due</td><td align="right" style="padding-top:8px;font-weight:800;font-size:16px;color:#4f46e5;">${formatCurrency(order.total)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;font-size:12px;color:#64748b;">
          This invoice was emailed to ${escapeHtml(order.customerEmail || "")}. AuraStore sends an updated invoice at every status change so you can track Processing, Shipment, and Delivery.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildInvoiceView(order, status = order.status || "Pending") {
  const copy = STATUS_COPY[status] || STATUS_COPY.Pending;
  const rows = (order.items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td class="inv-num">${item.quantity}</td>
      <td class="inv-num">${formatCurrency(item.price)}</td>
      <td class="inv-num">${formatCurrency(Number(item.price) * Number(item.quantity))}</td>
    </tr>
  `).join("");

  const pills = (status === "Cancelled" ? ["Cancelled"] : STATUS_FLOW).map((step) =>
    `<span class="inv-step ${step === status ? "active" : ""}">${step}</span>`
  ).join("");

  return `
    <article class="invoice-sheet">
      <header class="invoice-hero">
        <div>
          <p class="invoice-kicker">AuraStore invoice</p>
          <h3>${escapeHtml(copy.headline)}</h3>
          <p>${escapeHtml(copy.body)}</p>
        </div>
        <div class="invoice-id">
          <strong>${escapeHtml(invoiceNumber(order))}</strong>
          <span>${escapeHtml(order.id)}</span>
        </div>
      </header>
      <div class="invoice-meta">
        <div><span>Date</span><strong>${escapeHtml(orderDate(order))}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(status)}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(order.paymentMethod || "Card")}</strong></div>
      </div>
      <div class="invoice-steps">${pills}</div>
      <div class="invoice-parties">
        <div>
          <h4>Bill to</h4>
          <p>${escapeHtml(order.customerName || "Customer")}<br>${escapeHtml(order.customerEmail || "")}<br>${escapeHtml(order.customerPhone || "")}</p>
        </div>
        <div>
          <h4>Ship to</h4>
          <p>${escapeHtml(order.shippingAddress || "Standard delivery")}</p>
        </div>
      </div>
      <table class="invoice-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Line total</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="4">No items</td></tr>`}</tbody>
      </table>
      <div class="invoice-totals">
        <div><span>Subtotal</span><span>${formatCurrency(order.subtotal || order.total)}</span></div>
        <div><span>Tax</span><span>${formatCurrency(order.tax || 0)}</span></div>
        <div><span>Shipping</span><span>${shippingLabel(order)}</span></div>
        <div class="invoice-grand"><span>Amount due</span><span>${formatCurrency(order.total)}</span></div>
      </div>
      <p class="invoice-note">${escapeHtml(copy.next)}. A matching invoice is emailed at every status change.</p>
    </article>
  `;
}

export function printInvoice(order, status = order.status || "Pending") {
  const html = buildInvoiceHtml(order, status);
  const popup = window.open("", "_blank", "width=820,height=900");
  if (!popup) {
    throw new Error("Allow pop-ups to print or save the invoice.");
  }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 350);
}

async function sendWithEmailJs(toEmail, subject, message, html, order) {
  const cfg = getEmailJsConfig();
  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) return false;

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: cfg.serviceId,
      template_id: cfg.templateId,
      user_id: cfg.publicKey,
      template_params: {
        to_email: toEmail,
        to_name: order.customerName || "Customer",
        subject,
        message,
        invoice_html: html,
        order_id: order.id,
        invoice_no: invoiceNumber(order),
        order_status: order.status,
        order_total: formatCurrency(order.total)
      }
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "EmailJS could not send the invoice.");
  }
  return true;
}

async function sendWithFormSubmit(toEmail, subject, message, order, status) {
  const itemFields = {};
  (order.items || []).forEach((item, index) => {
    itemFields[`Item_${index + 1}`] = `${item.quantity} x ${item.title} @ ${formatCurrency(item.price)} = ${formatCurrency(Number(item.price) * Number(item.quantity))}`;
  });

  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(toEmail)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      name: "AuraStore Invoices",
      email: "invoices@aurastore.app",
      _subject: subject,
      _template: "table",
      _captcha: "false",
      Invoice: invoiceNumber(order),
      Order_ID: order.id,
      Status: status,
      Customer: order.customerName,
      Phone: order.customerPhone || "N/A",
      Ship_To: order.shippingAddress || "Standard delivery",
      Payment: order.paymentMethod || "Card",
      Subtotal: formatCurrency(order.subtotal || order.total),
      Tax: formatCurrency(order.tax || 0),
      Shipping: shippingLabel(order),
      Amount_Due: formatCurrency(order.total),
      ...itemFields,
      Full_Invoice: message
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === "false") {
    throw new Error(data.message || "Could not deliver the invoice email.");
  }
  return true;
}

export async function sendOrderEmail(order, status = order.status || "Pending") {
  const toEmail = String(order.customerEmail || "").trim();
  if (!toEmail || !toEmail.includes("@")) {
    throw new Error("A valid customer email is required to send the invoice.");
  }

  const copy = STATUS_COPY[status] || STATUS_COPY.Pending;
  const subject = `${copy.title} • ${invoiceNumber(order)} • ${order.id}`;
  const payload = { ...order, status };
  const message = buildInvoiceText(payload, status);
  const html = buildInvoiceHtml(payload, status);

  let sent = false;
  try {
    sent = await sendWithEmailJs(toEmail, subject, message, html, payload);
  } catch (err) {
    console.warn("EmailJS send failed, trying FormSubmit:", err.message);
  }

  if (!sent) {
    await sendWithFormSubmit(toEmail, subject, message, payload, status);
  }

  rememberSend({
    at: new Date().toISOString(),
    to: toEmail,
    orderId: order.id,
    invoice: invoiceNumber(order),
    status,
    subject
  });

  return { to: toEmail, subject, status, invoice: invoiceNumber(order) };
}

export function getEmailLog() {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_LOG_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
