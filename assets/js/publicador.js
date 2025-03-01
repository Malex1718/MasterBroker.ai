// publicador.js

// Variables globales
let map;
let marker;
let circle;
let autocomplete;
let infowindow;
let geocoder;
let locationPrecision = 'exact';

// Objeto con todas las variantes por tipo de inmueble
const variantesPorTipo = {
    casa: [
        'Casa independiente',
        'Casa en condominio',
        'Casa de campo',
        'Casa de playa',
        'Casa tipo colonial',
        'Casa moderna',
        'Casa rústica',
        'Casa inteligente'
    ],
    departamento: [
        'Departamento',
        'Penthouse',
        'Loft',
        'Studio',
        'Garden house',
        'Departamento amueblado',
        'Departamento tipo suite'
    ],
    duplex: [
        'Dúplex horizontal',
        'Dúplex vertical',
        'Dúplex con terraza',
        'Dúplex con jardín'
    ],
    quinta: [
        'Quinta residencial',
        'Quinta campestre',
        'Quinta para eventos',
        'Quinta recreativa'
    ],
    villa: [
        'Villa turística',
        'Villa residencial',
        'Villa vacacional',
        'Villa de lujo'
    ],
    edificio: [
        'Edificio residencial',
        'Edificio corporativo',
        'Edificio mixto',
        'Edificio histórico',
        'Torre de apartamentos'
    ],
    oficina: [
        'Oficina ejecutiva',
        'Oficina tipo coworking',
        'Oficina independiente',
        'Suite ejecutiva',
        'Oficina virtual',
        'Consultorio'
    ],
    local: [
        'Local comercial',
        'Local en plaza',
        'Local en centro comercial',
        'Local en esquina',
        'Local industrial',
        'Local para restaurante'
    ],
    bodega: [
        'Bodega de almacenamiento',
        'Bodega con oficinas',
        'Bodega refrigerada',
        'Mini-bodegas',
        'Centro de distribución'
    ],
    nave: [
        'Nave de producción',
        'Nave de almacenamiento',
        'Nave con área administrativa',
        'Parque industrial'
    ],
    terreno: [
        'Terreno urbano',
        'Terreno campestre',
        'Terreno industrial',
        'Terreno comercial',
        'Terreno agrícola',
        'Lote',
        'Solar'
    ],
    huerta: [
        'Huerta frutal',
        'Huerta de hortalizas',
        'Huerta orgánica',
        'Huerta mixta'
    ],
    rancho: [
        'Rancho ganadero',
        'Rancho agrícola',
        'Rancho mixto',
        'Rancho turístico',
        'Rancho con instalaciones'
    ]
};

const TIPOS_ANTIGUEDAD = {
    estrenar: 'new',
    anos: 'years',
    construccion: 'under_construction'
};

// Estilos personalizados
const customStyles = `
    .pac-container {
        background-color: var(--body);
        border: 1px solid var(--border);
        border-radius: 10px;
        font-family: var(--txt);
        margin-top: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 10px;
        z-index: 9999;
    }

    .pac-item {
        padding: 8px;
        color: var(--colortxt);
        border-top: none;
        font-family: var(--txt);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 6px;
    }

    .pac-item:hover {
        background-color: var(--border);
    }

    .pac-item-query {
        color: var(--colortxt);
        font-family: var(--txt-bold);
    }

    .precision_controls {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .value-changed {
        animation: pulse 0.3s ease-in-out;
    }

    .limit-reached {
        animation: shake 0.3s ease-in-out;
    }

    .antiguedad_container {
        width: 100%;
        margin-bottom: 20px;
    }

    .antiguedad_opciones {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .input_anos_container {
        margin-top: 10px;
        margin-left: 25px;
        transition: all 0.3s ease;
    }

    .input_anos_container input {
        width: 100%;
        max-width: 200px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-family: var(--txt);
        font-size: 14px;
        color: var(--colortxt);
        background: var(--body);
    }

    .input_anos_container input:focus {
        outline: none;
        border-color: var(--principal);
    }

    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
    }
`;

