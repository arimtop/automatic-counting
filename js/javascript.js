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

const categoryPrefixes = {
    "Электроника": "ELEC",
    "Мебель": "FURN",
    "Инструменты": "TOOL",
    "Канцелярия": "STAT",
    "Продукты": "FOOD",
    "Одежда": "CLTH",
    "Хозтовары": "HOUS",
    "Спорт": "SPRT",
    "Авто": "AUTO",
    "Стройматериалы": "BUILD"
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

getElement("productDate").valueAsDate = new Date();

function getCategoryPrefix(category) {
    if (categoryPrefixes[category]) {
        return categoryPrefixes[category];
    }
    
    const cleanName = category.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
    
    if (cleanName.length >= 4) {
        return cleanName.substring(0, 4);
    } else if (cleanName.length >= 2) {
        return cleanName.substring(0, 2);
    } else {
        return 'OTHER';
    }
}

function generateProductCode(category, excludeProductId = null) {
    const prefix = getCategoryPrefix(category);
    
    const existingCodes = products
        .filter(function(p) {
            return p.code.startsWith(prefix + '-') && p.id !== excludeProductId;
        })
        .map(function(p) {
            return parseInt(p.code.split('-')[1]) || 0;
        });
    
    let nextNumber = 1;
    if (existingCodes.length > 0) {
        nextNumber = Math.max(...existingCodes) + 1;
    }
    
    const formattedNumber = String(nextNumber).padStart(3, '0');
    
    return `${prefix}-${formattedNumber}`;
}

async function sha1(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(function(b) {
        return b.toString(16).padStart(2, "0");
    }).join("");
    return hashHex;
}

async function checkPassword(actionName) {
    const enteredPassword = prompt(`Для выполнения действия "${actionName}" введите пароль:`);
    
    if (enteredPassword === null) {
        return false;
    }
    
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
    document.querySelectorAll(".notification").forEach(function(notification) {
        notification.remove();
    });
    
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(function() {
        notification.remove();
    }, 5000);
}

function getCurrentDateTime() {
    const now = new Date();
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        datetime: now.toISOString()
    };
}

function resetEditMode() {
    isEditing = false;
    editingProductCode = null;
    
    const codeInput = getElement("productCode");
    codeInput.style.backgroundColor = '';
    codeInput.title = '';
    codeInput.readOnly = false;
    
    const submitBtn = productForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изделие';
        submitBtn.style.background = '';
        submitBtn.style.borderColor = '';
    }
    
    const category = getElement("productCategory").value;
    if (category) {
        getElement("productCode").value = generateProductCode(category);
    }
}

async function saveToStorage(key, value) {
    try {
        await localforage.setItem(key, value);
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showNotification('Ошибка сохранения данных!', 'error');
    }
}

async function loadFromStorage(key) {
    try {
        return await localforage.getItem(key) || [];
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        return [];
    }
}

async function loadAllData() {
    const results = await Promise.all([
        loadFromStorage('products'),
        loadFromStorage('changeHistory')
    ]);
    products = results[0];
    changeHistory = results[1];
}

function addHistoryRecord(recordData) {
    changeHistory.push(recordData);
    saveToStorage('changeHistory', changeHistory);
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
        reason: '',
        date: getCurrentDateTime().date,
        time: getCurrentDateTime().time,
        location: product.location,
        description: product.description || 'Описание отсутствует',
        oldQuantity: (changes && changes.quantity) ? oldProduct.quantity : null,
        oldPrice: (changes && changes.price) ? oldProduct.price : null,
        oldCode: (changes && changes.code) ? oldProduct.code : null,
        oldCategory: (changes && changes.category) ? oldProduct.category : null,
        oldLocation: (changes && changes.location) ? oldProduct.location : null
    };
    
    addHistoryRecord(record);
}

