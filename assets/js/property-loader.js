// Clase para manejar el loader
class LoaderManager {
    constructor() {
        this.loader = document.getElementById('loader');
        this.body = document.body;
        this.isVisible = false;
        this.init();
    }

    init() {
        window.addEventListener('load', () => {
            this.hideLoader();
        });

        setTimeout(() => {
            this.hideLoader();
        }, 5000);
    }

    showLoader() {
        if (this.loader && !this.isVisible) {
            this.loader.style.display = 'flex';
            this.loader.classList.remove('loader-hidden');
            this.isVisible = true;
            this.body.style.overflow = 'hidden';
        }
    }

    hideLoader() {
        if (this.loader && this.isVisible) {
            this.loader.classList.add('loader-hidden');
            this.isVisible = false;
            
            setTimeout(() => {
                this.loader.style.display = 'none';
                this.body.classList.add('loaded');
                this.body.style.overflow = 'visible';
            }, 500);
        }
    }
}

const loaderManager = new LoaderManager();

// Variables globales
let currentPage = 1;
let lastLoadedPage = 0;
let isLoading = false;
const propertiesContainer = document.querySelector('.seccion_prop_tars');

// Estado de los filtros
let currentFilters = {
    operation_type: '',
    property_variant: '',
    min_price: '',
    max_price: '',
    search: '',
    bedrooms: '',
    bathrooms: '',
    surface_min: '',
    surface_max: '',
    age: ''
};

// Estado temporal de los filtros
let tempFilters = {
    operation_type: '',
    property_variant: '',
    min_price: '',
    max_price: '',
    search: '',
    bedrooms: '',
    bathrooms: '',
    surface_min: '',
    surface_max: '',
    age: ''
};

function formatNumber(value) {
    if (!value) return '';
    // Removemos todo excepto números
    const numbers = value.toString().replace(/\D/g, '');
    // Formateamos con comas
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function unformatNumber(value) {
    if (!value) return '';
    // Removemos todo excepto números
    return value.toString().replace(/\D/g, '');
}

function setupNumberFormatter(input, onValueChange) {
    let previousValue = '';
    let previousCursorPosition = 0;

    // Determinar el límite basado en el placeholder
    const isPrice = input.placeholder.includes('MXN');
    const maxDigits = isPrice ? 15 : 10; // 15 dígitos para precios, 10 para superficie

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') return;
        
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/[\d]/.test(char) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            e.preventDefault();
        }
    });

    input.addEventListener('keydown', function(e) {
        previousValue = this.value;
        previousCursorPosition = this.selectionStart;
    });

    input.addEventListener('input', function(e) {
        const unformattedValue = unformatNumber(this.value);
        
        if (!unformattedValue) {
            this.value = '';
            if (onValueChange) {
                onValueChange('');
            }
            return;
        }

        // Validar longitud máxima según el tipo
        if (unformattedValue.length > maxDigits) {
            this.value = previousValue;
            return;
        }

        const formattedValue = formatNumber(unformattedValue);
        const cursorPosition = this.selectionStart;
        
        const commasBefore = (previousValue.slice(0, previousCursorPosition).match(/,/g) || []).length;
        const commasAfter = (formattedValue.slice(0, cursorPosition).match(/,/g) || []).length;
        const commasDiff = commasAfter - commasBefore;

        this.value = formattedValue;

        const newPosition = cursorPosition + commasDiff;
        this.setSelectionRange(newPosition, newPosition);

        if (onValueChange) {
            onValueChange(unformattedValue);
        }

        previousValue = formattedValue;
        previousCursorPosition = newPosition;
    });

    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const unformattedValue = unformatNumber(pastedText);
        
        if (unformattedValue.length > maxDigits) return;
        
        const formattedValue = formatNumber(unformattedValue);
        this.value = formattedValue;
        
        if (onValueChange) {
            onValueChange(unformattedValue);
        }
    });

    input.addEventListener('blur', function() {
        if (!this.value.trim()) {
            this.value = '';
            if (onValueChange) {
                onValueChange('');
            }
        }
    });
}