// Función de inicialización global
window.initializeMapAndForm = function() {
    // Verificar si ya está inicializado
    if (window.mapInitialized) return;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);

    initializeMapAndAutocomplete();
    inicializarFormulario();
    inicializarEventosAntiguedad();
    inicializarContadores();
    inicializarEventListenersProgreso();

    // Marcar como inicializado
    window.mapInitialized = true;
};

// Función para inicializar event listeners de progreso
function inicializarEventListenersProgreso() {
    // Superficie
    const superficieConstruida = document.getElementById('superficie_construida');
    const superficieTotal = document.getElementById('superficie_total');

    if (superficieConstruida) {
        superficieConstruida.addEventListener('input', actualizarBarraProgreso);
    }
    if (superficieTotal) {
        superficieTotal.addEventListener('input', actualizarBarraProgreso);
    }

    // Precio
    const precioInmueble = document.getElementById('precio_inmueble');
    const mantenimiento = document.getElementById('mantenimiento');

    if (precioInmueble) {
        precioInmueble.addEventListener('input', actualizarBarraProgreso);
    }
    if (mantenimiento) {
        mantenimiento.addEventListener('input', actualizarBarraProgreso);
    }

    // Título y descripción
    const titulo = document.getElementById('titulo_propiedad');
    const descripcion = document.getElementById('descripcion_propiedad');

    if (titulo) {
        titulo.addEventListener('input', actualizarBarraProgreso);
    }
    if (descripcion) {
        descripcion.addEventListener('input', actualizarBarraProgreso);
    }

    // Radio buttons
    const radioGroups = ['tipo_operacion', 'tipo_inmueble', 'tipo_variante', 'antiguedad'];
    radioGroups.forEach(groupName => {
        const radios = document.querySelectorAll(`input[name="${groupName}"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', actualizarBarraProgreso);
        });
    });

    // Años de antigüedad
    const inputAnos = document.getElementById('cantidad_anos');
    if (inputAnos) {
        inputAnos.addEventListener('input', actualizarBarraProgreso);
    }
}

// Modificar la función updateValue
function updateValue(field, change) {
    const valueElement = document.getElementById(`${field}_value`);
    if (!valueElement) return;

    let currentValue = parseInt(valueElement.textContent || '0');
    let newValue = currentValue + change;
    
    if (newValue >= 0 && newValue <= 99) {
        valueElement.textContent = newValue;
        valueElement.setAttribute('data-value', newValue);
        
        const hiddenInput = document.getElementById(field);
        if (hiddenInput) {
            hiddenInput.value = newValue;
        }

        // Emitir evento personalizado
        document.dispatchEvent(new CustomEvent('caracteristicasUpdated', {
            detail: {
                field: field,
                value: newValue
            }
        }));

        valueElement.classList.add('value-changed');
        setTimeout(() => {
            valueElement.classList.remove('value-changed');
        }, 300);

        actualizarBarraProgreso();
    } else {
        valueElement.classList.add('limit-reached');
        setTimeout(() => {
            valueElement.classList.remove('limit-reached');
        }, 300);
    }
}

// Función para validar dirección
function esDireccionValida(direccion) {
    return direccion.length >= 10 && document.getElementById('locationData') !== null;
}

// Modificar la función generarOpcionesVariantes
function generarOpcionesVariantes(tipo) {
    const varianteSelector = document.getElementById('varianteSelector');
    const varianteOpciones = document.querySelector('.tipo_variante_opciones');
    
    if (!varianteSelector || !varianteOpciones) return;

    varianteSelector.classList.remove('disabled');
    varianteSelector.style.opacity = '0';
    varianteSelector.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        varianteSelector.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        varianteSelector.style.opacity = '1';
        varianteSelector.style.transform = 'translateY(0)';
        
        setTimeout(() => {
            varianteOpciones.innerHTML = '';
            const variantes = variantesPorTipo[tipo.toLowerCase()] || [];
            
            variantes.forEach((variante, index) => {
                const opcionHtml = `
                    <div class="opcion">
                        <input type="radio" id="variante_${index}" name="tipo_variante" value="${variante.toLowerCase()}">
                        <label for="variante_${index}">
                            <span class="radio_custom"></span>
                            ${variante}
                        </label>
                    </div>
                `;
                varianteOpciones.insertAdjacentHTML('beforeend', opcionHtml);
            });

            const radiosVariante = varianteOpciones.querySelectorAll('input[type="radio"]');
            radiosVariante.forEach(radio => {
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        const varianteHeader = varianteSelector.querySelector('.selector_header span');
                        varianteHeader.textContent = this.value;
                        varianteOpciones.classList.remove('show');
                        varianteSelector.querySelector('.selector_header').classList.remove('active');

                        // Emitir evento personalizado
                        document.dispatchEvent(new CustomEvent('varianteSelected', {
                            detail: { value: this.value }
                        }));

                        actualizarBarraProgreso();
                    }
                });
            });

            // Disparar la selección automática si existe una variante en formData
            const propertyHandler = window.propertyFormHandler;
            if (propertyHandler && propertyHandler.formData.variante) {
                const varianteInput = document.querySelector(`input[name="tipo_variante"][value="${propertyHandler.formData.variante.toLowerCase()}"]`);
                if (varianteInput) {
                    varianteInput.click();
                }
            }
        }, 300);
    }, 50);
}

// Modificar la función initSelector
function initSelector(containerId, name) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const header = container.querySelector('.selector_header');
    const opciones = container.querySelector(`.tipo_${name}_opciones`);
    
    if (!header || !opciones) return;

    header.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (container.classList.contains('disabled')) {
            return;
        }
        
        document.querySelectorAll('.selector_header.active').forEach(el => {
            if (el !== header) {
                el.classList.remove('active');
                el.nextElementSibling.classList.remove('show');
            }
        });

        this.classList.toggle('active');
        opciones.classList.toggle('show');
    });

    if (name === 'operacion' || name === 'inmueble') {
        const radios = container.querySelectorAll(`input[name="tipo_${name}"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    header.querySelector('span').textContent = this.value;
                    opciones.classList.remove('show');
                    header.classList.remove('active');
                    
                    // Emitir evento personalizado
                    if (name === 'operacion') {
                        document.dispatchEvent(new CustomEvent('operacionSelected', {
                            detail: { value: this.value }
                        }));
                    } else if (name === 'inmueble') {
                        document.dispatchEvent(new CustomEvent('inmuebleSelected', {
                            detail: { value: this.value }
                        }));
                        generarOpcionesVariantes(this.value);
                    }
                    
                    actualizarBarraProgreso();
                }
            });
        });
    }
}

