let products = [];
let changeHistory = [];
let currentPage = 1;
let currentFilter = "";
let currentCategory = "";

let writeOffHistoryPage = 1;
let writeOffSearchFilter = "";
let writeOffReasonFilterValue = "";

let isEditing = false;
let editingProductCode = null;

const itemsPerPage = 10;

let importData = [];
let importErrors = [];
let importMode = "writeOff";

const categoryPrefixes = {
  Электроника: "ELEC",
  Мебель: "FURN",
  Инструменты: "TOOL",
  Канцелярия: "STAT",
  Продукты: "FOOD",
  Одежда: "CLTH",
  Хозтовары: "HOUS",
  Спорт: "SPRT",
  Авто: "AUTO",
  Стройматериалы: "BUILD",
};

function getElement(id) {
  return document.getElementById(id);
}

const productForm = document.querySelector("form");
const searchInput = getElement("searchInput");
const categoryFilter = getElement("categoryFilter");
const productsList = getElement("productsList");
const summaryQuantity = getElement("summaryQuantity");
const summaryValue = getElement("summaryValue");
const prevPageBtn = getElement("prevPage");
const nextPageBtn = getElement("nextPage");
const pageInfo = getElement("pageInfo");
const clearFormBtn = getElement("clearForm");

const totalProductsEl = getElement("totalProducts");
const totalQuantityEl = getElement("totalQuantity");
const totalValueEl = getElement("totalValue");
const categoriesCountEl = getElement("categoriesCount");

if (getElement("productDate")) getElement("productDate").valueAsDate = new Date();

function getCategoryPrefix(category) {
  if (categoryPrefixes[category]) return categoryPrefixes[category];
  const cleanName = category.toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
  if (cleanName.length >= 4) return cleanName.substring(0, 4);
  if (cleanName.length >= 2) return cleanName.substring(0, 2);
  return "OTHER";
}

function generateProductCode(category, excludeProductId = null) {
  const prefix = getCategoryPrefix(category);
  const existingCodes = products
    .filter((p) => p.code && p.code.startsWith(prefix + "-") && p.id !== excludeProductId)
    .map((p) => parseInt(p.code.split("-")[1]) || 0);
  let nextNumber = 1;
  if (existingCodes.length > 0) nextNumber = Math.max(...existingCodes) + 1;
  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

async function sha1(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkPassword(actionName) {
  const enteredPassword = prompt(`Для выполнения действия "${actionName}" введите пароль:`);
  if (enteredPassword === null) return false;
  const enteredHash = await sha1(enteredPassword);
  const correctHash = await sha1("0000");
  if (enteredHash !== correctHash) {
    showNotification("Неверный пароль! Доступ запрещён.", "error");
    return false;
  }
  return true;
}

function formatNumber(number) {
  if (number === null || number === undefined) return "0";
  let numberStr = String(number).replace(/\s/g, "");
  if (numberStr.includes(".")) {
    const parts = numberStr.split(".");
    const integerPart = parts[0].replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, "$1 ");
    return `${integerPart}.${parts[1]}`;
  }
  return numberStr.replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, "$1 ");
}

function showNotification(message, type = "info") {
  document.querySelectorAll(".notification").forEach((n) => n.remove());
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">&times;</button>`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().split(" ")[0],
    datetime: now.toISOString(),
  };
}

function resetEditMode() {
  isEditing = false;
  editingProductCode = null;
  const codeInput = getElement("productCode");
  if (codeInput) {
    codeInput.style.backgroundColor = "";
    codeInput.title = "";
    codeInput.readOnly = false;
  }
  const submitBtn = productForm ? productForm.querySelector('button[type="submit"]') : null;
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изделие';
    submitBtn.style.background = "";
    submitBtn.style.borderColor = "";
  }
  const category = getElement("productCategory");
  if (category && category.value && getElement("productCode")) {
    getElement("productCode").value = generateProductCode(category.value);
  }
}

async function saveToStorage(key, value) {
  try {
    await localforage.setItem(key, value);
  } catch (error) {
    console.error("Ошибка сохранения:", error);
  }
}

async function loadFromStorage(key) {
  try {
    return (await localforage.getItem(key)) || [];
  } catch (error) {
    console.error("Ошибка загрузки:", error);
    return [];
  }
}

async function loadAllData() {
  const results = await Promise.all([
    loadFromStorage("products"),
    loadFromStorage("changeHistory"),
  ]);
  products = results[0];
  changeHistory = results[1];
}

function addHistoryRecord(recordData) {
  changeHistory.push(recordData);
  saveToStorage("changeHistory", changeHistory);
}

function createHistoryRecord(type, product, oldProduct, changes) {
  const record = {
    id: Date.now(),
    type: type,
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    category: product.category,
    quantity: product.quantity,
    price: product.price,
    totalCost: product.quantity * product.price,
    reason: "",
    date: getCurrentDateTime().date,
    time: getCurrentDateTime().time,
    location: product.location,
    description: product.description || "Описание отсутствует",
    oldQuantity: changes && changes.quantity ? oldProduct.quantity : null,
    oldPrice: changes && changes.price ? oldProduct.price : null,
    oldCode: changes && changes.code ? oldProduct.code : null,
    oldCategory: changes && changes.category ? oldProduct.category : null,
    oldLocation: changes && changes.location ? oldProduct.location : null,
  };
  addHistoryRecord(record);
}

function refreshCategories() {
  const categorySelect = getElement("productCategory");
  const filterSelect = getElement("categoryFilter");
  if (!categorySelect || !filterSelect) return;
  
  const currentFormValue = categorySelect.value;
  const currentFilterValue = filterSelect.value;
  
  while (categorySelect.options.length > 1) categorySelect.remove(1);
  while (filterSelect.options.length > 1) filterSelect.remove(1);
  
  const uniqueCategories = [...new Set(products.map((p) => p.category))];
  uniqueCategories.sort((a, b) => a.localeCompare(b, "ru"));
  
  uniqueCategories.forEach((category) => {
    if (category && category.trim() !== "") {
      const prefix = getCategoryPrefix(category);
      const formOption = document.createElement("option");
      formOption.value = category;
      formOption.textContent = `${category} (${prefix})`;
      categorySelect.appendChild(formOption);
      
      const filterOption = document.createElement("option");
      filterOption.value = category;
      filterOption.textContent = category;
      filterSelect.appendChild(filterOption);
    }
  });
  
  if (currentFormValue && uniqueCategories.includes(currentFormValue))
    categorySelect.value = currentFormValue;
  if (currentFilterValue && uniqueCategories.includes(currentFilterValue))
    filterSelect.value = currentFilterValue;
  else filterSelect.value = "";
}

