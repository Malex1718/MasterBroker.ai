class PropertyCardManager {
    constructor() {
        this.container = document.querySelector('.dashboard_container');
        this.filterSection = this.container.querySelector('.filtros_publicaciones');
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMorePages = true;
        this.itemsPerPage = 10;
        this.totalPages = 1;
        this.loader = document.getElementById('loader');
        this.defaultImage = '/assets/img/no-image.png';
        this.setupModal();
        this.setupFilters();
        this.setupPagination();
        this.setupLazyLoading();
        this.loadProperties();
    }

    setupModal() {
        // Crear el contenedor del modal si no existe
        if (!document.getElementById('modal-container')) {
            const modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);

            // Crear el HTML del modal
            const modalHTML = `
                <div id="finish-property-modal" class="modal" style="display: none;">
                    <div class="modal-overlay"></div>
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 class="modal-title"></h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-content">
                            <form id="finish-property-form">
                                <div class="form-group">
                                    <label for="finish-reason">Razón</label>
                                    <select id="finish-reason" required>
                                        <option value="">Selecciona una razón</option>
                                        <option value="sold">Venta exitosa</option>
                                        <option value="external_sale">Operación cerrada fuera del portal</option>
                                        <option value="temporarily_unavailable">Propiedad no disponible temporalmente</option>
                                        <option value="conditions_changed">Cambio de condiciones</option>
                                        <option value="cancelled">Ya no se desea vender/rentar</option>
                                        <option value="duplicate">Duplicado</option>
                                        <option value="error">Error en la publicación</option>
                                        <option value="expired">Expiración natural del anuncio</option>
                                        <option value="other">Otro</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="finish-notes">Notas adicionales (opcional)</label>
                                    <textarea id="finish-notes" rows="4"></textarea>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn-cancel">Cancelar</button>
                                    <button type="submit" class="btn-confirm"></button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            modalContainer.innerHTML = modalHTML;

            // Agregar estilos del modal
            const styleSheet = document.createElement("style");
            styleSheet.textContent = `
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 100;
                }
                .modal-overlay {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                }
                .modal-container {
                    position: relative;
                    width: 90%;
                    max-width: 500px;
                    margin: 50px auto;
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }
                .btn-cancel,
                .btn-confirm {
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .btn-cancel {
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                }
                .btn-confirm {
                    background: #2563eb;
                    color: white;
                    border: none;
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    showFinishModal(propertyId, action) {
        const modal = document.getElementById('finish-property-modal');
        const form = document.getElementById('finish-property-form');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const title = modal.querySelector('.modal-title');
        const confirmBtn = modal.querySelector('.btn-confirm');

        // Configurar el modal según la acción
        if (action === 'archive') {
            title.textContent = 'Archivar publicación';
            confirmBtn.textContent = 'Archivar';
        } else {
            title.textContent = 'Finalizar publicación';
            confirmBtn.textContent = 'Finalizar';
        }

        const handleSubmit = async (e) => {
            e.preventDefault();
            const reason = document.getElementById('finish-reason').value;
            const notes = document.getElementById('finish-notes').value;

            if (!reason) {
                alert('Por favor selecciona una razón');
                return;
            }

            try {
                const response = await fetch('/api/propiedades/update_status.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        property_id: propertyId,
                        status: action === 'archive' ? 'archived' : 'finished',
                        finish_reason: reason,
                        finish_notes: notes
                    })
                });

                const result = await response.json();
                
                if (result.status === 'success') {
                    await this.loadProperties();
                    modal.style.display = 'none';
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Error al actualizar el estado:', error);
                alert('Error al actualizar el estado de la publicación');
            }
        };

        const closeModal = () => {
            modal.style.display = 'none';
            form.removeEventListener('submit', handleSubmit);
            closeBtn.removeEventListener('click', closeModal);
            cancelBtn.removeEventListener('click', closeModal);
        };

        // Agregar event listeners
        form.addEventListener('submit', handleSubmit);
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Mostrar el modal
        modal.style.display = 'block';
    }

    setupFilters() {
        const statusSelect = this.filterSection.querySelector('.buscar_publicacion select');
        if (statusSelect) {
            statusSelect.innerHTML = `
                <option value="">Todos los estados</option>
                <option value="published">Activos</option>
                <option value="draft">Borradores</option>
                <option value="finished">Finalizados</option>
                <option value="archived">Archivados</option>
            `;

            statusSelect.addEventListener('change', () => {
                this.currentPage = 1;
                this.loadProperties();
            });
        }

        const searchInput = this.filterSection.querySelector('.buscar_publicacion input');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadProperties();
                }, 500);
            });
        }
    }

    setupPagination() {
        let paginationContainer = this.container.querySelector('.pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';
    
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Anterior';
            prevButton.className = 'pagination-prev';
            prevButton.addEventListener('click', () => this.changePage(this.currentPage - 1));
            
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Siguiente';
            nextButton.className = 'pagination-next';
            nextButton.addEventListener('click', () => this.changePage(this.currentPage + 1));
    
            this.pageNumbersContainer = document.createElement('div');
            this.pageNumbersContainer.className = 'page-numbers';
    
            paginationContainer.appendChild(prevButton);
            paginationContainer.appendChild(this.pageNumbersContainer);
            paginationContainer.appendChild(nextButton);
    
            this.container.appendChild(paginationContainer);
        }
    
        this.updatePagination();
    }

    updatePaginationButtons(prevButton, nextButton) {
        prevButton.disabled = this.currentPage === 1;
        nextButton.disabled = this.currentPage >= this.totalPages;
    }

    renderPageNumbers() {
        this.pageNumbersContainer.innerHTML = '';
        
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            this.addPageNumber(1);
            if (startPage > 2) {
                this.addEllipsis();
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(i);
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                this.addEllipsis();
            }
            this.addPageNumber(this.totalPages);
        }
    }

    addPageNumber(pageNum) {
        const pageButton = document.createElement('button');
        pageButton.textContent = pageNum;
        pageButton.className = pageNum === this.currentPage ? 'active' : '';
        pageButton.addEventListener('click', () => this.changePage(pageNum));
        this.pageNumbersContainer.appendChild(pageButton);
    }

    addEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        this.pageNumbersContainer.appendChild(ellipsis);
    }

    async changePage(newPage) {
        if (newPage < 1 || newPage > this.totalPages || newPage === this.currentPage) {
            return;
        }

        this.currentPage = newPage;
        await this.loadProperties();
        this.updatePagination();
        window.scrollTo(0, 0);
    }

    updatePagination() {
        const prevButton = this.container.querySelector('.pagination-prev');
        const nextButton = this.container.querySelector('.pagination-next');
        if (prevButton && nextButton) {
            this.updatePaginationButtons(prevButton, nextButton);
        }
        
        if (this.pageNumbersContainer) {
            this.renderPageNumbers();
        }
    }

    setupLazyLoading() {
        this.imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.loadImage(img);
                    observer.unobserve(img);
                }
            });
        }, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });
    }

    async loadProperties() {
        try {
            if (this.isLoading) return;
            this.isLoading = true;
            this.showLoader();

            const statusSelect = this.filterSection.querySelector('.buscar_publicacion select');
            const searchInput = this.filterSection.querySelector('.buscar_publicacion input');
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage
            });

            if (statusSelect && statusSelect.value) {
                params.append('status', statusSelect.value);
            }

            if (searchInput && searchInput.value.trim()) {
                params.append('search', searchInput.value.trim());
            }
    
            const response = await fetch(`/api/propiedades/get_publications.php?${params.toString()}`);
            const result = await response.json();
    
            if (result.status === 'error') {
                throw new Error(result.message);
            }
    
            if (result.data && Array.isArray(result.data)) {
                result.data = result.data.map(property => ({
                    ...property,
                    main_image: property.main_image && property.main_image !== 'null' && property.main_image !== 'undefined'
                        ? property.main_image
                        : this.defaultImage
                }));
            }
    
            this.totalPages = result.total_pages || Math.ceil(result.total / this.itemsPerPage);
            this.container.innerHTML = '';
            this.container.appendChild(this.filterSection);
            this.updatePropertyCount(result.total);
            this.renderProperties(result.data);
    
            let paginationElement = this.container.querySelector('.pagination');
            if (!paginationElement) {
                this.setupPagination();
            } else {
                this.updatePagination();
            }
    
        } catch (error) {
            console.error('Error al cargar propiedades:', error);
        } finally {
            this.isLoading = false;
            this.hideLoader();
        }
    }

    showLoader() {
        if (this.loader) this.loader.style.display = 'flex';
    }

    hideLoader() {
        if (this.loader) this.loader.style.display = 'none';
    }

    updatePropertyCount(count) {
        const countElement = document.querySelector('.seleccionar_todas_publicaciones h5');
        if (countElement) {
            countElement.textContent = `${count} publicaciones`;
        }
    }

    renderProperties(properties) {
        properties.forEach(property => {
            const card = this.createPropertyCard(property);
            if (card) {
                this.container.appendChild(card);
            }
        });
    }

    formatPrice(value) {
        if (!value) return '0.00';
        
        // Convertimos a número y fijamos 2 decimales
        const number = parseFloat(value);
        if (isNaN(number)) return '0.00';
        
        // Separamos la parte entera y decimal
        const [integerPart, decimalPart] = number.toFixed(2).split('.');
        
        // Formateamos la parte entera con comas
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        // Retornamos el número completo con 2 decimales
        return `${formattedInteger}.${decimalPart}`;
    }

    createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'publicacion_tarjet_info';
        card.dataset.propertyId = property.id;
    
        const mainImage = property.main_image && property.main_image !== 'null' && property.main_image !== 'undefined' 
            ? property.main_image 
            : this.defaultImage;
    
        const getActionButtons = (status) => {
            const editButton = `
                <button class="tooltip" data-tooltip="Editar publicación" onclick="window.open('https://masterbroker.ai/dashboard/workspace/publicador.html?id=${property.id}')">
                    <img src="/assets/img/editar_white.png">
                </button>
            `;
        
            // Botón de estadísticas común para todos los estados que lo usan
            const statsButton = `
                <button class="tooltip" data-tooltip="Ver estadísticas" onclick="window.location.href='/dashboard/estadisticas.html?id=${property.id}'">
                    <img src="/assets/img/estadisticas_white.png">
                </button>
            `;
        
            switch(status) {
                case 'published':
                    return `
                        <button class="tooltip toggle-status" data-tooltip="Pausar publicación" data-action="pause">
                            <img src="/assets/img/pausa_white.png">
                        </button>
                        ${editButton}
                        <button class="tooltip" data-tooltip="Ver publicación" onclick="window.open('https://masterbroker.ai/propiedad.html?id=${property.id}', '_blank')">
                            <img src="/assets/img/redirect_white.png">
                        </button>
                        ${statsButton}
                        <button class="tooltip archive-btn" data-tooltip="Archivar publicación">
                            <img src="/assets/img/archivar_white.png">
                        </button>
                    `;
                case 'draft':
                    return `
                        ${editButton}
                        <button class="tooltip archive-btn" data-tooltip="Archivar publicación">
                            <img src="/assets/img/archivar_white.png">
                        </button>
                    `;
                case 'finished':
                    return `
                        <button class="tooltip toggle-status" data-tooltip="Activar publicación" data-action="activate">
                            <img src="/assets/img/activar_white.png">
                        </button>
                        <button class="tooltip archive-btn" data-tooltip="Archivar publicación">
                            <img src="/assets/img/archivar_white.png">
                        </button>
                        ${statsButton}
                    `;
                case 'archived':
                    return `
                        <button class="tooltip toggle-status" data-tooltip="Activar publicación" data-action="activate">
                            <img src="/assets/img/activar_white.png">
                        </button>
                        ${statsButton}
                        <button class="tooltip delete-btn" data-tooltip="Borrar">
                            <img src="/assets/img/basura.png">
                        </button>
                    `;
                default:
                    return '';
            }
        
        };
    
        const getStatusColor = (status) => {
            switch(status) {
                case 'published': return 'var(--accent)';
                case 'draft': return 'var(--colorp)';
                case 'finished': return 'var(--cancelado)';
                case 'archived': return '#777777';
                default: return 'var(--colorp)';
            }
        };
    
        const getStatusText = (status) => {
            switch(status) {
                case 'published': return 'Activo';
                case 'draft': return 'Borrador';
                case 'finished': return 'Finalizado';
                case 'archived': return 'Archivado';
                default: return 'Desconocido';
            }
        };
    
        const formattedPrice = this.formatPrice(property.price);
    
        card.innerHTML = `
            <label class="seleccionar_publicacion">
                <input type="checkbox">
                <span></span>
            </label>
            <div class="imagen_publicacion">
                <img class="lazy-image" 
                     data-src="${mainImage}" 
                     src="${this.defaultImage}"
                     alt="${this.escapeHtml(property.title)}"
                     loading="lazy"
                     onerror="this.src='${this.defaultImage}'">
            </div>
            <div class="caracteristicas_publicacion">
                <div class="detalles_publicaciones">
                    <div class="info_porcentaje_propiedad">
                        <div class="info_propiedades">
                            <p>${this.escapeHtml(property.property_type)}</p>
                            <h4>${this.escapeHtml(property.title)}</h4>
                            <p>${this.escapeHtml(property.address)}</p>
                            <p>${this.escapeHtml(property.operation_type)} <span>$${formattedPrice} MXN</span></p>
                        </div>
                        <div class="porcentaje_estado">
                            <h4 style="color: ${getStatusColor(property.status)}">${getStatusText(property.status)}</h4>
                            <div class="cara_progreso">
                                <img src="/assets/img/${property.score_icon}">
                            </div>
                            <h4>${property.total_score}%</h4>
                        </div>
                    </div>
                    <div class="estadistica_resumida">
                        <div class="desempeño">
                            <img src="/assets/img/tendencia.png" alt="">
                            <span style="color: var(--colorp);">Desempeño</span>
                            <button style="display: none;">Mejorar Desempeño</button>
                        </div>
                        <div class="estadisticas">
                            <div class="estadistica">
                                <span>Exposición</span>
                                <h4>${property.exposure_count || 0}</h4>
                            </div>
                            <div class="estadistica">
                                <span>Visualizaciones</span>
                                <h4>${property.view_count || 0}</h4>
                            </div>
                            <div class="estadistica" style="border: none;">
                                <span>Interesados</span>
                                <h4>${property.lead_count || 0}</h4>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="valores_acciones">
                    <div class="valores_unicos">
                        <p>Código <span>${property.code || '------'}</span></p>
                        <p>ID <span>${property.id || '------'}</span></p>
                        <p>Creado <span>${property.formatted_date || '--/--/----'}</span></p>
                    </div>
                    <div class="acciones_boton">
                        ${getActionButtons(property.status)}
                    </div>
                </div>
            </div>
        `;
    
        // Event listeners para los botones de acción
        card.querySelectorAll('.toggle-status').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                if (action === 'pause') {
                    this.showFinishModal(property.id, 'finish');
                } else {
                    this.handleStatusToggle(property.id, 'activate');
                }
            });
        });
    
        card.querySelectorAll('.archive-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                // Si la propiedad ya está finalizada, archivamos directamente
                if (property.status === 'finished') {
                    try {
                        const response = await fetch('/api/propiedades/update_status.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                property_id: property.id,
                                status: 'archived'
                            })
                        });
        
                        const result = await response.json();
                        if (result.status === 'success') {
                            await this.loadProperties();
                        } else {
                            throw new Error(result.message);
                        }
                    } catch (error) {
                        console.error('Error al archivar la propiedad:', error);
                        alert('Error al archivar la publicación');
                    }
                } else {
                    // Si no está finalizada, mostramos el modal
                    this.showFinishModal(property.id, 'archive');
                }
            });
        });
    
        if (property.status === 'archived') {
            const deleteButton = card.querySelector('.delete-btn');
            if (deleteButton) {
                deleteButton.addEventListener('click', () => {
                    if (confirm('¿Estás seguro de que deseas eliminar esta propiedad? Esta acción no se puede deshacer.')) {
                        this.handleDeleteProperty(property.id);
                    }
                });
            }
        }
    
        this.initializeLazyImage(card.querySelector('.lazy-image'));
        return card;
    }

    async handleStatusToggle(propertyId, action) {
        try {
            const response = await fetch('/api/propiedades/update_status.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    property_id: propertyId,
                    status: action === 'activate' ? 'published' : 'finished'
                })
            });

            const result = await response.json();
            if (result.status === 'success') {
                await this.loadProperties();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error al actualizar el estado:', error);
            alert('Error al actualizar el estado de la publicación');
        }
    }

    async handleDeleteProperty(propertyId) {
        try {
            const response = await fetch('/api/propiedades/delete_property.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    property_id: propertyId
                })
            });

            const result = await response.json();
            if (result.status === 'success') {
                await this.loadProperties();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error al eliminar la propiedad:', error);
            alert('Error al eliminar la propiedad');
        }
    }

    initializeLazyImage(imgElement) {
        this.imageObserver.observe(imgElement);
    }

    loadImage(img) {
        if (!img.dataset.src || img.dataset.src === 'null' || img.dataset.src === 'undefined') {
            img.src = this.defaultImage;
            return;
        }

        const loadHighRes = () => {
            img.src = img.dataset.src;
        };

        const tempImage = new Image();
        tempImage.onload = loadHighRes;
        tempImage.onerror = () => {
            img.src = this.defaultImage;
        };
        tempImage.src = img.dataset.src;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PropertyCardManager();
});