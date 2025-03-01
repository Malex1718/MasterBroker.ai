class LoaderManager {
    constructor() {
        this.loader = document.getElementById('loader');
        this.body = document.body;
        this.init();
    }

    init() {
        // Cuando la página y todos sus recursos estén cargados
        window.addEventListener('load', () => {
            this.hideLoader();
        });

        // Backup: si load no se dispara después de 5 segundos, ocultamos el loader
        setTimeout(() => {
            this.hideLoader();
        }, 5000);
    }

    hideLoader() {
        if (this.loader && !this.loader.classList.contains('loader-hidden')) {
            // Añadimos la clase para ocultar con transición
            this.loader.classList.add('loader-hidden');
            
            // Restauramos el scroll después de la transición
            setTimeout(() => {
                this.body.classList.add('loaded');
                // Opcionalmente, podemos remover el loader del DOM
                this.loader.remove();
            }, 500); // Tiempo igual a la duración de la transición
        }
    }
}

// Inicializamos el loader
const loaderManager = new LoaderManager();