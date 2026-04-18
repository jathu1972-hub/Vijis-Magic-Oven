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

const state = { user: null, cakes: [], orders: [] };

const refs = {
  cakeDescription:      document.getElementById("cakeDescription"),
  cakeForm:             document.getElementById("cakeForm"),
  cakeImage:            document.getElementById("cakeImage"),
  cakeName:             document.getElementById("cakeName"),
  cakePrice:            document.getElementById("cakePrice"),
  cancelEditBtn:        document.getElementById("cancelEditBtn"),
  catalogPanel:         document.getElementById("catalogPanel"),
  editingCakeId:        document.getElementById("editingCakeId"),
  editorTitle:          document.getElementById("editorTitle"),
  existingImagePublicId:document.getElementById("existingImagePublicId"),
  existingImageUrl:     document.getElementById("existingImageUrl"),
  imagePreview:         document.getElementById("imagePreview"),
  imagePreviewWrap:     document.getElementById("imagePreviewWrap"),
  ownerCakeList:        document.getElementById("ownerCakeList"),
  ownerDashboard:       document.getElementById("ownerDashboard"),
  ownerLoginForm:       document.getElementById("ownerLoginForm"),
  ownerLoginPanel:      document.getElementById("ownerLoginPanel"),
  ownerLogoutBtn:       document.getElementById("ownerLogoutBtn"),
  ownerOrdersList:      document.getElementById("ownerOrdersList"),
  ownerOrdersPanel:     document.getElementById("ownerOrdersPanel"),
  ownerSessionRole:     document.getElementById("ownerSessionRole"),
  ownerStatusBanner:    document.getElementById("ownerStatusBanner"),
  saveCakeBtn:          document.getElementById("saveCakeBtn"),
};

/* ─── UI Sync ──────────────────────────────────────── */

function syncOwnerUi() {
  const isOwner = state.user?.role === "OWNER";
  refs.ownerSessionRole.textContent = state.user
    ? `👋 ${state.user.name}`
    : "";
  refs.ownerLogoutBtn.classList.toggle("hidden", !state.user);
  refs.ownerLoginPanel.classList.toggle("hidden", isOwner);
  refs.ownerDashboard.classList.toggle("hidden", !isOwner);

  if (state.user && !isOwner) {
    showBanner(
      refs.ownerStatusBanner,
      "A customer session is active. Please log out and use the owner credentials.",
      "warning"
    );
  }
}

function previewImage(source) {
  if (!source) {
    refs.imagePreviewWrap.classList.add("hidden");
    refs.imagePreview.removeAttribute("src");
    return;
  }
  refs.imagePreview.src = source;
  refs.imagePreviewWrap.classList.remove("hidden");
}

function resetEditor() {
  refs.cakeForm.reset();
  refs.editingCakeId.value = "";
  refs.existingImageUrl.value = "";
  refs.existingImagePublicId.value = "";
  refs.cancelEditBtn.classList.add("hidden");
  refs.editorTitle.textContent = "Add a cake";
  refs.saveCakeBtn.textContent = "Save cake";
  setFormBusy(refs.cakeForm, false);
  previewImage("");
}

