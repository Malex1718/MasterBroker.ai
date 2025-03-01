/**
 * PropertyFormHandler - Manejador principal del formulario de propiedades
 * Gestiona la recopilación y validación de datos del formulario
 */

class PropertyFormHandler {
    constructor() {
        this.TIPOS_ANTIGUEDAD = {
            estrenar: 'new',
            anos: 'years',
            construccion: 'under_construction'
        };
    
        // Detectar si estamos en modo edición
        const urlParams = new URLSearchParams(window.location.search);
        this.propertyId = urlParams.get('id');
        this.isEditMode = !!this.propertyId;
    
        // Inicialización del estado del formulario
        this.formData = {
            // Tipo de operación e inmueble
            operacion: '',
            tipo_inmueble: '',
            variante: '',
    
            // Ubicación
            direccion: '',
            estado: '',
            ciudad: '', 
            colonia: '',
            coordenadas: {
                lat: null,
                lng: null
            },
            precision_ubicacion: 'exact', // 'exact', 'approximate', 'hidden'
    
            // Características principales
            caracteristicas: {
                recamaras: 0,
                banos: 0,
                mediobano: 0,
                estacionamientos: 0
            },
    
            // Superficie
            superficie: {
                construida: 0,
                total: 0
            },
    
            // Antigüedad
            antiguedad: {
                tipo: 'new', // Valor por defecto
                anos: 0
            },
    
            // Precio
            precio: {
                monto: 0,
                mantenimiento: 0
            },
    
            // Descripción
            titulo: '',
            descripcion: '',
    
            // Metadata
            usuario_id: null,
            fecha_creacion: null,
            estado_publicacion: 'borrador'
        };
    
        // Agregar botón de debug en desarrollo
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            this.addDebugButton();
        }
    
