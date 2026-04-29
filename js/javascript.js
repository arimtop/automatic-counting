// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let products = [];
let writeOffHistory = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilter = "";
let currentCategory = "";

let writeOffHistoryPage = 1;
const writeOffItemsPerPage = 10;
let writeOffSearchFilter = "";
let writeOffReasonFilterValue = "";

const productForm = document.querySelector("form");
const searchInput = document.getElementById("searchInput");
const productCategory = document.getElementById("productCategory");
const categoryFilter = document.getElementById("categoryFilter");
const productsList = document.getElementById("productsList");
const summaryQuantity = document.getElementById("summaryQuantity");
const summaryValue = document.getElementById("summaryValue");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const clearFormBtn = document.getElementById("clearForm");

const totalProductsEl = document.getElementById("totalProducts");
const totalQuantityEl = document.getElementById("totalQuantity");
const totalValueEl = document.getElementById("totalValue");
const categoriesCountEl = document.getElementById("categoriesCount");

document.getElementById("productDate").valueAsDate = new Date();

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function spaceDigits(number) {
  if (number === null || number === undefined) return "0";
  let numStr = String(number).replace(/\s/g, "");
  if (numStr.includes(".")) {
    const parts = numStr.split(".");
    const integerPart = parts[0].replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, "$1 ");
    const decimalPart = parts[1];
    return `${integerPart}.${decimalPart}`;
  }
  return numStr.replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, "$1 ");
}

function showNotification(message, type = "info") {
  document.querySelectorAll(".notification").forEach((n) => n.remove());
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// ========== РАБОТА С ДАННЫМИ ЧЕРЕЗ localForage ==========

async function saveProducts() {
  try {
    await localforage.setItem('products', products);
  } catch (error) {
    console.error('Ошибка сохранения товаров:', error);
    showNotification('Ошибка сохранения данных!', 'error');
  }
}

async function loadProducts() {
  try {
    products = await localforage.getItem('products') || [];
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error);
    products = [];
  }
}

async function saveWriteOffHistory() {
  try {
    await localforage.setItem('writeOffHistory', writeOffHistory);
  } catch (error) {
    console.error('Ошибка сохранения истории:', error);
    showNotification('Ошибка сохранения истории!', 'error');
  }
}

async function loadWriteOffHistory() {
  try {
    writeOffHistory = await localforage.getItem('writeOffHistory') || [];
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
    writeOffHistory = [];
  }
}

async function loadAllData() {
  await Promise.all([loadProducts(), loadWriteOffHistory()]);
}

// ========== КАТЕГОРИИ ==========

function initCategories() {
  const categorySelect = document.getElementById("productCategory");
  const filterSelect = document.getElementById("categoryFilter");
  const currentFormValue = categorySelect.value;
  const currentFilterValue = filterSelect.value;
  const uniqueCategories = [...new Set(products.map((product) => product.category))];

  uniqueCategories.forEach((category) => {
    if (category && category.trim() !== "") {
      let formExists = false;
      for (let i = 0; i < categorySelect.options.length; i++) {
        if (categorySelect.options[i].value === category) {
          formExists = true;
          break;
        }
      }
      if (!formExists) {
        const formOption = document.createElement("option");
        formOption.value = category;
        formOption.textContent = category;
        categorySelect.appendChild(formOption);
      }

      let filterExists = false;
      for (let i = 0; i < filterSelect.options.length; i++) {
        if (filterSelect.options[i].value === category) {
          filterExists = true;
          break;
        }
      }
      if (!filterExists) {
        const filterOption = document.createElement("option");
        filterOption.value = category;
        filterOption.textContent = category;
        filterSelect.appendChild(filterOption);
      }
    }
  });

  if (currentFormValue && uniqueCategories.includes(currentFormValue)) {
    categorySelect.value = currentFormValue;
  }
  if (currentFilterValue && uniqueCategories.includes(currentFilterValue)) {
    filterSelect.value = currentFilterValue;
  } else if (currentFilterValue === "") {
    filterSelect.value = "";
  }
}

function refreshCategories() {
  const categorySelect = document.getElementById("productCategory");
  const filterSelect = document.getElementById("categoryFilter");
  const currentFormValue = categorySelect.value;
  const currentFilterValue = filterSelect.value;

  while (categorySelect.options.length > 1) categorySelect.remove(1);
  while (filterSelect.options.length > 1) filterSelect.remove(1);

  const uniqueCategories = [...new Set(products.map((product) => product.category))];
  uniqueCategories.sort((a, b) => a.localeCompare(b, "ru"));

  uniqueCategories.forEach((category) => {
    if (category && category.trim() !== "") {
      const formOption = document.createElement("option");
      formOption.value = category;
      formOption.textContent = category;
      categorySelect.appendChild(formOption);

      const filterOption = document.createElement("option");
      filterOption.value = category;
      filterOption.textContent = category;
      filterSelect.appendChild(filterOption);
    }
  });

  if (currentFormValue && uniqueCategories.includes(currentFormValue)) {
    categorySelect.value = currentFormValue;
  }
  if (currentFilterValue && uniqueCategories.includes(currentFilterValue)) {
    filterSelect.value = currentFilterValue;
  } else {
    filterSelect.value = "";
  }
}

