// Инициализация данных
let products = JSON.parse(localStorage.getItem('products')) || [];
let currentPage = 1;
const itemsPerPage = 5;
let currentFilter = '';
let currentCategory = '';

// DOM элементы
const productForm = document.querySelector('form');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const productsList = document.getElementById('productsList');
const summaryQuantity = document.getElementById('summaryQuantity');
const summaryValue = document.getElementById('summaryValue');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const clearFormBtn = document.getElementById('clearForm');

// Статистика
const totalProductsEl = document.getElementById('totalProducts');
const totalQuantityEl = document.getElementById('totalQuantity');
const totalValueEl = document.getElementById('totalValue');
const categoriesCountEl = document.getElementById('categoriesCount');

// Инициализация даты
document.getElementById('productDate').valueAsDate = new Date();

// Функция для разделения чисел пробелами
function spaceDigits(number) {
    if (number === null || number === undefined) return '0';
    
    // Преобразуем в строку и убираем существующие пробелы
    let numStr = String(number).replace(/\s/g, '');
    
    // Если это число с десятичной частью
    if (numStr.includes('.')) {
        const parts = numStr.split('.');
        const integerPart = parts[0].replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, '$1 ');
        const decimalPart = parts[1];
        return `${integerPart}.${decimalPart}`;
    }
    
    // Целое число
    return numStr.replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, '$1 ');
}

// Функция для отображения уведомлений
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Добавляем стили, если их нет
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        
        document.head.appendChild(styles);
    }
    
    // Добавляем на страницу
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// Инициализация категорий в фильтре
function initCategories() {
    const categorySelect = document.getElementById('productCategory');
    const filterSelect = document.getElementById('categoryFilter');
    
    // Сохраняем существующие опции
    const existingOptions = Array.from(filterSelect.options).map(opt => opt.value);
    
    // Добавляем новые категории из продуктов
    products.forEach(product => {
        if (product.category && !existingOptions.includes(product.category)) {
            const option = document.createElement('option');
            option.value = product.category;
            option.textContent = product.category;
            filterSelect.appendChild(option);
        }
    });
}

// Сохранение в LocalStorage
function saveToLocalStorage() {
    localStorage.setItem('products', JSON.stringify(products));
    updateStats();
    initCategories();
}

// Добавление продукта
function addProduct(event) {
    event.preventDefault();
    
    const product = {
        id: Date.now(),
        code: document.getElementById('productCode').value.trim(),
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value,
        quantity: parseInt(document.getElementById('productQuantity').value),
        price: parseFloat(document.getElementById('productPrice').value),
        description: document.getElementById('productDescription').value.trim(),
        location: document.getElementById('productLocation').value.trim(),
        date: document.getElementById('productDate').value
    };
    
    // Проверка на дубликат кода
    if (products.some(p => p.code === product.code)) {
        showNotification('Изделие с таким кодом уже существует!', 'error');
        return;
    }
    
    products.push(product);
    saveToLocalStorage();
    renderProducts();
    
    // Очистка формы
    productForm.reset();
    document.getElementById('productDate').valueAsDate = new Date();
    document.getElementById('productQuantity').value = 1;
    
    showNotification(`Изделие "${product.name}" успешно добавлено!`, 'success');
}

// Удаление продукта
function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if (confirm('Вы уверены, что хотите удалить это изделие?')) {
        products = products.filter(product => product.id !== id);
        saveToLocalStorage();
        renderProducts();
        showNotification(`Изделие "${product.name}" удалено!`, 'warning');
    }
}

// Редактирование продукта
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    // Заполняем форму данными продукта
    document.getElementById('productCode').value = product.code;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productQuantity').value = product.quantity;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productLocation').value = product.location;
    document.getElementById('productDate').value = product.date;
    
    // Удаляем старый продукт
    products = products.filter(p => p.id !== id);
    saveToLocalStorage();
    
    // Прокручиваем к форме
    document.querySelector('form').scrollIntoView({ behavior: 'smooth' });
    showNotification('Редактирование изделия', 'info');
}