// Función para actualizar la barra de progreso
function actualizarBarraProgreso() {
    try {
        const operacionSeleccionada = document.querySelector('input[name="tipo_operacion"]:checked');
        const inmuebleSeleccionado = document.querySelector('input[name="tipo_inmueble"]:checked');
        const varianteSeleccionada = document.querySelector('input[name="tipo_variante"]:checked');
        const direccionValida = esDireccionValida(document.getElementById('direccionInput')?.value || '');
        const superficieConstruida = document.getElementById('superficie_construida')?.value;
        const superficieTotal = document.getElementById('superficie_total')?.value;
        const antiguedadSeleccionada = document.querySelector('input[name="antiguedad"]:checked');
        const anosInput = document.getElementById('cantidad_anos');
        const precioInmueble = document.getElementById('precio_inmueble')?.value;
        const titulo = document.getElementById('titulo_propiedad')?.value;
        const descripcion = document.getElementById('descripcion_propiedad')?.value;

        let camposCompletados = 0;
        const totalCampos = 10;

        if (operacionSeleccionada) camposCompletados++;
        if (inmuebleSeleccionado) camposCompletados++;
        if (varianteSeleccionada) camposCompletados++;
        if (direccionValida) camposCompletados++;
        if (superficieConstruida) camposCompletados++;
        if (superficieTotal) camposCompletados++;
        if (antiguedadSeleccionada) {
            if (antiguedadSeleccionada.id === 'anos_antiguedad' && anosInput?.value) {
                camposCompletados++;
            } else if (antiguedadSeleccionada.id !== 'anos_antiguedad') {
                camposCompletados++;
            }
        }
        if (precioInmueble) camposCompletados++;
        if (titulo) camposCompletados++;
        if (descripcion) camposCompletados++;

        const porcentajePorSeccion = 30;
        const porcentajeCompletado = (camposCompletados / totalCampos) * porcentajePorSeccion;

        const barraProgreso = document.querySelector('.barra_progreso_partes_complet');
        if (barraProgreso) {
            barraProgreso.style.width = `${porcentajeCompletado}%`;
        }
    } catch (error) {
        console.error('Error al actualizar la barra de progreso:', error);
    }
}

