import {
  api,
  collectFormData,
  ensureCsrfToken,
  escapeHtml,
  fetchCurrentUser,
  formatCurrency,
  formatDate,
  getErrorMessage,
  logout,
  setFormBusy,
  showBanner,
  statusBadgeClass,
} from "./shared.js";

const state = {
  user: null,
  cakes: [],
  orders: [],
  activeCake: null,
  orderPending: false,
};

const refs = {
  authPanel:        document.getElementById("authPanel"),
  cakeCount:        document.getElementById("cakeCount"),
  cakeEmptyState:   document.getElementById("cakeEmptyState"),
  cakeGrid:         document.getElementById("cakeGrid"),
  closeOrderModal:  document.getElementById("closeOrderModal"),
  deliveryAddress:  document.getElementById("deliveryAddress"),
  loginForm:        document.getElementById("loginForm"),
  logoutBtn:        document.getElementById("logoutBtn"),
  orderCakePreview: document.getElementById("orderCakePreview"),
  orderForm:        document.getElementById("orderForm"),
  orderModal:       document.getElementById("orderModal"),
  orderNotes:       document.getElementById("orderNotes"),
  orderQuantity:    document.getElementById("orderQuantity"),
  orderSubmitBtn:   document.getElementById("orderSubmitBtn"),
  ordersList:       document.getElementById("ordersList"),
  ordersPanel:      document.getElementById("ordersPanel"),
  registerForm:     document.getElementById("registerForm"),
  selectedCakeId:   document.getElementById("selectedCakeId"),
  statusBanner:     document.getElementById("statusBanner"),
  viewerRole:       document.getElementById("viewerRole"),
  viewerRoleBadge:  document.getElementById("viewerRoleBadge"),
};

/* ─── Render ───────────────────────────────────────── */