function refreshCategories() {
    const categorySelect = getElement("productCategory");
    const filterSelect = getElement("categoryFilter");
    
    const currentFormValue = categorySelect.value;
    const currentFilterValue = filterSelect.value;
    
    while (categorySelect.options.length > 1) {
        categorySelect.remove(1);
    }
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }
    
    const uniqueCategories = [...new Set(products.map(function(product) {
        return product.category;
    }))];
    
    uniqueCategories.sort(function(a, b) {
        return a.localeCompare(b, "ru");
    });
    
    uniqueCategories.forEach(function(category) {
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
    
    if (currentFormValue && uniqueCategories.includes(currentFormValue)) {
        categorySelect.value = currentFormValue;
    }
    
    if (currentFilterValue && uniqueCategories.includes(currentFilterValue)) {
        filterSelect.value = currentFilterValue;
    } else {
        filterSelect.value = "";
    }
}

function readFormData() {
    const category = getElement("productCategory").value;
    let code = getElement("productCode").value.trim();
    
    if (!code && category) {
        code = generateProductCode(category);
    }
    
    return {
        id: Date.now(),
        code: code,
        name: getElement("productName").value.trim(),
        category: category,
        quantity: parseInt(getElement("productQuantity").value),
        price: parseFloat(getElement("productPrice").value),
        description: getElement("productDescription").value.trim(),
        location: getElement("productLocation").value.trim(),
        date: getElement("productDate").value
    };
}

function fillFormData(product) {
    getElement("productCode").value = product.code;
    getElement("productName").value = product.name;
    getElement("productCategory").value = product.category;
    getElement("productQuantity").value = product.quantity;
    getElement("productPrice").value = product.price;
    getElement("productDescription").value = product.description;
    getElement("productLocation").value = product.location;
    getElement("productDate").value = product.date;
}

function resetForm() {
    productForm.reset();
    getElement("productDate").valueAsDate = new Date();
    getElement("productQuantity").value = 1;
    
    const category = getElement("productCategory").value;
    if (category) {
        getElement("productCode").value = generateProductCode(category);
    } else {
        getElement("productCode").value = '';
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
    
    if (oldQuantity !== newData.quantity) {
        changes.quantity = true;
    }
    
    if (oldPrice !== newData.price) {
        const totalOldCost = oldQuantity * oldPrice;
        const totalNewCost = newData.quantity * newData.price;
        const totalQuantity = oldQuantity + newData.quantity;
        existing.price = Math.round(((totalOldCost + totalNewCost) / totalQuantity) * 100) / 100;
        changes.price = true;
    }
    
    existing.quantity = oldQuantity + newData.quantity;
    
    if (newData.description !== existing.description) {
        existing.description = newData.description;
        changes.description = true;
    }
    
    if (newData.location !== existing.location) {
        existing.location = newData.location;
        changes.location = true;
    }
    
    return changes;
}

async function addProduct(event) {
    event.preventDefault();
    
    const product = readFormData();
    
    const codeExists = products.some(function(p) {
        return p.code === product.code && p.id !== product.id;
    });
    
    if (codeExists && !isEditing) {
        product.code = generateProductCode(product.category);
        showNotification(`Код был изменен на ${product.code}`, "warning");
    }
    
    if (isEditing) {
        const oldProduct = products.find(function(p) {
            return p.code === editingProductCode;
        });
        
        if (oldProduct) {
            const oldValues = {...oldProduct};
            
            if (oldValues.category !== product.category) {
                product.code = generateProductCode(product.category, oldProduct.id);
            }
            
            Object.assign(oldProduct, product, { id: oldProduct.id });
            
            const changes = detectChanges(oldValues, oldProduct);
            
            createHistoryRecord('update', oldProduct, oldValues, changes);
            
            await saveToStorage('products', products);
            refreshAll();
            resetForm();
            resetEditMode();
            showNotification(`Изделие "${product.name}" обновлено!`, "success");
            return;
        }
    }
    
    const existingIndex = products.findIndex(function(p) {
        return p.code === product.code;
    });
    
    if (existingIndex !== -1) {
        const existing = products[existingIndex];
        const oldValues = {...existing};
        
        const changes = updateExistingProduct(existing, product);
        
        createHistoryRecord('update', existing, oldValues, changes);
        
        await saveToStorage('products', products);
        refreshAll();
        resetForm();
        
        showNotification(
            `Обновлено: "${product.name}" - ${formatNumber(existing.quantity)} шт., ` +
            `цена ${formatNumber(existing.price.toFixed(2))} руб.`,
            "success"
        );
        return;
    }
    
    if (!isEditing) {
        product.code = generateProductCode(product.category);
    }
    
    products.push(product);
    createHistoryRecord('add', product);
    
    await saveToStorage('products', products);
    refreshAll();
    resetForm();
    resetEditMode();
    
    showNotification(`Изделие "${product.name}" успешно добавлено!`, "success");
}

async function deleteProduct(id) {
    const product = products.find(function(p) {
        return p.id === id;
    });
    
    if (!product) return;
    
    if (confirm("Вы уверены, что хотите удалить это изделие?")) {
        createHistoryRecord('delete', product);
        
        products = products.filter(function(p) {
            return p.id !== id;
        });
        
        await saveToStorage('products', products);
        refreshAll();
        showNotification(`Изделие "${product.name}" удалено!`, "warning");
    }
}

async function editProduct(id) {
    const product = products.find(function(p) {
        return p.id === id;
    });
    
    if (!product) return;
    
    isEditing = true;
    editingProductCode = product.code;
    
    fillFormData(product);
    
    const codeInput = getElement("productCode");
    codeInput.style.backgroundColor = '#fff3cd';
    codeInput.title = 'Код можно изменить вручную';
    
    const submitBtn = productForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
        submitBtn.style.background = '#f59e0b';
        submitBtn.style.borderColor = '#f59e0b';
    }
    
    productForm.scrollIntoView({ behavior: "smooth" });
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
        filteredProducts = filteredProducts.filter(function(product) {
            return product.name.toLowerCase().includes(searchLower) ||
                   product.code.toLowerCase().includes(searchLower) ||
                   (product.description && product.description.toLowerCase().includes(searchLower));
        });
    }
    
    if (currentCategory) {
        filteredProducts = filteredProducts.filter(function(product) {
            return product.category === currentCategory;
        });
    }
    
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    
    if (pageProducts.length === 0) {
        productsList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-box-open fa-2x mb-2" style="color: #ccc;"></i>
                    <p>Нет изделий для отображения</p>
                </td>
            </tr>
        `;
    } else {
        productsList.innerHTML = pageProducts.map(function(product) {
            const totalCost = product.quantity * product.price;
            return `
                <tr>
                    <td>${product.code}</td>
                    <td>${product.name}</td>
                    <td><span class="category-badge">${product.category}</span></td>
                    <td>${formatNumber(product.quantity)}</td>
                    <td>${formatNumber(product.price.toFixed(2))} руб.</td>
                    <td><strong>${formatNumber(totalCost.toFixed(2))} руб.</strong></td>
                    <td>
                        <button onclick="editProduct(${product.id})" class="btn-edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteProduct(${product.id})" class="btn-delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }
    
    const totalQuantity = filteredProducts.reduce(function(sum, product) {
        return sum + product.quantity;
    }, 0);
    
    const totalValue = filteredProducts.reduce(function(sum, product) {
        return sum + product.quantity * product.price;
    }, 0);
    
    summaryQuantity.textContent = formatNumber(totalQuantity);
    summaryValue.textContent = formatNumber(totalValue.toFixed(2));
    pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function updateStats() {
    const totalProducts = products.length;
    const totalQuantity = products.reduce(function(sum, product) {
        return sum + product.quantity;
    }, 0);
    const totalValue = products.reduce(function(sum, product) {
        return sum + product.quantity * product.price;
    }, 0);
    const uniqueCategories = new Set(products.map(function(product) {
        return product.category;
    }));
    
    totalProductsEl.textContent = formatNumber(totalProducts);
    totalQuantityEl.textContent = formatNumber(totalQuantity);
    totalValueEl.textContent = formatNumber(totalValue.toFixed(2));
    categoriesCountEl.textContent = formatNumber(uniqueCategories.size);
}

function newCategories() {
    const newCategory = prompt("Введите название новой категории:");
    
    if (newCategory && newCategory.trim() !== "") {
        const trimmedCategory = newCategory.trim();
        const existingCategories = [...new Set(products.map(function(p) {
            return p.category;
        }))];
        
        if (!existingCategories.includes(trimmedCategory)) {
            const categorySelect = getElement("productCategory");
            const filterSelect = getElement("categoryFilter");
            
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
            getElement("productCode").value = generateProductCode(trimmedCategory);
            
            showNotification(`Категория "${trimmedCategory}" добавлена! Префикс: ${prefix}`, "success");
        } else {
            showNotification("Такая категория уже существует!", "error");
        }
    }
}

function toggleSelect() {
    const container = document.querySelector(".custom-options-container");
    
    if (container.style.display === "none") {
        openSelect();
    } else {
        closeSelect();
    }
}

function openSelect() {
    const select = getElement("writeOffProductSelect");
    const container = select.querySelector(".custom-options-container");
    
    select.classList.add("open");
    container.style.display = "block";
    
    setTimeout(function() {
        const searchInput = getElement("productSearchInput");
        if (searchInput) {
            searchInput.focus();
            searchInput.value = "";
            filterProducts("");
        }
    }, 100);
    
    document.addEventListener("click", handleOutsideClick);
}

function closeSelect() {
    const select = getElement("writeOffProductSelect");
    const container = select.querySelector(".custom-options-container");
    
    select.classList.remove("open");
    container.style.display = "none";
    document.removeEventListener("click", handleOutsideClick);
}

function handleOutsideClick(event) {
    const select = getElement("writeOffProductSelect");
    
    if (!select.contains(event.target)) {
        closeSelect();
    }
}

function filterProducts(searchTerm) {
    const optionsContainer = getElement("writeOffProductOptions");
    
    if (!optionsContainer) return;
    
    const searchLower = searchTerm.toLowerCase();
    
    const filteredProducts = products.filter(function(product) {
        if (product.quantity <= 0) return false;
        if (!searchTerm) return true;
        
        return product.name.toLowerCase().includes(searchLower) ||
               product.code.toLowerCase().includes(searchLower) ||
               product.category.toLowerCase().includes(searchLower);
    });
    
    if (searchTerm) {
        filteredProducts.sort(function(a, b) {
            const aNameMatch = a.name.toLowerCase().includes(searchLower);
            const bNameMatch = b.name.toLowerCase().includes(searchLower);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return a.name.localeCompare(b.name);
        });
    } else {
        filteredProducts.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
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
        optionsContainer.innerHTML = filteredProducts.map(function(product) {
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
                        ${formatNumber(product.quantity)} шт.
                    </span>
                </div>
            `;
        }).join("");
    }
}

function highlightMatch(text, searchTerm) {
    if (!searchTerm) return text;
    
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    
    return text.replace(regex, '<strong style="background: #fff59d; padding: 0 2px;">$1</strong>');
}

function selectProduct(productId, productName, quantity) {
    getElement("writeOffProduct").value = productId;
    
    const placeholder = document.querySelector(".custom-select-placeholder");
    placeholder.textContent = productName;
    placeholder.classList.add("selected");
    
    document.querySelectorAll(".custom-option").forEach(function(option) {
        option.classList.remove("selected");
    });
    
    const selectedOption = document.querySelector(`[data-product-id="${productId}"]`);
    if (selectedOption) {
        selectedOption.classList.add("selected");
    }
    
    closeSelect();
    showProductInfo(productId);
    
    const writeOffQuantity = getElement("writeOffQuantity");
    if (writeOffQuantity) {
        writeOffQuantity.max = quantity;
        if (parseInt(writeOffQuantity.value) > quantity) {
            writeOffQuantity.value = quantity;
        }
    }
}

function updateWriteOffProductsList() {
    const searchInput = getElement("productSearchInput");
    const currentSearch = searchInput ? searchInput.value : "";
    filterProducts(currentSearch);
    
    const selectedId = getElement("writeOffProduct").value;
    
    if (selectedId) {
        const product = products.find(function(p) {
            return p.id == selectedId;
        });
        
        if (!product || product.quantity <= 0) {
            getElement("writeOffProduct").value = "";
            
            const placeholder = document.querySelector(".custom-select-placeholder");
            if (placeholder) {
                placeholder.textContent = "Выберите изделие для списания";
                placeholder.classList.remove("selected");
            }
            
            getElement("selectedProductInfo").style.display = "none";
        }
    }
}

function initWriteOffSelect() {
    updateWriteOffProductsList();
    
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            const container = document.querySelector(".custom-options-container");
            if (container && container.style.display !== "none") {
                closeSelect();
            }
            closeImportModal();
        }
    });
    
    const optionsContainer = document.querySelector(".custom-options-container");
    if (optionsContainer) {
        optionsContainer.addEventListener("click", function(event) {
            event.stopPropagation();
        });
    }
    
    const searchInput = getElement("productSearchInput");
    if (searchInput) {
        searchInput.addEventListener("click", function(event) {
            event.stopPropagation();
        });
    }
}

function showProductInfo(productId) {
    const infoBlock = getElement("selectedProductInfo");
    
    if (!infoBlock) return;
    
    if (!productId) {
        infoBlock.style.display = "none";
        return;
    }
    
    const product = products.find(function(p) {
        return p.id == productId;
    });
    
    if (!product) {
        infoBlock.style.display = "none";
        return;
    }
    
    getElement("infoCode").textContent = product.code;
    getElement("infoCategory").textContent = product.category;
    getElement("infoQuantity").textContent = formatNumber(product.quantity);
    getElement("infoPrice").textContent = formatNumber(product.price.toFixed(2));
    getElement("infoLocation").textContent = product.location || "Не указано";
    
    infoBlock.style.display = "block";
    
    const writeOffQuantity = getElement("writeOffQuantity");
    if (writeOffQuantity) {
        writeOffQuantity.max = product.quantity;
        if (parseInt(writeOffQuantity.value) > product.quantity) {
            writeOffQuantity.value = product.quantity;
        }
    }
}

async function writeOffProduct(event) {
    event.preventDefault();
    
    const productId = parseInt(getElement("writeOffProduct").value);
    const quantity = parseInt(getElement("writeOffQuantity").value);
    let reason = getElement("writeOffReason").value;
    const otherReason = getElement("otherReason").value;
    const date = getElement("writeOffDate").value;
    
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
    
    const productIndex = products.findIndex(function(p) {
        return p.id === productId;
    });
    
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
    
    const product = products[productIndex];
    
    await performWriteOff(product, quantity, reason, date);
    
    refreshAll();
    
    getElement("writeOffForm").reset();
    getElement("writeOffDate").valueAsDate = new Date();
    getElement("writeOffQuantity").value = 1;
    getElement("selectedProductInfo").style.display = "none";
    
    const placeholder = document.querySelector(".custom-select-placeholder");
    if (placeholder) {
        placeholder.textContent = "Выберите изделие для списания";
        placeholder.classList.remove("selected");
    }
    
    showNotification(
        `Списано ${quantity} шт. изделия "${product.name}". Причина: ${reason}`,
        "success"
    );
}

async function performWriteOff(product, quantity, reason, date) {
    const totalCost = quantity * product.price;
    
    const operationRecord = {
        id: Date.now(),
        type: 'writeOff',
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
        description: product.description || 'Описание отсутствует',
        oldQuantity: null,
        oldPrice: null,
        oldCode: null,
        oldCategory: null,
        oldLocation: null
    };
    
    changeHistory.push(operationRecord);
    
    product.quantity -= quantity;
    
    if (product.quantity === 0) {
        const index = products.findIndex(p => p.id === product.id);
        if (index !== -1) {
            products.splice(index, 1);
        }
    }
}

// ============ ФУНКЦИИ ИМПОРТА EXCEL ============

function downloadTemplate() {
    const templateData = [
        ['Код изделия', 'Название', 'Количество', 'Причина списания', 'Дата'],
        ['ELEC-001', 'Ноутбук Dell XPS', '2', 'Продажа', '2026-05-19'],
        ['TOOL-001', 'Дрель электрическая', '1', 'Перемещение', '2026-05-19'],
        ['STAT-001', 'Бумага А4', '50', 'Инвентаризация', '2026-05-19']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 20 },
        { wch: 12 }
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Накладная');
    
    XLSX.writeFile(wb, 'Шаблон_накладной.xlsx');
    showNotification('Шаблон накладной скачан', 'success');
}

function importFromExcel() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.style.display = 'none';
    
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showNotification('Чтение файла...', 'info');
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    showNotification('Файл пуст или содержит только заголовки', 'error');
                    return;
                }
                
                parseImportData(jsonData);
                showImportModal();
                
            } catch (error) {
                console.error('Ошибка чтения файла:', error);
                showNotification('Ошибка чтения файла. Проверьте формат.', 'error');
            }
        };
        
        reader.onerror = function() {
            showNotification('Ошибка чтения файла', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    };
    
    fileInput.click();
}

function parseImportData(rawData) {
    importData = [];
    importErrors = [];
    
    const headers = rawData[0].map(h => String(h || '').toLowerCase().trim());
    
    const codeIndex = headers.findIndex(h => 
        h.includes('код') || h === 'code' || h.includes('артикул') || h.includes('шифр')
    );
    const nameIndex = headers.findIndex(h => 
        h.includes('назван') || h.includes('наименован') || h === 'name' || h.includes('товар')
    );
    const quantityIndex = headers.findIndex(h => 
        h.includes('колич') || h === 'quantity' || h.includes('кол-во') || h === 'шт'
    );
    const reasonIndex = headers.findIndex(h => 
        h.includes('причин') || h === 'reason' || h.includes('основан')
    );
    const dateIndex = headers.findIndex(h => 
        h.includes('дат') || h === 'date'
    );
    
    const missingColumns = [];
    
    if (codeIndex === -1) {
        missingColumns.push('"Код изделия" (варианты: Код, Артикул, Шифр)');
    }
    
    if (nameIndex === -1) {
        missingColumns.push('"Название" (варианты: Наименование, Товар)');
    }
    
    if (quantityIndex === -1) {
        missingColumns.push('"Количество" (варианты: Кол-во, Шт)');
    }
    
    if (reasonIndex === -1) {
        missingColumns.push('"Причина списания" (варианты: Причина, Основание)');
    }
    
    if (dateIndex === -1) {
        missingColumns.push('"Дата"');
    }
    
    if (missingColumns.length > 0) {
        importErrors.push('В файле отсутствуют обязательные колонки:');
        missingColumns.forEach(col => {
            importErrors.push('• ' + col);
        });
        importErrors.push('Все колонки являются обязательными для импорта!');
        showNotification('Не найдены обязательные колонки в файле', 'error');
        return;
    }
    
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        
        if (!row || row.length === 0) continue;
        
        const code = String(row[codeIndex] || '').trim();
        const name = String(row[nameIndex] || '').trim();
        const quantity = parseInt(row[quantityIndex]) || 0;
        const reason = String(row[reasonIndex] || '').trim();
        const date = formatExcelDate(row[dateIndex]);
        
        if (!code) continue;
        
        const importItem = {
            code,
            name: name || 'Не указано',
            quantity,
            reason: reason || 'Не указана',
            date,
            status: 'pending',
            errors: []
        };
        
        if (!name) {
            importItem.errors.push('Не указано название изделия');
        }
        
        if (!reason) {
            importItem.errors.push('Не указана причина списания');
        }
        
        if (!date || date === 'Invalid Date') {
            importItem.errors.push('Некорректная дата');
        }
        
        const product = products.find(p => p.code === code);
        
        if (!product) {
            importItem.status = 'error';
            importItem.errors.push(`Товар с кодом "${code}" не найден в базе`);
            importItem.category = '—';
            importItem.availableQuantity = 0;
        } else {
            importItem.category = product.category;
            importItem.availableQuantity = product.quantity;
            importItem.productId = product.id;
            importItem.price = product.price;
            importItem.location = product.location;
            importItem.description = product.description;
            
            if (quantity <= 0) {
                importItem.status = 'error';
                importItem.errors.push('Некорректное количество (должно быть больше 0)');
            } else if (quantity > product.quantity) {
                importItem.status = 'warning';
                importItem.errors.push(`Недостаточно на складе (доступно: ${product.quantity} шт.)`);
            } else if (importItem.errors.length === 0) {
                importItem.status = 'success';
            } else {
                importItem.status = 'error';
            }
        }
        
        importData.push(importItem);
    }
    
    if (importData.length === 0) {
        importErrors.push('Не найдено ни одной строки с данными');
    }
}

function formatExcelDate(excelDate) {
    if (!excelDate) return null;
    
    if (typeof excelDate === 'number') {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    
    if (typeof excelDate === 'string') {
        const formats = [
            /^(\d{2})\.(\d{2})\.(\d{4})$/,
            /^(\d{4})-(\d{2})-(\d{2})$/,
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        ];
        
        for (const format of formats) {
            const match = excelDate.match(format);
            if (match) {
                if (format === formats[0]) {
                    return `${match[3]}-${match[2]}-${match[1]}`;
                }
                return excelDate;
            }
        }
    }
    
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return null;
}

function showImportModal() {
    const modal = getElement('importModal');
    if (!modal) {
        showNotification('Ошибка: не найдено модальное окно импорта', 'error');
        return;
    }
    
    const successCount = importData.filter(item => item.status === 'success').length;
    const warningCount = importData.filter(item => item.status === 'warning').length;
    const errorCount = importData.filter(item => item.status === 'error').length;
    
    const summary = getElement('importSummary');
    if (summary) {
        summary.innerHTML = `
            <div class="d-flex flex-wrap gap-3 mb-3">
                <span class="badge" style="background: #10b981; color: white; padding: 8px 15px; font-size: 14px;">
                    Успешно: ${successCount}
                </span>
                <span class="badge" style="background: #f59e0b; color: white; padding: 8px 15px; font-size: 14px;">
                    Предупреждения: ${warningCount}
                </span>
                <span class="badge" style="background: #ef4444; color: white; padding: 8px 15px; font-size: 14px;">
                    Ошибки: ${errorCount}
                </span>
                <span class="badge" style="background: #3b82f6; color: white; padding: 8px 15px; font-size: 14px;">
                    Всего позиций: ${importData.length}
                </span>
            </div>
            ${importErrors.length > 0 ? `
                <div class="alert alert-danger">
                    <strong>Ошибки структуры файла:</strong><br>
                    ${importErrors.join('<br>')}
                </div>
            ` : ''}
        `;
    }
    
    const tbody = getElement('importPreviewBody');
    if (tbody) {
        tbody.innerHTML = importData.map((item, index) => `
            <tr style="${item.status === 'error' ? 'background: #fee2e2;' : item.status === 'warning' ? 'background: #fef3c7;' : ''}">
                <td><strong>${item.code}</strong></td>
                <td>${item.name}</td>
                <td>${item.category || '—'}</td>
                <td><strong>${item.quantity}</strong></td>
                <td>${item.availableQuantity || '—'}</td>
                <td>${item.reason}</td>
                <td>${item.date || '—'}</td>
                <td style="color: #ef4444; font-size: 13px;">${item.errors.join('<br>') || '—'}</td>
            </tr>
        `).join('');
    }
    
    const confirmBtn = getElement('confirmImportBtn');
    if (confirmBtn) {
        confirmBtn.disabled = successCount === 0;
        confirmBtn.textContent = `Подтвердить импорт (${successCount} позиций)`;
    }
    
    modal.style.display = 'block';
}

function closeImportModal() {
    const modal = getElement('importModal');
    if (modal) {
        modal.style.display = 'none';
    }
    importData = [];
    importErrors = [];
}

async function confirmImport() {
    const successItems = importData.filter(item => item.status === 'success');
    
    if (successItems.length === 0) {
        showNotification('Нет позиций для импорта', 'warning');
        return;
    }
    
    const hasAccess = await checkPassword('Массовое списание из накладной');
    
    if (!hasAccess) {
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите списать ${successItems.length} позиций из накладной?`)) {
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of successItems) {
        const product = products.find(p => p.id === item.productId);
        
        if (product && product.quantity >= item.quantity) {
            await performWriteOff(product, item.quantity, item.reason, item.date);
            successCount++;
        } else {
            errorCount++;
        }
    }
    
    await saveToStorage('products', products);
    await saveToStorage('changeHistory', changeHistory);
    
    refreshAll();
    closeImportModal();
    
    showNotification(
        `Импорт завершен! Успешно списано: ${successCount} позиций` + 
        (errorCount > 0 ? `, ошибок: ${errorCount}` : ''),
        errorCount > 0 ? 'warning' : 'success'
    );
}

// ============ ФУНКЦИИ ИСТОРИИ ============

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(timeString) {
    if (!timeString) return '';
    return timeString.substring(0, 5);
}

function getActionBadgeHTML(type, reason) {
    if (reason) {
        const reasonLower = reason.toLowerCase();
        if (reasonLower.includes('инвентар')) {
            return '<span class="badge-reason badge-inventarizaciya">Инвентаризация</span>';
        } else if (reasonLower.includes('продаж')) {
            return '<span class="badge-reason badge-sale">Продажа</span>';
        } else if (reasonLower.includes('перемещен')) {
            return '<span class="badge-reason badge-peremeshenie">Перемещение</span>';
        } else if (reasonLower.includes('брак')) {
            return '<span class="badge-reason badge-brak">Брак</span>';
        } else if (reasonLower.includes('порч')) {
            return '<span class="badge-reason badge-porcha">Порча</span>';
        } else if (reasonLower.includes('устарев')) {
            return '<span class="badge-reason badge-ustarevanie">Устаревание</span>';
        }
    }
    
    const badges = {
        'add': '<span class="badge-reason badge-sale">Добавление</span>',
        'update': '<span class="badge-reason badge-ustarevanie">Обновление</span>',
        'delete': '<span class="badge-reason badge-brak">Удаление</span>',
        'writeOff': '<span class="badge-reason badge-porcha">Списание</span>'
    };
    
    return badges[type] || '<span class="badge-reason badge-other">Прочее</span>';
}

function getWriteOffItemsPerPage() {
    const modal = getElement("writeOffHistoryModal");
    if (!modal) return 5;
    
    const modalContent = modal.querySelector(".modal-content-large");
    if (!modalContent) return 5;
    
    const modalHeight = modalContent.clientHeight;
    
    const headerHeight = 70;
    const summaryHeight = 40;
    const controlsHeight = 60;
    const footerHeight = 60;
    const tableHeadHeight = 45;
    
    const availableHeight = modalHeight - headerHeight - summaryHeight - controlsHeight - footerHeight - tableHeadHeight - 60;
    
    const rowHeight = 55;
    
    const calculatedItems = Math.floor(availableHeight / rowHeight);
    
    return Math.max(3, Math.min(calculatedItems, 20));
}

function showWriteOffHistory() {
    const modal = getElement("writeOffHistoryModal");
    
    if (!modal) return;
    
    checkPassword("Просмотр истории операций").then(function(hasAccess) {
        if (!hasAccess) return;
        
        writeOffHistoryPage = 1;
        writeOffSearchFilter = "";
        writeOffReasonFilterValue = "";
        
        const searchInput = getElement("writeOffSearchInput");
        const reasonFilter = getElement("writeOffReasonFilter");
        
        if (searchInput) searchInput.value = "";
        if (reasonFilter) reasonFilter.value = "";
        
        modal.style.display = "block";
        
        setTimeout(function() {
            renderWriteOffHistory();
        }, 100);
        
        modal.addEventListener("click", function(event) {
            if (event.target === modal) {
                closeWriteOffHistory();
            }
        });
    });
}

function closeWriteOffHistory() {
    const modal = getElement("writeOffHistoryModal");
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
    const reasonFilter = getElement("writeOffReasonFilter");
    writeOffReasonFilterValue = reasonFilter ? reasonFilter.value : "";
    writeOffHistoryPage = 1;
    renderWriteOffHistory();
}

function renderWriteOffHistory() {
    const historyList = getElement("writeOffHistoryList");
    
    if (!historyList) return;
    
    let allHistory = [...changeHistory];
    
    if (writeOffSearchFilter) {
        allHistory = allHistory.filter(function(record) {
            return (record.productName && record.productName.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.productCode && record.productCode.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.description && record.description.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.reason && record.reason.toLowerCase().includes(writeOffSearchFilter));
        });
    }
    
    if (writeOffReasonFilterValue) {
        allHistory = allHistory.filter(function(record) {
            return record.type === writeOffReasonFilterValue;
        });
    }
    
    allHistory.sort(function(a, b) {
        const dateA = new Date(a.date + 'T' + (a.time || '00:00:00'));
        const dateB = new Date(b.date + 'T' + (b.time || '00:00:00'));
        return dateB - dateA;
    });
    
    const dynamicItemsPerPage = getWriteOffItemsPerPage();
    const totalPages = Math.ceil(allHistory.length / dynamicItemsPerPage);
    
    if (writeOffHistoryPage > totalPages && totalPages > 0) {
        writeOffHistoryPage = totalPages;
    }
    
    const startIndex = (writeOffHistoryPage - 1) * dynamicItemsPerPage;
    const endIndex = Math.min(startIndex + dynamicItemsPerPage, allHistory.length);
    const pageHistory = allHistory.slice(startIndex, endIndex);
    
    if (pageHistory.length === 0 && allHistory.length === 0) {
        historyList.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <i class="fas fa-inbox fa-2x mb-2" style="color: #ccc;"></i>
                    <p>История операций пуста</p>
                </td>
            </tr>
        `;
    } else if (pageHistory.length === 0) {
        historyList.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <i class="fas fa-search fa-2x mb-2" style="color: #ccc;"></i>
                    <p>Ничего не найдено</p>
                </td>
            </tr>
        `;
    } else {
        historyList.innerHTML = pageHistory.map(function(record) {
            const type = record.type || 'other';
            
            let quantityDisplay = formatNumber(record.quantity || 0);
            if (record.type === 'update' && record.oldQuantity !== null && record.oldQuantity !== undefined && record.oldQuantity !== record.quantity) {
                quantityDisplay = `${formatNumber(record.quantity)} <span style="color: #999; font-size: 0.85em;">(было ${formatNumber(record.oldQuantity)})</span>`;
            }
            
            let priceDisplay = record.price ? formatNumber(record.price.toFixed(2)) + ' руб.' : '---';
            if (record.type === 'update' && record.oldPrice !== null && record.oldPrice !== undefined && record.oldPrice !== record.price) {
                priceDisplay = `${formatNumber(record.price.toFixed(2))} руб. <span style="color: #999; font-size: 0.85em;">(было ${formatNumber(record.oldPrice.toFixed(2))})</span>`;
            }
            
            const totalDisplay = record.totalCost ? formatNumber(record.totalCost.toFixed(2)) + ' руб.' : '---';
            
            let codeDisplay = record.productCode || '---';
            if (record.type === 'update' && record.oldCode !== null && record.oldCode !== record.productCode) {
                codeDisplay += `<br><span style="color: #999; font-size: 0.85em;">(было ${record.oldCode})</span>`;
            }
            
            let categoryDisplay = `<span class="category-badge">${record.category || '---'}</span>`;
            if (record.type === 'update' && record.oldCategory !== null && record.oldCategory !== record.category) {
                categoryDisplay += `<br><span style="color: #999; font-size: 0.85em;">(было ${record.oldCategory})</span>`;
            }
            
            let operationDisplay = '';
            if (record.type === 'writeOff') {
                operationDisplay = getActionBadgeHTML(type, record.reason);
            } else {
                operationDisplay = getActionBadgeHTML(type);
            }
            
            let descriptionDisplay = '';
            if (record.description && record.description !== 'Описание отсутствует') {
                descriptionDisplay = record.description;
            }
            
            return `
                <tr>
                    <td>${formatDate(record.date)} ${formatTime(record.time)}</td>
                    <td>${codeDisplay}</td>
                    <td>${record.productName || '---'}</td>
                    <td>${categoryDisplay}</td>
                    <td>${operationDisplay}</td>
                    <td>${quantityDisplay}</td>
                    <td>${priceDisplay}</td>
                    <td>${totalDisplay}</td>
                    <td>${descriptionDisplay}</td>
                </tr>
            `;
        }).join("");
    }
    
    const totalQuantity = allHistory.reduce(function(sum, record) {
        return sum + (record.quantity || 0);
    }, 0);
    
    const totalValue = allHistory.reduce(function(sum, record) {
        return sum + (record.totalCost || 0);
    }, 0);
    
    const totalWriteOffQuantity = getElement("totalWriteOffQuantity");
    const totalWriteOffValue = getElement("totalWriteOffValue");
    
    if (totalWriteOffQuantity) {
        totalWriteOffQuantity.textContent = formatNumber(totalQuantity);
    }
    
    if (totalWriteOffValue) {
        totalWriteOffValue.textContent = formatNumber(totalValue.toFixed(2));
    }
    
    updateWriteOffPagination(totalPages);
}

function updateWriteOffPagination(totalPages) {
    const pageInfo = getElement("writeOffPageInfo");
    const prevBtn = getElement("writeOffPrevPage");
    const nextBtn = getElement("writeOffNextPage");
    
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
    let allHistory = [...changeHistory];
    
    if (writeOffSearchFilter) {
        allHistory = allHistory.filter(function(record) {
            return (record.productName && record.productName.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.productCode && record.productCode.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.description && record.description.toLowerCase().includes(writeOffSearchFilter)) ||
                   (record.reason && record.reason.toLowerCase().includes(writeOffSearchFilter));
        });
    }
    
    if (writeOffReasonFilterValue) {
        allHistory = allHistory.filter(function(record) {
            return record.type === writeOffReasonFilterValue;
        });
    }
    
    const dynamicItemsPerPage = getWriteOffItemsPerPage();
    const totalPages = Math.ceil(allHistory.length / dynamicItemsPerPage);
    
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
    
    const hasAccess = await checkPassword("Очистка истории операций");
    
    if (!hasAccess) {
        return;
    }
    
    if (confirm(`Удалить всю историю операций (${changeHistory.length} записей)?`)) {
        changeHistory = [];
        await saveToStorage('changeHistory', changeHistory);
        renderWriteOffHistory();
        showNotification("История операций очищена", "warning");
    }
}

function exportWriteOffHistory() {
    let allHistory = [...changeHistory];
    
    if (allHistory.length === 0) {
        showNotification("История операций пуста", "warning");
        return;
    }
    
    allHistory.sort(function(a, b) {
        const dateA = new Date(a.date + 'T' + (a.time || '00:00:00'));
        const dateB = new Date(b.date + 'T' + (b.time || '00:00:00'));
        return dateB - dateA;
    });
    
    let csvContent = "Дата;Время;Тип операции;Код;Название;Категория;Количество;Цена;Сумма;Причина;Описание\n";
    
    allHistory.forEach(function(record) {
        let typeText = 'Прочее';
        switch(record.type) {
            case 'add': typeText = 'Добавление'; break;
            case 'update': typeText = 'Обновление'; break;
            case 'delete': typeText = 'Удаление'; break;
            case 'writeOff': typeText = 'Списание'; break;
        }
        
        csvContent += `"${formatDate(record.date)}";"${formatTime(record.time)}";"${typeText}";"${record.productCode || ''}";"${record.productName || ''}";"${record.category || ''}";${record.quantity || 0};${record.price || 0};${record.totalCost || 0};"${record.reason || ''}";"${record.description || ''}"\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `operations_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Экспортировано ${allHistory.length} записей`, "success");
}

function exportToCSV() {
    if (products.length === 0) {
        showNotification("Нет данных для экспорта", "warning");
        return;
    }
    
    let csvContent = "Код;Название;Категория;Количество;Цена;Описание;Место хранения;Дата поступления\n";
    
    products.forEach(function(product) {
        csvContent += `"${product.code}";"${product.name}";"${product.category}";${product.quantity};${product.price};"${product.description || ""}";"${product.location || ""}";"${product.date}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_${new Date().toISOString().split('T')[0]}.csv`);
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
    
    const hasAccess = await checkPassword("Очистка всех данных");
    
    if (!hasAccess) {
        return;
    }
    
    if (confirm(`Удалить ВСЕ данные (${products.length} изделий)?`)) {
        products.forEach(function(product) {
            createHistoryRecord('delete', product);
        });
        
        products = [];
        await saveToStorage('products', products);
        
        const categorySelect = getElement("productCategory");
        while (categorySelect.options.length > 1) {
            categorySelect.remove(1);
        }
        
        const filterSelect = getElement("categoryFilter");
        while (filterSelect.options.length > 1) {
            filterSelect.remove(1);
        }
        
        refreshAll();
        showNotification("Все данные успешно удалены", "warning");
    }
}

function generateTestData() {
    if (products.length > 0) {
        if (!confirm("У вас уже есть данные. Добавить тестовые данные?")) {
            return;
        }
    }
    
    const baseId = Date.now();
    
    const testProducts = [
        { id: baseId + 1, code: "ELEC-001", name: "Ноутбук Dell XPS", category: "Электроника", quantity: 5, price: 89999.99, description: "Игровой ноутбук с процессором i7", location: "Склад А, стеллаж 3", date: "2026-04-01" },
        { id: baseId + 2, code: "ELEC-002", name: "Монитор Samsung 27", category: "Электроника", quantity: 15, price: 25999.00, description: "Изогнутый монитор 27 дюймов", location: "Склад А, стеллаж 5", date: "2026-04-02" },
        { id: baseId + 3, code: "FURN-001", name: "Офисное кресло", category: "Мебель", quantity: 12, price: 12499.50, description: "Эргономичное кресло", location: "Склад Б, секция 2", date: "2026-03-15" },
        { id: baseId + 4, code: "FURN-002", name: "Стол письменный", category: "Мебель", quantity: 8, price: 18000.00, description: "Стол из дуба с ящиками", location: "Склад Б, секция 1", date: "2026-03-16" },
        { id: baseId + 5, code: "TOOL-001", name: "Дрель электрическая", category: "Инструменты", quantity: 10, price: 4599.00, description: "Мощная дрель с набором насадок", location: "Склад В, ячейка 15", date: "2026-04-10" },
        { id: baseId + 6, code: "TOOL-002", name: "Набор отверток", category: "Инструменты", quantity: 25, price: 1299.00, description: "Набор из 12 отверток", location: "Склад В, ячейка 20", date: "2026-04-11" },
        { id: baseId + 7, code: "STAT-001", name: "Бумага А4", category: "Канцелярия", quantity: 500, price: 350.00, description: "Бумага для принтера, 500 листов", location: "Склад А, стеллаж 20", date: "2026-03-01" },
        { id: baseId + 8, code: "STAT-002", name: "Ручки шариковые", category: "Канцелярия", quantity: 1000, price: 25.00, description: "Синие шариковые ручки", location: "Склад А, стеллаж 21", date: "2026-03-01" },
        { id: baseId + 9, code: "FOOD-001", name: "Чай Lipton", category: "Продукты", quantity: 200, price: 250.00, description: "Черный чай в пакетиках", location: "Склад Д, секция 1", date: "2026-04-15" },
        { id: baseId + 10, code: "FOOD-002", name: "Кофе Jacobs", category: "Продукты", quantity: 150, price: 800.50, description: "Натуральный молотый кофе", location: "Склад Д, секция 1", date: "2026-04-15" }
    ];
    
    products.push(...testProducts);
    
    testProducts.forEach(function(product) {
        createHistoryRecord('add', product);
    });
    
    saveToStorage('products', products).then(function() {
        refreshAll();
        showNotification(`Добавлено ${testProducts.length} тестовых изделий!`, "success");
    });
}

async function init() {
    await loadAllData();
    
    productForm.addEventListener("submit", addProduct);
    
    initWriteOffSelect();
    
    const categorySelect = getElement("productCategory");
    categorySelect.addEventListener("change", function() {
        if (!isEditing) {
            if (this.value) {
                getElement("productCode").value = generateProductCode(this.value);
            } else {
                getElement("productCode").value = '';
            }
        }
    });
    
    const writeOffForm = getElement("writeOffForm");
    if (writeOffForm) {
        writeOffForm.addEventListener("submit", writeOffProduct);
        
        getElement("writeOffReason").addEventListener("change", function(event) {
            const otherReasonGroup = getElement("otherReasonGroup");
            if (event.target.value === "Другое") {
                otherReasonGroup.style.display = "block";
            } else {
                otherReasonGroup.style.display = "none";
                getElement("otherReason").value = "";
            }
        });
        
        getElement("clearWriteOffForm").addEventListener("click", function() {
            writeOffForm.reset();
            getElement("writeOffDate").valueAsDate = new Date();
            getElement("writeOffQuantity").value = 1;
            getElement("selectedProductInfo").style.display = "none";
            getElement("writeOffProduct").value = "";
            
            const placeholder = document.querySelector(".custom-select-placeholder");
            if (placeholder) {
                placeholder.textContent = "Выберите изделие для списания";
                placeholder.classList.remove("selected");
            }
            
            showNotification("Форма списания очищена", "info");
        });
        
        getElement("writeOffDate").valueAsDate = new Date();
    }
    
    searchInput.addEventListener("input", function(event) {
        currentFilter = event.target.value;
        currentPage = 1;
        renderProducts();
    });
    
    categoryFilter.addEventListener("change", function(event) {
        currentCategory = event.target.value;
        currentPage = 1;
        renderProducts();
    });
    
    prevPageBtn.addEventListener("click", function() {
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
        }
    });
    
    nextPageBtn.addEventListener("click", function() {
        const totalPages = Math.ceil(products.filter(function(p) {
            return (!currentFilter || p.name.toLowerCase().includes(currentFilter.toLowerCase()) || p.code.toLowerCase().includes(currentFilter.toLowerCase())) &&
                   (!currentCategory || p.category === currentCategory);
        }).length / itemsPerPage);
        
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
        }
    });
    
    clearFormBtn.addEventListener("click", function() {
        productForm.reset();
        getElement("productDate").valueAsDate = new Date();
        getElement("productQuantity").value = 1;
        resetEditMode();
        showNotification("Форма очищена", "info");
    });
    
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            closeWriteOffHistory();
            closeImportModal();
        }
    });
    
    window.addEventListener("resize", function() {
        if (getElement("writeOffHistoryModal").style.display === "block") {
            renderWriteOffHistory();
        }
    });
    
    refreshAll();
    
    if (products.length === 0) {
        generateTestData();
    }
}

document.addEventListener("DOMContentLoaded", init);