// Modificar la función inicializarEventosAntiguedad
function inicializarEventosAntiguedad() {
    const radiosAntiguedad = document.querySelectorAll('input[name="antiguedad"]');
    const inputAnosContainer = document.getElementById('input_anos_container');
    const inputAnos = inputAnosContainer?.querySelector('input');

    if (!inputAnosContainer) return;

    radiosAntiguedad.forEach(radio => {
        radio.addEventListener('change', function() {
            const isAnos = this.id === 'anos_antiguedad';
            
            if (isAnos) {
                inputAnosContainer.style.display = 'block';
                inputAnosContainer.style.opacity = '0';
                inputAnosContainer.style.transform = 'translateY(-10px)';
                
                requestAnimationFrame(() => {
                    inputAnosContainer.style.transition = 'all 0.3s ease';
                    inputAnosContainer.style.opacity = '1';
                    inputAnosContainer.style.transform = 'translateY(0)';
                });
            } else {
                inputAnosContainer.style.opacity = '0';
                inputAnosContainer.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    inputAnosContainer.style.display = 'none';
                }, 300);
            }

            // Mapear el valor al tipo correcto
            const tipoAntiguedad = TIPOS_ANTIGUEDAD[this.value] || 'new';

            // Emitir evento personalizado con el tipo mapeado
            document.dispatchEvent(new CustomEvent('antiguedadUpdated', {
                detail: {
                    tipo: tipoAntiguedad,
                    anos: isAnos ? (parseInt(inputAnos?.value) || 0) : 0
                }
            }));

            actualizarBarraProgreso();
        });
    });

    if (inputAnos) {
        inputAnos.addEventListener('input', function() {
            // Emitir evento personalizado usando el tipo mapeado
            document.dispatchEvent(new CustomEvent('antiguedadUpdated', {
                detail: {
                    tipo: TIPOS_ANTIGUEDAD['anos'], // Siempre será 'years' para el input de años
                    anos: parseInt(this.value) || 0
                }
            }));
            actualizarBarraProgreso();
        });
    }
}

// Modificar la función inicializarContadores
function inicializarContadores() {
    const elementos = {
        'titulo_propiedad': 'contador_titulo',
        'descripcion_propiedad': 'contador_descripcion'
    };

    for (const [inputId, contadorId] of Object.entries(elementos)) {
        const elemento = document.getElementById(inputId);
        const contador = document.getElementById(contadorId);
        
        if (elemento && contador) {
            elemento.addEventListener('input', function() {
                const longitud = this.value.length;
                contador.textContent = longitud;
                contador.style.color = longitud > (this.maxLength * 0.8) ? 'var(--principal)' : 'var(--colorp)';
                
                if (this.tagName.toLowerCase() === 'textarea') {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                }

                // Emitir evento personalizado
                document.dispatchEvent(new CustomEvent('descripcionUpdated', {
                    detail: {
                        field: inputId === 'titulo_propiedad' ? 'titulo' : 'descripcion',
                        value: this.value
                    }
                }));
                
                actualizarBarraProgreso();
            });
        }
    }
}