function renderCakes() {
  refs.cakeCount.textContent = String(state.cakes.length);
  refs.cakeEmptyState.classList.toggle("hidden", state.cakes.length > 0);

  if (state.cakes.length === 0) {
    refs.cakeGrid.innerHTML = "";
    return;
  }

  // Use Cloudinary auto-optimization if URL contains /upload/
  const optimizeUrl = (url) =>
    url.includes("res.cloudinary.com")
      ? url.replace("/upload/", "/upload/w_600,f_auto,q_auto/")
      : url;

  refs.cakeGrid.innerHTML = state.cakes
    .map(
      (cake) => `
        <article class="cake-card">
          <img
            src="${escapeHtml(optimizeUrl(cake.image_url))}"
            alt="${escapeHtml(cake.name)}"
            loading="lazy"
          />
          <div class="cake-card-body">
            <h4>${escapeHtml(cake.name)}</h4>
            <p class="cake-price">${formatCurrency(cake.price)}</p>
            <p class="cake-copy">${escapeHtml(cake.description)}</p>
            <div class="card-actions">
              <button class="primary-btn" type="button"
                data-cake-id="${escapeHtml(cake.id)}"
                data-action="order">
                Order now
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  const canShowOrders = state.user?.role === "CUSTOMER";
  refs.ordersPanel.classList.toggle("hidden", !canShowOrders);

  if (!canShowOrders) { refs.ordersList.innerHTML = ""; return; }

  if (state.orders.length === 0) {
    refs.ordersList.innerHTML =
      '<p class="empty-state">You haven\'t placed any orders yet. 🍰</p>';
    return;
  }

  refs.ordersList.innerHTML = state.orders
    .map((order) => {
      const items = Array.isArray(order.items)
        ? order.items
            .map(
              (item) =>
                `<span class="badge">${escapeHtml(item.cakeName)} × ${item.quantity}</span>`
            )
            .join("")
        : "";

      const statusClass = statusBadgeClass(order.status);

      return `
        <article class="order-card">
          <div class="order-card-body">
            <h4>Order #${escapeHtml(order.id.slice(0, 8).toUpperCase())}</h4>
            <div class="order-meta">
              <span class="badge ${statusClass}">${escapeHtml(order.status)}</span>
              <span class="badge">${formatCurrency(order.total)}</span>
              <span class="badge">${formatDate(order.created_at)}</span>
            </div>
            <p class="order-copy"><strong>Address:</strong> ${escapeHtml(order.delivery_address)}</p>
            ${order.notes ? `<p class="order-copy"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
            <div class="order-meta" style="margin-top:.5rem">${items}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function syncAuthUi() {
  const roleLabel = state.user ? state.user.role : "Guest";
  refs.viewerRole.textContent = roleLabel;
  refs.viewerRoleBadge.textContent = state.user ? `👋 ${state.user.name}` : "";
  refs.logoutBtn.classList.toggle("hidden", !state.user);
  refs.authPanel.classList.toggle("hidden", Boolean(state.user));

  if (state.user?.role === "OWNER") {
    showBanner(
      refs.statusBanner,
      "Owner session detected. Use the dashboard to manage cakes.",
      "warning"
    );
  }
}

/* ─── Order Modal ──────────────────────────────────── */

function openOrderModal(cake) {
  state.activeCake = cake;
  refs.selectedCakeId.value = cake.id;

  const canOrder = state.user?.role === "CUSTOMER";

  refs.orderCakePreview.innerHTML = `
    <p class="eyebrow">You're ordering</p>
    <h3>${escapeHtml(cake.name)}</h3>
    <p class="cake-price">${formatCurrency(cake.price)}</p>
    <p class="hero-copy">${escapeHtml(cake.description)}</p>
    ${!canOrder ? '<p class="meta-text">⚠️ Sign in as a customer to place an order.</p>' : ""}
  `;

  for (const field of refs.orderForm.querySelectorAll("input, textarea, button")) {
    if (field === refs.selectedCakeId) continue;
    field.disabled = !canOrder;
  }

  refs.orderSubmitBtn.textContent = canOrder ? "Submit order" : "Log in to order";
  refs.orderModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeOrderModal() {
  refs.orderModal.classList.add("hidden");
  document.body.style.overflow = "";
  refs.orderForm.reset();
  setFormBusy(refs.orderForm, false);
  refs.orderSubmitBtn.textContent = "Submit order";
  state.activeCake = null;
  state.orderPending = false;
}

/* ─── Data Loaders ─────────────────────────────────── */

async function loadCakes() {
  const data = await api("/cakes");
  state.cakes = data.cakes || [];
  renderCakes();
}

async function loadOrders() {
  if (!state.user || state.user.role !== "CUSTOMER") {
    state.orders = [];
    renderOrders();
    return;
  }
  const data = await api("/orders/me");
  state.orders = data.orders || [];
  renderOrders();
}

async function refreshSession() {
  state.user = await fetchCurrentUser();
  syncAuthUi();
  await loadOrders();
}

/* ─── Event Handlers ───────────────────────────────── */

async function handleRegister(event) {
  event.preventDefault();
  setFormBusy(refs.registerForm, true);
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: collectFormData(refs.registerForm),
    });
    refs.registerForm.reset();
    state.user = data.user;
    syncAuthUi();
    await loadOrders();
    showBanner(refs.statusBanner, `Welcome, ${data.user.name}! 🎉`, "success");
  } catch (error) {
    showBanner(refs.statusBanner, getErrorMessage(error), "danger");
  } finally {
    setFormBusy(refs.registerForm, false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setFormBusy(refs.loginForm, true);
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: collectFormData(refs.loginForm),
    });
    refs.loginForm.reset();
    state.user = data.user;
    syncAuthUi();
    await loadOrders();
    showBanner(refs.statusBanner, `Welcome back, ${data.user.name}! 👋`, "success");
  } catch (error) {
    showBanner(refs.statusBanner, getErrorMessage(error), "danger");
  } finally {
    setFormBusy(refs.loginForm, false);
  }
}

async function handleLogout() {
  refs.logoutBtn.disabled = true;
  try {
    await logout();
    await ensureCsrfToken(true);
    state.user = null;
    state.orders = [];
    syncAuthUi();
    renderOrders();
    closeOrderModal();
    showBanner(refs.statusBanner, "You've been logged out.", "info");
  } catch (error) {
    showBanner(refs.statusBanner, getErrorMessage(error), "danger");
  } finally {
    refs.logoutBtn.disabled = false;
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();

  if (!state.user || state.user.role !== "CUSTOMER") {
    showBanner(refs.statusBanner, "Please log in as a customer to place an order.", "warning");
    closeOrderModal();
    refs.authPanel.scrollIntoView({ behavior: "smooth" });
    return;
  }

  // Prevent double-submit
  if (state.orderPending) return;
  state.orderPending = true;
  setFormBusy(refs.orderForm, true);
  refs.orderSubmitBtn.textContent = "Placing order…";

  try {
    const payload = {
      items: [{ cakeId: refs.selectedCakeId.value, quantity: Number(refs.orderQuantity.value) }],
      deliveryAddress: refs.deliveryAddress.value,
      notes: refs.orderNotes.value,
    };

    const data = await api("/orders", { method: "POST", body: payload });
    showBanner(refs.statusBanner, "Order placed! We'll bake it fresh. 🎂", "success");
    closeOrderModal();
    await loadOrders();
  } catch (error) {
    showBanner(refs.statusBanner, getErrorMessage(error), "danger");
    state.orderPending = false;
    setFormBusy(refs.orderForm, false);
    refs.orderSubmitBtn.textContent = "Submit order";
  }
}

/* ─── Boot ─────────────────────────────────────────── */

async function init() {
  try {
    await ensureCsrfToken();
    await refreshSession();
    await loadCakes();
  } catch (error) {
    showBanner(refs.statusBanner, `Could not connect to server: ${getErrorMessage(error)}`, "danger");
  }
}

refs.registerForm.addEventListener("submit", handleRegister);
refs.loginForm.addEventListener("submit", handleLogin);
refs.logoutBtn.addEventListener("click", handleLogout);
refs.orderForm.addEventListener("submit", handleOrderSubmit);
refs.closeOrderModal.addEventListener("click", closeOrderModal);

refs.orderModal.addEventListener("click", (event) => {
  if (event.target === refs.orderModal) closeOrderModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !refs.orderModal.classList.contains("hidden")) {
    closeOrderModal();
  }
});

refs.cakeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cake-id]");
  if (!button) return;
  const cake = state.cakes.find((c) => c.id === button.dataset.cakeId);
  if (cake) openOrderModal(cake);
});

init();