function readFormData() {
  const category = getElement("productCategory") ? getElement("productCategory").value : "";
  let code = getElement("productCode") ? getElement("productCode").value.trim() : "";
  const name = getElement("productName") ? getElement("productName").value.trim() : "";
  
  return {
    id: Date.now(),
    code: code,
    name: name,
    category: category,
    quantity: getElement("productQuantity") ? parseInt(getElement("productQuantity").value) || 0 : 0,
    price: getElement("productPrice") ? parseFloat(getElement("productPrice").value) || 0 : 0,
    description: getElement("productDescription") ? getElement("productDescription").value.trim() : "",
    location: getElement("productLocation") ? getElement("productLocation").value.trim() : "",
    date: getElement("productDate") ? getElement("productDate").value : "",
  };
}

function fillFormData(product) {
  if (getElement("productCode")) getElement("productCode").value = product.code;
  if (getElement("productName")) getElement("productName").value = product.name;
  if (getElement("productCategory")) getElement("productCategory").value = product.category;
  if (getElement("productQuantity")) getElement("productQuantity").value = product.quantity;
  if (getElement("productPrice")) getElement("productPrice").value = product.price;
  if (getElement("productDescription")) getElement("productDescription").value = product.description;
  if (getElement("productLocation")) getElement("productLocation").value = product.location;
  if (getElement("productDate")) getElement("productDate").value = product.date;
}

function resetForm() {
  if (productForm) productForm.reset();
  if (getElement("productDate")) getElement("productDate").valueAsDate = new Date();
  if (getElement("productQuantity")) getElement("productQuantity").value = 1;
  const category = getElement("productCategory");
  if (category && category.value && getElement("productCode")) {
    getElement("productCode").value = generateProductCode(category.value);
  } else if (getElement("productCode")) {
    getElement("productCode").value = "";
  }
}

function detectChanges(oldProduct, newProduct) {
  const changes = {};
  if (oldProduct.code !== newProduct.code) changes.code = true;
  if (oldProduct.name !== newProduct.name) changes.name = true;
  if (oldProduct.category !== newProduct.category) changes.category = true;
  if (oldProduct.quantity !== newProduct.quantity) changes.quantity = true;
  if (oldProduct.price !== newProduct.price) changes.price = true;
  if (oldProduct.description !== newProduct.description) changes.description = true;
  if (oldProduct.location !== newProduct.location) changes.location = true;
  return changes;
}

function updateExistingProduct(existing, newData) {
  const oldQuantity = existing.quantity;
  const oldPrice = existing.price;
  const changes = {};
  
  existing.quantity = oldQuantity + newData.quantity;
  changes.quantity = true;
  
  if (newData.price && newData.price !== existing.price) {
    const totalOldCost = oldQuantity * oldPrice;
    const totalNewCost = newData.quantity * newData.price;
    existing.price = Math.round(((totalOldCost + totalNewCost) / existing.quantity) * 100) / 100;
    changes.price = true;
  }
  
  if (newData.description && newData.description !== existing.description) {
    existing.description = newData.description;
    changes.description = true;
  }
  
  if (newData.location && newData.location !== existing.location) {
    existing.location = newData.location;
    changes.location = true;
  }
  
  return changes;
}

// ОСНОВНАЯ ИСПРАВЛЕННАЯ ФУНКЦИЯ
async function addProduct(event) {
  event.preventDefault();
  const product = readFormData();
  
  if (!product.name) {
    showNotification("Введите название изделия!", "error");
    return;
  }
  
  if (!product.category) {
    showNotification("Выберите категорию!", "error");
    return;
  }
  
  if (product.quantity <= 0) {
    showNotification("Количество должно быть больше 0!", "error");
    return;
  }
  
  if (product.price <= 0) {
    showNotification("Цена должна быть больше 0!", "error");
    return;
  }
  
  // Ищем существующий товар по имени (игнорируя регистр)
  const existingByName = products.find(p => 
    p.name && product.name && 
    p.name.toLowerCase() === product.name.toLowerCase()
  );
  
  // Если товар с таким названием уже существует
  if (existingByName && !isEditing) {
    // Используем категорию из существующего товара
    if (existingByName.category !== product.category) {
      showNotification(`Категория изменена с "${product.category}" на "${existingByName.category}" (категория существующего товара)`, "warning");
      product.category = existingByName.category;
    }
    
    const oldValues = { ...existingByName };
    const oldQuantity = existingByName.quantity;
    const oldPrice = existingByName.price;
    
    // Обновляем количество
    existingByName.quantity = oldQuantity + product.quantity;
    
    // Обновляем цену (средневзвешенная)
    if (product.price && product.price !== existingByName.price) {
      const totalOldCost = oldQuantity * oldPrice;
      const totalNewCost = product.quantity * product.price;
      existingByName.price = Math.round(((totalOldCost + totalNewCost) / existingByName.quantity) * 100) / 100;
    }
    
    // Обновляем описание, если новое не пустое
    if (product.description && product.description.trim() !== "") {
      existingByName.description = product.description;
    }
    
    // Обновляем место хранения, если новое не пустое
    if (product.location && product.location.trim() !== "") {
      existingByName.location = product.location;
    }
    
    // Обновляем дату, если новая позже
    if (product.date && product.date > existingByName.date) {
      existingByName.date = product.date;
    }
    
    // Создаем запись об обновлении
    createHistoryRecord("update", existingByName, oldValues, {
      quantity: oldQuantity !== existingByName.quantity,
      price: oldPrice !== existingByName.price
    });
    
    await saveToStorage("products", products);
    refreshAll();
    resetForm();
    resetEditMode();
    showNotification(`Обновлено: "${product.name}" - добавлено ${product.quantity} шт. Теперь всего ${existingByName.quantity} шт., цена ${formatNumber(existingByName.price.toFixed(2))} руб.`, "success");
    return;
  }
  
  // Поиск по коду при редактировании
  if (isEditing) {
    const oldProduct = products.find((p) => p.code === editingProductCode);
    if (oldProduct) {
      const oldValues = { ...oldProduct };
      if (oldValues.category !== product.category) {
        product.code = generateProductCode(product.category, oldProduct.id);
      }
      Object.assign(oldProduct, product, { id: oldProduct.id });
      const changes = detectChanges(oldValues, oldProduct);
      createHistoryRecord("update", oldProduct, oldValues, changes);
      await saveToStorage("products", products);
      refreshAll();
      resetForm();
      resetEditMode();
      showNotification(`Изделие "${product.name}" обновлено!`, "success");
      return;
    }
  }
  
  // Проверка на существующий код
  const codeExists = products.some((p) => p.code === product.code && p.id !== product.id);
  if (codeExists && !isEditing) {
    product.code = generateProductCode(product.category);
    showNotification(`Код был изменен на ${product.code}`, "warning");
  }
  
  // Добавление нового товара
  if (!isEditing && (!product.code || product.code === "")) {
    product.code = generateProductCode(product.category);
  }
  
  product.id = Date.now();
  products.push(product);
  createHistoryRecord("add", product);
  await saveToStorage("products", products);
  refreshAll();
  resetForm();
  resetEditMode();
  showNotification(`Изделие "${product.name}" успешно добавлено!`, "success");
}