// Función para inicializar el mapa y controles
function initializeMapAndAutocomplete() {
    const mapContainer = document.getElementById('mapContainer');
    const input = document.getElementById('direccionInput');

    if (!mapContainer || !input) return;

    const mapOptions = {
        center: { lat: 23.634501, lng: -102.552784 },
        zoom: 5,
        styles: [
            {
                "featureType": "poi.business",
                "elementType": "labels",
                "stylers": [{ "visibility": "off" }]
            }
        ],
        mapTypeId: 'roadmap',
        tilt: 0,
        disableDefaultUI: false,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
        },
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
        },
        streetViewControl: true,
        streetViewControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
        },
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_RIGHT
        }
    };

    map = new google.maps.Map(mapContainer, mapOptions);
    
    marker = new google.maps.Marker({
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#1a5a89',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
        }
    });

    autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'mx' },
        fields: ['address_components', 'geometry', 'name', 'formatted_address']
    });

    geocoder = new google.maps.Geocoder();
    infowindow = new google.maps.InfoWindow({ maxWidth: 300 });

    autocomplete.addListener('place_changed', onPlaceChanged);
    marker.addListener('dragend', onMarkerDragEnd);
    
    initializePrecisionControls();

    return {
        map,
        marker,
        autocomplete,
        setLocation: (lat, lng, address) => {
            const location = new google.maps.LatLng(lat, lng);
            map.setCenter(location);
            marker.setPosition(location);
            if (address) {
                input.value = address;
            }
            updateMapDisplay();
        }
    };
}

function sincronizarDatosIniciales(propertyHandler) {
    if (!propertyHandler || !propertyHandler.formData) return;

    const data = propertyHandler.formData;

    // Actualizar selectores
    if (data.estado) {
        actualizarSelectoresUbicacion({
            administrative_area_level_1: data.estado,
            locality: data.ciudad,
            sublocality_level_1: data.colonia
        });
    }

    // Actualizar datos de ubicación
    if (data.direccion) {
        guardarDatosUbicacion({
            administrative_area_level_1: data.estado,
            locality: data.ciudad,
            sublocality_level_1: data.colonia,
            formatted_address: data.direccion,
            lat: data.coordenadas.lat,
            lng: data.coordenadas.lng
        });
    }

    // Restaurar la precisión de ubicación
    if (data.precision_ubicacion) {
        const precisionRadio = document.querySelector(`input[name="precision_ubicacion"][value="${data.precision_ubicacion}"]`);
        if (precisionRadio) {
            precisionRadio.checked = true;
            locationPrecision = data.precision_ubicacion;
            updateMapDisplay();
        }
    }

    actualizarBarraProgreso();
}

// Función para inicializar controles de precisión
function initializePrecisionControls() {
    const mapContainer = document.getElementById('mapContainer');
    // Verificar si los controles ya existen
    const existingControls = document.querySelector('.precision_controls');
    if (!mapContainer || existingControls) return;

    const precisionControlsHtml = `
        <div class="precision_controls">
            <div class="opcion">
                <input type="radio" id="ubicacion_exacta" name="precision_ubicacion" value="exact" checked>
                <label for="ubicacion_exacta">
                    <span class="radio_custom"></span>
                    Ubicación exacta
                </label>
            </div>
            <div class="opcion">
                <input type="radio" id="ubicacion_aproximada" name="precision_ubicacion" value="approximate">
                <label for="ubicacion_aproximada">
                    <span class="radio_custom"></span>
                    Ubicación aproximada
                </label>
            </div>
            <div class="opcion">
                <input type="radio" id="ubicacion_oculta" name="precision_ubicacion" value="hidden">
                <label for="ubicacion_oculta">
                    <span class="radio_custom"></span>
                    No mostrar ubicación
                </label>
            </div>
        </div>
    `;

    mapContainer.insertAdjacentHTML('beforebegin', precisionControlsHtml);

    document.querySelectorAll('input[name="precision_ubicacion"]').forEach(radio => {
        radio.addEventListener('change', function() {
            locationPrecision = this.value;
            updateMapDisplay();
            
            document.dispatchEvent(new CustomEvent('precisionUbicacionUpdated', {
                detail: { value: locationPrecision }
            }));
        });
    });
}