function startEdit(cake) {
  refs.editingCakeId.value = cake.id;
  refs.cakeName.value = cake.name;
  refs.cakePrice.value = cake.price;
  refs.cakeDescription.value = cake.description;
  refs.existingImageUrl.value = cake.image_url;
  refs.existingImagePublicId.value = cake.image_public_id || "";
  refs.cancelEditBtn.classList.remove("hidden");
  refs.editorTitle.textContent = "Edit cake";
  refs.saveCakeBtn.textContent = "Update cake";
  previewImage(cake.image_url);
  refs.cakeName.focus();
  refs.cakeName.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ─── Render ───────────────────────────────────────── */

function renderCatalog() {
  if (state.cakes.length === 0) {
    refs.ownerCakeList.innerHTML =
      '<p class="empty-state">No cakes yet. Use the form to add one. 🎂</p>';
    return;
  }

  refs.ownerCakeList.innerHTML = state.cakes
    .map(
      (cake) => `
        <article class="owner-row">
          <img src="${escapeHtml(cake.image_url)}" alt="${escapeHtml(cake.name)}" />
          <div class="owner-row-body">
            <h4>${escapeHtml(cake.name)}</h4>
            <p class="cake-price">${formatCurrency(cake.price)}</p>
            <p class="meta-text">${escapeHtml(cake.description.slice(0, 80))}${cake.description.length > 80 ? "…" : ""}</p>
            <div class="owner-row-actions">
              <button class="action-btn" type="button"
                data-cake-id="${escapeHtml(cake.id)}" data-action="edit">Edit</button>
              <button class="danger-btn" type="button"
                data-cake-id="${escapeHtml(cake.id)}" data-action="delete">Delete</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  if (state.orders.length === 0) {
    refs.ownerOrdersList.innerHTML =
      '<p class="empty-state">No orders yet. Customers will appear here once they order. 📦</p>';
    return;
  }

  const statuses = ["PLACED", "PREPARING", "READY", "COMPLETED"];

  refs.ownerOrdersList.innerHTML = state.orders
    .map((order) => {
      const itemBadges = Array.isArray(order.items)
        ? order.items
            .map(
              (item) =>
                `<span class="badge">${escapeHtml(item.cakeName)} × ${item.quantity}</span>`
            )
            .join("")
        : "";

      const statusOptions = statuses
        .map(
          (s) =>
            `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`
        )
        .join("");

      const statusClass = statusBadgeClass(order.status);

      return `
        <article class="order-card">
          <div class="order-card-body">
            <h4>${escapeHtml(order.customer_name)} · #${escapeHtml(order.id.slice(0,8).toUpperCase())}</h4>
            <div class="order-meta">
              <span class="badge ${statusClass}">${escapeHtml(order.status)}</span>
              <span class="badge">${formatCurrency(order.total)}</span>
              <span class="badge">${formatDate(order.created_at)}</span>
            </div>
            <p class="order-copy"><strong>Email:</strong> ${escapeHtml(order.customer_email)}</p>
            <p class="order-copy"><strong>Address:</strong> ${escapeHtml(order.delivery_address)}</p>
            ${order.notes ? `<p class="order-copy"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
            <div class="order-meta" style="margin-top:.6rem">${itemBadges}</div>
            <div style="display:flex;align-items:center;gap:.6rem;margin-top:1rem">
              <label style="font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--cocoa-soft)">Update status</label>
              <select
                data-order-id="${escapeHtml(order.id)}"
                data-action="update-status"
                style="padding:6px 10px;border-radius:999px;border:1.5px solid rgba(44,26,18,.2);font-size:13px;font-family:inherit;color:var(--cocoa);background:#fff;cursor:pointer"
              >
                ${statusOptions}
              </select>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

/* ─── Data Loaders ─────────────────────────────────── */

async function loadCatalog() {
  const data = await api("/cakes");
  state.cakes = data.cakes || [];
  renderCatalog();
}

async function loadOrders() {
  const data = await api("/orders");
  state.orders = data.orders || [];
  renderOrders();
}

async function loadDashboardData() {
  await Promise.all([loadCatalog(), loadOrders()]);
}

/* ─── Event Handlers ───────────────────────────────── */

async function handleOwnerLogin(event) {
  event.preventDefault();
  setFormBusy(refs.ownerLoginForm, true);
  try {
    const data = await api("/auth/owner-login", {
      method: "POST",
      body: collectFormData(refs.ownerLoginForm),
    });
    refs.ownerLoginForm.reset();
    state.user = data.user;
    syncOwnerUi();
    await loadDashboardData();
    showBanner(refs.ownerStatusBanner, `Welcome back, ${data.user.name}! Dashboard loaded.`, "success");
  } catch (error) {
    showBanner(refs.ownerStatusBanner, getErrorMessage(error), "danger");
  } finally {
    setFormBusy(refs.ownerLoginForm, false);
  }
}

async function handleOwnerLogout() {
  refs.ownerLogoutBtn.disabled = true;
  try {
    await logout();
    await ensureCsrfToken(true);
    state.user = null;
    state.orders = [];
    state.cakes = [];
    syncOwnerUi();
    renderCatalog();
    renderOrders();
    resetEditor();
    showBanner(refs.ownerStatusBanner, "Owner session closed.", "info");
  } catch (error) {
    showBanner(refs.ownerStatusBanner, getErrorMessage(error), "danger");
  } finally {
    refs.ownerLogoutBtn.disabled = false;
  }
}

async function uploadSelectedImageIfNeeded() {
  const file = refs.cakeImage.files[0];
  if (!file) {
    return {
      imageUrl: refs.existingImageUrl.value.trim(),
      imagePublicId: refs.existingImagePublicId.value.trim(),
    };
  }
  const formData = new FormData();
  formData.append("image", file);
  return api("/cakes/upload-image", { method: "POST", formData });
}

async function handleCakeSave(event) {
  event.preventDefault();
  setFormBusy(refs.cakeForm, true);
  refs.saveCakeBtn.textContent = "Saving…";

  try {
    const imageData = await uploadSelectedImageIfNeeded();

    if (!imageData.imageUrl) {
      showBanner(refs.ownerStatusBanner, "Please upload a cake image before saving.", "warning");
      return;
    }

    const payload = {
      name: refs.cakeName.value,
      price: Number(refs.cakePrice.value),
      description: refs.cakeDescription.value,
      imageUrl: imageData.imageUrl,
      imagePublicId: imageData.imagePublicId,
    };

    const editingId = refs.editingCakeId.value;
    const method = editingId ? "PUT" : "POST";
    const path = editingId ? `/cakes/${editingId}` : "/cakes";

    const data = await api(path, { method, body: payload });
    showBanner(refs.ownerStatusBanner, data.message, "success");
    resetEditor();
    await loadCatalog();
  } catch (error) {
    showBanner(refs.ownerStatusBanner, getErrorMessage(error), "danger");
  } finally {
    setFormBusy(refs.cakeForm, false);
    refs.saveCakeBtn.textContent = refs.editingCakeId.value ? "Update cake" : "Save cake";
  }
}

async function handleCatalogClick(event) {
  const button = event.target.closest("button[data-cake-id]");
  if (!button) return;

  const cake = state.cakes.find((c) => c.id === button.dataset.cakeId);
  if (!cake) return;

  if (button.dataset.action === "edit") {
    startEdit(cake);
    return;
  }

  if (button.dataset.action === "delete") {
    // Custom confirm using a simple inline check
    const confirmed = window.confirm(`Delete "${cake.name}"? This cannot be undone.`);
    if (!confirmed) return;

    button.disabled = true;
    try {
      const data = await api(`/cakes/${cake.id}`, { method: "DELETE" });
      showBanner(refs.ownerStatusBanner, data.message, "success");
      if (refs.editingCakeId.value === cake.id) resetEditor();
      await loadCatalog();
    } catch (error) {
      showBanner(refs.ownerStatusBanner, getErrorMessage(error), "danger");
    } finally {
      button.disabled = false;
    }
  }
}

async function handleOrderStatusChange(event) {
  const select = event.target.closest("select[data-action='update-status']");
  if (!select) return;

  const orderId = select.dataset.orderId;
  const newStatus = select.value;
  select.disabled = true;

  try {
    await api(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status: newStatus },
    });
    showBanner(refs.ownerStatusBanner, `Order status updated to ${newStatus}.`, "success");
    // Update local state without full reload for responsiveness
    const order = state.orders.find((o) => o.id === orderId);
    if (order) order.status = newStatus;
    // Re-render just the badge next to the select
    const badge = select.closest(".order-card-body").querySelector(".badge");
    if (badge) {
      badge.textContent = newStatus;
      badge.className = `badge ${statusBadgeClass(newStatus)}`;
    }
  } catch (error) {
    showBanner(refs.ownerStatusBanner, getErrorMessage(error), "danger");
    // Revert select value
    const order = state.orders.find((o) => o.id === orderId);
    if (order) select.value = order.status;
  } finally {
    select.disabled = false;
  }
}

/* ─── Boot ─────────────────────────────────────────── */

async function init() {
  try {
    await ensureCsrfToken();
    state.user = await fetchCurrentUser();
    syncOwnerUi();
    if (state.user?.role === "OWNER") await loadDashboardData();
  } catch (error) {
    showBanner(refs.ownerStatusBanner, `Startup error: ${getErrorMessage(error)}`, "danger");
  }
}

refs.ownerLoginForm.addEventListener("submit", handleOwnerLogin);
refs.ownerLogoutBtn.addEventListener("click", handleOwnerLogout);
refs.cakeForm.addEventListener("submit", handleCakeSave);
refs.cancelEditBtn.addEventListener("click", resetEditor);
refs.ownerCakeList.addEventListener("click", handleCatalogClick);
refs.ownerOrdersList.addEventListener("change", handleOrderStatusChange);

refs.cakeImage.addEventListener("change", () => {
  const file = refs.cakeImage.files[0];
  if (!file) {
    previewImage(refs.existingImageUrl.value);
    return;
  }
  previewImage(URL.createObjectURL(file));
});

init();
