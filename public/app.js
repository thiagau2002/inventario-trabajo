// State Management
let products = [];
let categories = new Set();
let editModeId = null;

// API URL
const API_URL = '/api/products';

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const modalOverlay = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const btnAddProduct = document.getElementById('btn-add-product');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const modalTitle = document.getElementById('modal-title');
const toastContainer = document.getElementById('toast-container');

// Form Inputs
const imagePreview = document.getElementById('image-preview');
const fileInput = document.getElementById('product-image');
const imgDataInput = document.getElementById('product-image-data');
const categoryList = document.getElementById('category-list');
const btnSearchImage = document.getElementById('btn-search-image');
const searchModal = document.getElementById('image-search-modal');
const btnCloseSearchModal = document.getElementById('btn-close-search-modal');
const searchResultsContainer = document.getElementById('image-search-results');
const searchLoading = document.getElementById('image-search-loading');
const modalSearchInput = document.getElementById('modal-search-input');
const btnTriggerSearch = document.getElementById('btn-trigger-search');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Settings & Theme
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('nav-settings').addEventListener('click', () => {
        settingsModal.classList.add('active');
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    const themeToggle = document.getElementById('theme-toggle');
    const isLightMode = localStorage.getItem('lightMode') === 'true';
    if (isLightMode) {
        document.body.classList.add('light-mode');
        themeToggle.checked = true;
    }
    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('lightMode', 'true');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('lightMode', 'false');
        }
    });

    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

    // View Modes
    document.getElementById('view-mode-grid').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('view-mode-list').addEventListener('click', () => setViewMode('list'));

    // Units Modal
    document.getElementById('btn-close-units').addEventListener('click', () => {
        document.getElementById('units-modal').classList.remove('active');
    });
    document.getElementById('btn-save-units').addEventListener('click', saveUnits);

    btnAddProduct.addEventListener('click', openAddModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    
    // Image Upload & Paste
    imagePreview.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    
    // Paste Image Support
    document.addEventListener('paste', (e) => {
        if (!modalOverlay.classList.contains('active')) return;
        
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const max_size = 800;
                        if (width > height) {
                            if (width > max_size) {
                                height *= max_size / width;
                                width = max_size;
                            }
                        } else {
                            if (height > max_size) {
                                width *= max_size / height;
                                height = max_size;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        imgDataInput.value = dataUrl;
                        imagePreview.style.backgroundImage = `url(${dataUrl})`;
                        imagePreview.innerHTML = '';
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    // Sidebar navigation
    document.getElementById('nav-dashboard').addEventListener('click', () => setNav('dashboard'));
    document.getElementById('nav-items').addEventListener('click', () => setNav('items'));
    document.getElementById('nav-repairs').addEventListener('click', () => setNav('repairs'));
    document.getElementById('nav-assignments').addEventListener('click', () => setNav('assignments'));
    
    // Form Submit
    productForm.addEventListener('submit', handleFormSubmit);
    
    // Filters
    searchInput.addEventListener('input', renderProducts);
    categoryFilter.addEventListener('change', renderProducts);
}

// Data Management
async function loadData() {
    try {
        const [productsRes, categoriesRes] = await Promise.all([
            fetch(API_URL),
            fetch('/api/categories')
        ]);
        if (!productsRes.ok || !categoriesRes.ok) throw new Error('Error al conectar con el servidor');
        products = await productsRes.json();
        const apiCategories = await categoriesRes.json();
        
        // Merge API categories with any new categories in products
        const catNames = apiCategories.map(c => c.name);
        products.forEach(p => { if (p.category) catNames.push(p.category); });
        categories = new Set(catNames);
        
        updateCategoriesUI();
        if (currentNavView === 'dashboard') {
            document.getElementById('products-view').style.display = 'none';
            document.getElementById('dashboard-view').style.display = 'flex';
            renderDashboard();
        } else {
            document.getElementById('products-view').style.display = 'block';
            document.getElementById('dashboard-view').style.display = 'none';
            renderProducts();
        }
        updateStats();
        document.querySelector('.storage-info').style.display = 'none';
    } catch (err) {
        showToast('Error cargando datos: ' + err.message, 'error');
        console.error(err);
    }
}

function updateCategoriesUI() {
    // Update Datalist
    categoryList.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoryList.appendChild(option);
    });

    // Update Filter
    const currentFilter = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    categoryFilter.value = categories.has(currentFilter) ? currentFilter : 'all';
}

function exportToExcel() {
    if (products.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    // Format data for Excel
    const data = products.map(p => ({
        'ID': p.id,
        'Nombre': p.name,
        'Categoría': p.category,
        'Marca/Modelo': p.brand,
        'Nº Serie': p.serial,
        'Ubicación': p.location,
        'Condición': p.condition,
        'Cantidad': p.quantity,
        'Asignado a': p.assigned,
        'Descripción': p.desc
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    
    // Generate file and trigger download
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Backup_Inventario_${dateStr}.xlsx`);
    showToast('Exportación a Excel completada', 'success');
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Form Handlers
function openAddModal() {
    editModeId = null;
    modalTitle.textContent = 'Añadir Elemento';
    productForm.reset();
    document.getElementById('product-condition').value = 'Nuevo';
    resetImagePreview();
    modalOverlay.classList.add('active');
}

function openEditModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    editModeId = id;
    modalTitle.textContent = 'Editar Elemento';
    
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-brand').value = product.brand || '';
    document.getElementById('product-serial').value = product.serial || '';
    document.getElementById('product-location').value = product.location || '';
    document.getElementById('product-condition').value = product.condition || 'Buen estado';
    document.getElementById('product-quantity').value = product.quantity;
    document.getElementById('product-min-stock').value = product.minStock;
    document.getElementById('product-desc').value = product.desc || '';
    
    if (product.image) {
        imgDataInput.value = product.image;
        imagePreview.style.backgroundImage = `url(${product.image})`;
        imagePreview.innerHTML = '';
    } else {
        resetImagePreview();
    }

    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        showToast('La imagen es demasiado grande (Máximo 2MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        // Compress image using canvas
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            imgDataInput.value = dataUrl;
            imagePreview.style.backgroundImage = `url(${dataUrl})`;
            imagePreview.innerHTML = '';
        }
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}



function resetImagePreview() {
    imgDataInput.value = '';
    imagePreview.style.backgroundImage = 'none';
    imagePreview.innerHTML = `
        <i class="ph ph-image" style="font-size: 2rem; margin-bottom: 5px;"></i>
        <span style="font-size: 0.8rem; text-align: center;">Click para subir<br>o Ctrl+V para pegar</span>
    `;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const productData = {
        id: editModeId || generateId(),
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value || 'General',
        brand: document.getElementById('product-brand').value,
        serial: document.getElementById('product-serial').value,
        location: document.getElementById('product-location').value,
        condition: document.getElementById('product-condition').value,
        quantity: parseInt(document.getElementById('product-quantity').value),
        minStock: parseInt(document.getElementById('product-min-stock').value) || 0,
        desc: document.getElementById('product-desc').value,
        image: imgDataInput.value,
        units: '[]'
    };

    try {
        if (editModeId) {
            await fetch(`${API_URL}/${editModeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            showToast('Elemento actualizado', 'success');
        } else {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            showToast('Elemento añadido', 'success');
        }
        await loadData();
        closeModal();
    } catch (err) {
        showToast('Error al guardar datos', 'error');
        console.error(err);
    }
}

// Product Actions
window.deleteProduct = async function deleteProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
    
    fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        .then(() => {
            loadData();
            showToast('Elemento eliminado', 'success');
        })
        .catch(err => showToast('Error al eliminar', 'error'));
}

// Zoom Controls
const zoomSlider = document.getElementById('zoom-slider');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

function updateZoom(value) {
    document.documentElement.style.setProperty('--grid-card-size', `${value}px`);
    localStorage.setItem('inventory-zoom', value);
}

if (zoomSlider && btnZoomIn && btnZoomOut) {
    const savedZoom = localStorage.getItem('inventory-zoom') || '280';
    zoomSlider.value = savedZoom;
    updateZoom(savedZoom);

    zoomSlider.addEventListener('input', (e) => updateZoom(e.target.value));
    
    btnZoomIn.addEventListener('click', () => {
        let val = parseInt(zoomSlider.value) + 20;
        if (val > 350) val = 350;
        zoomSlider.value = val;
        updateZoom(val);
    });
    
    btnZoomOut.addEventListener('click', () => {
        let val = parseInt(zoomSlider.value) - 20;
        if (val < 150) val = 150;
        zoomSlider.value = val;
        updateZoom(val);
    });
}

window.editProduct = function(id) {
    openEditModal(id);
}

window.changeQuantity = async function(id, delta) {
    const product = products.find(p => p.id === id);
    if (product) {
        const newQty = product.quantity + delta;
        if (newQty >= 0) {
            product.quantity = newQty; // optimisic update
            const qtyElement = document.getElementById(`qty-${id}`);
            if (qtyElement) qtyElement.textContent = newQty;
            updateStockBadge(product);
            updateStats();

            try {
                await fetch(`${API_URL}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            } catch(err) {
                // Revert on error
                product.quantity -= delta;
                if (qtyElement) qtyElement.textContent = product.quantity;
                updateStockBadge(product);
                updateStats();
                showToast('Error de red', 'error');
            }
        }
    }
}

function updateStockBadge(product) {
    const badge = document.getElementById(`badge-${product.id}`);
    if(!badge) return;
    
    badge.className = 'status-badge';
    badge.style.background = '';
    
    if (product.condition === 'Para reparar') {
        badge.classList.add('status-out-stock');
        badge.style.background = 'rgba(239, 68, 68, 0.8)';
        badge.textContent = 'En Reparación';
    } else if (product.quantity === 0) {
        badge.classList.add('status-out-stock');
        badge.textContent = 'Agotado';
    } else if (product.quantity <= product.minStock) {
        badge.classList.add('status-low-stock');
        badge.textContent = 'Stock Bajo';
    } else {
        badge.classList.add('status-in-stock');
        badge.textContent = 'Disponible';
    }
}

// Rendering
let currentNavView = 'dashboard';
let currentViewMode = localStorage.getItem('viewMode') || 'grid';
let activeUnitsProductId = null;

function getRepairCount(p) {
    if (p.condition === 'Para reparar') return p.quantity;
    if (p.units && p.units !== '[]') {
        try {
            const unitsArr = JSON.parse(p.units);
            const badUnits = unitsArr.filter(u => u.condition === 'Para reparar').length;
            if (badUnits > 0) return badUnits;
        } catch(e) {}
    }
    return p.condition === 'Atención (Variado)' ? 1 : 0;
}

function setNav(view) {
    currentNavView = view;
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');
    
    if (view === 'dashboard') {
        document.getElementById('products-view').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'flex';
        renderDashboard();
    } else {
        document.getElementById('products-view').style.display = 'block';
        document.getElementById('dashboard-view').style.display = 'none';
        renderProducts();
    }
}

// Global chart variables to destroy before re-rendering
let categoryChartInstance = null;
let statusChartInstance = null;

function renderDashboard() {
    const categoryCounts = {};
    const statusCounts = {};
    
    products.forEach(p => {
        // Category count
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + p.quantity;
        
        // Status count
        let units = [];
        try { units = JSON.parse(p.units || '[]'); } catch(e) {}
        
        if (units.length > 0) {
            units.forEach(u => {
                statusCounts[u.condition] = (statusCounts[u.condition] || 0) + 1;
            });
        } else {
            statusCounts[p.condition] = (statusCounts[p.condition] || 0) + p.quantity;
        }
    });

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#0f172a' : '#ffffff';

    // 1. Render Category Chart (Pie)
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(catCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryCounts),
                datasets: [{
                    data: Object.values(categoryCounts),
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                }
            }
        });
    }

    // 2. Render Status Chart (Bar)
    const statCtx = document.getElementById('statusChart');
    if (statCtx) {
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: 'Unidades',
                    data: Object.values(statusCounts),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: textColor } },
                    y: { ticks: { color: textColor }, beginAtZero: true }
                }
            }
        });
    }
    
    // 3. Render Category Blocks
    const grid = document.getElementById('dashboard-categories-grid');
    grid.innerHTML = '';
    
    Object.keys(categoryCounts).forEach(cat => {
        const count = categoryCounts[cat];
        const block = document.createElement('div');
        block.className = 'glass-panel';
        block.style.padding = '1.5rem';
        block.style.cursor = 'pointer';
        block.style.transition = 'transform 0.2s';
        block.innerHTML = `
            <div style="font-size: 2rem; color: var(--primary); margin-bottom: 10px;"><i class="ph ph-folder"></i></div>
            <h4 style="margin: 0; font-size: 1.1rem;">${cat}</h4>
            <p style="margin: 5px 0 0; color: var(--text-muted); font-size: 0.9rem;">${count} unidades</p>
        `;
        block.onmouseover = () => block.style.transform = 'translateY(-5px)';
        block.onmouseout = () => block.style.transform = 'translateY(0)';
        block.onclick = () => {
            // Switch to items view and filter by this category
            categoryFilter.value = cat;
            setNav('items');
        };
        grid.appendChild(block);
    });
}

function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    document.getElementById('view-mode-grid').classList.toggle('active', mode === 'grid');
    document.getElementById('view-mode-list').classList.toggle('active', mode === 'list');
    renderProducts();
}

window.openUnitsModal = function(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    activeUnitsProductId = id;
    
    let units = [];
    try {
        units = JSON.parse(product.units || '[]');
    } catch(e) { units = []; }
    
    const container = document.getElementById('units-list');
    container.innerHTML = '';
    
    // Ensure array has exactly product.quantity elements
    if (!Array.isArray(units)) units = [];
    while (units.length < product.quantity) {
        units.push({ id: units.length + 1, condition: product.condition || 'Buen estado', serial: '', assigned: '' });
    }
    if (units.length > product.quantity) {
        units = units.slice(0, product.quantity);
    }
    
    units.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = 'unit-item';
        div.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px; flex-grow:1;">
                <strong style="font-size: 0.9rem;">Unidad #${i + 1}</strong>
                <input type="text" class="glass-input unit-serial" placeholder="Nº de Serie individual" value="${u.serial || ''}" style="font-size: 0.8rem; padding: 4px 8px;">
                <div style="display:flex; gap: 5px; align-items:center;">
                    <input type="text" class="glass-input unit-assigned" placeholder="Asignado a" value="${u.assigned || ''}" style="font-size: 0.8rem; padding: 4px 8px; flex-grow:1;">
                    <button class="btn-icon" title="Asignar Rápido a Donación" onclick="this.previousElementSibling.value='Donación'" style="background: rgba(236, 72, 153, 0.2); color: #ec4899; padding: 4px 6px; border-radius: 4px;"><i class="ph ph-gift"></i></button>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                <select class="glass-select unit-condition" style="font-size: 0.85rem;">
                    <option value="Nuevo" ${u.condition==='Nuevo'?'selected':''}>Nuevo</option>
                    <option value="Buen estado" ${u.condition==='Buen estado'?'selected':''}>Buen estado</option>
                    <option value="Usado" ${u.condition==='Usado'?'selected':''}>Usado</option>
                    <option value="Para reparar" ${u.condition==='Para reparar'?'selected':''}>Para reparar</option>
                    <option value="Dañado" ${u.condition==='Dañado'?'selected':''}>Dañado</option>
                    <option value="Perdido" ${u.condition==='Perdido'?'selected':''}>Perdido</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('units-modal').classList.add('active');
}

async function saveUnits() {
    const product = products.find(p => p.id === activeUnitsProductId);
    if (!product) return;
    
    const container = document.getElementById('units-list');
    const items = container.querySelectorAll('.unit-item');
    let newUnits = [];
    let needsRepair = 0;
    
    items.forEach((item, index) => {
        const condition = item.querySelector('.unit-condition').value;
        const serial = item.querySelector('.unit-serial').value;
        const assigned = item.querySelector('.unit-assigned').value.trim();
        if (condition === 'Para reparar') needsRepair++;
        newUnits.push({ id: index + 1, condition, serial, assigned });
    });
    
    product.units = JSON.stringify(newUnits);
    
    // Automatically update the main condition if all are identical or if some need repair
    if (needsRepair > 0) {
        if (needsRepair === product.quantity) product.condition = 'Para reparar';
        else product.condition = 'Atención (Variado)'; // Or we keep the main one
    } else {
        const allSame = newUnits.every(u => u.condition === newUnits[0].condition);
        if (allSame && newUnits.length > 0) product.condition = newUnits[0].condition;
    }
    
    // Automatically update the main 'assigned' field
    const uniqueAssignments = [...new Set(newUnits.map(u => u.assigned).filter(a => a !== ''))];
    if (uniqueAssignments.length === 0) {
        product.assigned = '';
    } else if (uniqueAssignments.length === 1) {
        product.assigned = uniqueAssignments[0];
    } else {
        product.assigned = 'Varias asignaciones';
    }
    
    try {
        await fetch(`${API_URL}/${product.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        showToast('Unidades guardadas', 'success');
        document.getElementById('units-modal').classList.remove('active');
        renderProducts();
        updateStats();
    } catch(err) {
        showToast('Error al guardar unidades', 'error');
    }
}

function renderProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterCat = categoryFilter.value;
    
    const filtered = products.filter(p => {
        // Navigation Filters
        if (currentNavView === 'items') {
            // Show all (maybe hide repairs?)
        } else if (currentNavView === 'repairs') {
            if (getRepairCount(p) === 0) return false;
        } else if (currentNavView === 'assignments') {
            if (!p.assigned || p.assigned.trim() === '') return false;
        }
        
        // Search & Cat Filters
        const matchName = p.name.toLowerCase().includes(searchTerm);
        const matchCat = p.category.toLowerCase().includes(searchTerm);
        const matchAssigned = (p.assigned || '').toLowerCase().includes(searchTerm);
        const matchesSearch = matchName || matchCat || matchAssigned;
        
        const matchesCatFilter = filterCat === 'all' || p.category === filterCat;
        return matchesSearch && matchesCatFilter;
    });

    productsGrid.innerHTML = '';
    productsGrid.className = currentViewMode === 'list' ? 'products-list' : 'products-grid';

    if (filtered.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-package"></i>
                <p>No se encontraron elementos.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(product => {
        let statusClass = 'status-in-stock';
        let statusText = 'Disponible';
        let customBadgeStyle = '';
        
        const repairs = getRepairCount(product);
        if (repairs > 0) {
            statusClass = 'status-out-stock';
            statusText = repairs === product.quantity ? 'En Reparación' : `Reparando (${repairs})`;
            customBadgeStyle = 'background: rgba(239, 68, 68, 0.8);';
        } else if (product.quantity === 0) {
            statusClass = 'status-out-stock';
            statusText = 'Agotado';
        } else if (product.quantity <= product.minStock) {
            statusClass = 'status-low-stock';
            statusText = 'Stock Bajo';
        }

        const imgHtml = product.image 
            ? `<img src="${product.image}" alt="${product.name}" class="product-img">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.2);"><i class="ph ph-image" style="font-size:3rem;"></i></div>`;

        const unitsBtnHtml = `<button class="btn-icon" onclick="openUnitsModal('${product.id}')" title="Gestionar / Asignar Unidades"><i class="ph ph-stack"></i></button>`;

        const card = document.createElement('div');
        if (currentViewMode === 'list') {
            card.className = 'product-list-item';
            card.innerHTML = `
                <div class="product-img-wrapper" style="position:relative;">
                    ${imgHtml}
                </div>
                <div class="product-list-info">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 class="product-name" style="margin:0;">${product.name}</h3>
                        <span class="status-badge ${statusClass}" style="position:static; padding: 2px 8px; ${customBadgeStyle}">${statusText}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                        <span style="color:var(--primary); font-weight:600;">${product.category}</span>
                        ${product.brand ? ` | ${product.brand}` : ''}
                        ${product.assigned ? ` | Asignado a: ${product.assigned}` : ''}
                    </div>
                </div>
                <div class="product-list-controls">
                    <div class="qty-control" style="margin:0;">
                        <button class="qty-btn" onclick="changeQuantity('${product.id}', -1)"><i class="ph ph-minus"></i></button>
                        <span class="qty-display" id="qty-${product.id}">${product.quantity}</span>
                        <button class="qty-btn" onclick="changeQuantity('${product.id}', 1)"><i class="ph ph-plus"></i></button>
                    </div>
                    ${unitsBtnHtml}
                    <button class="btn-icon" onclick="editProduct('${product.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon delete" onclick="deleteProduct('${product.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
                </div>
            `;
        } else {
            card.className = 'product-card glass-panel';
            card.innerHTML = `
                <div class="product-img-wrapper">
                    <span class="status-badge ${statusClass}" id="badge-${product.id}" style="${customBadgeStyle}">${statusText}</span>
                    ${imgHtml}
                </div>
                <div class="product-info">
                    <span class="product-category">${product.category}</span>
                    <h3 class="product-name" title="${product.name}" style="margin-bottom: 0.2rem;">${product.name}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${product.brand ? `<span>${product.brand}</span>` : ''} 
                        ${product.serial ? `<span style="margin-left: 8px; padding-left: 8px; border-left: 1px solid var(--glass-border);"><i class="ph ph-barcode" style="vertical-align: middle;"></i> ${product.serial}</span>` : ''}
                    </div>
                    
                    <div class="item-details-grid">
                        <div title="Ubicación"><i class="ph ph-map-pin"></i> ${product.location || 'Sin ubicación'}</div>
                        <div title="Estado"><i class="ph ph-activity"></i> ${product.condition || 'N/A'}</div>
                        ${product.assigned ? `<div class="assigned-row" title="Asignado a"><i class="ph ph-user"></i> ${product.assigned}</div>` : ''}
                    </div>
                    
                    <div class="product-controls">
                        <div class="qty-control">
                            <button class="qty-btn" onclick="changeQuantity('${product.id}', -1)"><i class="ph ph-minus"></i></button>
                            <span class="qty-display" id="qty-${product.id}">${product.quantity}</span>
                            <button class="qty-btn" onclick="changeQuantity('${product.id}', 1)"><i class="ph ph-plus"></i></button>
                        </div>
                        <div class="card-actions">
                            ${unitsBtnHtml}
                            <button class="btn-icon" onclick="editProduct('${product.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                            <button class="btn-icon delete" onclick="deleteProduct('${product.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }
        productsGrid.appendChild(card);
    });
}

function updateStats() {
    const totalProducts = products.reduce((sum, p) => sum + p.quantity, 0);
    const repairing = products.reduce((sum, p) => sum + getRepairCount(p), 0);
    const lowStock = products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length;

    document.getElementById('stat-total-products').textContent = totalProducts;
    document.getElementById('stat-repair').textContent = repairing;
    document.getElementById('stat-low-stock').textContent = lowStock;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    
    toast.innerHTML = `
        <i class="ph ${icon}" style="font-size: 1.5rem;"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