async function deleteProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  if (confirm("Вы уверены, что хотите удалить это изделие?")) {
    createHistoryRecord("delete", product);
    products = products.filter((p) => p.id !== id);
    await saveToStorage("products", products);
    refreshAll();
    showNotification(`Изделие "${product.name}" удалено!`, "warning");
  }
}

async function editProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  isEditing = true;
  editingProductCode = product.code;
  fillFormData(product);
  const codeInput = getElement("productCode");
  if (codeInput) {
    codeInput.style.backgroundColor = "#fff3cd";
    codeInput.title = "Код можно изменить вручную";
  }
  const submitBtn = productForm ? productForm.querySelector('button[type="submit"]') : null;
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
    submitBtn.style.background = "#f59e0b";
    submitBtn.style.borderColor = "#f59e0b";
  }
  if (productForm) productForm.scrollIntoView({ behavior: "smooth" });
  showNotification("Редактирование изделия - внесите изменения и нажмите Сохранить", "info");
}

function refreshAll() {
  renderProducts();
  updateWriteOffProductsList();
  refreshCategories();
  updateStats();
}

function renderProducts() {
  let filteredProducts = [...products];
  if (currentFilter) {
    const searchLower = currentFilter.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(searchLower)) ||
        (p.code && p.code.toLowerCase().includes(searchLower)) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
    );
  }
  if (currentCategory)
    filteredProducts = filteredProducts.filter(
      (p) => p.category === currentCategory
    );
  
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageProducts = filteredProducts.slice(startIndex, endIndex);
  
  if (!productsList) return;
  
  if (pageProducts.length === 0) {
    productsList.innerHTML = `<tr><td colspan="7" class="text-center py-4"><i class="fas fa-box-open fa-2x mb-2" style="color: #ccc;"></i><p>Нет изделий для отображения</p></td></tr>`;
  } else {
    productsList.innerHTML = pageProducts
      .map((product) => {
        const totalCost = product.quantity * product.price;
        return `<tr>
          <td>${product.code || '---'}</td>
          <td>${product.name || '---'}</td>
          <td><span class="category-badge" style="display: inline-block; padding: 4px 10px; background: #e0f2fe; color: #0369a1; border-radius: 12px; font-size: 0.85em;">${product.category || '---'}</span></td>
          <td>${formatNumber(product.quantity)}</td>
          <td>${formatNumber(product.price.toFixed(2))} руб.</td>
          <td><strong>${formatNumber(totalCost.toFixed(2))} руб.</strong></td>
          <td>
            <button onclick="editProduct(${product.id})" class="btn-edit" style="border: none; border-radius: 6px; background: #dbeafe; color: #1d4ed8; width: 36px; height: 36px; margin-right: 5px;"><i class="fas fa-edit"></i></button>
            <button onclick="deleteProduct(${product.id})" class="btn-delete" style="border: none; border-radius: 6px; background: #fee2e2; color: #dc2626; width: 36px; height: 36px;"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      })
      .join("");
  }
  
  const totalQuantitySum = filteredProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalValueSum = filteredProducts.reduce((sum, p) => sum + p.quantity * p.price, 0);
  if (summaryQuantity) summaryQuantity.textContent = formatNumber(totalQuantitySum);
  if (summaryValue) summaryValue.textContent = formatNumber(totalValueSum.toFixed(2));
  if (pageInfo) pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function updateStats() {
  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
  const uniqueCategories = new Set(products.map((p) => p.category));
  
  if (totalProductsEl) totalProductsEl.textContent = formatNumber(totalProducts);
  if (totalQuantityEl) totalQuantityEl.textContent = formatNumber(totalQuantity);
  if (totalValueEl) totalValueEl.textContent = formatNumber(totalValue.toFixed(2));
  if (categoriesCountEl) categoriesCountEl.textContent = formatNumber(uniqueCategories.size);
}

function newCategories() {
  const newCategory = prompt("Введите название новой категории:");
  if (newCategory && newCategory.trim() !== "") {
    const trimmedCategory = newCategory.trim();
    const existingCategories = [...new Set(products.map((p) => p.category))];
    if (!existingCategories.includes(trimmedCategory)) {
      const categorySelect = getElement("productCategory");
      const filterSelect = getElement("categoryFilter");
      if (categorySelect && filterSelect) {
        const prefix = getCategoryPrefix(trimmedCategory);
        const formOption = document.createElement("option");
        formOption.value = trimmedCategory;
        formOption.textContent = `${trimmedCategory} (${prefix})`;
        categorySelect.appendChild(formOption);
        
        const filterOption = document.createElement("option");
        filterOption.value = trimmedCategory;
        filterOption.textContent = trimmedCategory;
        filterSelect.appendChild(filterOption);
        
        categorySelect.value = trimmedCategory;
        if (getElement("productCode")) {
          getElement("productCode").value = generateProductCode(trimmedCategory);
        }
        showNotification(`Категория "${trimmedCategory}" добавлена! Префикс: ${prefix}`, "success");
      }
    } else {
      showNotification("Такая категория уже существует!", "error");
    }
  }
}

function toggleSelect() {
  const container = document.querySelector(".custom-options-container");
  if (container) {
    if (container.style.display === "none") openSelect();
    else closeSelect();
  }
}

function openSelect() {
  const select = getElement("writeOffProductSelect");
  if (!select) return;
  const container = select.querySelector(".custom-options-container");
  if (container) {
    select.classList.add("open");
    container.style.display = "block";
    setTimeout(() => {
      const searchInput = getElement("productSearchInput");
      if (searchInput) {
        searchInput.focus();
        searchInput.value = "";
        filterProducts("");
      }
    }, 100);
    document.addEventListener("click", handleOutsideClick);
  }
}

function closeSelect() {
  const select = getElement("writeOffProductSelect");
  if (!select) return;
  const container = select.querySelector(".custom-options-container");
  if (container) {
    select.classList.remove("open");
    container.style.display = "none";
    document.removeEventListener("click", handleOutsideClick);
  }
}

function handleOutsideClick(event) {
  const select = getElement("writeOffProductSelect");
  if (select && !select.contains(event.target)) closeSelect();
}

function filterProducts(searchTerm) {
  const optionsContainer = getElement("writeOffProductOptions");
  if (!optionsContainer) return;
  
  const searchLower = searchTerm.toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      p.quantity > 0 &&
      (!searchTerm ||
        (p.name && p.name.toLowerCase().includes(searchLower)) ||
        (p.code && p.code.toLowerCase().includes(searchLower)) ||
        (p.category && p.category.toLowerCase().includes(searchLower)))
  );
  
  if (searchTerm) {
    filteredProducts.sort((a, b) => {
      const aM = a.name && a.name.toLowerCase().includes(searchLower);
      const bM = b.name && b.name.toLowerCase().includes(searchLower);
      if (aM && !bM) return -1;
      if (!aM && bM) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  } else {
    filteredProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  
  if (filteredProducts.length === 0) {
    optionsContainer.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><p>Ничего не найдено</p>${searchTerm ? "<small>Попробуйте изменить запрос</small>" : "<small>Нет доступных изделий</small>"}</div>`;
  } else {
    optionsContainer.innerHTML = filteredProducts
      .map((product) => {
        const quantityClass = product.quantity <= 5 ? "low" : "";
        return `<div class="custom-option" onclick="selectProduct(${product.id}, '${(product.name || '').replace(/'/g, "\\'")}', ${product.quantity})" data-product-id="${product.id}">
          <div class="option-info">
            <span class="option-name">${highlightMatch(product.name || '', searchTerm)}</span>
            <span class="option-details">${highlightMatch(product.code || '', searchTerm)} - ${product.category || ''}</span>
          </div>
          <span class="option-quantity ${quantityClass}">${formatNumber(product.quantity)} шт.</span>
        </div>`;
      })
      .join("");
  }
}

function highlightMatch(text, searchTerm) {
  if (!searchTerm || !text) return text;
  const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedSearch})`, "gi");
  return text.replace(regex, '<strong style="background: #fff59d; padding: 0 2px;">$1</strong>');
}

function selectProduct(productId, productName, quantity) {
  const productIdInput = getElement("writeOffProduct");
  if (productIdInput) productIdInput.value = productId;
  
  const placeholder = document.querySelector(".custom-select-placeholder");
  if (placeholder) {
    placeholder.textContent = productName;
    placeholder.classList.add("selected");
  }
  
  document.querySelectorAll(".custom-option").forEach((opt) => opt.classList.remove("selected"));
  const selectedOption = document.querySelector(`[data-product-id="${productId}"]`);
  if (selectedOption) selectedOption.classList.add("selected");
  
  closeSelect();
  showProductInfo(productId);
  
  const writeOffQuantity = getElement("writeOffQuantity");
  if (writeOffQuantity) {
    writeOffQuantity.max = quantity;
    if (parseInt(writeOffQuantity.value) > quantity) writeOffQuantity.value = quantity;
  }
}

function updateWriteOffProductsList() {
  const searchInput = getElement("productSearchInput");
  const currentSearch = searchInput ? searchInput.value : "";
  filterProducts(currentSearch);
  
  const selectedId = getElement("writeOffProduct");
  if (selectedId && selectedId.value) {
    const product = products.find((p) => p.id == selectedId.value);
    if (!product || product.quantity <= 0) {
      selectedId.value = "";
      const placeholder = document.querySelector(".custom-select-placeholder");
      if (placeholder) {
        placeholder.textContent = "Выберите изделие для списания";
        placeholder.classList.remove("selected");
      }
      const infoBlock = getElement("selectedProductInfo");
      if (infoBlock) infoBlock.style.display = "none";
    }
  }
}

function initWriteOffSelect() {
  updateWriteOffProductsList();
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      const container = document.querySelector(".custom-options-container");
      if (container && container.style.display !== "none") closeSelect();
      closeImportModal();
    }
  });
  const optionsContainer = document.querySelector(".custom-options-container");
  if (optionsContainer) optionsContainer.addEventListener("click", (e) => e.stopPropagation());
  const searchInput = getElement("productSearchInput");
  if (searchInput) searchInput.addEventListener("click", (e) => e.stopPropagation());
}

function showProductInfo(productId) {
  const infoBlock = getElement("selectedProductInfo");
  if (!infoBlock) return;
  
  if (!productId) {
    infoBlock.style.display = "none";
    return;
  }
  
  const product = products.find((p) => p.id == productId);
  if (!product) {
    infoBlock.style.display = "none";
    return;
  }
  
  const infoCode = getElement("infoCode");
  const infoCategory = getElement("infoCategory");
  const infoQuantity = getElement("infoQuantity");
  const infoPrice = getElement("infoPrice");
  const infoLocation = getElement("infoLocation");
  
  if (infoCode) infoCode.textContent = product.code || '---';
  if (infoCategory) infoCategory.textContent = product.category || '---';
  if (infoQuantity) infoQuantity.textContent = formatNumber(product.quantity);
  if (infoPrice) infoPrice.textContent = formatNumber(product.price.toFixed(2));
  if (infoLocation) infoLocation.textContent = product.location || "Не указано";
  
  infoBlock.style.display = "block";
  
  const writeOffQuantity = getElement("writeOffQuantity");
  if (writeOffQuantity) {
    writeOffQuantity.max = product.quantity;
    if (parseInt(writeOffQuantity.value) > product.quantity) writeOffQuantity.value = product.quantity;
  }
}

async function writeOffProduct(event) {
  event.preventDefault();
  
  const productIdInput = getElement("writeOffProduct");
  const productId = productIdInput ? parseInt(productIdInput.value) : null;
  const quantityInput = getElement("writeOffQuantity");
  const quantity = quantityInput ? parseInt(quantityInput.value) : 0;
  const reasonSelect = getElement("writeOffReason");
  let reason = reasonSelect ? reasonSelect.value : "";
  const otherReasonInput = getElement("otherReason");
  const otherReason = otherReasonInput ? otherReasonInput.value : "";
  const dateInput = getElement("writeOffDate");
  const date = dateInput ? dateInput.value : "";
  
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
  
  const productIndex = products.findIndex((p) => p.id === productId);
  if (productIndex === -1) {
    showNotification("Изделие не найдено!", "error");
    return;
  }
  if (quantity > products[productIndex].quantity) {
    showNotification(`Недостаточно изделий на складе! Доступно: ${products[productIndex].quantity} шт.`, "error");
    return;
  }
  
  const product = products[productIndex];
  await performWriteOff(product, quantity, reason, date);
  refreshAll();
  
  const writeOffForm = getElement("writeOffForm");
  if (writeOffForm) writeOffForm.reset();
  if (getElement("writeOffDate")) getElement("writeOffDate").valueAsDate = new Date();
  if (getElement("writeOffQuantity")) getElement("writeOffQuantity").value = 1;
  
  const infoBlock = getElement("selectedProductInfo");
  if (infoBlock) infoBlock.style.display = "none";
  
  const placeholder = document.querySelector(".custom-select-placeholder");
  if (placeholder) {
    placeholder.textContent = "Выберите изделие для списания";
    placeholder.classList.remove("selected");
  }
  
  showNotification(`Списано ${quantity} шт. изделия "${product.name}". Причина: ${reason}`, "success");
}

async function performWriteOff(product, quantity, reason, date) {
  const totalCost = quantity * product.price;
  const operationRecord = {
    id: Date.now(),
    type: "writeOff",
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    category: product.category,
    quantity: quantity,
    price: product.price,
    totalCost: totalCost,
    reason: reason,
    date: date,
    time: getCurrentDateTime().time,
    location: product.location,
    description: product.description || "Описание отсутствует",
    oldQuantity: null,
    oldPrice: null,
    oldCode: null,
    oldCategory: null,
    oldLocation: null,
  };
  changeHistory.push(operationRecord);
  product.quantity -= quantity;
  if (product.quantity === 0) {
    const index = products.findIndex((p) => p.id === product.id);
    if (index !== -1) products.splice(index, 1);
  }
}

function downloadTemplate() {
  const templateData = [
    ["Код изделия", "Название", "Категория", "Количество", "Цена (руб.)", "Описание", "Место хранения", "Дата"],
    ["ELEC-003", "Ноутбук Dell XPS", "Электроника", "2", "89999.99", "Игровой ноутбук", "Склад А, стеллаж 3", "2026-05-19"],
    ["TOOL-003", "Дрель электрическая", "Инструменты", "1", "4599", "Мощная дрель", "Склад В, ячейка 15", "2026-05-19"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  ws["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Накладная (добавление)");
  XLSX.writeFile(wb, "Шаблон_накладной_добавление.xlsx");
  showNotification("Шаблон накладной скачан", "success");
}

function downloadTemplateWriteOff() {
  const templateData = [
    ["Код изделия", "Название", "Количество", "Причина списания", "Дата"],
    ["ELEC-001", "Ноутбук Dell XPS", "2", "Продажа", "2026-05-19"],
    ["TOOL-001", "Дрель электрическая", "1", "Перемещение", "2026-05-19"],
    ["STAT-001", "Бумага А4", "50", "Инвентаризация", "2026-05-19"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  ws["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Накладная (списание)");
  XLSX.writeFile(wb, "Шаблон_накладной_списание.xlsx");
  showNotification("Шаблон накладной скачан", "success");
}

function importFromExcel() {
  importMode = "writeOff";
  _openExcelFile();
}

function importFromExcelAdd() {
  importMode = "add";
  _openExcelFile();
}

function _openExcelFile() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".xlsx,.xls";
  fileInput.style.display = "none";
  fileInput.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    showNotification("Чтение файла...", "info");
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        if (jsonData.length < 2) {
          showNotification("Файл пуст или содержит только заголовки", "error");
          return;
        }
        if (importMode === "writeOff") parseImportDataWriteOff(jsonData);
        else parseImportDataAdd(jsonData);
        showImportModal();
      } catch (error) {
        showNotification("Ошибка чтения файла", "error");
      }
    };
    reader.onerror = function () {
      showNotification("Ошибка чтения файла", "error");
    };
    reader.readAsArrayBuffer(file);
  };
  fileInput.click();
}

function parseImportDataAdd(rawData) {
  importData = [];
  importErrors = [];
  const headers = rawData[0].map((h) => String(h || "").toLowerCase().trim());
  const codeIndex = headers.findIndex((h) => h.includes("код") || h === "code");
  const nameIndex = headers.findIndex((h) => h.includes("назван") || h.includes("наименован") || h === "name");
  const categoryIndex = headers.findIndex((h) => h.includes("категор") || h === "category");
  const quantityIndex = headers.findIndex((h) => h.includes("колич") || h === "quantity");
  const priceIndex = headers.findIndex((h) => h.includes("цен") || h === "price");
  const descIndex = headers.findIndex((h) => h.includes("описан") || h === "description");
  const locIndex = headers.findIndex((h) => h.includes("мест") || h === "location");
  const dateIndex = headers.findIndex((h) => h.includes("дат") || h === "date");
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    
    const code = String(row[codeIndex] || "").trim();
    const name = String(row[nameIndex] || "").trim();
    const category = String(row[categoryIndex] || "").trim();
    const quantity = parseInt(row[quantityIndex]) || 0;
    const price = parseFloat(row[priceIndex]) || 0;
    const description = String(row[descIndex] || "").trim();
    const location = String(row[locIndex] || "").trim();
    const date = formatExcelDate(row[dateIndex]);
    
    if (!code || !name || quantity <= 0) continue;
    
    const item = { code, name, category, quantity, price, description, location, date, status: "success", errors: [] };
    
    if (!category) {
      item.status = "error";
      item.errors.push("Категория обязательна");
    }
    if (!price || price <= 0) {
      item.status = "error";
      item.errors.push("Цена обязательна и должна быть больше 0");
    }
    if (!date && item.status !== "error") {
      item.status = "warning";
      item.errors.push("Некорректная дата");
    }
    importData.push(item);
  }
}

function parseImportDataWriteOff(rawData) {
  importData = [];
  importErrors = [];
  const headers = rawData[0].map((h) => String(h || "").toLowerCase().trim());
  const codeIndex = headers.findIndex((h) => h.includes("код") || h === "code");
  const nameIndex = headers.findIndex((h) => h.includes("назван") || h === "name");
  const quantityIndex = headers.findIndex((h) => h.includes("колич") || h === "quantity");
  const reasonIndex = headers.findIndex((h) => h.includes("причин") || h === "reason");
  const dateIndex = headers.findIndex((h) => h.includes("дат") || h === "date");
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    const code = String(row[codeIndex] || "").trim();
    const name = String(row[nameIndex] || "").trim();
    const quantity = parseInt(row[quantityIndex]) || 0;
    const reason = String(row[reasonIndex] || "").trim();
    const date = formatExcelDate(row[dateIndex]);
    if (!code) continue;
    
    const item = { code, name: name || "Не указано", quantity, reason: reason || "Не указана", date, status: "pending", errors: [] };
    const product = products.find((p) => p.code === code);
    
    if (!product) {
      item.status = "error";
      item.errors.push(`Товар "${code}" не найден`);
      item.category = "-";
      item.availableQuantity = 0;
      item.price = 0;
      item.description = "";
      item.location = "";
    } else {
      item.category = product.category;
      item.availableQuantity = product.quantity;
      item.productId = product.id;
      item.price = product.price;
      item.description = product.description || "";
      item.location = product.location || "";
      
      if (quantity <= 0) {
        item.status = "error";
        item.errors.push("Количество должно быть > 0");
      } else if (quantity > product.quantity) {
        item.status = "warning";
        item.errors.push(`Недостаточно (доступно: ${product.quantity})`);
      } else if (item.errors.length === 0) {
        item.status = "success";
      }
    }
    importData.push(item);
  }
}

function formatExcelDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === "number") {
    const d = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  if (typeof excelDate === "string") {
    const m = excelDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const d = new Date(excelDate);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function showImportModal() {
  const modal = getElement("importModal");
  if (!modal) return;
  const summary = getElement("importSummary");
  const tbody = getElement("importPreviewBody");
  
  if (importMode === "add") {
    const successCount = importData.filter((i) => i.status === "success").length;
    const errorCount = importData.filter((i) => i.status === "error").length;
    const warningCount = importData.filter((i) => i.status === "warning").length;
    
    if (summary) {
      summary.innerHTML = `<span style="background:#10b981;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Успешно: ${successCount}</span>
        <span style="background:#f59e0b;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Предупреждения: ${warningCount}</span>
        <span style="background:#ef4444;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Ошибки: ${errorCount}</span>`;
    }
    
    if (tbody) {
      tbody.innerHTML = importData.map((item) => `
        <tr style="${item.status === "error" ? "background:#fee2e2" : item.status === "warning" ? "background:#fef3c7" : ""}">
          <td><strong>${item.code}</strong></td>
          <td>${item.name}</td>
          <td>${item.category || '<span style="color:#ef4444">не указана</span>'}</td>
          <td><strong>${item.quantity}</strong></td>
          <td>${item.price ? formatNumber(item.price.toFixed(2)) + " руб." : '<span style="color:#ef4444">не указана</span>'}</td>
          <td>${item.description || "-"}</td>
          <td>${item.location || "-"}</td>
          <td>${item.date || "-"}</td>
        </tr>
      `).join("");
    }
    
    const confirmBtn = getElement("confirmImportBtn");
    if (confirmBtn) {
      confirmBtn.disabled = successCount === 0;
      confirmBtn.textContent = `Добавить (${successCount} позиций)`;
    }
  } else {
    const successCount = importData.filter((i) => i.status === "success").length;
    const warningCount = importData.filter((i) => i.status === "warning").length;
    const errorCount = importData.filter((i) => i.status === "error").length;
    
    if (summary) {
      summary.innerHTML = `<span style="background:#10b981;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Успешно: ${successCount}</span>
        <span style="background:#f59e0b;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Предупреждения: ${warningCount}</span>
        <span style="background:#ef4444;color:white;padding:8px 15px;border-radius:5px;margin:5px;display:inline-block;">Ошибки: ${errorCount}</span>`;
    }
    
    if (tbody) {
      tbody.innerHTML = importData.map((item) => `
        <tr style="${item.status === "error" ? "background:#fee2e2" : item.status === "warning" ? "background:#fef3c7" : ""}">
          <td><strong>${item.code}</strong></td>
          <td>${item.name}</td>
          <td>${item.category || "-"}</td>
          <td><strong>${item.quantity}</strong></td>
          <td>${item.price ? formatNumber(item.price.toFixed(2)) + " руб." : "-"}</td>
          <td>${item.description || "-"}</td>
          <td>${item.location || "-"}</td>
          <td>${item.date || "-"}</td>
        </tr>
      `).join("");
    }
    
    const confirmBtn = getElement("confirmImportBtn");
    if (confirmBtn) {
      confirmBtn.disabled = successCount === 0;
      confirmBtn.textContent = `Списать (${successCount} позиций)`;
    }
  }
  modal.style.display = "block";
}

