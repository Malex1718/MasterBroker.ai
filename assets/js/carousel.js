// Agregar estilos consistentes para las tarjetas
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

    .dueno img:hover {
        transform: scale(1.1);
    }
`;
document.head.appendChild(styleElement);

// Función para cargar propiedades destacadas
async function loadFeaturedProperties() {
    try {
        // Agregamos score_order=desc a la URL
        const response = await fetch('/api/propiedades/get_properties.php?featured=1&limit=6&score_order=desc');
        const data = await response.json();
        
        if (data.status === 'success') {
            const carouselContainer = document.querySelector('.carousel-properties .seccion_info_tar');
            if (!carouselContainer) return;
            
            // Limpiar el contenedor
            carouselContainer.innerHTML = '';

            // Agregar las propiedades
            if (data.data && data.data.length > 0) {
                data.data.forEach(property => {
                    const propertyCard = createPropertyCard(property);
                    carouselContainer.appendChild(propertyCard);
                });

                // Esperar a que las imágenes se carguen antes de inicializar el carrusel
                Promise.all(Array.from(carouselContainer.getElementsByTagName('img'))
                    .map(img => {
                        return new Promise((resolve) => {
                            if (img.complete) resolve();
                            else img.onload = img.onerror = () => resolve();
                        });
                    }))
                    .then(() => {
                        // Inicializar el carrusel después de que las imágenes estén cargadas
                        initializeCarousel();
                    });
            }
        }
    } catch (error) {
        console.error('Error al cargar propiedades destacadas:', error);
    }
}

// Función para formatear precios
function formatPrice(price) {
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// Función para crear tarjeta de propiedad
function createPropertyCard(property) {
    const card = document.createElement('div');
    card.className = 'tarjet_info';
    
    // Verificamos si existe un logo del propietario
    const logoSrc = property.owner?.company?.logo || '/assets/img/vendedor.png?v=1.0.1';
    const companyName = property.owner?.company?.name || 'Vendedor';
    
    card.innerHTML = `
        <div class="tarjet_info_img">
            <div class="tip_trans">
                <span>${property.operation_type_name}</span>
            </div>
            <img src="${property.main_image}" 
                 alt="Propiedad: ${property.title}" 
                 onerror="this.src='/assets/img/placeholder.jpg'">
            <div class="dueno">
                <img src="${logoSrc}" 
                     alt="Logo de ${companyName}"
                     onerror="this.src='/assets/img/vendedor.png?v=1.0.1'">
            </div>
        </div>
        <h3 class="titulo_tarjet" title="${property.title}">${property.title}</h3>
        <p class="tarjet_info_p">${property.description_short || property.description}</p>
        <div class="info_min_deta">
            <div class="info_min_sec">
                <img src="/assets/img/cama.png" alt="Icono de habitaciones">
                <p>${property.bedrooms || '0'}</p>
            </div>
            <div class="info_min_sec">
                <img src="/assets/img/bano.png" alt="Icono de baños">
                <p>${property.bathrooms || '0'}</p>
            </div>
            <div class="info_min_sec">
                <img src="/assets/img/casa.png" alt="Icono de tipo de propiedad">
                <p>${property.property_type_name}</p>
            </div>
        </div>
        <div class="info_mas_deta">
            <div class="info_pre_deta">
                <p>Precio:</p>
                <h3>$${formatPrice(property.price)} MXN</h3>
            </div>
            <a href="/propiedad.html?id=${property.id}" style="width: 45%;">
                <button>Ver Detalles</button>
            </a>
        </div>
    `;
    return card;
}

// Función principal del carrusel
function initializeCarousel() {
    const carousels = document.querySelectorAll('.seccion_info_tars');
    
    function getItemsToShow() {
        if (window.innerWidth <= 768) {
            return 1;
        } else if (window.innerWidth <= 1024) {
            return 2;
        }
        return 3;
    }

    carousels.forEach(carousel => {
        const container = carousel.querySelector('.seccion_info_tar');
        if (!container) return;

        const items = carousel.querySelectorAll('.tarjet_info, .tarjet_info_exper');
        if (!items || items.length === 0) return;

        const prevButton = carousel.querySelector('.button:not([style*="rotate"])');
        const nextButton = carousel.querySelector('.button[style*="rotate"]');
        const pageText = carousel.querySelector('.seccion_info_but p span');
        
        let currentIndex = 0;
        let itemsToShow = getItemsToShow();
        const itemsToMove = 1;
        const totalItems = items.length;
        
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        let isDragging = false;
        let startPos = 0;
        let currentTranslate = 0;
        let isScrolling = null;

        function updatePageNumber() {
            if (!pageText) return;
            
            const currentPosition = Math.min(currentIndex + itemsToShow, totalItems);
            pageText.textContent = currentPosition.toString().padStart(2, '0');
            
            const totalPages = pageText.nextElementSibling;
            if (totalPages && totalPages.classList.contains('total-pages')) {
                totalPages.textContent = totalItems.toString().padStart(2, '0');
            }
        }

        function moveCarousel(direction) {
            if (!items || items.length === 0) return;
            
            const firstItem = items[0];
            if (!firstItem) return;

            if (direction === 'next' && currentIndex < totalItems - itemsToShow) {
                currentIndex = Math.min(currentIndex + itemsToMove, totalItems - itemsToShow);
            } else if (direction === 'prev' && currentIndex > 0) {
                currentIndex = Math.max(currentIndex - itemsToMove, 0);
            }
            
            const itemWidth = firstItem.offsetWidth || 0;
            const gap = 25;
            currentTranslate = -(currentIndex * (itemWidth + gap));
            
            container.style.transform = `translateX(${currentTranslate}px)`;
            updatePageNumber();
            
            if (prevButton) prevButton.disabled = currentIndex === 0;
            if (nextButton) nextButton.disabled = currentIndex >= totalItems - itemsToShow;
        }

        function handleTouchStart(event) {
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].pageY;
            isDragging = true;
            startPos = touchStartX;
            isScrolling = null;
            
            container.style.transition = 'none';
        }

        function handleTouchMove(event) {
            if (!isDragging) return;
            
            const touchCurrentX = event.touches[0].clientX;
            const touchCurrentY = event.touches[0].pageY;
            const deltaX = touchStartX - touchCurrentX;
            const deltaY = touchStartY - touchCurrentY;

            // Determinar si el usuario está intentando hacer scroll vertical
            if (isScrolling === null) {
                isScrolling = Math.abs(deltaY) > Math.abs(deltaX);
            }

            // Si es scroll vertical, permitir el comportamiento predeterminado
            if (isScrolling) {
                isDragging = false;
                return;
            }

            // Si es movimiento horizontal, prevenir el scroll y manejar el carrusel
            event.preventDefault();
            touchEndX = touchCurrentX;
            const diff = touchEndX - startPos;
            const newTranslate = currentTranslate + diff;
            
            // Limitar el arrastre
            const itemWidth = items[0].offsetWidth;
            const gap = 25;
            const maxTranslate = 0;
            const minTranslate = -((totalItems - itemsToShow) * (itemWidth + gap));
            
            if (newTranslate <= maxTranslate && newTranslate >= minTranslate) {
                container.style.transform = `translateX(${newTranslate}px)`;
            }
        }

        function handleTouchEnd() {
            if (!isDragging || isScrolling) return;
            
            isDragging = false;
            isScrolling = null;
            const movedBy = touchEndX - touchStartX;
            container.style.transition = 'transform 0.3s ease';
            
            if (Math.abs(movedBy) > 100) {
                if (movedBy > 0) {
                    moveCarousel('prev');
                } else {
                    moveCarousel('next');
                }
            } else {
                container.style.transform = `translateX(${currentTranslate}px)`;
            }
        }

        // Event Listeners
        if (items.length > 0) {
            container.addEventListener('touchstart', handleTouchStart, { passive: true });
            container.addEventListener('touchmove', handleTouchMove, { passive: false });
            container.addEventListener('touchend', handleTouchEnd);
            
            if (prevButton) {
                prevButton.addEventListener('click', () => moveCarousel('prev'));
            }
            
            if (nextButton) {
                nextButton.addEventListener('click', () => moveCarousel('next'));
            }
            
            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    moveCarousel('prev');
                } else if (e.key === 'ArrowRight') {
                    moveCarousel('next');
                }
            });

            // Initialize
            updatePageNumber();
            
            // Reset transition on window resize
            window.addEventListener('resize', () => {
                container.style.transition = 'none';
                setTimeout(() => {
                    container.style.transition = 'transform 0.3s ease';
                }, 50);

                // Update items to show on resize
                itemsToShow = getItemsToShow();
                moveCarousel('current');
            });
        }
    });
}

// Inicializar carruseles cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    loadFeaturedProperties();
});