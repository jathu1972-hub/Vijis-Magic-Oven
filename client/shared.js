const BASE_URL = "https://vijis-magic-oven.onrender.com";

let csrfToken = "";
export async function ensureCsrfToken(forceRefresh = false) {
  if (csrfToken && !forceRefresh) return csrfToken;
  const response = await fetch(`${BASE_URL}/auth/csrf-token`, { credentials: "include" });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}
export async function api(path, { method = "GET", body, formData, headers = {} } = {}) {
  const upperMethod = method.toUpperCase();
  const finalHeaders = new Headers(headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(upperMethod)) {
    finalHeaders.set("x-csrf-token", await ensureCsrfToken());
  }
  const options = { method: upperMethod, credentials: "include", headers: finalHeaders };
  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.details = data;
    throw error;
  }
  return data;
}
export async function fetchCurrentUser() {
  try {
    const data = await api("/auth/me");
    return data.user || null;
  } catch {
    return null;
  }
}
export async function logout() {
  return api("/auth/logout", { method: "POST" });
}
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function showBanner(element, message, tone = "info") {
  if (!element) return;
  if (!message) {
    element.className = "notice hidden";
    element.textContent = "";
    return;
  }
  element.className = `notice ${tone}`;
  element.textContent = message;
  if (tone === "success" || tone === "info") {
    clearTimeout(element._bannerTimer);
    element._bannerTimer = setTimeout(() => showBanner(element, ""), 6000);
  }
}
export function collectFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}
export function getErrorMessage(error) {
  const firstValidationError = error?.details?.errors?.[0];
  return firstValidationError?.message || error?.message || "Something went wrong.";
}
export function statusBadgeClass(status) {
  const map = {
    PLACED: "badge-status-placed",
    PREPARING: "badge-status-preparing",
    READY: "badge-status-ready",
    COMPLETED: "badge-status-completed",
  };
  return map[status] ?? "";
}
export function setFormBusy(form, busy) {
  for (const el of form.querySelectorAll("input, textarea, button, select")) {
    el.disabled = busy;
  }
}
