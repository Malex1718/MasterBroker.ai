// Variables para el carrusel
let currentIndex = 0;
let isMobileView = window.innerWidth <= 1024;
let isSmallMobileView = window.innerWidth <= 767;
const trackSup = document.querySelector('.carousel-track-sup');
const trackInf = document.querySelector('.carousel-track-inf');
const slidesSup = document.querySelectorAll('.cart_sup_prop');
const slidesInf = document.querySelectorAll('.cart_infe_prop');
const prevButton = document.querySelector('.button:first-child');
const nextButton = document.querySelector('.button:last-child');
const carouselSupContainer = document.querySelector('.caru_sup_prop');

// Configurar vista según el dispositivo
function setupResponsiveView() {
    if (isSmallMobileView) {
        // Ajustes para móviles pequeños (< 768px)
        slidesInf.forEach((slide) => {
            slide.style.flex = '0 0 calc(100% - 10px)';
            slide.style.width = 'calc(100% - 10px)';
            slide.style.height = '249px';
        });
        
        // Ajustar el contenedor de miniaturas superiores
        if (slidesSup.length > 0) {
            slidesSup.forEach((slide) => {
                slide.style.minWidth = '67px';
                slide.style.width = '67px';
                slide.style.height = '41px';
            });
        }
    } else if (isMobileView) {
        // Ajustes para tablets (768px - 1024px)
        slidesInf.forEach((slide) => {
            slide.style.flex = '0 0 calc(100% - 10px)';
            slide.style.width = 'calc(100% - 10px)';
            slide.style.height = '407px';
        });
        
        // Restaurar tamaños normales para miniaturas
        slidesSup.forEach((slide) => {
            slide.style.minWidth = '';
            slide.style.width = '122px';
            slide.style.height = '74px';
        });
    } else {
        // Restaurar estilos para desktop
        slidesInf.forEach((slide) => {
            slide.style.flex = '0 0 calc(50% - 12px)';
            slide.style.width = '50%';
            slide.style.height = '407px';
        });
        
        slidesSup.forEach((slide) => {
            slide.style.minWidth = '';
            slide.style.width = '122px';
            slide.style.height = '74px';
        });
    }

    // Forzar recálculo de posiciones
    updateCarouselPosition(currentIndex);
}

// Calcular el desplazamiento necesario para las miniaturas
function calculateSupOffset(index) {
    const containerWidth = carouselSupContainer.offsetWidth;
    const slideWidth = slidesSup[0].offsetWidth;
    const slideGap = 10;
    const totalSlideWidth = slideWidth + slideGap;
    
    // Calcular cuántas miniaturas caben en el contenedor
    const visibleSlides = Math.floor(containerWidth / totalSlideWidth);
    const trackWidth = slidesSup.length * totalSlideWidth;
    
    if (trackWidth <= containerWidth) {
        return 0;
    }

    // Ajustar el desplazamiento para mantener centrada la miniatura activa en móvil
    if (isSmallMobileView) {
        const centerPosition = containerWidth / 2;
        const slideCenter = totalSlideWidth / 2;
        let offset = (index * totalSlideWidth) - (centerPosition - slideCenter);
        
        // Limitar el desplazamiento máximo
        const maxOffset = trackWidth - containerWidth;
        offset = Math.max(0, Math.min(offset, maxOffset));
        return -offset;
    }

    // Comportamiento normal para otros tamaños
    const lastVisibleIndex = slidesSup.length - visibleSlides;
    let targetIndex = Math.min(Math.max(index, 0), lastVisibleIndex);
    return -targetIndex * totalSlideWidth;
}

// Actualizar el carrusel
function updateCarousel(newIndex) {
    if (newIndex < 0) {
        newIndex = slidesSup.length - 1;
    } else if (newIndex >= slidesSup.length) {
        newIndex = 0;
    }

    currentIndex = newIndex;
    updateCarouselPosition(currentIndex);
}

// Actualizar las posiciones de ambos carruseles
function updateCarouselPosition(index) {
    // Actualizar miniaturas activas
    slidesSup.forEach((slide) => slide.classList.remove('active'));
    slidesSup[index].classList.add('active');

    // Calcular y aplicar el desplazamiento para el carrusel superior
    const offsetSup = calculateSupOffset(index);
    trackSup.style.transform = `translateX(${offsetSup}px)`;

    // Actualizar el carrusel inferior
    const gap = 20;
    const slideWidth = slidesInf[0].offsetWidth;
    const offsetInf = -index * (slideWidth + gap);
    trackInf.style.transform = `translateX(${offsetInf}px)`;
}

// Agregar navegación táctil
function enableTouchNavigation() {
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartTime = 0;

    const handleSwipe = () => {
        const touchEndTime = new Date().getTime();
        const touchDuration = touchEndTime - touchStartTime;
        const swipeDistance = touchEndX - touchStartX;
        
        // Ajustar el umbral según el tamaño de la pantalla
        const swipeThreshold = isSmallMobileView ? 30 : 50;
        
        // Solo procesar swipes rápidos para evitar conflictos con scroll
        if (touchDuration < 300 && Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance > 0) {
                updateCarousel(currentIndex - 1);
            } else {
                updateCarousel(currentIndex + 1);
            }
        }
    };

    trackInf.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartTime = new Date().getTime();
    });

    trackInf.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    });
}

// Inicializar el carrusel
function initCarousel() {
    if (slidesSup.length > 0) {
        slidesSup[0].classList.add('active');
    }

    slidesSup.forEach((slide, index) => {
        slide.addEventListener('click', () => {
            updateCarousel(index);
        });
    });

    prevButton.addEventListener('click', () => {
        updateCarousel(currentIndex - 1);
    });

    nextButton.addEventListener('click', () => {
        updateCarousel(currentIndex + 1);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            updateCarousel(currentIndex - 1);
        } else if (e.key === 'ArrowRight') {
            updateCarousel(currentIndex + 1);
        }
    });

    // Manejar cambios de tamaño de ventana
    window.addEventListener('resize', () => {
        const wasSmallMobile = isSmallMobileView;
        const wasMobile = isMobileView;
        
        isSmallMobileView = window.innerWidth <= 767;
        isMobileView = window.innerWidth <= 1024;
        
        if (wasSmallMobile !== isSmallMobileView || wasMobile !== isMobileView) {
            setupResponsiveView();
        }
    });

    // Configuración inicial
    setupResponsiveView();
    enableTouchNavigation();
}

// Iniciar el carrusel cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
});