// ========== CRUD ОПЕРАЦИИ ==========

async function addProduct(event) {
  event.preventDefault();

  const product = {
    id: Date.now(),
    code: document.getElementById("productCode").value.trim(),
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("productCategory").value,
    quantity: parseInt(document.getElementById("productQuantity").value),
    price: parseFloat(document.getElementById("productPrice").value),
    description: document.getElementById("productDescription").value.trim(),
    location: document.getElementById("productLocation").value.trim(),
    date: document.getElementById("productDate").value,
  };

  const existingProductIndex = products.findIndex(p => p.code === product.code);
  
  if (existingProductIndex !== -1) {
    const existing = products[existingProductIndex];
    const oldQuantity = existing.quantity;
    const oldPrice = existing.price;
    const newQuantity = product.quantity;
    const newPrice = product.price;
    
    const totalOldCost = oldQuantity * oldPrice;
    const totalNewCost = newQuantity * newPrice;
    const totalQuantity = oldQuantity + newQuantity;
    const weightedAveragePrice = (totalOldCost + totalNewCost) / totalQuantity;
    
    existing.quantity = totalQuantity;
    existing.price = Math.round(weightedAveragePrice * 100) / 100;
    
    if (product.description && product.description !== existing.description) {
      existing.description = product.description;
    }
    if (product.location && product.location !== existing.location) {
      existing.location = product.location;
    }
    
    await saveProducts();
    renderProducts();
    updateWriteOffProductsList();
    refreshCategories();
    updateStats();
    
    productForm.reset();
    document.getElementById("productDate").valueAsDate = new Date();
    document.getElementById("productQuantity").value = 1;
    
    showNotification(
      `Обновлено: "${product.name}" - ${spaceDigits(totalQuantity)} шт., ` +
      `средняя цена ${spaceDigits(existing.price.toFixed(2))} руб.`,
      "success"
    );
    return;
  }

  products.push(product);
  await saveProducts();
  renderProducts();
  updateWriteOffProductsList();
  refreshCategories();
  updateStats();

  productForm.reset();
  document.getElementById("productDate").valueAsDate = new Date();
  document.getElementById("productQuantity").value = 1;

  showNotification(`Изделие "${product.name}" успешно добавлено!`, "success");
}

async function deleteProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  if (confirm("Вы уверены, что хотите удалить это изделие?")) {
    products = products.filter((product) => product.id !== id);
    await saveProducts();
    renderProducts();
    updateWriteOffProductsList();
    refreshCategories();
    updateStats();
    showNotification(`Изделие "${product.name}" удалено!`, "warning");
  }
}

async function editProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  document.getElementById("productCode").value = product.code;
  document.getElementById("productName").value = product.name;
  document.getElementById("productCategory").value = product.category;
  document.getElementById("productQuantity").value = product.quantity;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productDescription").value = product.description;
  document.getElementById("productLocation").value = product.location;
  document.getElementById("productDate").value = product.date;

  products = products.filter((p) => p.id !== id);
  await saveProducts();
  updateWriteOffProductsList();
  refreshCategories();
  updateStats();

  document.querySelector("form").scrollIntoView({ behavior: "smooth" });
  showNotification("Редактирование изделия", "info");
}

// ========== ОТОБРАЖЕНИЕ ТОВАРОВ ==========