function closeImportModal() {
  const modal = getElement("importModal");
  if (modal) modal.style.display = "none";
  importData = [];
  importErrors = [];
}

async function confirmImport() {
  if (importMode === "add") {
    let addedCount = 0;
    for (const item of importData) {
      if (item.status !== "success") continue;
      
      const existing = products.find((p) => p.code === item.code);
      if (existing) {
        const oldQuantity = existing.quantity;
        const oldPrice = existing.price;
        existing.quantity += item.quantity;
        if (item.price && item.price !== existing.price) {
          const totalOld = oldQuantity * oldPrice;
          const totalNew = item.quantity * item.price;
          existing.price = Math.round(((totalOld + totalNew) / existing.quantity) * 100) / 100;
        }
        if (item.description) existing.description = item.description;
        if (item.location) existing.location = item.location;
        if (item.category) existing.category = item.category;
        createHistoryRecord("update", existing, { quantity: oldQuantity, price: oldPrice }, { quantity: true, price: item.price !== oldPrice });
      } else {
        const newProduct = {
          id: Date.now() + Math.random(),
          code: item.code || generateProductCode(item.category || "Прочее"),
          name: item.name,
          category: item.category || "Прочее",
          quantity: item.quantity,
          price: item.price || 0,
          description: item.description || "",
          location: item.location || "",
          date: item.date || getCurrentDateTime().date,
        };
        products.push(newProduct);
        createHistoryRecord("add", newProduct);
      }
      addedCount++;
    }
    await saveToStorage("products", products);
    await saveToStorage("changeHistory", changeHistory);
    refreshAll();
    closeImportModal();
    showNotification(`Добавлено ${addedCount} позиций`, "success");
  } else {
    const successItems = importData.filter((i) => i.status === "success");
    let writtenOffCount = 0;
    for (const item of successItems) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.quantity >= item.quantity) {
        await performWriteOff(product, item.quantity, item.reason, item.date);
        writtenOffCount++;
      }
    }
    await saveToStorage("products", products);
    await saveToStorage("changeHistory", changeHistory);
    refreshAll();
    closeImportModal();
    showNotification(`Списано ${writtenOffCount} позиций`, "success");
  }
}

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(timeString) {
  return timeString ? timeString.substring(0, 5) : "";
}

