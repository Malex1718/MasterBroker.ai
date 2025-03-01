// Clase para manejar la animación de marcas
class BrandAnimationManager {
    constructor(options = {}) {
        this.config = {
            interval: options.interval || 3000,
            fadeTime: options.fadeTime || 500,
            initialDelay: options.initialDelay || 1000,
            mobileBreakpoint: 1024
        };

        this.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
        this.currentIndex = 0;
        this.isAnimating = false;
        
        this.animate = this.animate.bind(this);
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.handleResize = this.handleResize.bind(this);

        window.addEventListener('resize', this.handleResize);
        this.updateContainers();
    }

    updateContainers() {
        this.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
        
        if (this.isMobile) {
            this.brandContainers = document.querySelectorAll('.nav_lateral .con_publi');
        } else {
            this.brandContainers = document.querySelectorAll('.nav-container > .con_publi');
        }

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
            
            marcas.forEach(marca => {
                marca.style.opacity = '0';
                marca.classList.remove('visible');
            });

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
        this.stop();

        this.brandContainers.forEach(container => {
            const marcas = container.querySelectorAll('.marca_color');
            
            marcas.forEach(marca => {
                marca.style.opacity = '0';
                marca.classList.remove('visible');
            });
            
            if (marcas[0]) {
                marcas[0].style.opacity = '1';
                marcas[0].classList.add('visible');
            }
        });

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

// Función para cargar el componente de navegación
function loadNavigation() {
    return new Promise((resolve, reject) => {
        const navContainer = document.getElementById('nav-container');
        
        if (!navContainer) {
            const error = 'Error: Elemento nav-container no encontrado';
            console.error(error);
            reject(error);
            return;
        }

        fetch('/components/nav_private.html')
            .then(response => response.text())
            .then(data => {
                navContainer.innerHTML = data;
                
                // Inicializar navegación si existe la función
                if (typeof initNavigation === 'function') {
                    initNavigation();
                }
                
                // Inicializar animación de marcas
                const brandAnimation = new BrandAnimationManager({
                    interval: 8000,     // 8 segundos de visualización
                    fadeTime: 1200,     // 1.2 segundos de transición
                    initialDelay: 2000, // 2 segundos antes de empezar
                    mobileBreakpoint: 1024
                });
                
                // Almacenar la instancia para poder destruirla si es necesario
                window.brandAnimation = brandAnimation;
                resolve();
            })
            .catch(error => {
                console.error('Error cargando la navegación:', error);
                reject(error);
            });
    });
}

// Función para cargar el componente de footer
function loadFooter() {
    return new Promise((resolve, reject) => {
        const footerContainer = document.getElementById('footer_container');
        
        if (!footerContainer) {
            const error = 'Error: Elemento footer_container no encontrado';
            console.error(error);
            reject(error);
            return;
        }

        fetch('/components/footer_private.html')
            .then(response => response.text())
            .then(data => {
                footerContainer.innerHTML = data;
                resolve();
            })
            .catch(error => {
                console.error('Error cargando el footer:', error);
                reject(error);
            });
    });
}

// Función para verificar que los elementos necesarios existen
function checkRequiredElements() {
    const missingElements = [];
    
    if (!document.getElementById('nav-container')) {
        missingElements.push('nav-container');
    }
    
    if (!document.getElementById('footer_container')) {
        missingElements.push('footer_container');
    }
    
    if (missingElements.length > 0) {
        console.error(`Elementos faltantes en el DOM: ${missingElements.join(', ')}`);
        return false;
    }
    
    return true;
}

// Función para inicializar los componentes
async function initializeComponents() {
    try {
        if (!checkRequiredElements()) {
            return;
        }
        // Primero cargamos la navegación
        await loadNavigation();
        // Después cargamos el footer
        await loadFooter();
        
    } catch (error) {
        console.error('Error durante la inicialización de componentes:', error);
    }
}

// Asegurarnos de que el DOM esté completamente cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
    initializeComponents();
}

// Exportar las funciones para uso global si es necesario
window.loadNavigation = loadNavigation;
window.loadFooter = loadFooter;
window.initializeComponents = initializeComponents;
window.BrandAnimationManager = BrandAnimationManager;