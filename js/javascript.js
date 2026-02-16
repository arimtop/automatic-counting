let products = JSON.parse(localStorage.getItem("products")) || [];
let currentPage = 1;
const itemsPerPage = 5;
let currentFilter = "";
let currentCategory = "";

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

function initCategories() {
  const categorySelect = document.getElementById("productCategory");
  const filterSelect = document.getElementById("categoryFilter");

  const currentFormValue = categorySelect.value;
  const currentFilterValue = filterSelect.value;

  const uniqueCategories = [
    ...new Set(products.map((product) => product.category)),
  ];

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

  while (categorySelect.options.length > 1) {
    categorySelect.remove(1);
  }

  while (filterSelect.options.length > 1) {
    filterSelect.remove(1);
  }

  const uniqueCategories = [
    ...new Set(products.map((product) => product.category)),
  ];

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

function saveToLocalStorage() {
  localStorage.setItem("products", JSON.stringify(products));
  updateStats();
  refreshCategories();
}

function addProduct(event) {
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

  if (products.some((p) => p.code === product.code)) {
    showNotification("Изделие с таким кодом уже существует!", "error");
    return;
  }

  products.push(product);
  saveToLocalStorage();
  renderProducts();

  productForm.reset();
  document.getElementById("productDate").valueAsDate = new Date();
  document.getElementById("productQuantity").value = 1;

  showNotification(`Изделие "${product.name}" успешно добавлено!`, "success");
}

function deleteProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  if (confirm("Вы уверены, что хотите удалить это изделие?")) {
    products = products.filter((product) => product.id !== id);
    saveToLocalStorage();
    renderProducts();
    showNotification(`Изделие "${product.name}" удалено!`, "warning");
  }
}

function editProduct(id) {
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
  saveToLocalStorage();

  document.querySelector("form").scrollIntoView({ behavior: "smooth" });
  showNotification("Редактирование изделия", "info");
}

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

  const totalQuantity = filteredProducts.reduce(
    (sum, p) => sum + p.quantity,
    0,
  );
  const totalValue = filteredProducts.reduce(
    (sum, p) => sum + p.quantity * p.price,
    0,
  );

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

function newCategories() {
  let newCategory = prompt("Введите название новой категории:");
  if (newCategory && newCategory.trim() !== "") {
    newCategory = newCategory.trim();

    const existingCategories = [...new Set(products.map((p) => p.category))];

    if (!existingCategories.includes(newCategory)) {
      const categorySelect = document.getElementById("productCategory");
      const filterSelect = document.getElementById("categoryFilter");

      let formExists = false;
      for (let i = 0; i < categorySelect.options.length; i++) {
        if (categorySelect.options[i].value === newCategory) {
          formExists = true;
          break;
        }
      }

      if (!formExists) {
        const formOption = document.createElement("option");
        formOption.value = newCategory;
        formOption.textContent = newCategory;
        categorySelect.appendChild(formOption);
      }

      let filterExists = false;
      for (let i = 0; i < filterSelect.options.length; i++) {
        if (filterSelect.options[i].value === newCategory) {
          filterExists = true;
          break;
        }
      }

      if (!filterExists) {
        const filterOption = document.createElement("option");
        filterOption.value = newCategory;
        filterOption.textContent = newCategory;
        filterSelect.appendChild(filterOption);
      }

      showNotification(
        `Категория "${newCategory}" добавлена в список!`,
        "success",
      );
    } else {
      showNotification("Такая категория уже существует!", "error");
    }
  }
}

function exportToCSV() {
  if (products.length === 0) {
    showNotification("Нет данных для экспорта", "warning");
    return;
  }

  let csvContent =
    "Код;Название;Категория;Количество;Цена;Описание;Место хранения;Дата поступления\n";

  products.forEach((product) => {
    csvContent += `"${product.code}";"${product.name}";"${product.category}";${product.quantity};${product.price};"${product.description || ""}";"${product.location || ""}";"${product.date}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `inventory_${new Date().toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification(
    `Экспортировано ${products.length} изделий в CSV`,
    "success",
  );
}

function clearAllData() {
  if (products.length === 0) {
    showNotification("Нет данных для очистки", "info");
    return;
  }

  if (
    confirm(
      `Вы уверены, что хотите удалить ВСЕ данные (${products.length} изделий)?\nЭто действие нельзя отменить!`,
    )
  ) {
    products = [];
    localStorage.removeItem("products");

    const categorySelect = document.getElementById("productCategory");
    while (categorySelect.options.length > 1) {
      categorySelect.remove(1);
    }

    const filterSelect = document.getElementById("categoryFilter");
    while (filterSelect.options.length > 1) {
      filterSelect.remove(1);
    }

    renderProducts();
    updateStats();
    showNotification("Все данные успешно удалены", "warning");
  }
}

function init() {
  productForm.addEventListener("submit", addProduct);

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

  refreshCategories();

  renderProducts();
  updateStats();

  if (products.length === 0) {
    loadSampleData();
  }

  addGenerateButton();
}

function loadSampleData() {
  const sampleProducts = [
    {
      id: 1,
      code: "ELEC-001",
      name: "Ноутбук Dell XPS",
      category: "Электроника",
      quantity: 5,
      price: 89999.99,
      description: "Игровой ноутбук с процессором i7",
      location: "Склад А, стеллаж 3",
      date: "2024-01-15",
    },
    {
      id: 2,
      code: "FURN-001",
      name: "Офисное кресло",
      category: "Мебель",
      quantity: 12,
      price: 12499.5,
      description: "Эргономичное кресло с поддержкой спины",
      location: "Склад Б, секция 2",
      date: "2024-01-20",
    },
    {
      id: 3,
      code: "TOOL-001",
      name: "Дрель электрическая",
      category: "Инструменты",
      quantity: 8,
      price: 4599.0,
      description: "Мощная дрель с набором насадок",
      location: "Склад В, ячейка 15",
      date: "2024-01-25",
    },
    {
      id: 4,
      code: "CLOTH-002",
      name: "Футболка",
      category: "Одежда",
      quantity: 10,
      price: 500.5,
      description: "Хлопковая футболка",
      location: "Склад Б, секция 2",
      date: "2024-01-20",
    },
    {
      id: 5,
      code: "BOOK-003",
      name: "Война и мир",
      category: "Книги",
      quantity: 12,
      price: 1299.5,
      description: "Роман Л.Н. Толстого",
      location: "Склад Б, секция 2",
      date: "2024-01-20",
    },
    {
      id: 6,
      code: "FOOD-004",
      name: "Кофе Jacobs",
      category: "Другое",
      quantity: 12,
      price: 800.5,
      description: "Натуральный молотый кофе",
      location: "Склад Б, секция 2",
      date: "2024-01-20",
    },
  ];

  products = sampleProducts;
  saveToLocalStorage();
  renderProducts();
  showNotification("Загружены демонстрационные данные", "success");
}

document.addEventListener("DOMContentLoaded", init);