// Funciones de tracking
async function trackPropertyExposure(property, exposureData) {
    try {
        // Asegurar que los filtros actuales están definidos
        const currentFilters = { ...exposureData.search_filters } || {};
        
        // Crear un objeto de filtros limpio con solo los valores definidos
        const formattedFilters = Object.entries(currentFilters).reduce((acc, [key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {});

        const data = {
            type: 'exposure',
            property_id: property.id,
            page_number: exposureData.page,
            position: exposureData.position,
            total_results: exposureData.total_results,
            search_query: document.querySelector('.buscador_inter_sup input')?.value?.trim() || '',
            search_filters: JSON.stringify(formattedFilters)
        };

        console.log('Sending exposure data:', data);

        const response = await fetch('/api/propiedades/track_property.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log('Server response:', result);

    } catch (error) {
        console.error('Error tracking exposure:', error);
    }
}

async function trackPropertyView(propertyId) {
    try {
        const data = {
            property_id: propertyId,
            referrer: document.referrer,
            interaction_type: 'brief',
            type: 'view'
        };

        await fetch('/api/propiedades/track_property.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error al registrar vista:', error);
    }
}

// Función principal para cargar propiedades
async function loadProperties(page = 1, filters = {}) {
    if (isLoading) return;
    
    try {
        isLoading = true;
        loaderManager.showLoader();
        
        page = Math.max(1, parseInt(page) || 1);
        
        const queryParams = new URLSearchParams({
            page: page,
            limit: 9,
            score_order: 'desc',
            ...filters
        });
        
        const response = await fetch(`/api/propiedades/get_properties.php?${queryParams}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            let sectionContainer = document.querySelector('.seccion_prop_tar');
            if (!sectionContainer) {
                sectionContainer = document.createElement('div');
                sectionContainer.className = 'seccion_prop_tar';
                propertiesContainer.appendChild(sectionContainer);
            }
            sectionContainer.innerHTML = '';
            
            if (data.pagination.total_pages > 0 && page > data.pagination.total_pages) {
                return loadProperties(data.pagination.total_pages, filters);
            }

            if (data.data && data.data.length > 0) {
                const seenIds = new Set();
                const uniqueProperties = data.data.filter(property => {
                    if (seenIds.has(property.id)) {
                        return false;
                    }
                    seenIds.add(property.id);
                    return true;
                });

                displayProperties(uniqueProperties);
            } else {
                showNoResultsMessage(sectionContainer);
            }

            updatePagination(data.pagination);
            updateTotalResults({
                from: data.pagination.from,
                to: data.pagination.to,
                total: data.pagination.total
            });

            const url = new URL(window.location);
            url.searchParams.set('page', page);
            window.history.replaceState({}, '', url);

        } else {
            showError('No se pudieron cargar las propiedades');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar las propiedades');
    } finally {
        isLoading = false;
        loaderManager.hideLoader();
    }
}

// Función para mostrar las propiedades
function displayProperties(properties) {
    let sectionContainer = document.querySelector('.seccion_prop_tar');
    
    if (!sectionContainer) {
        sectionContainer = document.createElement('div');
        sectionContainer.className = 'seccion_prop_tar';
        propertiesContainer.appendChild(sectionContainer);
    }

    // Tracking de propiedades
    properties.forEach((property, index) => {
        trackPropertyExposure(property, {
            page: currentPage,
            position: index + 1,
            total_results: properties.length,
            search_filters: { ...currentFilters }
        });
    });

    if (properties.length === 0) {
        showNoResultsMessage(sectionContainer);
        return;
    }

    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .titulo_tarjet {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin: 15px 0;
            font-size: 16px;
            line-height: 1.2;
            height: 19px;
        }

        .tarjet_info_p {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            margin: 10px 0;
            height: auto;
            max-height: 42px;
            line-height: 1.5;
        }
    `;
    document.head.appendChild(styleElement);

    const fragment = document.createDocumentFragment();

    properties.forEach(property => {
        const propertyCard = document.createElement('div');
        propertyCard.className = 'tarjet_prop';
        propertyCard.dataset.propertyId = property.id;
        propertyCard.innerHTML = `
            <div class="tarjet_info_img">
                <div class="tip_trans">
                    <span>${property.operation_type_name}</span>
                </div>
                <img src="${property.main_image}" alt="${property.title}" 
                     onerror="this.onerror=null; this.src='/assets/img/placeholder.jpg';">
                ${property.total_score >= 80 ? `
                    <div class="dueno">
                        <img src="${property.owner?.company?.logo || '/assets/img/vendedor.png?v=1.0.1'}" 
                             alt="Logo de ${property.owner?.company?.name || 'Vendedor'}"
                             onerror="this.onerror=null; this.src='/assets/img/vendedor.png?v=1.0.1';">
                    </div>
                ` : ''}
            </div>
            <h3 class="titulo_tarjet" title="${property.title}">${property.title}</h3>
            <p class="tarjet_info_p">${property.description_short || property.description}</p>
            <div class="info_min_deta">
                <div class="info_min_sec"> 
                    <img src="/assets/img/cama.png" alt="Recámaras">
                    <p>${property.bedrooms || '0'}</p>
                </div>
                <div class="info_min_sec">
                    <img src="/assets/img/bano.png" alt="Baños">
                    <p>${property.bathrooms || '0'}</p>
                </div>
                <div class="info_min_sec">
                    <img src="/assets/img/casa.png" alt="Tipo">
                    <p>${property.property_type_name}</p>
                </div>
            </div>
            <div class="info_mas_deta">
                <div class="info_pre_deta">
                    <p>Precio:</p>
                    <h3>$${property.price_formatted} MXN</h3>
                </div>
                <a href="/propiedad.html?id=${property.id}&position=${properties.indexOf(property) + 1}&page=${currentPage}" 
                    class="property-link"
                    data-property-id="${property.id}"
                    style="width: 45%;">
                        <button>Ver Detalles</button>
                </a>
            </div>
        `;

        const propertyLink = propertyCard.querySelector('.property-link');
        if (propertyLink) {
            propertyLink.addEventListener('click', function(e) {
                const propertyId = this.dataset.propertyId;
                trackPropertyView(propertyId);
            });
        }
                
        fragment.appendChild(propertyCard);
    });

    sectionContainer.appendChild(fragment);
    initializeTooltips();
    setupLazyLoading();
}

// Función para mostrar mensaje de no resultados
function showNoResultsMessage(container) {
    container.innerHTML = `
        <div class="tarjet_prop" style="display: flex; justify-content: center; align-items: center; text-align: center;">
            <div>
                <h3>No se encontraron propiedades</h3>
                <p style="color: var(--colorp);">Intenta con otros filtros de búsqueda</p>
            </div>
        </div>
    `;
}

// Función para mostrar error
function showError(message) {
    let sectionContainer = document.querySelector('.seccion_prop_tar');
    if (!sectionContainer) {
        sectionContainer = document.createElement('div');
        sectionContainer.className = 'seccion_prop_tar';
        propertiesContainer.appendChild(sectionContainer);
    }

    sectionContainer.innerHTML = `
        <div class="tarjet_prop" style="display: flex; justify-content: center; align-items: center; text-align: center;">
            <div>
                <h3 style="color: var(--error);">${message}</h3>
                <button onclick="loadProperties(1, currentFilters)" 
                        style="background-color: var(--principal); border: none; padding: 10px 20px; border-radius: 10px; margin-top: 20px;">
                    Reintentar
                </button>
            </div>
        </div>
    `;
}

// Función para actualizar la paginación
function updatePagination(pagination) {
    if (!pagination || !pagination.total_pages) return;

    const totalPages = parseInt(pagination.total_pages);
    const currentPage = parseInt(pagination.current_page);
    
    if (totalPages < 1 || currentPage < 1) return;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';
    paginationContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        margin: 20px 0 40px;
        flex-wrap: wrap;
    `;

    // Información de página actual
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.style.cssText = `
        width: 100%;
        text-align: center;
        margin-bottom: 10px;
        color: var(--colorp);
        font-family: var(--txt);
    `;
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    // Contenedor de botones
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
    `;

    // Botones de paginación
    if (currentPage > 2) {
        buttonsContainer.appendChild(createPaginationButton('1', () => changePage(1)));
    }

    if (currentPage > 1) {
        buttonsContainer.appendChild(createPaginationButton('Anterior', () => changePage(currentPage - 1)));
    }

    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        const button = createPaginationButton(i.toString(), () => changePage(i));
        if (i === currentPage) {
            button.style.backgroundColor = 'var(--principal)';
            button.style.color = 'white';
        }
        buttonsContainer.appendChild(button);
    }

    if (currentPage < totalPages) {
        buttonsContainer.appendChild(createPaginationButton('Siguiente', () => changePage(currentPage + 1)));
    }

    if (currentPage < totalPages - 1) {
        buttonsContainer.appendChild(createPaginationButton(totalPages.toString(), () => changePage(totalPages)));
    }

    paginationContainer.appendChild(buttonsContainer);

    const existingPagination = document.querySelector('.pagination');
    if (existingPagination) {
        existingPagination.replaceWith(paginationContainer);
    } else {
        propertiesContainer.after(paginationContainer);
    }
}

// Función para crear botones de paginación
function createPaginationButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    button.style.cssText = `
        padding: 8px 16px;
        background-color: var(--contenedor);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--colortxt);
        cursor: pointer;
        font-family: var(--txt);
        transition: background-color 0.3s;
        min-width: 44px;
        text-align: center;
    `;
    button.onmouseover = () => {
        if (button.style.backgroundColor !== 'var(--principal)') {
            button.style.backgroundColor = 'var(--border)';
        }
    };
    button.onmouseout = () => {
        if (button.style.backgroundColor !== 'var(--principal)') {
            button.style.backgroundColor = 'var(--contenedor)';
        }
    };
    return button;
}

// Función para actualizar el contador de resultados
function updateTotalResults({ from, to, total }) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-count';
    resultsContainer.style.cssText = `
        text-align: center;
        margin: 20px 0;
        color: var(--colorp);
        font-family: var(--txt);
    `;
    
    let text;
    if (total === 0) {
        text = 'No se encontraron propiedades';
    } else if (from === to) {
        text = `Mostrando la propiedad ${from} de ${total}`;
    } else {
        text = `Mostrando propiedades ${from} - ${to} de ${total}`;
    }
    
    resultsContainer.innerHTML = `<p>${text}</p>`;
    
    const existingResults = document.querySelector('.results-count');
    if (existingResults) {
        existingResults.replaceWith(resultsContainer);
    } else {
        propertiesContainer.before(resultsContainer);
    }
}

// Función para cambiar de página
function changePage(page) {
    if (isLoading || page === currentPage) return;
    
    currentPage = page;
    loadProperties(currentPage, currentFilters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Función para inicializar filtros
function initializeFilters() {
    const searchInput = document.querySelector('.buscador_inter_sup input');
    const searchButton = document.querySelector('.buscador_inter_sup button');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            tempFilters.search = e.target.value;
        });

        // Agregar evento para la tecla Enter
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            applyFilters();
        });
    }

    // Event listeners para tipo de operación
    document.querySelectorAll('input[name="operacion"]').forEach(input => {
        input.addEventListener('change', (e) => {
            tempFilters.operation_type = e.target.value;
        });
    });

    // Event listeners para tipo de propiedad
    document.querySelectorAll('input[name="tipo_inmueble"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const checkedBoxes = document.querySelectorAll('input[name="tipo_inmueble"]:checked');
            tempFilters.property_variant = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        });
    });

    // Configurar formato para inputs de precio
    const priceInputs = document.querySelectorAll('.opciones_inputs input[placeholder*="MXN"]');
    priceInputs.forEach(input => {
        setupNumberFormatter(input, (value) => {
            if (input.placeholder.includes('Desde')) {
                tempFilters.min_price = value;
            } else {
                tempFilters.max_price = value;
            }
        });
    });

    // Configurar formato para inputs de superficie
    const surfaceInputs = document.querySelectorAll('.opciones_inputs input[placeholder*="m²"]');
    surfaceInputs.forEach(input => {
        setupNumberFormatter(input, (value) => {
            if (input.placeholder.includes('Desde')) {
                tempFilters.surface_min = value;
            } else {
                tempFilters.surface_max = value;
            }
        });
    });

    // Event listeners para habitaciones y baños
    document.querySelectorAll('input[name="bedrooms"]').forEach(input => {
        input.addEventListener('change', (e) => {
            tempFilters.bedrooms = e.target.value;
        });
    });

    document.querySelectorAll('input[name="bathrooms"]').forEach(input => {
        input.addEventListener('change', (e) => {
            tempFilters.bathrooms = e.target.value;
        });
    });

    // Event listeners para antigüedad
    document.querySelectorAll('input[name="antiguedad"]').forEach(input => {
        input.addEventListener('change', (e) => {
            tempFilters.age = e.target.value;
        });
    });

    // Manejador para los toggles de selectores
    document.querySelectorAll('.select_flecha input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const optionsContainer = this.closest('.opciones_select').querySelector('.opciones');
            if (optionsContainer) {
                optionsContainer.style.display = this.checked ? 'block' : 'none';
            }
        });
    });

    // Cerrar selectores al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.opciones_select')) {
            document.querySelectorAll('.opciones').forEach(container => {
                container.style.display = 'none';
            });
            document.querySelectorAll('.select_flecha input').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    });
}