// Funciones para el manejo del mapa
function onPlaceChanged() {
    const place = autocomplete.getPlace();
    
    if (!place.geometry) {
        document.getElementById('direccionInput').placeholder = 'Ingresa una dirección';
        return;
    }
    
    updateMapView(place.geometry.location);
    updateMarkerPosition(place.geometry.location);
    updateMapDisplay();
    showInfoWindow(place.formatted_address);
    extractAddressComponents(place);
}

function updateMapView(location) {
    if (!map) return;
    map.setCenter(location);
    map.setZoom(19);
    map.setTilt(45);
}

function updateMarkerPosition(location) {
    if (!marker) return;
    marker.setPosition(location);
    marker.setVisible(locationPrecision === 'exact');
    
    if (circle) {
        circle.setCenter(location);
        circle.setVisible(locationPrecision === 'approximate');
    }
}

function showInfoWindow(content) {
    if (!infowindow || locationPrecision === 'hidden') return;
    infowindow.setContent(content);
    infowindow.open(map, marker);
}

function updateMapDisplay() {
    if (!marker || !map) return;

    const position = marker.getPosition();
    if (!position) return;

    if (!circle) {
        circle = new google.maps.Circle({
            map: map,
            fillColor: '#1a5a89',
            fillOpacity: 0.4,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            radius: 400
        });
    }

    switch (locationPrecision) {
        case 'exact':
            marker.setVisible(true);
            circle.setVisible(false);
            map.setZoom(19);
            map.setCenter(position);
            break;
        case 'approximate':
            marker.setVisible(false);
            circle.setVisible(true);
            circle.setCenter(position);
            map.setZoom(15);
            map.setCenter(position);
            break;
        case 'hidden':
            marker.setVisible(false);
            circle.setVisible(false);
            map.setZoom(13);
            map.setCenter(position);
            break;
    }
}

function onMarkerDragEnd() {
    const position = marker.getPosition();
    if (!position) return;
    
    // Emitir evento de ubicación actualizada al arrastrar el marcador
    document.dispatchEvent(new CustomEvent('locationUpdated', {
        detail: {
            direccionCompleta: document.getElementById('direccionInput').value,
            lat: position.lat(),
            lng: position.lng(),
            precisionUbicacion: locationPrecision
        }
    }));
    
    updateLocationFromLatLng(position.lat(), position.lng());
}

function updateLocationFromLatLng(lat, lng) {
    const latlng = { lat: parseFloat(lat), lng: parseFloat(lng) };
    
    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
            document.getElementById('direccionInput').value = results[0].formatted_address;
            extractAddressComponents(results[0]);
            
            if (locationPrecision !== 'hidden') {
                infowindow.setContent(results[0].formatted_address);
                infowindow.open(map, marker);
            }
        }
    });
}

function actualizarSelectoresUbicacion(addressData) {
    const selectores = {
        estadoSelector: 'administrative_area_level_1',
        ciudadSelector: 'locality',
        coloniaSelector: 'sublocality_level_1'
    };

    for (const [selectorId, campo] of Object.entries(selectores)) {
        const selectorElement = document.getElementById(selectorId);
        if (selectorElement && addressData[campo]) {
            selectorElement.classList.remove('disabled');
            const headerSpan = selectorElement.querySelector('.selector_header span');
            if (headerSpan) {
                headerSpan.textContent = addressData[campo];
            }

            // Animación suave para mostrar el selector
            selectorElement.style.opacity = '0';
            selectorElement.style.transform = 'translateY(10px)';
            
            requestAnimationFrame(() => {
                selectorElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                selectorElement.style.opacity = '1';
                selectorElement.style.transform = 'translateY(0)';
            });
        }
    }

    actualizarBarraProgreso();
}

