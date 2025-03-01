// assets/js/publicador/extras.js

class ExtrasAnimations {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Obtener todas las secciones de comodidades
        const secciones = document.querySelectorAll('.seccion_comodidades');

        secciones.forEach(seccion => {
            // Obtener elementos
            const titulo = seccion.querySelector('.titulo_seccion');
            const contenido = seccion.querySelector('.opciones_seccion');
            const botonToggle = seccion.querySelector('.toggle_seccion');

            // Establecer estado inicial
            this.setCollapsedState(contenido);

            // Agregar manejador de click al título
            titulo.addEventListener('click', (e) => {
                // Si el click NO fue en el botón toggle
                if (!e.target.closest('.toggle_seccion')) {
                    this.toggleSeccion(contenido, botonToggle);
                }
            });

            // Agregar manejador de click al botón toggle
            botonToggle.addEventListener('click', () => {
                this.toggleSeccion(contenido, botonToggle);
            });
        });
    }

    setCollapsedState(contenido) {
        // Establecer estado inicial
        contenido.style.maxHeight = '0px';
        contenido.style.opacity = '0';
        contenido.style.padding = '0 20px';
    }

    toggleSeccion(contenido, botonToggle) {
        const isCollapsed = contenido.style.maxHeight === '0px';
        
        if (isCollapsed) {
            // Expandir
            contenido.style.maxHeight = contenido.scrollHeight + 'px';
            contenido.style.opacity = '1';
            contenido.style.padding = '20px';
            botonToggle.classList.add('active');
            
            // Animar los checkboxes
            contenido.querySelectorAll('.opcion_check').forEach((check, index) => {
                check.style.animation = `fadeInUp 0.3s ease forwards ${index * 0.05}s`;
            });
        } else {
            // Colapsar
            contenido.style.maxHeight = '0px';
            contenido.style.opacity = '0';
            contenido.style.padding = '0 20px';
            botonToggle.classList.remove('active');
            
            // Animar los checkboxes
            contenido.querySelectorAll('.opcion_check').forEach((check, index) => {
                check.style.animation = `fadeOutDown 0.2s ease forwards ${index * 0.03}s`;
            });
        }
    }
}

// Agregar estilos de animación si no existen
const animationStyles = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(20px);
        }
    }
`;

// Agregar estilos si no existen
if (!document.querySelector('#extras-animations-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'extras-animations-styles';
    styleSheet.textContent = animationStyles;
    document.head.appendChild(styleSheet);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.extrasAnimations = new ExtrasAnimations();
});