        // Inicializar
        this.init();
    }

    async init() {
        // Inicializar los listeners
        this.initializeDataListeners();
    
        // Si estamos en modo edición, cargar los datos
        if (this.isEditMode) {
            await this.cargarDatosPropiedad();
        }
    
        this.logFormDataUpdate('Formulario inicializado');
    }

    async cargarDatosPropiedad() {
        try {
            const response = await fetch(`/api/propiedades/obtener.php?id=${this.propertyId}`);
            
            if (!response.ok) {
                throw new Error('Error al cargar los datos de la propiedad');
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const errorText = await response.text();
                console.error('Respuesta no JSON del servidor:', errorText);
                throw new Error('Respuesta no válida del servidor');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Error al cargar la propiedad');
            }

            // Actualizar el formulario con los datos recibidos
            await this.actualizarFormulario(data.propiedad);

        } catch (error) {
            console.error('Error al cargar la propiedad:', error);
            alert('Error al cargar los datos de la propiedad');
        }
    }

    async actualizarFormulario(propiedad) {
        // Actualizar el estado interno
        this.formData = {
            ...this.formData,
            operacion: propiedad.operacion,
            tipo_inmueble: propiedad.tipo_inmueble,
            variante: propiedad.variante,
            direccion: propiedad.direccion,
            estado: propiedad.estado,
            ciudad: propiedad.ciudad,
            colonia: propiedad.colonia,
            coordenadas: propiedad.coordenadas,
            precision_ubicacion: propiedad.precision_ubicacion,
            caracteristicas: propiedad.caracteristicas,
            superficie: propiedad.superficie,
            antiguedad: propiedad.antiguedad,
            precio: propiedad.precio,
            titulo: propiedad.titulo,
            descripcion: propiedad.descripcion
        };
    
        // Tipo de operación
        const operacionInput = document.querySelector(`input[name="tipo_operacion"][value="${propiedad.operacion.toLowerCase()}"]`);
        if (operacionInput) {
            operacionInput.click();
        }
    
        // Tipo de inmueble y variante
        const inmuebleInput = document.querySelector(`input[name="tipo_inmueble"][value="${propiedad.tipo_inmueble.toLowerCase()}"]`);
        if (inmuebleInput) {
            inmuebleInput.click();
            
            // Esperar a que se generen las variantes
            await new Promise(resolve => {
                const checkVariantes = setInterval(() => {
                    const varianteInput = document.querySelector(`input[name="tipo_variante"][value="${propiedad.variante.toLowerCase()}"]`);
                    if (varianteInput) {
                        clearInterval(checkVariantes);
                        varianteInput.click();
                        resolve();
                    }
                }, 100);
    
                // Timeout después de 5 segundos
                setTimeout(() => {
                    clearInterval(checkVariantes);
                    resolve();
                }, 5000);
            });
        }
    
        // Ubicación
        const direccionInput = document.getElementById('direccionInput');
        if (direccionInput) {
            direccionInput.value = propiedad.direccion;
        }
    
        // Actualizar el mapa si está disponible
        if (window.google && window.google.maps) {
            try {
                const mapHandler = await initializeMapAndForm();
                if (mapHandler && mapHandler.setLocation && propiedad.coordenadas) {
                    mapHandler.setLocation(
                        propiedad.coordenadas.lat,
                        propiedad.coordenadas.lng,
                        propiedad.direccion
                    );
                }
            } catch (error) {
                console.warn('No se pudo inicializar el mapa:', error);
            }
        }
    
        // Características
        Object.entries(propiedad.caracteristicas).forEach(([key, value]) => {
            const element = document.getElementById(`${key}_value`);
            if (element) {
                element.textContent = value;
                // Disparar evento para actualizar el estado interno
                document.dispatchEvent(new CustomEvent('caracteristicasUpdated', {
                    detail: { field: key, value: value }
                }));
            }
        });
    
        // Superficie
        if (propiedad.superficie) {
            const superficieConstruida = document.getElementById('superficie_construida');
            const superficieTotal = document.getElementById('superficie_total');
            
            if (superficieConstruida) {
                superficieConstruida.value = propiedad.superficie.construida;
                document.dispatchEvent(new CustomEvent('superficieUpdated', {
                    detail: { tipo: 'construida', value: propiedad.superficie.construida }
                }));
            }
            
            if (superficieTotal) {
                superficieTotal.value = propiedad.superficie.total;
                document.dispatchEvent(new CustomEvent('superficieUpdated', {
                    detail: { tipo: 'total', value: propiedad.superficie.total }
                }));
            }
        }
    
        // Antigüedad
        const tipoAntiguedadMap = {
            'new': 'estrenar',
            'years': 'anos',
            'under_construction': 'construccion'
        };
        const tipoAntiguedadRadio = document.querySelector(
            `input[name="antiguedad"][value="${tipoAntiguedadMap[propiedad.antiguedad.tipo]}"]`
        );
        if (tipoAntiguedadRadio) {
            tipoAntiguedadRadio.click();
            if (propiedad.antiguedad.tipo === 'years') {
                const cantidadAnos = document.getElementById('cantidad_anos');
                if (cantidadAnos) {
                    cantidadAnos.value = propiedad.antiguedad.anos;
                    document.getElementById('input_anos_container').style.display = 'block';
                }
            }
        }
    
        // Precio
        if (propiedad.precio) {
            const precioInmueble = document.getElementById('precio_inmueble');
            const mantenimiento = document.getElementById('mantenimiento');
            
            if (precioInmueble) {
                precioInmueble.value = propiedad.precio.monto;
                document.dispatchEvent(new CustomEvent('precioUpdated', {
                    detail: { tipo: 'monto', value: propiedad.precio.monto }
                }));
            }
            
            if (mantenimiento) {
                mantenimiento.value = propiedad.precio.mantenimiento;
                document.dispatchEvent(new CustomEvent('precioUpdated', {
                    detail: { tipo: 'mantenimiento', value: propiedad.precio.mantenimiento }
                }));
            }
        }
    
        // Título y descripción
        const tituloInput = document.getElementById('titulo_propiedad');
        const descripcionInput = document.getElementById('descripcion_propiedad');
        
        if (tituloInput) {
            tituloInput.value = propiedad.titulo;
            document.dispatchEvent(new CustomEvent('descripcionUpdated', {
                detail: { field: 'titulo', value: propiedad.titulo }
            }));
        }
        
        if (descripcionInput) {
            descripcionInput.value = propiedad.descripcion;
            document.dispatchEvent(new CustomEvent('descripcionUpdated', {
                detail: { field: 'descripcion', value: propiedad.descripcion }
            }));
        }
    
        // Actualizar contadores si existen
        const contadorTitulo = document.getElementById('contador_titulo');
        const contadorDescripcion = document.getElementById('contador_descripcion');
        if (contadorTitulo) contadorTitulo.textContent = propiedad.titulo.length;
        if (contadorDescripcion) contadorDescripcion.textContent = propiedad.descripcion.length;
    
        this.logFormDataUpdate('Formulario actualizado con datos existentes');
    }

    /**
     * Agrega un botón de debug en entorno de desarrollo
     */
    addDebugButton() {
        const debugButton = document.createElement('button');
        debugButton.textContent = '🐛 Debug Data';
        debugButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 15px;
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 5px;
            cursor: pointer;
            font-family: Arial, sans-serif;
        `;
        debugButton.onclick = () => this.logFormDataUpdate('Debug solicitado');
        document.body.appendChild(debugButton);
    }

    /**
     * Registra y muestra el estado actual del formulario
     */
    logFormDataUpdate(source, detail = null) {
        console.group(`📝 Actualización de FormData - ${source}`);
        console.log('Timestamp:', new Date().toLocaleTimeString());
        
        if (detail) {
            console.log('Detalle del cambio:', detail);
        }

        console.log('Estado actual del formulario:', {
            // Operación y tipo
            operacion: {
                valor: this.formData.operacion,
                estado: this.formData.operacion ? '✅' : '❌'
            },
            tipo_inmueble: {
                valor: this.formData.tipo_inmueble,
                estado: this.formData.tipo_inmueble ? '✅' : '❌'
            },
            variante: {
                valor: this.formData.variante,
                estado: this.formData.variante ? '✅' : '❌'
            },
            // Ubicación
            ubicacion: {
                direccion: {
                    valor: this.formData.direccion,
                    estado: this.formData.direccion ? '✅' : '❌'
                },
                estado: {
                    valor: this.formData.estado,
                    estado: this.formData.estado ? '✅' : '❌'
                },
                ciudad: {
                    valor: this.formData.ciudad,
                    estado: this.formData.ciudad ? '✅' : '❌'
                },
                colonia: {
                    valor: this.formData.colonia,
                    estado: this.formData.colonia ? '✅' : '❌'
                },
                coordenadas: {
                    valor: this.formData.coordenadas,
                    estado: (this.formData.coordenadas.lat && this.formData.coordenadas.lng) ? '✅' : '❌'
                },
                precision: this.formData.precision_ubicacion
            },
            // Características
            caracteristicas: {
                recamaras: this.formData.caracteristicas.recamaras,
                banos: this.formData.caracteristicas.banos,
                mediobano: this.formData.caracteristicas.mediobano,
                estacionamientos: this.formData.caracteristicas.estacionamientos
            },
            // Superficie
            superficie: {
                construida: {
                    valor: this.formData.superficie.construida,
                    estado: this.formData.superficie.construida > 0 ? '✅' : '❌'
                },
                total: {
                    valor: this.formData.superficie.total,
                    estado: this.formData.superficie.total > 0 ? '✅' : '❌'
                }
            },
            // Antigüedad
            antiguedad: {
                tipo: {
                    valor: this.formData.antiguedad.tipo,
                    estado: this.formData.antiguedad.tipo ? '✅' : '❌'
                },
                anos: this.formData.antiguedad.anos
            },
            // Precio
            precio: {
                monto: {
                    valor: this.formData.precio.monto,
                    estado: this.formData.precio.monto > 0 ? '✅' : '❌'
                },
                mantenimiento: this.formData.precio.mantenimiento
            },
            // Descripción
            titulo: {
                valor: this.formData.titulo,
                estado: this.formData.titulo ? '✅' : '❌',
                longitud: this.formData.titulo.length
            },
            descripcion: {
                valor: this.formData.descripcion,
                estado: this.formData.descripcion ? '✅' : '❌',
                longitud: this.formData.descripcion.length
            }
        });

        console.groupEnd();
    }

    /**
     * Inicializa todos los listeners de eventos del formulario
     */
    initializeDataListeners() {
        // Tipo de operación
        document.addEventListener('operacionSelected', (e) => {
            this.formData.operacion = e.detail.value;
            this.logFormDataUpdate('Operación seleccionada', e.detail);
        });

        // Tipo de inmueble
        document.addEventListener('inmuebleSelected', (e) => {
            this.formData.tipo_inmueble = e.detail.value;
            this.formData.variante = ''; // Resetear variante al cambiar tipo
            this.logFormDataUpdate('Inmueble seleccionado', e.detail);
        });

        // Variante de inmueble
        document.addEventListener('varianteSelected', (e) => {
            this.formData.variante = e.detail.value;
            this.logFormDataUpdate('Variante seleccionada', e.detail);
        });

        // Ubicación
        document.addEventListener('locationUpdated', (e) => {
            const locationData = e.detail;
            this.formData.direccion = locationData.direccionCompleta;
            this.formData.estado = locationData.estado;
            this.formData.ciudad = locationData.ciudad;
            this.formData.colonia = locationData.colonia;
            this.formData.coordenadas = {
                lat: locationData.lat,
                lng: locationData.lng
            };
            this.formData.precision_ubicacion = locationData.precisionUbicacion;
            this.logFormDataUpdate('Ubicación actualizada', locationData);
        });

        // Características
        document.addEventListener('caracteristicasUpdated', (e) => {
            const { field, value } = e.detail;
            this.formData.caracteristicas[field] = parseInt(value) || 0;
            this.logFormDataUpdate('Característica actualizada', e.detail);
        });

        // Superficie
        document.addEventListener('superficieUpdated', (e) => {
            const { tipo, value } = e.detail;
            this.formData.superficie[tipo] = parseFloat(value) || 0;
            this.logFormDataUpdate('Superficie actualizada', e.detail);
        });

        // Antigüedad
        document.addEventListener('antiguedadUpdated', (e) => {
            const { tipo, anos } = e.detail;
            
            // Asignar el tipo directamente ya que viene mapeado del componente
            this.formData.antiguedad.tipo = tipo;
            this.formData.antiguedad.anos = parseInt(anos) || 0;
            
            // Log detallado para debugging
            this.logFormDataUpdate('Antigüedad actualizada', {
                tipo_recibido: tipo,
                anos_recibidos: anos,
                tipo_guardado: this.formData.antiguedad.tipo,
                anos_guardados: this.formData.antiguedad.anos
            });
        });

        // Precio
        document.addEventListener('precioUpdated', (e) => {
            const { tipo, value } = e.detail;
            this.formData.precio[tipo] = parseFloat(value) || 0;
            this.logFormDataUpdate('Precio actualizado', e.detail);
        });

        // Descripción
        document.addEventListener('descripcionUpdated', (e) => {
            const { field, value } = e.detail;
            this.formData[field] = value;
            this.logFormDataUpdate('Descripción actualizada', e.detail);
        });

        // Precisión de ubicación
        document.addEventListener('precisionUbicacionUpdated', (e) => {
            this.formData.precision_ubicacion = e.detail.value;
            this.logFormDataUpdate('Precisión de ubicación actualizada', e.detail);
        });

        // Eventos de guardado
        document.addEventListener('saveProperty', async (e) => {
            console.group('💾 Guardando Propiedad');
            console.log('Datos finales a enviar:', this.formData);
            console.log('Acción:', e.detail.accion);
            console.groupEnd();
            await this.guardarPropiedad(e.detail.accion);
        });
    }

    /**
     * Valida todos los campos requeridos del formulario
     */
    validarFormulario() {
        const errores = [];
    
        // Validar operación e inmueble
        if (!this.formData.operacion) errores.push('Selecciona el tipo de operación');
        if (!this.formData.tipo_inmueble) errores.push('Selecciona el tipo de inmueble');
        if (!this.formData.variante) errores.push('Selecciona la variante del inmueble');
    
        // Validar ubicación
        if (!this.formData.direccion) {
            errores.push('Ingresa la dirección del inmueble');
        }
        
        if (!this.formData.coordenadas.lat || !this.formData.coordenadas.lng) {
            errores.push('Selecciona una ubicación válida en el mapa');
        }
    
        // Validar precio
        if (!this.formData.precio.monto || this.formData.precio.monto <= 0) {
            errores.push('Ingresa un precio válido para el inmueble');
        }
    
        // Validar superficie
        if (this.formData.superficie.construida <= 0 && this.formData.superficie.total <= 0) {
            errores.push('Ingresa al menos una superficie (construida o total)');
        }
    
        // Validar descripción
        if (!this.formData.titulo.trim()) errores.push('Ingresa el título del aviso');
        if (!this.formData.descripcion.trim()) errores.push('Ingresa la descripción del inmueble');
    
        // Mostrar errores si existen
        if (errores.length > 0) {
            console.error('Errores de validación:', errores);
            alert('Por favor corrige los siguientes errores:\n\n' + errores.join('\n'));
            return false;
        }
    
        return true;
    }

    /**
     * Guarda la propiedad en el servidor
     */
    async guardarPropiedad(accion) {
        try {
            // Verificar autenticación
            const sessionManager = new SessionManager();
            if (!sessionManager.isAuthenticated()) {
                window.location.href = '/inicio_sesion.html';
                return;
            }
    
            // Validar datos antes de enviar
            if (!this.validarFormulario()) {
                throw new Error('Por favor, completa todos los campos requeridos');
            }
    
            // Preparar datos para envío
            const session = sessionManager.getSession();
            const datosParaEnviar = {
                // Si estamos en modo edición, incluir el ID
                ...(this.isEditMode && { id: this.propertyId }),
                
                // Datos de operación
                operacion: this.formData.operacion,
                tipo_inmueble: this.formData.tipo_inmueble,
                variante: this.formData.variante,
    
                // Ubicación
                direccion: this.formData.direccion,
                estado: this.formData.estado,
                ciudad: this.formData.ciudad,
                colonia: this.formData.colonia,
                coordenadas: this.formData.coordenadas,
                precision_ubicacion: this.formData.precision_ubicacion,
    
                // Características
                caracteristicas: {
                    recamaras: parseInt(this.formData.caracteristicas.recamaras) || 0,
                    banos: parseInt(this.formData.caracteristicas.banos) || 0,
                    mediobano: parseInt(this.formData.caracteristicas.mediobano) || 0,
                    estacionamientos: parseInt(this.formData.caracteristicas.estacionamientos) || 0
                },
    
                // Superficie
                superficie: {
                    construida: parseFloat(this.formData.superficie.construida) || 0,
                    total: parseFloat(this.formData.superficie.total) || 0
                },
    
                // Antigüedad
                antiguedad: {
                    tipo: this.formData.antiguedad.tipo,
                    anos: parseInt(this.formData.antiguedad.anos) || 0
                },
    
                // Precio
                precio: {
                    monto: parseFloat(this.formData.precio.monto) || 0,
                    mantenimiento: parseFloat(this.formData.precio.mantenimiento) || 0
                },
    
                // Descripción
                titulo: this.formData.titulo.trim(),
                descripcion: this.formData.descripcion.trim(),
    
                // Metadata
                usuario_id: session.id,
                fecha_creacion: this.isEditMode ? undefined : new Date().toISOString(),
                estado_publicacion: 'draft'
            };
    
            // Determinar la URL según el modo (creación o actualización)
            const url = this.isEditMode ? 
                '/api/propiedades/actualizar.php' : 
                '/api/propiedades/guardar.php';
    
            // Log de datos a enviar
            console.log('Datos a enviar al servidor:', datosParaEnviar);
            console.log('URL del endpoint:', url);
            console.log('Modo:', this.isEditMode ? 'Actualización' : 'Creación');
    
            // Realizar la petición
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(datosParaEnviar)
            });
    
            // Log de la respuesta del servidor
            console.log('Respuesta del servidor - Status:', response.status);
            console.log('Respuesta del servidor - Headers:', Object.fromEntries(response.headers.entries()));
    
            // Verificar si la respuesta es JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Si no es JSON, intentar obtener el texto del error
                const errorText = await response.text();
                console.error('Respuesta no JSON del servidor:', errorText);
                throw new Error('Respuesta no válida del servidor');
            }
    
            const data = await response.json();
            console.log('Datos de respuesta:', data);
    
            if (!response.ok) {
                throw new Error(data.message || `Error del servidor: ${response.status}`);
            }
    
            if (!data.success) {
                throw new Error(data.message || 'Error desconocido al guardar la propiedad');
            }
    
            // Mostrar mensaje de éxito
            alert(this.isEditMode ? 
                'Propiedad actualizada exitosamente' : 
                'Propiedad creada exitosamente'
            );
    
            // Determinar el ID para la redirección
            const propertyId = this.isEditMode ? this.propertyId : data.propiedad_id;
    
            // Redirigir según la acción
            if (accion === 'continuar') {
                window.location.href = `/dashboard/workspace/multimedia.html?id=${propertyId}`;
            } else {
                window.location.href = '/dashboard/publicaciones.html';
            }
    
        } catch (error) {
            console.error('Error completo:', error);
            alert(`Error al ${this.isEditMode ? 'actualizar' : 'crear'} la propiedad: ${error.message}`);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.propertyFormHandler = new PropertyFormHandler();
    console.log('🚀 PropertyFormHandler inicializado');
});