// Función para guardar datos de ubicación
function guardarDatosUbicacion(addressData) {
    let hiddenDataInput = document.getElementById('locationData');
    if (!hiddenDataInput) {
        hiddenDataInput = document.createElement('input');
        hiddenDataInput.type = 'hidden';
        hiddenDataInput.id = 'locationData';
        document.body.appendChild(hiddenDataInput);
    }

    const datosUbicacion = {
        estado: addressData.administrative_area_level_1 || '',
        ciudad: addressData.locality || '',
        colonia: addressData.sublocality_level_1 || '',
        calle: addressData.route || '',
        numeroExterior: addressData.street_number || '',
        codigoPostal: addressData.postal_code || '',
        lat: addressData.lat || 0,
        lng: addressData.lng || 0,
        direccionCompleta: addressData.formatted_address || '',
        precisionUbicacion: locationPrecision
    };

    hiddenDataInput.value = JSON.stringify(datosUbicacion);
    actualizarBarraProgreso();
}

// Para la ubicación, modificar la función extractAddressComponents
function extractAddressComponents(place) {
    if (!place || !place.address_components) {
        console.error('Datos de lugar inválidos');
        return;
    }

    const addressData = {
        street_number: '',
        route: '',
        locality: '',
        administrative_area_level_1: '',
        country: '',
        postal_code: '',
        sublocality_level_1: '',
        lat: place.geometry?.location.lat() || 0,
        lng: place.geometry?.location.lng() || 0,
        formatted_address: place.formatted_address || ''
    };

    const addressFields = {
        street_number: 'short_name',
        route: 'long_name',
        locality: 'long_name',
        administrative_area_level_1: 'long_name',
        country: 'long_name',
        postal_code: 'short_name',
        sublocality_level_1: 'long_name'
    };

    for (const component of place.address_components) {
        const addressType = component.types[0];
        if (addressFields[addressType]) {
            addressData[addressType] = component[addressFields[addressType]];
        }
    }

    try {
        actualizarSelectoresUbicacion(addressData);
        guardarDatosUbicacion(addressData);

        // Emitir evento de ubicación
        document.dispatchEvent(new CustomEvent('locationUpdated', {
            detail: {
                direccionCompleta: addressData.formatted_address,
                estado: addressData.administrative_area_level_1,
                ciudad: addressData.locality,
                colonia: addressData.sublocality_level_1,
                lat: addressData.lat,
                lng: addressData.lng,
                precisionUbicacion: locationPrecision
            }
        }));
    } catch (error) {
        console.error('Error al procesar los datos de ubicación:', error);
    }
}