function renderProducts() {
  let filteredProducts = [...products];

  if (currentFilter) {
    const searchLower = currentFilter.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.code.toLowerCase().includes(searchLower) ||
        (product.description &&
          product.description.toLowerCase().includes(searchLower)),
    );
  }

  if (currentCategory) {
    filteredProducts = filteredProducts.filter(
      (product) => product.category === currentCategory,
    );
  }

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  productsList.innerHTML = "";

  if (paginatedProducts.length === 0) {
    productsList.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4">
          <i class="fas fa-box-open fa-2x mb-2" style="color: #ccc;"></i>
          <p>Нет изделий для отображения</p>
        </td>
      </tr>
    `;
  } else {
    paginatedProducts.forEach((product) => {
      const totalCost = product.quantity * product.price;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${product.code}</td>
        <td>${product.name}</td>
        <td><span class="category-badge">${product.category}</span></td>
        <td>${spaceDigits(product.quantity)}</td>
        <td>${spaceDigits(product.price.toFixed(2))} руб.</td>
        <td><strong>${spaceDigits(totalCost.toFixed(2))} руб.</strong></td>
        <td>
          <button onclick="editProduct(${product.id})" class="btn-edit">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteProduct(${product.id})" class="btn-delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      productsList.appendChild(row);
    });
  }

  const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = filteredProducts.reduce((sum, p) => sum + p.quantity * p.price, 0);

  summaryQuantity.textContent = spaceDigits(totalQuantity);
  summaryValue.textContent = spaceDigits(totalValue.toFixed(2));
  pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function updateStats() {
  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
  const uniqueCategories = [...new Set(products.map((p) => p.category))];

  totalProductsEl.textContent = spaceDigits(totalProducts);
  totalQuantityEl.textContent = spaceDigits(totalQuantity);
  totalValueEl.textContent = spaceDigits(totalValue.toFixed(2));
  categoriesCountEl.textContent = spaceDigits(uniqueCategories.length);
}

// ========== КАТЕГОРИИ ==========

function newCategories() {
  let newCategory = prompt("Введите название новой категории:");
  if (newCategory && newCategory.trim() !== "") {
    newCategory = newCategory.trim();
    const existingCategories = [...new Set(products.map((p) => p.category))];

    if (!existingCategories.includes(newCategory)) {
      const categorySelect = document.getElementById("productCategory");
      const filterSelect = document.getElementById("categoryFilter");

      const formOption = document.createElement("option");
      formOption.value = newCategory;
      formOption.textContent = newCategory;
      categorySelect.appendChild(formOption);

      const filterOption = document.createElement("option");
      filterOption.value = newCategory;
      filterOption.textContent = newCategory;
      filterSelect.appendChild(filterOption);

      showNotification(`Категория "${newCategory}" добавлена в список!`, "success");
    } else {
      showNotification("Такая категория уже существует!", "error");
    }
  }
}

// ========== КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК С ПОИСКОМ ==========

function toggleSelect() {
  const select = document.getElementById("writeOffProductSelect");
  const container = select.querySelector(".custom-options-container");
  
  if (container.style.display === "none") {
    openSelect();
  } else {
    closeSelect();
  }
}

function openSelect() {
  const select = document.getElementById("writeOffProductSelect");
  const container = select.querySelector(".custom-options-container");
  
  select.classList.add("open");
  container.style.display = "block";
  
  setTimeout(() => {
    const searchInput = document.getElementById("productSearchInput");
    if (searchInput) {
      searchInput.focus();
      searchInput.value = "";
      filterProducts("");
    }
  }, 100);
  
  document.addEventListener("click", handleOutsideClick);
}

function closeSelect() {
  const select = document.getElementById("writeOffProductSelect");
  const container = select.querySelector(".custom-options-container");
  
  select.classList.remove("open");
  container.style.display = "none";
  
  document.removeEventListener("click", handleOutsideClick);
}

function handleOutsideClick(e) {
  const select = document.getElementById("writeOffProductSelect");
  if (!select.contains(e.target)) {
    closeSelect();
  }
}

function filterProducts(searchTerm) {
  const optionsContainer = document.getElementById("writeOffProductOptions");
  if (!optionsContainer) return;
  
  const searchLower = searchTerm.toLowerCase();
  
  const filteredProducts = products.filter(product => {
    if (product.quantity <= 0) return false;
    if (!searchTerm) return true;
    
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.code.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower)
    );
  });
  
  if (searchTerm) {
    filteredProducts.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(searchLower);
      const bNameMatch = b.name.toLowerCase().includes(searchLower);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  if (filteredProducts.length === 0) {
    optionsContainer.innerHTML = `
      <div class="no-results">
        <i class="fas fa-search"></i>
        <p>Ничего не найдено</p>
        ${searchTerm ? '<small>Попробуйте изменить запрос</small>' : '<small>Нет доступных изделий</small>'}
      </div>
    `;
  } else {
    optionsContainer.innerHTML = filteredProducts.map(product => {
      const quantityClass = product.quantity <= 5 ? 'low' : '';
      return `
        <div class="custom-option" 
             onclick="selectProduct(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.quantity})"
             data-product-id="${product.id}">
          <div class="option-info">
            <span class="option-name">${highlightMatch(product.name, searchTerm)}</span>
            <span class="option-details">
              ${highlightMatch(product.code, searchTerm)} - ${product.category}
            </span>
          </div>
          <span class="option-quantity ${quantityClass}">
            ${spaceDigits(product.quantity)} шт.
          </span>
        </div>
      `;
    }).join("");
  }
}

function highlightMatch(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<strong style="background: #fff59d; padding: 0 2px;">$1</strong>');
}

function selectProduct(productId, productName, quantity) {
  document.getElementById("writeOffProduct").value = productId;
  
  const placeholder = document.querySelector(".custom-select-placeholder");
  placeholder.textContent = productName;
  placeholder.classList.add("selected");
  
  document.querySelectorAll(".custom-option").forEach(opt => {
    opt.classList.remove("selected");
  });
  
  const selectedOption = document.querySelector(`[data-product-id="${productId}"]`);
  if (selectedOption) {
    selectedOption.classList.add("selected");
  }
  
  closeSelect();
  showProductInfo(productId);
  
  const writeOffQuantity = document.getElementById("writeOffQuantity");
  if (writeOffQuantity) {
    writeOffQuantity.max = quantity;
    if (parseInt(writeOffQuantity.value) > quantity) {
      writeOffQuantity.value = quantity;
    }
  }
}

function updateWriteOffProductsList() {
  const currentSearch = document.getElementById("productSearchInput")?.value || "";
  filterProducts(currentSearch);
  
  const selectedId = document.getElementById("writeOffProduct").value;
  if (selectedId) {
    const product = products.find(p => p.id == selectedId);
    if (!product || product.quantity <= 0) {
      document.getElementById("writeOffProduct").value = "";
      const placeholder = document.querySelector(".custom-select-placeholder");
      if (placeholder) {
        placeholder.textContent = "Выберите изделие для списания";
        placeholder.classList.remove("selected");
      }
      document.getElementById("selectedProductInfo").style.display = "none";
    }
  }
}

function initWriteOffSelect() {
  updateWriteOffProductsList();
  
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      const container = document.querySelector(".custom-options-container");
      if (container && container.style.display !== "none") {
        closeSelect();
      }
    }
  });
  
  const optionsContainer = document.querySelector(".custom-options-container");
  if (optionsContainer) {
    optionsContainer.addEventListener("click", function(e) {
      e.stopPropagation();
    });
  }
  
  const searchInput = document.getElementById("productSearchInput");
  if (searchInput) {
    searchInput.addEventListener("click", function(e) {
      e.stopPropagation();
    });
  }
}

// ========== ФОРМА СПИСАНИЯ ==========

function showProductInfo(productId) {
  const infoBlock = document.getElementById("selectedProductInfo");
  if (!infoBlock) return;
  
  if (!productId) {
    infoBlock.style.display = "none";
    return;
  }
  
  const product = products.find(p => p.id == productId);
  if (!product) {
    infoBlock.style.display = "none";
    return;
  }
  
  document.getElementById("infoCode").textContent = product.code;
  document.getElementById("infoCategory").textContent = product.category;
  document.getElementById("infoQuantity").textContent = spaceDigits(product.quantity);
  document.getElementById("infoPrice").textContent = spaceDigits(product.price.toFixed(2));
  document.getElementById("infoLocation").textContent = product.location || "Не указано";
  
  infoBlock.style.display = "block";
  
  const writeOffQuantity = document.getElementById("writeOffQuantity");
  if (writeOffQuantity) {
    writeOffQuantity.max = product.quantity;
    if (parseInt(writeOffQuantity.value) > product.quantity) {
      writeOffQuantity.value = product.quantity;
    }
  }
}

async function writeOffProduct(event) {
  event.preventDefault();
  
  const productId = parseInt(document.getElementById("writeOffProduct").value);
  const quantity = parseInt(document.getElementById("writeOffQuantity").value);
  let reason = document.getElementById("writeOffReason").value;
  const otherReason = document.getElementById("otherReason").value;
  const date = document.getElementById("writeOffDate").value;
  
  if (!productId) {
    showNotification("Выберите изделие для списания!", "error");
    return;
  }
  
  if (!quantity || quantity <= 0) {
    showNotification("Укажите корректное количество!", "error");
    return;
  }
  
  if (!reason) {
    showNotification("Укажите причину списания!", "error");
    return;
  }
  
  if (reason === "Другое") {
    if (!otherReason.trim()) {
      showNotification("Укажите причину списания!", "error");
      return;
    }
    reason = otherReason.trim();
  }
  
  const productIndex = products.findIndex(p => p.id === productId);
  if (productIndex === -1) {
    showNotification("Изделие не найдено!", "error");
    return;
  }
  
  if (quantity > products[productIndex].quantity) {
    showNotification(
      `Недостаточно изделий на складе! Доступно: ${products[productIndex].quantity} шт.`,
      "error"
    );
    return;
  }
  
  const writeOffRecord = {
    id: Date.now(),
    productId: productId,
    productCode: products[productIndex].code,
    productName: products[productIndex].name,
    category: products[productIndex].category,
    quantity: quantity,
    price: products[productIndex].price,
    totalCost: quantity * products[productIndex].price,
    reason: reason,
    date: date,
    location: products[productIndex].location,
  };
  
  writeOffHistory.push(writeOffRecord);
  
  products[productIndex].quantity -= quantity;
  
  if (products[productIndex].quantity === 0) {
    if (confirm(`Изделие "${products[productIndex].name}" полностью списано. Удалить его из списка?`)) {
      products.splice(productIndex, 1);
    }
  }
  
  await saveProducts();
  await saveWriteOffHistory();
  
  renderProducts();
  updateWriteOffProductsList();
  refreshCategories();
  updateStats();
  
  document.getElementById("writeOffForm").reset();
  document.getElementById("writeOffDate").valueAsDate = new Date();
  document.getElementById("writeOffQuantity").value = 1;
  document.getElementById("selectedProductInfo").style.display = "none";
  
  const placeholder = document.querySelector(".custom-select-placeholder");
  if (placeholder) {
    placeholder.textContent = "Выберите изделие для списания";
    placeholder.classList.remove("selected");
  }
  
  showNotification(
    `Списано ${quantity} шт. изделия "${writeOffRecord.productName}". Причина: ${reason}`,
    "success"
  );
}

// ========== ИСТОРИЯ СПИСАНИЙ ==========

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getReasonClass(reason) {
  const reasonLower = reason.toLowerCase();
  if (reasonLower.includes('брак')) return 'badge-brak';
  if (reasonLower.includes('порч')) return 'badge-porcha';
  if (reasonLower.includes('устар')) return 'badge-ustarevanie';
  if (reasonLower.includes('продаж')) return 'badge-sale';
  if (reasonLower.includes('перемещ')) return 'badge-peremeshenie';
  if (reasonLower.includes('инвентар')) return 'badge-inventarizaciya';
  return 'badge-other';
}

function showWriteOffHistory() {
  const modal = document.getElementById("writeOffHistoryModal");
  if (!modal) return;
  
  writeOffHistoryPage = 1;
  writeOffSearchFilter = "";
  writeOffReasonFilterValue = "";
  
  const searchInput = document.getElementById("writeOffSearchInput");
  const reasonFilter = document.getElementById("writeOffReasonFilter");
  if (searchInput) searchInput.value = "";
  if (reasonFilter) reasonFilter.value = "";
  
  modal.style.display = "block";
  renderWriteOffHistory();
  
  modal.addEventListener("click", function(e) {
    if (e.target === modal) {
      closeWriteOffHistory();
    }
  });
}

function closeWriteOffHistory() {
  const modal = document.getElementById("writeOffHistoryModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function searchWriteOffHistory(value) {
  writeOffSearchFilter = value.toLowerCase();
  writeOffHistoryPage = 1;
  renderWriteOffHistory();
}

function filterWriteOffHistory() {
  const reasonFilter = document.getElementById("writeOffReasonFilter");
  writeOffReasonFilterValue = reasonFilter ? reasonFilter.value : "";
  writeOffHistoryPage = 1;
  renderWriteOffHistory();
}

function renderWriteOffHistory() {
  const historyList = document.getElementById("writeOffHistoryList");
  if (!historyList) return;
  
  let filteredHistory = [...writeOffHistory];
  
  if (writeOffSearchFilter) {
    filteredHistory = filteredHistory.filter(record =>
      record.productName.toLowerCase().includes(writeOffSearchFilter) ||
      record.productCode.toLowerCase().includes(writeOffSearchFilter) ||
      record.reason.toLowerCase().includes(writeOffSearchFilter) ||
      (record.category && record.category.toLowerCase().includes(writeOffSearchFilter))
    );
  }
  
  if (writeOffReasonFilterValue) {
    filteredHistory = filteredHistory.filter(record => 
      record.reason === writeOffReasonFilterValue
    );
  }
  
  filteredHistory.sort((a, b) => 
    new Date(b.date + 'T' + (b.time || '00:00:00')) - 
    new Date(a.date + 'T' + (a.time || '00:00:00'))
  );
  
  const totalPages = Math.ceil(filteredHistory.length / writeOffItemsPerPage);
  if (writeOffHistoryPage > totalPages && totalPages > 0) {
    writeOffHistoryPage = totalPages;
  }
  
  const startIndex = (writeOffHistoryPage - 1) * writeOffItemsPerPage;
  const endIndex = startIndex + writeOffItemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
  
  if (paginatedHistory.length === 0) {
    historyList.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4">
          <i class="fas fa-inbox fa-2x mb-2" style="color: #ccc;"></i>
          <p>${writeOffHistory.length === 0 ? 'История списаний пуста' : 'Ничего не найдено по вашему запросу'}</p>
        </td>
      </tr>
    `;
  } else {
    historyList.innerHTML = paginatedHistory.map(record => `
      <tr>
        <td>${formatDate(record.date)}</td>
        <td>${record.productCode}</td>
        <td>${record.productName}</td>
        <td><span class="category-badge">${record.category}</span></td>
        <td><strong style="color: #dc2626;">-${spaceDigits(record.quantity)}</strong></td>
        <td>${spaceDigits(record.price.toFixed(2))} руб.</td>
        <td><strong>${spaceDigits(record.totalCost.toFixed(2))} руб.</strong></td>
        <td><span class="badge-reason ${getReasonClass(record.reason)}">${record.reason}</span></td>
        <td>${record.location || '---'}</td>
      </tr>
    `).join("");
  }
  
  const totalQuantity = filteredHistory.reduce((sum, r) => sum + r.quantity, 0);
  const totalValue = filteredHistory.reduce((sum, r) => sum + r.totalCost, 0);
  
  const totalWriteOffQuantity = document.getElementById("totalWriteOffQuantity");
  const totalWriteOffValue = document.getElementById("totalWriteOffValue");
  
  if (totalWriteOffQuantity) {
    totalWriteOffQuantity.textContent = spaceDigits(totalQuantity);
  }
  if (totalWriteOffValue) {
    totalWriteOffValue.textContent = spaceDigits(totalValue.toFixed(2));
  }
  
  updateWriteOffPagination(totalPages);
}