function showWriteOffHistory() {
  const modal = getElement("writeOffHistoryModal");
  if (!modal) return;
  checkPassword("Просмотр истории операций").then((hasAccess) => {
    if (!hasAccess) return;
    writeOffHistoryPage = 1;
    writeOffSearchFilter = "";
    writeOffReasonFilterValue = "";
    const si = getElement("writeOffSearchInput");
    if (si) si.value = "";
    const rf = getElement("writeOffReasonFilter");
    if (rf) rf.value = "";
    modal.style.display = "block";
    setTimeout(() => renderWriteOffHistory(), 100);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeWriteOffHistory();
    });
  });
}

function closeWriteOffHistory() {
  const m = getElement("writeOffHistoryModal");
  if (m) m.style.display = "none";
}

function searchWriteOffHistory(v) {
  writeOffSearchFilter = v.toLowerCase();
  writeOffHistoryPage = 1;
  renderWriteOffHistory();
}

function filterWriteOffHistory() {
  const rf = getElement("writeOffReasonFilter");
  writeOffReasonFilterValue = rf ? rf.value : "";
  writeOffHistoryPage = 1;
  renderWriteOffHistory();
}

function renderWriteOffHistory() {
  const historyList = getElement("writeOffHistoryList");
  if (!historyList) return;
  
  let allHistory = [...changeHistory];
  if (writeOffSearchFilter) {
    allHistory = allHistory.filter((r) =>
      (r.productName || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.productCode || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.description || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.reason || "").toLowerCase().includes(writeOffSearchFilter)
    );
  }
  if (writeOffReasonFilterValue) {
    allHistory = allHistory.filter((r) => r.type === writeOffReasonFilterValue);
  }
  
  allHistory.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00:00")) - new Date(a.date + "T" + (a.time || "00:00:00")));
  
  const itemsPerPageHistory = 10;
  const totalPages = Math.ceil(allHistory.length / itemsPerPageHistory);
  if (writeOffHistoryPage > totalPages && totalPages > 0) writeOffHistoryPage = totalPages;
  
  const startIndex = (writeOffHistoryPage - 1) * itemsPerPageHistory;
  const endIndex = Math.min(startIndex + itemsPerPageHistory, allHistory.length);
  const pageHistory = allHistory.slice(startIndex, endIndex);
  
  if (pageHistory.length === 0 && allHistory.length === 0) {
    historyList.innerHTML = `<tr><td colspan="9" class="text-center py-4"><i class="fas fa-inbox fa-2x mb-2" style="color:#ccc"></i><p>История операций пуста</p></td></tr>`;
  } else if (pageHistory.length === 0) {
    historyList.innerHTML = `<tr><td colspan="9" class="text-center py-4"><i class="fas fa-search fa-2x mb-2" style="color:#ccc"></i><p>Ничего не найдено</p></td></tr>`;
  } else {
    historyList.innerHTML = pageHistory.map((r) => {
      const type = r.type || "other";
      let quantityDisplay = formatNumber(r.quantity || 0);
      if (type === "update" && r.oldQuantity != null && r.oldQuantity !== r.quantity) {
        quantityDisplay = `${formatNumber(r.quantity)} <span style="color:#999;font-size:.85em">(было ${formatNumber(r.oldQuantity)})</span>`;
      }
      
      let priceDisplay = r.price ? formatNumber(r.price.toFixed(2)) + " руб." : "---";
      if (type === "update" && r.oldPrice != null && r.oldPrice !== r.price) {
        priceDisplay = `${formatNumber(r.price.toFixed(2))} руб. <span style="color:#999;font-size:.85em">(было ${formatNumber(r.oldPrice.toFixed(2))})</span>`;
      }
      
      const totalDisplay = r.totalCost ? formatNumber(r.totalCost.toFixed(2)) + " руб." : "---";
      
      let typeDisplay = "";
      if (type === "add") typeDisplay = '<span style="background:#dbeafe;color:#1d4ed8;padding:4px 8px;border-radius:12px;">Добавление</span>';
      else if (type === "update") typeDisplay = '<span style="background:#fef3c7;color:#d97706;padding:4px 8px;border-radius:12px;">Обновление</span>';
      else if (type === "delete") typeDisplay = '<span style="background:#fee2e2;color:#dc2626;padding:4px 8px;border-radius:12px;">Удаление</span>';
      else if (type === "writeOff") typeDisplay = '<span style="background:#fce7f3;color:#9d174d;padding:4px 8px;border-radius:12px;">Списание</span>';
      
      return `<tr>
        <td>${formatDate(r.date)} ${formatTime(r.time)}</td>
        <td>${r.productCode || "---"}</td>
        <td>${r.productName || "---"}</td>
        <td><span style="display:inline-block;padding:4px 10px;background:#e0f2fe;color:#0369a1;border-radius:12px;">${r.category || "---"}</span></td>
        <td>${typeDisplay}</td>
        <td>${quantityDisplay}</td>
        <td>${priceDisplay}</td>
        <td>${totalDisplay}</td>
        <td>${r.reason || r.description || ""}</td>
      </tr>`;
    }).join("");
  }
  
  const totalQuantity = allHistory.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalValue = allHistory.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  
  const tqEl = getElement("totalWriteOffQuantity");
  if (tqEl) tqEl.textContent = formatNumber(totalQuantity);
  const tvEl = getElement("totalWriteOffValue");
  if (tvEl) tvEl.textContent = formatNumber(totalValue.toFixed(2));
  
  const pageInfoEl = getElement("writeOffPageInfo");
  if (pageInfoEl) pageInfoEl.textContent = `Страница ${writeOffHistoryPage} из ${totalPages || 1}`;
  
  const prevBtn = getElement("writeOffPrevPage");
  if (prevBtn) prevBtn.disabled = writeOffHistoryPage === 1;
  const nextBtn = getElement("writeOffNextPage");
  if (nextBtn) nextBtn.disabled = writeOffHistoryPage === totalPages || totalPages === 0;
}