// Función para inicializar el formulario
function inicializarFormulario() {

    // Precio
    const precioInmueble = document.getElementById('precio_inmueble');
    const mantenimiento = document.getElementById('mantenimiento');

    if (precioInmueble) {
        precioInmueble.addEventListener('input', function(e) {
            document.dispatchEvent(new CustomEvent('precioUpdated', {
                detail: {
                    tipo: 'monto',
                    value: parseFloat(e.target.value) || 0
                }
            }));
        });
    }

    if (mantenimiento) {
        mantenimiento.addEventListener('input', function(e) {
            document.dispatchEvent(new CustomEvent('precioUpdated', {
                detail: {
                    tipo: 'mantenimiento',
                    value: parseFloat(e.target.value) || 0
                }
            }));
        });
    }

    // Superficie
    const superficieConstruida = document.getElementById('superficie_construida');
    const superficieTotal = document.getElementById('superficie_total');

    if (superficieConstruida) {
        superficieConstruida.addEventListener('input', function(e) {
            document.dispatchEvent(new CustomEvent('superficieUpdated', {
                detail: {
                    tipo: 'construida',
                    value: parseFloat(e.target.value) || 0
                }
            }));
        });
    }

    if (superficieTotal) {
        superficieTotal.addEventListener('input', function(e) {
            document.dispatchEvent(new CustomEvent('superficieUpdated', {
                detail: {
                    tipo: 'total',
                    value: parseFloat(e.target.value) || 0
                }
            }));
        });
    }

    const selectores = {
        operacionSelector: 'operacion',
        inmuebleSelector: 'inmueble',
        varianteSelector: 'variante'
    };

    for (const [selector, tipo] of Object.entries(selectores)) {
        initSelector(selector, tipo);
    }

    const selectoresDesactivados = [
        'varianteSelector',
        'estadoSelector',
        'ciudadSelector',
        'coloniaSelector'
    ];

    selectoresDesactivados.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.classList.add('disabled');
        }
    });

    // Inicializar input de dirección
    const direccionInput = document.getElementById('direccionInput');
    if (direccionInput) {
        direccionInput.addEventListener('input', function() {
            const selectores = ['estado', 'ciudad', 'colonia'];
            selectores.forEach(tipo => {
                const selector = document.getElementById(`${tipo}Selector`);
                if (selector) {
                    if (this.value.length < 10) {
                        selector.classList.add('disabled');
                        selector.querySelector('.selector_header span').textContent = 
                            tipo.charAt(0).toUpperCase() + tipo.slice(1);
                    }
                }
            });

            const locationData = document.getElementById('locationData');
            if (locationData && this.value.length < 10) {
                locationData.remove();
            }

            actualizarBarraProgreso();
        });
    }
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    if (window.google && window.google.maps) {
        window.initializeMapAndForm();
        
        // Sincronizar datos si existe una propiedad cargada
        if (window.propertyFormHandler && window.propertyFormHandler.isEditMode) {
            sincronizarDatosIniciales(window.propertyFormHandler);
        }
    }

    // Event listeners para los campos numéricos
    const campos = ['recamaras', 'banos', 'mediobano', 'estacionamientos'];
    campos.forEach(campo => {
        document.querySelectorAll(`[data-field="${campo}"] .numeric_btn`).forEach(btn => {
            btn.addEventListener('click', function() {
                const isPlus = this.classList.contains('plus');
                updateValue(campo, isPlus ? 1 : -1);
            });
        });
    });

    // Prevenir envío de formulario con Enter
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.type !== 'submit') {
                e.preventDefault();
            }
        });
    });

    // Cerrar selectores al hacer click fuera
    document.addEventListener('click', function(e) {
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

// Exportar las funciones necesarias al scope global
window.updateValue = updateValue;
window.actualizarBarraProgreso = actualizarBarraProgreso;
window.esDireccionValida = esDireccionValida;
window.initializeMapAndForm = initializeMapAndForm;
window.actualizarSelectoresUbicacion = actualizarSelectoresUbicacion;
window.guardarDatosUbicacion = guardarDatosUbicacion;
window.extractAddressComponents = extractAddressComponents;

// Función auxiliar para manejar errores en la geocodificación
function handleGeocodeError(error) {
    console.error('Error en geocodificación:', error);
    
    // Limpiar los selectores
    const selectores = ['estadoSelector', 'ciudadSelector', 'coloniaSelector'];
    selectores.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.classList.add('disabled');
            const headerSpan = selector.querySelector('.selector_header span');
            if (headerSpan) {
                headerSpan.textContent = selectorId.replace('Selector', '').charAt(0).toUpperCase() + 
                                       selectorId.replace('Selector', '').slice(1);
            }
        }
    });

    // Eliminar datos de ubicación guardados
    const locationData = document.getElementById('locationData');
    if (locationData) {
        locationData.remove();
    }

    actualizarBarraProgreso();
}

// Agregar eventos para los botones de guardar
document.addEventListener('DOMContentLoaded', function() {
    const btnGuardar = document.querySelector('.boton_guardar');
    const btnContinuar = document.querySelector('.boton_continuar');

    if (btnGuardar) {
        btnGuardar.addEventListener('click', (e) => {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('saveProperty', {
                detail: { accion: 'borrador' }
            }));
        });
    }

    if (btnContinuar) {
        btnContinuar.addEventListener('click', (e) => {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('saveProperty', {
                detail: { accion: 'continuar' }
            }));
        });
    }
});