function updateWriteOffPagination(totalPages) {
  const pageInfo = document.getElementById("writeOffPageInfo");
  const prevBtn = document.getElementById("writeOffPrevPage");
  const nextBtn = document.getElementById("writeOffNextPage");
  
  if (pageInfo) {
    pageInfo.textContent = `Страница ${writeOffHistoryPage} из ${totalPages || 1}`;
  }
  if (prevBtn) {
    prevBtn.disabled = writeOffHistoryPage === 1;
  }
  if (nextBtn) {
    nextBtn.disabled = writeOffHistoryPage === totalPages || totalPages === 0;
  }
}

function writeOffPrevPage() {
  if (writeOffHistoryPage > 1) {
    writeOffHistoryPage--;
    renderWriteOffHistory();
  }
}

function writeOffNextPage() {
  let filteredHistory = [...writeOffHistory];
  
  if (writeOffSearchFilter) {
    filteredHistory = filteredHistory.filter(record =>
      record.productName.toLowerCase().includes(writeOffSearchFilter) ||
      record.productCode.toLowerCase().includes(writeOffSearchFilter) ||
      record.reason.toLowerCase().includes(writeOffSearchFilter) ||
      (record.category && record.category.toLowerCase().includes(writeOffSearchFilter))
    );
  }
  
  if (writeOffReasonFilterValue) {
    filteredHistory = filteredHistory.filter(record => 
      record.reason === writeOffReasonFilterValue
    );
  }
  
  const totalPages = Math.ceil(filteredHistory.length / writeOffItemsPerPage);
  if (writeOffHistoryPage < totalPages) {
    writeOffHistoryPage++;
    renderWriteOffHistory();
  }
}

