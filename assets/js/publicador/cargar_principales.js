// assets/js/publicador/cargar_principales.js

// Funciones de utilidad
function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showToast(message, type = 'success') {
    // Si tienes una librería de notificaciones, úsala aquí
    alert(message);
}

class PropertyDataLoader {
    constructor() {
        // Obtener ID de la propiedad de la URL
        this.propertyId = new URLSearchParams(window.location.search).get('id');
        if (!this.propertyId) {
            console.error('No se proporcionó ID de propiedad');
            return;
        }

        // Inicializar handlers y cargar datos
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            showLoader();
            await this.loadPropertyData();
            this.initializeSelectors();
            hideLoader();
        } catch (error) {
            console.error('Error al inicializar:', error);
            hideLoader();
            showToast('Error al cargar los datos de la propiedad', 'error');
        }
    }

    initializeSelectors() {
        // Inicializar selectores
        ['operacion', 'inmueble', 'variante'].forEach(tipo => {
            const selector = document.getElementById(`${tipo}Selector`);
            if (selector) {
                this.initializeSelector(selector, tipo);
            }
        });

        // Inicializar contadores de caracteres
        this.initializeCharacterCounters();

        // Inicializar manejo de antigüedad
        this.initializeAgeHandling();

        // Inicializar campos numéricos
        this.initializeNumericFields();
    }

    initializeSelector(selector, tipo) {
        const header = selector.querySelector('.selector_header');
        const opciones = selector.querySelector(`.tipo_${tipo}_opciones`);

        if (header && opciones) {
            header.addEventListener('click', () => {
                if (!selector.classList.contains('disabled')) {
                    header.classList.toggle('active');
                    opciones.classList.toggle('show');
                }
            });
        }

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target)) {
                header?.classList.remove('active');
                opciones?.classList.remove('show');
            }
        });
    }

    initializeCharacterCounters() {
        ['titulo_propiedad', 'descripcion_propiedad'].forEach(id => {
            const input = document.getElementById(id);
            const counter = document.getElementById(`contador_${id.split('_')[0]}`);
            
            if (input && counter) {
                input.addEventListener('input', () => {
                    counter.textContent = input.value.length;
                    this.updateProgressBar();
                });
            }
        });
    }

    initializeAgeHandling() {
        const radios = document.querySelectorAll('input[name="antiguedad"]');
        const container = document.getElementById('input_anos_container');

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (container) {
                    container.style.display = radio.value === 'anos' ? 'block' : 'none';
                }
                this.updateProgressBar();
            });
        });
    }

    initializeNumericFields() {
        ['recamaras', 'banos', 'mediobano', 'estacionamientos'].forEach(campo => {
            const value = document.getElementById(`${campo}_value`);
            const btnMinus = document.querySelector(`[onclick="updateValue('${campo}', -1)"]`);
            const btnPlus = document.querySelector(`[onclick="updateValue('${campo}', 1)"]`);

            if (value && btnMinus && btnPlus) {
                btnMinus.addEventListener('click', () => this.updateValue(campo, -1));
                btnPlus.addEventListener('click', () => this.updateValue(campo, 1));
            }
        });
    }

    updateValue(field, change) {
        const valueElement = document.getElementById(`${field}_value`);
        if (!valueElement) return;

        let currentValue = parseInt(valueElement.textContent || '0');
        let newValue = currentValue + change;

        if (newValue >= 0 && newValue <= 99) {
            valueElement.textContent = newValue;
            this.updateProgressBar();
        }
    }

    setupEventListeners() {
        // Botones de navegación
        const saveButton = document.querySelector('.boton_guardar');
        const continueButton = document.querySelector('.boton_continuar');

        if (saveButton) {
            saveButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveData('draft');
            });
        }

        if (continueButton) {
            continueButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveData('continue');
            });
        }

        // Campos que afectan la barra de progreso
        this.setupProgressBarListeners();
    }

    setupProgressBarListeners() {
        // Inputs numéricos
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', () => this.updateProgressBar());
        });

        // Radios
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateProgressBar());
        });

        // Inputs de texto
        ['titulo_propiedad', 'descripcion_propiedad', 'direccionInput'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.updateProgressBar());
            }
        });
    }

    async loadPropertyData() {
        const response = await fetch(`/api/propiedades/cargar_principales.php?id=${this.propertyId}`);
        if (!response.ok) {
            throw new Error('Error al cargar datos de la propiedad');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Error al cargar datos');
        }

        this.fillFormData(data.data);
    }

    fillFormData(data) {
        // Operación
        this.setOperationValue(data.operacion);
        
        // Inmueble
        this.setPropertyTypeValue(data.inmueble);
        
        // Ubicación
        this.setLocationValue(data.ubicacion);
        
        // Características
        this.setCharacteristicsValue(data.caracteristicas);
        
        // Superficie
        this.setAreasValue(data.superficie);
        
        // Antigüedad
        this.setAgeValue(data.antiguedad);
        
        // Precio
        this.setPriceValue(data.precio);
        
        // Contenido
        this.setContentValue(data.contenido);

        // Actualizar progreso
        this.updateProgressBar();
    }

    setOperationValue(operacion) {
        const radio = document.querySelector(`input[name="tipo_operacion"][value="${operacion.tipo}"]`);
        if (radio) {
            radio.checked = true;
            const header = document.querySelector('#operacionSelector .selector_header span');
            if (header) header.textContent = operacion.tipo;
        }
    }

    setPropertyTypeValue(inmueble) {
        // Tipo de inmueble
        const radioInmueble = document.querySelector(`input[name="tipo_inmueble"][value="${inmueble.tipo}"]`);
        if (radioInmueble) {
            radioInmueble.checked = true;
            const header = document.querySelector('#inmuebleSelector .selector_header span');
            if (header) header.textContent = inmueble.tipo;
        }

        // Variante
        if (inmueble.tipo && inmueble.variante) {
            this.generateVariants(inmueble.tipo, inmueble.variante);
        }
    }

    setLocationValue(ubicacion) {
        if (!ubicacion) return;

        const direccionInput = document.getElementById('direccionInput');
        if (direccionInput) {
            direccionInput.value = ubicacion.direccion;
        }

        // Actualizar mapa si está disponible
        if (window.google && window.map && window.marker) {
            const latLng = new google.maps.LatLng(
                ubicacion.coordenadas.lat,
                ubicacion.coordenadas.lng
            );
            window.map.setCenter(latLng);
            window.map.setZoom(19);
            window.marker.setPosition(latLng);
        }

        // Actualizar selectores de ubicación
        ['estado', 'ciudad', 'colonia'].forEach(tipo => {
            const selector = document.getElementById(`${tipo}Selector`);
            if (selector && ubicacion[tipo]) {
                selector.classList.remove('disabled');
                const header = selector.querySelector('.selector_header span');
                if (header) header.textContent = ubicacion[tipo].nombre;
            }
        });

        // Guardar datos de ubicación
        this.saveLocationData(ubicacion);
    }

    setCharacteristicsValue(caracteristicas) {
        if (!caracteristicas) return;

        Object.entries(caracteristicas).forEach(([key, value]) => {
            const element = document.getElementById(`${key}_value`);
            if (element) {
                element.textContent = value;
            }
        });
    }

    setAreasValue(superficie) {
        if (!superficie) return;

        const construida = document.getElementById('superficie_construida');
        const total = document.getElementById('superficie_total');

        if (construida) construida.value = superficie.construida;
        if (total) total.value = superficie.total;
    }

    setAgeValue(antiguedad) {
        if (!antiguedad) return;

        const radio = document.querySelector(`input[name="antiguedad"][value="${antiguedad.tipo}"]`);
        if (radio) {
            radio.checked = true;
            
            if (antiguedad.tipo === 'anos') {
                const anosInput = document.getElementById('cantidad_anos');
                const container = document.getElementById('input_anos_container');
                if (anosInput && container) {
                    container.style.display = 'block';
                    anosInput.value = antiguedad.anos;
                }
            }
        }
    }

    setPriceValue(precio) {
        if (!precio) return;

        const precioInput = document.getElementById('precio_inmueble');
        const mantenimientoInput = document.getElementById('mantenimiento');

        if (precioInput) precioInput.value = precio.monto;
        if (mantenimientoInput) mantenimientoInput.value = precio.mantenimiento;
    }

    setContentValue(contenido) {
        if (!contenido) return;

        const titulo = document.getElementById('titulo_propiedad');
        const descripcion = document.getElementById('descripcion_propiedad');

        if (titulo) {
            titulo.value = contenido.titulo;
            this.updateCharacterCounter('titulo_propiedad');
        }

        if (descripcion) {
            descripcion.value = contenido.descripcion;
            this.updateCharacterCounter('descripcion_propiedad');
        }
    }

    updateCharacterCounter(inputId) {
        const input = document.getElementById(inputId);
        const counter = document.getElementById(`contador_${inputId.split('_')[0]}`);
        if (input && counter) {
            counter.textContent = input.value.length;
        }
    }

    generateVariants(propertyType, selectedVariant = null) {
        const varianteSelector = document.getElementById('varianteSelector');
        if (!varianteSelector || !window.variantesPorTipo) return;

        varianteSelector.classList.remove('disabled');
        const container = varianteSelector.querySelector('.tipo_variante_opciones');
        if (!container) return;

        container.innerHTML = '';
        const variantes = window.variantesPorTipo[propertyType] || [];

        variantes.forEach((variante, index) => {
            const isSelected = variante === selectedVariant;
            container.insertAdjacentHTML('beforeend', `
                <div class="opcion">
                    <input type="radio" id="variante_${index}" 
                           name="tipo_variante" 
                           value="${variante}"
                           ${isSelected ? 'checked' : ''}>
                    <label for="variante_${index}">
                        <span class="radio_custom"></span>
                        ${variante}
                    </label>
                </div>
            `);
        });

        // Actualizar header si hay variante seleccionada
        if (selectedVariant) {
            const header = varianteSelector.querySelector('.selector_header span');
            if (header) header.textContent = selectedVariant;
        }
    }

    saveLocationData(locationData) {
        let input = document.getElementById('locationData');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.id = 'locationData';
            document.body.appendChild(input);
        }
        input.value = JSON.stringify(locationData);
    }

    updateProgressBar() {
        const progressBar = document.querySelector('.barra_progreso_partes_complet');
        if (!progressBar) return;

        const requiredFields = this.getRequiredFields();
        const completedFields = requiredFields.filter(field => this.isFieldComplete(field)).length;
        const progress = (completedFields / requiredFields.length) * 33;
        
        progressBar.style.width = `${Math.min(33 + progress, 66)}%`;
    }

    getRequiredFields() {
        return [
            'tipo_operacion',
            'tipo_inmueble',
            'tipo_variante',
            'direccionInput',
            'superficie_construida',
            'superficie_total',
            'precio_inmueble',
            'titulo_propiedad',
            'descripcion_propiedad'
        ];
    }

    isFieldComplete(fieldId) {
        const element = document.querySelector(`[name="${fieldId}"]:checked`) || 
                       document.getElementById(fieldId);
                       
        if (!element) return false;

        if (element.type === 'radio') {
            return element.checked;
        }

        if (element.type === 'number') {
            return element.value && parseFloat(element.value) > 0;
        }

        return element.value.trim().length > 0;
    }

    validateData() {
        const requiredFields = this.getRequiredFields();
        const incompleteFields = requiredFields.filter(field => !this.isFieldComplete(field));

        if (incompleteFields.length > 0) {
            showToast('Por favor completa todos los campos requeridos', 'error');
            return false;
        }

        return true;
    }

    async saveData(action = 'draft') {
        if (!this.validateData()) return;

        try {
            showLoader();
            
            const formData = {
                property_id: this.propertyId,
                operacion: this.getOperationData(),
                inmueble: this.getPropertyTypeData(),
                ubicacion: this.getLocationData(),
caracteristicas: this.getCharacteristicsData(),
                superficie: this.getAreasData(),
                antiguedad: this.getAgeData(),
                precio: this.getPricesData(),
                contenido: this.getContentData()
            };

            const response = await fetch('/api/propiedades/guardar_principales.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error al guardar los datos');
            }

            // Redireccionar según la acción
            if (action === 'continue') {
                window.location.href = `/dashboard/workspace/multimedia.html?id=${this.propertyId}`;
            } else {
                window.location.href = '/dashboard/publicaciones.html';
            }

        } catch (error) {
            console.error('Error al guardar:', error);
            showToast('Error al guardar los datos de la propiedad', 'error');
        } finally {
            hideLoader();
        }
    }

    getOperationData() {
        const operacion = document.querySelector('input[name="tipo_operacion"]:checked');
        return {
            tipo: operacion?.value || '',
            id: operacion?.dataset.id
        };
    }

    getPropertyTypeData() {
        const inmueble = document.querySelector('input[name="tipo_inmueble"]:checked');
        const variante = document.querySelector('input[name="tipo_variante"]:checked');
        return {
            tipo: inmueble?.value || '',
            variante: variante?.value || ''
        };
    }

    getLocationData() {
        const locationDataElement = document.getElementById('locationData');
        if (!locationDataElement) return null;

        try {
            return JSON.parse(locationDataElement.value);
        } catch (error) {
            console.error('Error al parsear datos de ubicación:', error);
            return null;
        }
    }

    getCharacteristicsData() {
        return {
            recamaras: parseInt(document.getElementById('recamaras_value')?.textContent || '0'),
            banos: parseInt(document.getElementById('banos_value')?.textContent || '0'),
            medio_bano: parseInt(document.getElementById('mediobano_value')?.textContent || '0'),
            estacionamientos: parseInt(document.getElementById('estacionamientos_value')?.textContent || '0')
        };
    }

    getAreasData() {
        return {
            construida: parseFloat(document.getElementById('superficie_construida')?.value || '0'),
            total: parseFloat(document.getElementById('superficie_total')?.value || '0')
        };
    }

    getAgeData() {
        const antiguedad = document.querySelector('input[name="antiguedad"]:checked');
        const anos = document.getElementById('cantidad_anos');
        
        return {
            tipo: antiguedad?.value || 'new',
            anos: antiguedad?.value === 'anos' && anos ? parseInt(anos.value) || 0 : null
        };
    }

    getPricesData() {
        return {
            monto: parseFloat(document.getElementById('precio_inmueble')?.value || '0'),
            mantenimiento: parseFloat(document.getElementById('mantenimiento')?.value || '0')
        };
    }

    getContentData() {
        return {
            titulo: document.getElementById('titulo_propiedad')?.value || '',
            descripcion: document.getElementById('descripcion_propiedad')?.value || ''
        };
    }

    // Método auxiliar para formatear números
    formatNumber(number, decimals = 0) {
        return new Intl.NumberFormat('es-MX', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    // Método auxiliar para formatear precios
    formatPrice(number) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    }

    // Método auxiliar para formatear áreas
    formatArea(number) {
        return `${this.formatNumber(number, 2)} m²`;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si estamos en la página correcta
    if (window.location.pathname.includes('/workspace/principales.html')) {
        window.propertyDataLoader = new PropertyDataLoader();
    }

    // Manejar eventos globales
    document.addEventListener('click', (e) => {
        // Cerrar todos los selectores abiertos al hacer click fuera de ellos
        if (!e.target.closest('.tipo_operacion_publicacion, .tipo_inmueble_publicacion, .tipo_variante_publicacion')) {
            document.querySelectorAll('.selector_header.active').forEach(header => {
                header.classList.remove('active');
            });
            document.querySelectorAll('.tipo_operacion_opciones.show, .tipo_inmueble_opciones.show, .tipo_variante_opciones.show').forEach(opciones => {
                opciones.classList.remove('show');
            });
        }
    });
});

// Exportar para uso global si es necesario
window.PropertyDataLoader = PropertyDataLoader;