function writeOffPrevPage() {
  if (writeOffHistoryPage > 1) {
    writeOffHistoryPage--;
    renderWriteOffHistory();
  }
}

function writeOffNextPage() {
  let allHistory = [...changeHistory];
  if (writeOffSearchFilter) {
    allHistory = allHistory.filter((r) =>
      (r.productName || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.productCode || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.description || "").toLowerCase().includes(writeOffSearchFilter) ||
      (r.reason || "").toLowerCase().includes(writeOffSearchFilter)
    );
  }
  if (writeOffReasonFilterValue) {
    allHistory = allHistory.filter((r) => r.type === writeOffReasonFilterValue);
  }
  const totalPages = Math.ceil(allHistory.length / 10);
  if (writeOffHistoryPage < totalPages) {
    writeOffHistoryPage++;
    renderWriteOffHistory();
  }
}

async function clearWriteOffHistory() {
  if (changeHistory.length === 0) {
    showNotification("История операций уже пуста", "info");
    return;
  }
  if (!(await checkPassword("Очистка истории операций"))) return;
  if (confirm(`Удалить всю историю операций (${changeHistory.length} записей)?`)) {
    changeHistory = [];
    await saveToStorage("changeHistory", changeHistory);
    renderWriteOffHistory();
    showNotification("История операций очищена", "warning");
  }
}