async function clearWriteOffHistory() {
  if (writeOffHistory.length === 0) {
    showNotification("История списаний уже пуста", "info");
    return;
  }
  
  if (confirm(`Вы уверены, что хотите удалить всю историю списаний (${writeOffHistory.length} записей)?\nЭто действие нельзя отменить!`)) {
    writeOffHistory = [];
    await saveWriteOffHistory();
    renderWriteOffHistory();
    showNotification("История списаний очищена", "warning");
  }
}

function exportWriteOffHistory() {
  if (writeOffHistory.length === 0) {
    showNotification("История списаний пуста", "warning");
    return;
  }
  
  let csvContent = "Дата;Код;Название;Категория;Количество;Цена;Сумма;Причина;Место хранения\n";
  
  writeOffHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(record => {
    csvContent += `"${formatDate(record.date)}";"${record.productCode}";"${record.productName}";"${record.category}";${record.quantity};${record.price};${record.totalCost};"${record.reason}";"${record.location || ''}"\n`;
  });
  
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `write_off_history_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification(`Экспортировано ${writeOffHistory.length} записей списаний`, "success");
}

// ========== ЭКСПОРТ И ОЧИСТКА ==========

function exportToCSV() {
  if (products.length === 0) {
    showNotification("Нет данных для экспорта", "warning");
    return;
  }

  let csvContent = "Код;Название;Категория;Количество;Цена;Описание;Место хранения;Дата поступления\n";

  products.forEach((product) => {
    csvContent += `"${product.code}";"${product.name}";"${product.category}";${product.quantity};${product.price};"${product.description || ""}";"${product.location || ""}";"${product.date}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `inventory_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification(`Экспортировано ${products.length} изделий в CSV`, "success");
}

