// assets/js/publicador/extras.js

class ExtrasHandler {
    constructor() {
        this.propertyId = new URLSearchParams(window.location.search).get('id');
        this.amenities = new Set();
        this.additionalFeatures = {};
        this.isSaving = false;
        
        // Referencias a elementos del DOM
        this.form = {
            amenitySections: document.querySelectorAll('.seccion_comodidades'),
            conservationStatus: document.querySelector('select.select_custom'),
            numericalInputs: document.querySelectorAll('.campo_adicional input[type="number"]'),
            backButton: document.querySelector('.botn_atras'),
            saveButton: document.querySelector('.boton_guardar'),
            continueButton: document.querySelector('.boton_continuar'),
            progressBar: document.querySelector('.barra_progreso_partes_complet')
        };
        
        this.initialize();
    }

    async initialize() {
        this.setupEventListeners();
        this.setupSectionToggles();
        await this.loadExistingData();
        this.updateProgressBar();
    }

    setupEventListeners() {
        // Eventos para checkboxes de amenities
        document.querySelectorAll('.opcion_check input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.amenities.add(checkbox.name);
                } else {
                    this.amenities.delete(checkbox.name);
                }
                this.updateProgressBar();
            });
        });

        // Eventos para inputs numéricos
        this.form.numericalInputs.forEach(input => {
            // Prevenir valores negativos
            input.addEventListener('input', () => {
                if (input.value < 0) input.value = 0;
                this.updateProgressBar();
            });
        });

        // Estado de conservación
        this.form.conservationStatus.addEventListener('change', () => this.updateProgressBar());

        // Botones de navegación
        this.form.backButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleNavigation('back');
        });

        this.form.saveButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleNavigation('save');
        });

        this.form.continueButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleNavigation('continue');
        });

        // Prevenir envío accidental del formulario
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => e.preventDefault());
        });
    }

    setupSectionToggles() {
        document.querySelectorAll('.titulo_seccion').forEach(titulo => {
            const contenido = titulo.nextElementSibling;
            const toggle = titulo.querySelector('.toggle_seccion');
            
            // Inicializar todas las secciones como colapsadas
            contenido.style.maxHeight = '0';
            
            titulo.addEventListener('click', () => {
                toggle.classList.toggle('active');
                
                if (contenido.classList.contains('collapsed')) {
                    // Abrir
                    contenido.classList.remove('collapsed');
                    contenido.style.maxHeight = contenido.scrollHeight + "px";
                    
                    // Animar entrada de checkboxes
                    contenido.querySelectorAll('.opcion_check').forEach((check, index) => {
                        check.style.animation = `fadeInUp 0.3s ease forwards ${index * 0.05}s`;
                    });
                } else {
                    // Cerrar
                    contenido.classList.add('collapsed');
                    contenido.style.maxHeight = 0;
                    
                    // Animar salida de checkboxes
                    contenido.querySelectorAll('.opcion_check').forEach((check, index) => {
                        check.style.animation = `fadeOutDown 0.2s ease forwards ${index * 0.03}s`;
                    });
                }
            });
        });
    }

    async loadExistingData() {
        try {
            showLoader();
            const response = await fetch(`/api/propiedades/cargar_extras.php?id=${this.propertyId}`);
            const responseText = await response.text(); // Primero obtener el texto de la respuesta
            
            let data;
            try {
                data = JSON.parse(responseText); // Intentar parsear el JSON
            } catch (e) {
                console.error('Respuesta del servidor:', responseText);
                throw new Error('La respuesta del servidor no es un JSON válido');
            }
            
            if (!response.ok) {
                throw new Error(data.message || 'Error en la respuesta del servidor');
            }
            
            if (!data.success) {
                throw new Error(data.message || 'Error al cargar los datos');
            }
            
            // Cargar amenities
            if (data.amenities && Array.isArray(data.amenities)) {
                data.amenities.forEach(amenity => {
                    const checkbox = document.querySelector(`input[name="${amenity.code}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        this.amenities.add(amenity.code);
                    }
                });
            }
            
            // Cargar características adicionales
            if (data.additional_features) {
                const features = data.additional_features;
                
                // Estado de conservación
                if (features.conservation_status) {
                    this.form.conservationStatus.value = features.conservation_status;
                }
                
                // Mapeo de campos numéricos
                const fieldMappings = {
                    'Bodega(s)': 'storage_units',
                    'Closets': 'closets',
                    'Elevador(es)': 'elevators',
                    'Metros cuadrados de fondo': 'depth_meters',
                    'Metros cuadrados de frente': 'front_meters',
                    'Niveles construidos': 'built_levels'
                };
                
                // Asignar valores a campos numéricos
                this.form.numericalInputs.forEach(input => {
                    const label = input.closest('.campo_adicional').querySelector('label').textContent;
                    const fieldName = fieldMappings[label];
                    if (fieldName && features[fieldName] !== null && features[fieldName] !== undefined) {
                        input.value = features[fieldName];
                    }
                });
            }
            
        } catch (error) {
            console.error('Error al cargar datos:', error);
            showToast(error.message || 'Error al cargar los datos existentes', 'error');
        } finally {
            hideLoader();
        }
    }

    updateProgressBar() {
        const amenitiesCount = this.amenities.size;
        const filledInputs = Array.from(this.form.numericalInputs)
            .filter(input => input.value && input.value !== '0').length;
        const hasConservationStatus = this.form.conservationStatus.value !== '' && 
                                    this.form.conservationStatus.value !== 'Selecciona una opción';
        
        // Calcular progreso (base 66% + hasta 33% adicional)
        const totalFields = 5; // Número objetivo de campos llenos para progreso completo
        const filledFields = amenitiesCount + filledInputs + (hasConservationStatus ? 1 : 0);
        const additionalProgress = Math.min(filledFields / totalFields * 33, 33);
        
        const totalProgress = Math.min(66 + additionalProgress, 99);
        this.form.progressBar.style.width = `${totalProgress}%`;
    }

    gatherFormData() {
        // Recopilar amenities
        const amenities = Array.from(this.amenities);
        
        // Recopilar características adicionales
        const additionalFeatures = {
            conservation_status: this.form.conservationStatus.value,
            storage_units: 0,
            closets: 0,
            elevators: 0,
            depth_meters: 0,
            front_meters: 0,
            built_levels: 0
        };
        
        // Mapeo de campos
        const fieldMappings = {
            'Bodega(s)': 'storage_units',
            'Closets': 'closets',
            'Elevador(es)': 'elevators',
            'Metros cuadrados de fondo': 'depth_meters',
            'Metros cuadrados de frente': 'front_meters',
            'Niveles construidos': 'built_levels'
        };
        
        // Recopilar valores numéricos
        this.form.numericalInputs.forEach(input => {
            const label = input.closest('.campo_adicional').querySelector('label').textContent;
            const fieldName = fieldMappings[label];
            if (fieldName) {
                additionalFeatures[fieldName] = parseFloat(input.value) || 0;
            }
        });
        
        return {
            property_id: this.propertyId,
            amenities,
            additional_features: additionalFeatures
        };
    }

    async saveData() {
        if (this.isSaving) return false;
        
        try {
            this.isSaving = true;
            this.toggleButtons(true);
            showLoader();
            
            const formData = this.gatherFormData();
            const response = await fetch('/api/propiedades/guardar_extras.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) throw new Error('Error al guardar datos');
            
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Error al guardar datos');
            
            return true;
        } catch (error) {
            console.error('Error al guardar:', error);
            showToast('Error al guardar los datos', 'error');
            return false;
        } finally {
            this.isSaving = false;
            this.toggleButtons(false);
            hideLoader();
        }
    }

    toggleButtons(disabled) {
        this.form.backButton.disabled = disabled;
        this.form.saveButton.disabled = disabled;
        this.form.continueButton.disabled = disabled;
        
        if (disabled) {
            this.form.saveButton.textContent = 'Guardando...';
            this.form.continueButton.textContent = 'Guardando...';
        } else {
            this.form.saveButton.textContent = 'Guardar y salir';
            this.form.continueButton.textContent = 'Continuar';
        }
    }

    async handleNavigation(action) {
        if (action === 'back') {
            window.location.href = `/dashboard/workspace/multimedia.html?id=${this.propertyId}`;
            return;
        }
        
        const saved = await this.saveData();
        if (!saved) return;
        
        if (action === 'continue') {
            window.location.href = `/dashboard/workspace/publicar.html?id=${this.propertyId}`;
        } else {
            window.location.href = '/dashboard/publicaciones.html';
        }
    }
}

// Funciones de utilidad para el loader y toast
function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showToast(message, type = 'success') {
    // Implementa tu sistema de notificaciones aquí
    alert(message);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.extrasHandler = new ExtrasHandler();
});