function exportWriteOffHistory() {
  let allHistory = [...changeHistory];
  if (!allHistory.length) {
    showNotification("История операций пуста", "warning");
    return;
  }
  
  allHistory.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00:00")) - new Date(a.date + "T" + (a.time || "00:00:00")));
  
  let csv = "\uFEFFДата;Время;Тип операции;Код;Название;Категория;Количество;Цена;Сумма;Причина;Описание\n";
  allHistory.forEach((r) => {
    let typeText = { add: "Добавление", update: "Обновление", delete: "Удаление", writeOff: "Списание" }[r.type] || "Прочее";
    csv += `"${formatDate(r.date)}";"${formatTime(r.time)}";"${typeText}";"${r.productCode || ""}";"${r.productName || ""}";"${r.category || ""}";${r.quantity || 0};${r.price || 0};${r.totalCost || 0};"${r.reason || ""}";"${r.description || ""}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `operations_history_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  showNotification(`Экспортировано ${allHistory.length} записей`, "success");
}

function exportToCSV() {
  if (!products.length) {
    showNotification("Нет данных для экспорта", "warning");
    return;
  }
  
  let csv = "\uFEFFКод;Название;Категория;Количество;Цена;Описание;Место хранения;Дата поступления\n";
  products.forEach((p) => {
    csv += `"${p.code || ""}";"${p.name || ""}";"${p.category || ""}";${p.quantity};${p.price};"${p.description || ""}";"${p.location || ""}";"${p.date || ""}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  showNotification(`Экспортировано ${products.length} изделий в CSV`, "success");
}

async function clearAllData() {
  if (!products.length) {
    showNotification("Нет данных для очистки", "info");
    return;
  }
  if (!(await checkPassword("Очистка всех данных"))) return;
  if (confirm(`Удалить ВСЕ данные (${products.length} изделий)?`)) {
    products.forEach((p) => createHistoryRecord("delete", p));
    products = [];
    await saveToStorage("products", products);
    const categorySelect = getElement("productCategory");
    if (categorySelect) {
      while (categorySelect.options.length > 1) categorySelect.remove(1);
    }
    const filterSelect = getElement("categoryFilter");
    if (filterSelect) {
      while (filterSelect.options.length > 1) filterSelect.remove(1);
    }
    refreshAll();
    showNotification("Все данные успешно удалены", "warning");
  }
}

function generateTestData() {
  if (products.length > 0 && !confirm("У вас уже есть данные. Добавить тестовые данные?")) return;
  
  const timestamp = Date.now();
  const testData = [
    { id: timestamp + 1, code: "ELEC-001", name: "Ноутбук Dell XPS", category: "Электроника", quantity: 5, price: 89999.99, description: "Игровой ноутбук с процессором i7", location: "Склад А, стеллаж 3", date: "2026-04-01" },
    { id: timestamp + 2, code: "ELEC-002", name: "Монитор Samsung 27", category: "Электроника", quantity: 15, price: 25999, description: "Изогнутый монитор 27 дюймов", location: "Склад А, стеллаж 5", date: "2026-04-02" },
    { id: timestamp + 3, code: "FURN-001", name: "Офисное кресло", category: "Мебель", quantity: 12, price: 12499.5, description: "Эргономичное кресло", location: "Склад Б, секция 2", date: "2026-03-15" },
    { id: timestamp + 4, code: "FURN-002", name: "Стол письменный", category: "Мебель", quantity: 8, price: 18000, description: "Стол из дуба с ящиками", location: "Склад Б, секция 1", date: "2026-03-16" },
    { id: timestamp + 5, code: "TOOL-001", name: "Дрель электрическая", category: "Инструменты", quantity: 10, price: 4599, description: "Мощная дрель с набором насадок", location: "Склад В, ячейка 15", date: "2026-04-10" },
    { id: timestamp + 6, code: "TOOL-002", name: "Набор отверток", category: "Инструменты", quantity: 25, price: 1299, description: "Набор из 12 отверток", location: "Склад В, ячейка 20", date: "2026-04-11" },
    { id: timestamp + 7, code: "STAT-001", name: "Бумага А4", category: "Канцелярия", quantity: 500, price: 350, description: "Бумага для принтера, 500 листов", location: "Склад А, стеллаж 20", date: "2026-03-01" },
    { id: timestamp + 8, code: "STAT-002", name: "Ручки шариковые", category: "Канцелярия", quantity: 1000, price: 25, description: "Синие шариковые ручки", location: "Склад А, стеллаж 21", date: "2026-03-01" },
    { id: timestamp + 9, code: "FOOD-001", name: "Чай Lipton", category: "Продукты", quantity: 200, price: 250, description: "Черный чай в пакетиках", location: "Склад Д, секция 1", date: "2026-04-15" },
    { id: timestamp + 10, code: "FOOD-002", name: "Кофе Jacobs", category: "Продукты", quantity: 150, price: 800.5, description: "Натуральный молотый кофе", location: "Склад Д, секция 1", date: "2026-04-15" }
  ];
  
  products.push(...testData);
  testData.forEach((p) => createHistoryRecord("add", p));
  saveToStorage("products", products).then(() => {
    refreshAll();
    showNotification(`Добавлено ${testData.length} тестовых изделий!`, "success");
  });
}

async function init() {
  await loadAllData();
  
  if (productForm) {
    productForm.addEventListener("submit", addProduct);
  }
  
  initWriteOffSelect();
  
  const categorySelect = getElement("productCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      if (!isEditing && getElement("productCode")) {
        getElement("productCode").value = this.value ? generateProductCode(this.value) : "";
      }
    });
  }
  
  const writeOffForm = getElement("writeOffForm");
  if (writeOffForm) {
    writeOffForm.addEventListener("submit", writeOffProduct);
    
    const reasonSelect = getElement("writeOffReason");
    if (reasonSelect) {
      reasonSelect.addEventListener("change", function (e) {
        const otherGroup = getElement("otherReasonGroup");
        if (otherGroup) {
          otherGroup.style.display = e.target.value === "Другое" ? "block" : "none";
        }
      });
    }
    
    const clearWriteOffBtn = getElement("clearWriteOffForm");
    if (clearWriteOffBtn) {
      clearWriteOffBtn.addEventListener("click", function () {
        if (writeOffForm) writeOffForm.reset();
        if (getElement("writeOffDate")) getElement("writeOffDate").valueAsDate = new Date();
        if (getElement("writeOffQuantity")) getElement("writeOffQuantity").value = 1;
        
        const infoBlock = getElement("selectedProductInfo");
        if (infoBlock) infoBlock.style.display = "none";
        
        const productIdInput = getElement("writeOffProduct");
        if (productIdInput) productIdInput.value = "";
        
        const placeholder = document.querySelector(".custom-select-placeholder");
        if (placeholder) {
          placeholder.textContent = "Выберите изделие для списания";
          placeholder.classList.remove("selected");
        }
        showNotification("Форма списания очищена", "info");
      });
    }
    
    if (getElement("writeOffDate")) getElement("writeOffDate").valueAsDate = new Date();
  }
  
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentFilter = e.target.value;
      currentPage = 1;
      renderProducts();
    });
  }
  
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      currentCategory = e.target.value;
      currentPage = 1;
      renderProducts();
    });
  }
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderProducts();
      }
    });
  }
  
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      let filteredProducts = [...products];
      if (currentFilter) {
        const searchLower = currentFilter.toLowerCase();
        filteredProducts = filteredProducts.filter(
          (p) =>
            (p.name && p.name.toLowerCase().includes(searchLower)) ||
            (p.code && p.code.toLowerCase().includes(searchLower))
        );
      }
      if (currentCategory) {
        filteredProducts = filteredProducts.filter((p) => p.category === currentCategory);
      }
      const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
      }
    });
  }
  
  if (clearFormBtn) {
    clearFormBtn.addEventListener("click", () => {
      if (productForm) productForm.reset();
      if (getElement("productDate")) getElement("productDate").valueAsDate = new Date();
      if (getElement("productQuantity")) getElement("productQuantity").value = 1;
      resetEditMode();
      showNotification("Форма очищена", "info");
    });
  }
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeWriteOffHistory();
      closeImportModal();
    }
  });
  
  refreshAll();
  
  if (!products.length) {
    generateTestData();
  }
}

document.addEventListener("DOMContentLoaded", init);