// Отображение продуктов
function renderProducts() {
    let filteredProducts = [...products];
    
    // Применяем фильтр по поиску
    if (currentFilter) {
        const searchLower = currentFilter.toLowerCase();
        filteredProducts = filteredProducts.filter(product =>
            product.name.toLowerCase().includes(searchLower) ||
            product.code.toLowerCase().includes(searchLower) ||
            product.description.toLowerCase().includes(searchLower)
        );
    }
    
    // Применяем фильтр по категории
    if (currentCategory) {
        filteredProducts = filteredProducts.filter(product =>
            product.category === currentCategory
        );
    }
    
    // Пагинация
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    // Очищаем список
    productsList.innerHTML = '';
    
    // Заполняем таблицу
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
        paginatedProducts.forEach(product => {
            const totalCost = product.quantity * product.price;
            const row = document.createElement('tr');
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
    
    // Обновляем сводку
    const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.quantity, 0);
    const totalValue = filteredProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
    
    summaryQuantity.textContent = spaceDigits(totalQuantity);
    summaryValue.textContent = spaceDigits(totalValue.toFixed(2));
    
    // Обновляем информацию о странице
    pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    
    // Блокируем/разблокируем кнопки пагинации
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Обновление статистики
function updateStats() {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
    
    // Уникальные категории
    const uniqueCategories = [...new Set(products.map(p => p.category))];
    
    // Обновляем статистику с разделением пробелами
    totalProductsEl.textContent = spaceDigits(totalProducts);
    totalQuantityEl.textContent = spaceDigits(totalQuantity);
    totalValueEl.textContent = spaceDigits(totalValue.toFixed(2));
    categoriesCountEl.textContent = spaceDigits(uniqueCategories.length);
}

// Функция для экспорта в CSV
function exportToCSV() {
    if (products.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Создаем заголовки CSV
    let csvContent = "Код;Название;Категория;Количество;Цена;Описание;Место хранения;Дата поступления\n";
    
    // Добавляем данные
    products.forEach(product => {
        csvContent += `"${product.code}";"${product.name}";"${product.category}";${product.quantity};${product.price};"${product.description || ''}";"${product.location || ''}";"${product.date}"\n`;
    });
    
    // Создаем Blob и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Экспортировано ${products.length} изделий в CSV`, 'success');
}

// Функция для полного очищения данных
function clearAllData() {
    if (products.length === 0) {
        showNotification('Нет данных для очистки', 'info');
        return;
    }
    
    if (confirm(`Вы уверены, что хотите удалить ВСЕ данные (${products.length} изделий)?\nЭто действие нельзя отменить!`)) {
        products = [];
        localStorage.removeItem('products');
        renderProducts();
        updateStats();
        initCategories();
        showNotification('Все данные успешно удалены', 'warning');
    }
}

// Инициализация
function init() {
    // Назначаем обработчики событий
    productForm.addEventListener('submit', addProduct);
    searchInput.addEventListener('input', (e) => {
        currentFilter = e.target.value;
        currentPage = 1;
        renderProducts();
    });
    
    categoryFilter.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        currentPage = 1;
        renderProducts();
    });
    
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(
            (currentFilter || currentCategory ? 
                products.filter(p => 
                    (!currentFilter || p.name.toLowerCase().includes(currentFilter.toLowerCase()) || p.code.toLowerCase().includes(currentFilter.toLowerCase())) &&
                    (!currentCategory || p.category === currentCategory)
                ).length : products.length) / itemsPerPage
        );
        
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
        }
    });
    
    clearFormBtn.addEventListener('click', () => {
        productForm.reset();
        document.getElementById('productDate').valueAsDate = new Date();
        document.getElementById('productQuantity').value = 1;
        showNotification('Форма очищена', 'info');
    });
    
    // Инициализируем категории
    initCategories();
    
    // Рендерим продукты
    renderProducts();
    updateStats();
    
    // Загружаем примеры данных, если нет сохранённых
    if (products.length === 0) {
        loadSampleData();
    }
}

// Загрузка примеров данных
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
            date: "2024-01-15"
        },
        {
            id: 2,
            code: "FURN-001",
            name: "Офисное кресло",
            category: "Мебель",
            quantity: 12,
            price: 12499.50,
            description: "Эргономичное кресло с поддержкой спины",
            location: "Склад Б, секция 2",
            date: "2024-01-20"
        },
        {
            id: 3,
            code: "TOOL-001",
            name: "Дрель электрическая",
            category: "Инструменты",
            quantity: 8,
            price: 4599.00,
            description: "Мощная дрель с набором насадок",
            location: "Склад В, ячейка 15",
            date: "2024-01-25"
        },
        {
            id: 4,
            code: "CLOTH-002",
            name: "Футболка",
            category: "Одежда",
            quantity: 10,
            price: 500.50,
            description: "Хлопковая футболка",
            location: "Склад Б, секция 2",
            date: "2024-01-20"
        },
        {
            id: 5,
            code: "BOOK-003",
            name: "Война и мир",
            category: "Книги",
            quantity: 12,
            price: 1299.50,
            description: "Роман Л.Н. Толстого",
            location: "Склад Б, секция 2",
            date: "2024-01-20"
        },
        {
            id: 6,
            code: "FOOD-004",
            name: "Кофе Jacobs",
            category: "Другое",
            quantity: 12,
            price: 800.50,
            description: "Натуральный молотый кофе",
            location: "Склад Б, секция 2",
            date: "2024-01-20"
        }
    ];
    
    products = sampleProducts;
    saveToLocalStorage();
    renderProducts();
    showNotification('Загружены демонстрационные данные', 'success');
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);