async function clearAllData() {
  if (products.length === 0) {
    showNotification("Нет данных для очистки", "info");
    return;
  }

  if (confirm(`Вы уверены, что хотите удалить ВСЕ данные (${products.length} изделий)?\nЭто действие нельзя отменить!`)) {
    products = [];
    await saveProducts();

    const categorySelect = document.getElementById("productCategory");
    while (categorySelect.options.length > 1) categorySelect.remove(1);

    const filterSelect = document.getElementById("categoryFilter");
    while (filterSelect.options.length > 1) filterSelect.remove(1);

    renderProducts();
    updateStats();
    updateWriteOffProductsList();
    showNotification("Все данные успешно удалены", "warning");
  }
}

// ========== ТЕСТОВЫЕ ДАННЫЕ ==========

function generateTestData() {
  if (products.length > 0) {
    if (!confirm("У вас уже есть данные. Хотите добавить тестовые данные к существующим?")) {
      return;
    }
  }

  const baseId = Date.now();
  
  const testProducts = [
    { id: baseId + 1, code: "ELEC-001", name: "Ноутбук Dell XPS", category: "Электроника", quantity: 5, price: 89999.99, description: "Игровой ноутбук с процессором i7", location: "Склад А, стеллаж 3", date: "2026-04-01" },
    { id: baseId + 2, code: "ELEC-002", name: "Монитор Samsung 27", category: "Электроника", quantity: 15, price: 25999.00, description: "Изогнутый монитор 27 дюймов", location: "Склад А, стеллаж 5", date: "2026-04-02" },
    { id: baseId + 3, code: "ELEC-003", name: "Смартфон iPhone 15", category: "Электроника", quantity: 20, price: 129999.00, description: "Смартфон Apple последней модели", location: "Склад В, сейф 1", date: "2026-04-03" },
    { id: baseId + 4, code: "FURN-001", name: "Офисное кресло", category: "Мебель", quantity: 12, price: 12499.50, description: "Эргономичное кресло с поддержкой спины", location: "Склад Б, секция 2", date: "2026-03-15" },
    { id: baseId + 5, code: "FURN-002", name: "Стол письменный", category: "Мебель", quantity: 8, price: 18000.00, description: "Стол из дуба с ящиками", location: "Склад Б, секция 1", date: "2026-03-16" },
    { id: baseId + 6, code: "FURN-003", name: "Шкаф для документов", category: "Мебель", quantity: 4, price: 35000.00, description: "Металлический шкаф с замком", location: "Склад Б, секция 3", date: "2026-03-17" },
    { id: baseId + 7, code: "TOOL-001", name: "Дрель электрическая", category: "Инструменты", quantity: 10, price: 4599.00, description: "Мощная дрель с набором насадок", location: "Склад В, ячейка 15", date: "2026-04-10" },
    { id: baseId + 8, code: "TOOL-002", name: "Набор отверток", category: "Инструменты", quantity: 25, price: 1299.00, description: "Набор из 12 отверток разных размеров", location: "Склад В, ячейка 20", date: "2026-04-11" },
    { id: baseId + 9, code: "TOOL-003", name: "Перфоратор Bosch", category: "Инструменты", quantity: 3, price: 25000.00, description: "Профессиональный перфоратор", location: "Склад В, ячейка 10", date: "2026-04-12" },
    { id: baseId + 10, code: "CLOTH-001", name: "Спецодежда (комплект)", category: "Одежда", quantity: 50, price: 4500.00, description: "Комплект спецодежды: куртка и брюки", location: "Склад А, стеллаж 10", date: "2026-03-20" },
    { id: baseId + 11, code: "CLOTH-002", name: "Футболка", category: "Одежда", quantity: 100, price: 500.50, description: "Хлопковая футболка с логотипом", location: "Склад А, стеллаж 11", date: "2026-03-21" },
    { id: baseId + 12, code: "CLOTH-003", name: "Перчатки рабочие", category: "Одежда", quantity: 200, price: 150.00, description: "Защитные перчатки из кожи", location: "Склад А, стеллаж 12", date: "2026-03-22" },
    { id: baseId + 13, code: "BOOK-001", name: "Справочник инженера", category: "Книги", quantity: 15, price: 2500.00, description: "Технический справочник 2026", location: "Склад Г, полка 1", date: "2026-02-10" },
    { id: baseId + 14, code: "BOOK-002", name: "Документация ГОСТ", category: "Книги", quantity: 30, price: 1800.00, description: "Сборник стандартов ГОСТ", location: "Склад Г, полка 2", date: "2026-02-11" },
    { id: baseId + 15, code: "BOOK-003", name: "Война и мир", category: "Книги", quantity: 12, price: 1299.50, description: "Роман Л.Н. Толстого", location: "Склад Г, полка 3", date: "2026-02-12" },
    { id: baseId + 16, code: "FOOD-001", name: "Чай Lipton", category: "Продукты", quantity: 200, price: 250.00, description: "Черный чай в пакетиках", location: "Склад Д, секция 1", date: "2026-04-15" },
    { id: baseId + 17, code: "FOOD-002", name: "Кофе Jacobs", category: "Продукты", quantity: 150, price: 800.50, description: "Натуральный молотый кофе", location: "Склад Д, секция 1", date: "2026-04-15" },
    { id: baseId + 18, code: "FOOD-003", name: "Печенье овсяное", category: "Продукты", quantity: 300, price: 120.00, description: "Овсяное печенье в упаковке", location: "Склад Д, секция 2", date: "2026-04-16" },
    { id: baseId + 19, code: "STAT-001", name: "Бумага А4", category: "Канцелярия", quantity: 500, price: 350.00, description: "Бумага для принтера, 500 листов", location: "Склад А, стеллаж 20", date: "2026-03-01" },
    { id: baseId + 20, code: "STAT-002", name: "Ручки шариковые", category: "Канцелярия", quantity: 1000, price: 25.00, description: "Синие шариковые ручки", location: "Склад А, стеллаж 21", date: "2026-03-01" },
    { id: baseId + 21, code: "STAT-003", name: "Степлер", category: "Канцелярия", quantity: 45, price: 450.00, description: "Мощный офисный степлер", location: "Склад А, стеллаж 22", date: "2026-03-02" },
    { id: baseId + 22, code: "STAT-004", name: "Скрепки (коробка)", category: "Канцелярия", quantity: 300, price: 80.00, description: "Металлические скрепки, 100 шт", location: "Склад А, стеллаж 22", date: "2026-03-02" },
    { id: baseId + 23, code: "HARD-001", name: "Клавиатура Logitech", category: "Компьютерная периферия", quantity: 35, price: 3500.00, description: "Беспроводная клавиатура", location: "Склад А, стеллаж 6", date: "2026-04-05" },
    { id: baseId + 24, code: "HARD-002", name: "Мышь компьютерная", category: "Компьютерная периферия", quantity: 40, price: 1500.00, description: "Оптическая мышь USB", location: "Склад А, стеллаж 6", date: "2026-04-05" },
    { id: baseId + 25, code: "HARD-003", name: "Веб-камера", category: "Компьютерная периферия", quantity: 20, price: 4500.00, description: "Full HD веб-камера с микрофоном", location: "Склад А, стеллаж 7", date: "2026-04-06" },
  ];

  products.push(...testProducts);
  saveProducts().then(() => {
    renderProducts();
    updateWriteOffProductsList();
    updateStats();
    showNotification(`Добавлено ${testProducts.length} тестовых изделий! Общее количество: ${products.length}`, "success");
  });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function init() {
  // Загружаем все данные
  await loadAllData();
  
  productForm.addEventListener("submit", addProduct);

  // Инициализация кастомного селекта с поиском
  initWriteOffSelect();

  const writeOffForm = document.getElementById("writeOffForm");
  if (writeOffForm) {
    writeOffForm.addEventListener("submit", writeOffProduct);
    
    document.getElementById("writeOffReason").addEventListener("change", function(e) {
      const otherReasonGroup = document.getElementById("otherReasonGroup");
      if (e.target.value === "Другое") {
        otherReasonGroup.style.display = "block";
      } else {
        otherReasonGroup.style.display = "none";
        document.getElementById("otherReason").value = "";
      }
    });
    
    document.getElementById("clearWriteOffForm").addEventListener("click", function() {
      writeOffForm.reset();
      document.getElementById("writeOffDate").valueAsDate = new Date();
      document.getElementById("writeOffQuantity").value = 1;
      document.getElementById("selectedProductInfo").style.display = "none";
      document.getElementById("writeOffProduct").value = "";
      
      const placeholder = document.querySelector(".custom-select-placeholder");
      if (placeholder) {
        placeholder.textContent = "Выберите изделие для списания";
        placeholder.classList.remove("selected");
      }
      
      showNotification("Форма списания очищена", "info");
    });
    
    document.getElementById("writeOffDate").valueAsDate = new Date();
  }

  searchInput.addEventListener("input", (e) => {
    currentFilter = e.target.value;
    currentPage = 1;
    renderProducts();
  });

  categoryFilter.addEventListener("change", (e) => {
    currentCategory = e.target.value;
    currentPage = 1;
    renderProducts();
  });

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderProducts();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(
      (currentFilter || currentCategory
        ? products.filter(
            (p) =>
              (!currentFilter ||
                p.name.toLowerCase().includes(currentFilter.toLowerCase()) ||
                p.code.toLowerCase().includes(currentFilter.toLowerCase())) &&
              (!currentCategory || p.category === currentCategory),
          ).length
        : products.length) / itemsPerPage,
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderProducts();
    }
  });

  clearFormBtn.addEventListener("click", () => {
    productForm.reset();
    document.getElementById("productDate").valueAsDate = new Date();
    document.getElementById("productQuantity").value = 1;
    showNotification("Форма очищена", "info");
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      closeWriteOffHistory();
    }
  });

  refreshCategories();
  renderProducts();
  updateStats();
  updateWriteOffProductsList();

  if (products.length === 0) {
    generateTestData();
  }
}

document.addEventListener("DOMContentLoaded", init);