// Función para aplicar los filtros
function applyFilters() {
    const newFilters = {};
    
    // Solo incluir filtros que tengan valores 
    Object.entries(tempFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            newFilters[key] = value;
        }
    });

    // Actualizar filtros actuales solo si hay cambios
    if (Object.keys(newFilters).length > 0) {
        currentFilters = newFilters;
        // Reiniciar página al aplicar nuevos filtros
        currentPage = 1;
        loadProperties(currentPage, currentFilters);
    }
}

// Función para limpiar todos los filtros
function clearAllFilters() {
    tempFilters = {
        operation_type: '',
        property_variant: '',
        min_price: '',
        max_price: '',
        search: '',
        bedrooms: '',
        bathrooms: '',
        surface_min: '',
        surface_max: '',
        age: ''
    };
    currentFilters = { ...tempFilters };

    // Limpiar todos los inputs y resetear su formato
    document.querySelectorAll('.opciones_inputs input').forEach(input => {
        input.value = '';
    });

    // Resto de la función clearAllFilters (sin cambios)
    const searchInput = document.querySelector('.buscador_inter_sup input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });

    document.querySelectorAll('.opciones').forEach(container => {
        container.style.display = 'none';
    });

    currentPage = 1;
    lastLoadedPage = 0;
    loadProperties(1, currentFilters);
}

// Utilidades
function initializeTooltips() {
    document.querySelectorAll('.titulo_tarjet').forEach(title => {
        if (title.scrollWidth > title.clientWidth) {
            title.title = title.textContent;
        }
    });
}

function setupLazyLoading() {
    const images = document.querySelectorAll('.tarjet_info_img img');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => {
        if (!img.src && img.dataset.src) {
            imageObserver.observe(img);
        }
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loaderManager.showLoader();
    initializeFilters();
    
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = parseInt(urlParams.get('page'));
    if (pageParam && pageParam > 0) {
        currentPage = pageParam;
    }
    
    loadProperties(currentPage, currentFilters).catch(error => {
        console.error('Error en la carga inicial:', error);
        loaderManager.hideLoader();
    });
});

// Manejar estado del loader en navegación
window.addEventListener('beforeunload', () => {
    loaderManager.showLoader();
});

// Exportar funciones útiles
window.propertyLoader = {
    loadProperties,
    clearAllFilters,
    changePage,
    loaderManager,
    trackPropertyView,
    trackPropertyExposure,
    applyFilters
};