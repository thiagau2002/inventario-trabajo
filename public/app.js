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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    btnAddProduct.addEventListener('click', openAddModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    
    // Image Upload & Search
    imagePreview.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    btnSearchImage.addEventListener('click', handleInternetImageSearch);
    btnCloseSearchModal.addEventListener('click', closeSearchModal);
    
    // Form Submit
    productForm.addEventListener('submit', handleFormSubmit);
    
    // Filters
    searchInput.addEventListener('input', renderProducts);
    categoryFilter.addEventListener('change', renderProducts);
}

// Data Management
async function loadData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al conectar con el servidor');
        products = await response.json();
        updateCategories();
        renderProducts();
        updateStats();
        // Hide storage progress logic since we use a backend now
        document.querySelector('.storage-info').style.display = 'none';
    } catch (err) {
        showToast('Error cargando datos: ' + err.message, 'error');
        console.error(err);
    }
}

function updateCategories() {
    categories = new Set(products.map(p => p.category));
    
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
    document.getElementById('product-assigned').value = product.assigned || '';
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

async function handleInternetImageSearch() {
    const productName = document.getElementById('product-name').value.trim();
    if (!productName) {
        showToast('Por favor escribe el Nombre del Elemento primero para buscar', 'error');
        return;
    }
    
    searchModal.style.display = 'flex';
    searchResultsContainer.innerHTML = '';
    searchLoading.style.display = 'block';
    
    try {
        const response = await fetch(`/api/search-images?q=${encodeURIComponent(productName)}`);
        const urls = await response.json();
        
        searchLoading.style.display = 'none';
        
        if (!urls || urls.length === 0 || urls.error) {
            searchResultsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No se encontraron imágenes</p>';
            return;
        }
        
        urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.width = '100%';
            img.style.height = '120px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer';
            img.style.border = '2px solid transparent';
            img.style.transition = 'all 0.2s ease';
            
            img.onmouseover = () => img.style.border = '2px solid var(--accent)';
            img.onmouseout = () => img.style.border = '2px solid transparent';
            
            img.addEventListener('click', () => {
                imgDataInput.value = url;
                imagePreview.style.backgroundImage = `url(${url})`;
                imagePreview.innerHTML = '';
                closeSearchModal();
            });
            
            // Si la imagen falla al cargar, la ocultamos
            img.onerror = () => img.style.display = 'none';
            
            searchResultsContainer.appendChild(img);
        });
        
    } catch (err) {
        searchLoading.style.display = 'none';
        searchResultsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error al buscar imágenes</p>';
    }
}

function closeSearchModal() {
    searchModal.style.display = 'none';
}

function resetImagePreview() {
    imgDataInput.value = '';
    imagePreview.style.backgroundImage = 'none';
    imagePreview.innerHTML = `
        <i class="ph ph-image"></i>
        <span>Click para subir foto</span>
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
        minStock: parseInt(document.getElementById('product-min-stock').value),
        assigned: document.getElementById('product-assigned').value,
        desc: document.getElementById('product-desc').value,
        image: imgDataInput.value
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
window.deleteProduct = async function(id) {
    if(confirm('¿Estás seguro de que deseas eliminar este elemento?')) {
        try {
            await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            showToast('Elemento eliminado', 'success');
            await loadData();
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    }
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
function renderProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterCat = categoryFilter.value;
    
    const filtered = products.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchTerm);
        const matchCat = p.category.toLowerCase().includes(searchTerm);
        const matchAssigned = (p.assigned || '').toLowerCase().includes(searchTerm);
        const matchesSearch = matchName || matchCat || matchAssigned;
        
        const matchesCatFilter = filterCat === 'all' || p.category === filterCat;
        return matchesSearch && matchesCatFilter;
    });

    productsGrid.innerHTML = '';

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
        
        if (product.condition === 'Para reparar') {
            statusClass = 'status-out-stock';
            statusText = 'En Reparación';
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

        const card = document.createElement('div');
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
                        <button class="btn-icon" onclick="editProduct('${product.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-icon delete" onclick="deleteProduct('${product.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

function updateStats() {
    const totalProducts = products.reduce((sum, p) => sum + p.quantity, 0);
    const repairing = products.filter(p => p.condition === 'Para reparar').length;
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
