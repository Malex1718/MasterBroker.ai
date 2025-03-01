// Clase para manejar el banner
class BannerManager {
    constructor() {
        this.bannerKey = 'bannerHidden';
        this.hideDuration = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    }

    shouldShowBanner() {
        const hiddenTimestamp = localStorage.getItem(this.bannerKey);
        if (!hiddenTimestamp) return true;

        const now = new Date().getTime();
        const timePassed = now - parseInt(hiddenTimestamp);
        return timePassed > this.hideDuration;
    }

    hideBanner() {
        const banner = document.getElementById('topBanner');
        if (banner) {
            banner.classList.add('hiding');
            localStorage.setItem(this.bannerKey, new Date().getTime().toString());
            document.body.classList.add('banner-hidden');
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }
    }

    initBanner() {
        const banner = document.getElementById('topBanner');
        if (banner) {
            if (!this.shouldShowBanner()) {
                banner.style.display = 'none';
                document.body.classList.add('banner-hidden');
            } else {
                banner.style.display = 'block';
                document.body.classList.remove('banner-hidden');
            }
        }
    }
}

// Clase para manejar la animación de marcas
class BrandAnimationManager {
    constructor(options = {}) {
        this.config = {
            interval: options.interval || 3000,
            fadeTime: options.fadeTime || 500,
            initialDelay: options.initialDelay || 1000,
            mobileBreakpoint: 1024 // Punto de quiebre para móvil
        };

        this.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
        this.currentIndex = 0;
        this.isAnimating = false;
        
        this.animate = this.animate.bind(this);
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Agregar listener para cambios de tamaño de ventana
        window.addEventListener('resize', this.handleResize);
        
        // Inicializar contenedores según el tamaño de pantalla
        this.updateContainers();
    }

    updateContainers() {
        this.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
        
        if (this.isMobile) {
            // En móvil, solo animar el contenedor en nav_lateral
            this.brandContainers = document.querySelectorAll('.nav_lateral .con_publi');
        } else {
            // En desktop, solo animar el contenedor en nav-container
            this.brandContainers = document.querySelectorAll('.nav-container > .con_publi');
        }

        // Reiniciar animaciones con los nuevos contenedores
        this.stop();
        this.start();
    }

    handleResize() {
        const wasMobile = this.isMobile;
        const newIsMobile = window.innerWidth <= this.config.mobileBreakpoint;
        
        if (wasMobile !== newIsMobile) {
            this.updateContainers();
        }
    }

    animate() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        this.brandContainers.forEach(container => {
            const marcas = Array.from(container.querySelectorAll('.marca_color'));
            
            // Ocultar todas las marcas
            marcas.forEach(marca => {
                marca.style.opacity = '0';
                marca.classList.remove('visible');
            });

            // Mostrar la siguiente marca
            this.currentIndex = (this.currentIndex + 1) % marcas.length;
            
            if (marcas[this.currentIndex]) {
                marcas[this.currentIndex].style.opacity = '1';
                marcas[this.currentIndex].classList.add('visible');
            }
        });

        setTimeout(() => {
            this.isAnimating = false;
        }, this.config.fadeTime);
    }

    start() {
        // Detener animaciones existentes
        this.stop();

        // Configuración inicial
        this.brandContainers.forEach(container => {
            const marcas = container.querySelectorAll('.marca_color');
            
            // Ocultar todas las marcas
            marcas.forEach(marca => {
                marca.style.opacity = '0';
                marca.classList.remove('visible');
            });
            
            // Mostrar la primera marca
            if (marcas[0]) {
                marcas[0].style.opacity = '1';
                marcas[0].classList.add('visible');
            }
        });

        // Iniciar nuevo intervalo
        if (this.brandContainers.length > 0) {
            setTimeout(() => {
                this.intervalId = setInterval(this.animate, this.config.interval);
            }, this.config.initialDelay);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.handleResize);
    }
}

// Crear instancia del BannerManager
const bannerManager = new BannerManager();

// Función global para cerrar el banner
window.closeBanner = () => {
    bannerManager.hideBanner();
};

// Función para cargar componentes HTML
function loadComponent(url, elementId) {
    fetch(url)
        .then(response => response.text())
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
            
            if (elementId === 'banner-container') {
                bannerManager.initBanner();
            }
            
            if (elementId === 'nav-container') {
                // Inicializar navegación desde navigation.js
                if (typeof initNavigation === 'function') {
                    initNavigation();
                }
                
                // Inicializar animación de marcas
                const brandAnimation = new BrandAnimationManager({
                    interval: 8000,     // 8 segundos de visualización
                    fadeTime: 1200,     // 1.2 segundos de transición
                    initialDelay: 2000,  // 2 segundos antes de empezar
                    mobileBreakpoint: 1024 // Punto de quiebre para móvil/desktop
                });
                
                // Almacenar la instancia para poder destruirla si es necesario
                window.brandAnimation = brandAnimation;
            }
        })
        .catch(error => console.error('Error cargando el componente:', error));
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar componentes
    loadComponent('/components/banner_public.html', 'banner-container');
    loadComponent('/components/nav_public.html', 'nav-container');
    loadComponent('/components/footer_public.html', 'footer_container');
});