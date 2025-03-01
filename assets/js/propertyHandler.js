// Variables globales para el carrusel
let currentIndex = 0;
let isMobileView = window.innerWidth <= 1024;
let isSmallMobileView = window.innerWidth <= 767;
let trackSup, trackInf, slidesSup, slidesInf, prevButton, nextButton, carouselSupContainer;

class PropertyHandler {
    constructor() {
        this.currentProperty = null;
        this.apiUrl = '/api/propiedades/property_handler.php';
        this.init();
        this.viewStartTime = Date.now();
        this.lastTrackingUpdate = Date.now();
        this.isTracking = false;
        this.trackingInterval = null;
        this.initializeViewTracking();
        this.statsUpdateInterval = null;
        this.lastStatsUpdate = Date.now();
        
        // Estado de la maqueta digital
        this.mockupActive = false;
    
        // Crear contenedor para notificaciones
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(this.notificationContainer);
    
        // Mapeo de amenidades a íconos
        this.amenityIcons = {
            // Características generales
            'Acceso discapacitados': 'fa-wheelchair',
            'Alberca': 'fa-swimming-pool',
            'Amueblado': 'fa-couch',
            'Caseta de guardia': 'fa-shield-alt',
            'Chimenea': 'fa-fire',
            'Cocina integral': 'fa-utensils',
            'Cuartos de servicio': 'fa-broom',
            'Escuelas Cercanas': 'fa-school',
            'Frente a Parque': 'fa-tree',
            'Jacuzzi': 'fa-hot-tub',
            'Mascotas': 'fa-paw',
    
            // Servicios
            'Aire acondicionado': 'fa-snowflake',
            'Área de Juegos Infantiles': 'fa-child',
            'Calefacción': 'fa-temperature-high',
            'Gimnasio': 'fa-dumbbell',
            'Internet/Wifi': 'fa-wifi',
            'Inmueble Inteligente': 'fa-microchip',
            'Energía Renovable': 'fa-solar-panel',
            'Línea blanca': 'fa-tshirt',
            'Seguridad privada': 'fa-shield-alt',
    
            // Exteriores
            'Asador': 'fa-fire',
            'Cancha de squash': 'fa-table-tennis',
            'Cancha de tenis': 'fa-tennis-ball',
            'Jardín Privado': 'fa-tree',
    
            // Ambientes
            'Cuarto de TV': 'fa-tv',
            'Estudio': 'fa-book'
        };
    
        // Crear los modales al inicializar
        this.createImageModal();
        this.createContactModal();
    }

    createContactModal() {
        const modal = document.createElement('div');
        modal.className = 'contact-phone-modal';
        modal.id = 'contactPhoneModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 2000;
            justify-content: center;
            align-items: center;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 400px;
            position: relative;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'modal-close';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        `;

        const form = document.createElement('form');
        form.id = 'phoneRevealForm';
        form.innerHTML = `
            <h3 style="margin: 0 0 20px; text-align: center;">Ingresa tus datos para ver el número</h3>
            <div style="margin-bottom: 15px;">
                <input type="text" name="name" placeholder="Nombre completo" required
                       style="width: calc(100% - 26px); padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
                <div style="display: flex; gap: 10px;">
                    <select name="country_code" 
                            style="padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="+52">+52</option>
                        <option value="+1">+1</option>
                    </select>
                    <input type="tel" name="phone" placeholder="Tu teléfono" required
                           style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
            </div>
            <input type="hidden" name="property_id">
            <button type="submit" style="
                width: 100%;
                padding: 12px;
                background: var(--principal);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.3s ease;
                margin-bottom: 10px;
            ">Ver número de teléfono</button>
            <p class="avisolegalform">Al enviar estás aceptando los <a href="/legal/terminos-y-condiciones.html">Términos y Condiciones de Uso</a> y la <a href="/legal/politica-de-privacidad.html">Política de privacidad</a></p>
        `;

        modalContent.appendChild(closeButton);
        modalContent.appendChild(form);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Event Listeners
        closeButton.addEventListener('click', () => this.closeContactPhoneModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeContactPhoneModal();
        });
        form.addEventListener('submit', (e) => this.handlePhoneRevealSubmit(e));
    }

    closeContactPhoneModal() {
        const modal = document.getElementById('contactPhoneModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    openContactPhoneModal() {
        const modal = document.getElementById('contactPhoneModal');
        const propertyIdInput = modal?.querySelector('input[name="property_id"]');
        if (modal && propertyIdInput && this.currentProperty) {
            propertyIdInput.value = this.currentProperty.id;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

// En el método handlePhoneRevealSubmit de la clase PropertyHandler
async handlePhoneRevealSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const requiredFields = ['name', 'phone', 'property_id'];
        for (const field of requiredFields) {
            const input = form.elements[field];
            if (!input || !input.value.trim()) {
                throw new Error(`El campo ${field} es requerido`);
            }
        }

        const formData = new FormData(form);
        formData.append('action', 'phone_reveal');
        formData.append('source', 'phone_reveal');
        formData.append('property_id', this.currentProperty.id);
        formData.append('country_code', formData.get('country_code') || '+52');
        formData.append('contact_preference', 'phone'); // Establecer teléfono como preferencia
        formData.append('message', 'Cliente solicitó ser contactado por teléfono'); // Mensaje específico
        
        // Agregar información específica para contacto telefónico
        formData.append('activity_title', 'Solicitud de número de teléfono');
        formData.append('activity_description', 'El usuario solicitó ver el número de teléfono del agente');
        formData.append('activity_type', 'first_contact');
        formData.append('contact_preference', 'phone'); // Específico para revelación de teléfono
        formData.append('message', 'Cliente solicitó ser contactado por teléfono');

        const response = await fetch('/api/propiedades/add_lead.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al procesar la solicitud');
        }

        const data = await response.json();
        
        if (data.status === 'success') {
            const phoneElement = document.getElementById('agent_phone');
            const phoneButton = document.querySelector('.mirar_number_ases .show-phone-btn');
            
            if (phoneElement && phoneButton) {
                const preferredContact = this.currentProperty.owner.preferred_contact || '';
                let preferredLabel = '';
                
                switch(preferredContact.toLowerCase()) {
                    case 'whatsapp':
                        preferredLabel = ' (Prefiere WhatsApp)';
                        break;
                    case 'call':
                        preferredLabel = ' (Prefiere llamadas)';
                        break;
                    case 'sms':
                        preferredLabel = ' (Prefiere SMS)';
                        break;
                    case 'email':
                        preferredLabel = ' (Prefiere email)';
                        break;
                }
                
                phoneElement.textContent = `${phoneElement.dataset.phone}${preferredLabel}`;
                phoneElement.style.display = 'block';
                phoneButton.style.display = 'none';
            }
            
            this.closeContactPhoneModal();
            form.reset();
            this.showNotification('Número de teléfono revelado exitosamente', 'success');
        } else {
            throw new Error(data.message || 'Error al procesar la solicitud');
        }
    } catch (error) {
        console.error('Error:', error);
        this.showNotification(error.message || 'Error al procesar la solicitud', 'error');
    }
}

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('id');
        
        if (propertyId) {
            this.loadPropertyData(propertyId);
        } else {
            console.error('ID de propiedad no encontrado en la URL');
        }
    }

    async loadPropertyData(propertyId) {
        try {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'flex';
    
            await this.trackPropertyView(propertyId);
    
            const response = await fetch(`${this.apiUrl}?action=getProperty&id=${propertyId}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
    
            const result = await response.json();
            
            if (result.success && result.data) {
                this.currentProperty = {
                    ...result.data,
                    built_area: parseFloat(result.data.built_area) || 0,
                    total_area: parseFloat(result.data.total_area) || 0,
                    bathrooms: parseInt(result.data.bathrooms) || 0,
                    bedrooms: parseInt(result.data.bedrooms) || 0,
                    parking_spots: parseInt(result.data.parking_spots) || 0,
                    half_bathrooms: parseInt(result.data.half_bathrooms) || 0,
                    price: parseFloat(result.data.price) || 0,
                    maintenance_fee: parseFloat(result.data.maintenance_fee) || 0
                };

                await this.updateUI();
                this.initializeEventListeners();
            } else {
                throw new Error(result.error || 'Error al cargar los datos de la propiedad');
            }
        } catch (error) {
            console.error('Error al cargar la propiedad:', error);
        } finally {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'none';
        }
    }

    initializeViewTracking() {
        // Iniciar tracking cuando la página está visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.startTracking();
            } else {
                this.pauseTracking();
            }
        });

        // Agregar actualización periódica de estadísticas
        this.statsUpdateInterval = setInterval(() => {
            if (this.isTracking && this.currentProperty) {
                this.updatePropertyStats();
            }
        }, 60000); // Actualizar estadísticas cada minuto si hay actividad

        // Eventos adicionales para actualización de estadísticas
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentProperty) {
                this.updatePropertyStats();
            }
        });

        window.addEventListener('beforeunload', () => {
            if (this.currentProperty) {
                this.updatePropertyStats(true);
            }
        });

        // Iniciar tracking inicial
        if (document.visibilityState === 'visible') {
            this.startTracking();
        }

        // Actualizar periódicamente mientras la página está abierta
        this.trackingInterval = setInterval(() => {
            if (this.isTracking) {
                this.updateViewDuration();
            }
        }, 30000); // Actualizar cada 30 segundos
    }

    startTracking() {
        if (!this.isTracking) {
            this.isTracking = true;
            this.lastTrackingUpdate = Date.now();
        }
    }

    pauseTracking() {
        if (this.isTracking) {
            this.updateViewDuration();
            this.isTracking = false;
        }
    }

    async updatePropertyStats(isFinal = false) {
        try {
            const currentTime = Date.now();
            // Evitar actualizaciones muy frecuentes
            if (!isFinal && currentTime - this.lastStatsUpdate < 60000) {
                return;
            }

            const response = await fetch('/cron/update_property_stats.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    property_id: this.currentProperty.id,
                    is_final: isFinal,
                    client_data: {
                        screen_width: window.innerWidth,
                        screen_height: window.innerHeight,
                        user_agent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'error') {
                throw new Error(result.message);
            }

            this.lastStatsUpdate = currentTime;

        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }

    async updateViewDuration(isFinal = false) {
        try {
            if (!this.currentProperty) return;
    
            const currentTime = Date.now();
            const duration = Math.floor((currentTime - this.lastTrackingUpdate) / 1000); // Duración en segundos
    
            if (duration < 1) return; // Ignorar actualizaciones muy cortas
    
            const urlParams = new URLSearchParams(window.location.search);
            const sessionData = localStorage.getItem('vibien_session');
            const userSession = sessionData ? JSON.parse(sessionData) : null;
    
            const trackingData = {
                property_id: this.currentProperty.id,
                type: 'view',                    // Añadido el tipo de tracking
                duration: duration,              // Duración explícita
                view_duration: duration,         // Añadida la duración de vista
                is_final_update: isFinal,
                interaction_type: isFinal ? 'complete' : 'ongoing',
                position: urlParams.get('position'),
                page: urlParams.get('page'),
                referrer: document.referrer,
                session: {
                    user_id: userSession?.id || null,
                    user_type: userSession?.user_type || null,
                    session_id: sessionData ? btoa(sessionData) : null,
                    is_authenticated: !!userSession
                },
                client_data: {
                    screen_width: window.innerWidth,
                    screen_height: window.innerHeight,
                    user_agent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform,
                    timestamp: new Date().toISOString()
                }
            };
    
            const response = await fetch('/api/propiedades/track_property.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(trackingData)
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            // Actualizar el tiempo de la última actualización solo si la petición fue exitosa
            this.lastTrackingUpdate = currentTime;
    
            console.log('View duration updated:', {
                duration,
                trackingData
            });
    
        } catch (error) {
            console.error('Error al actualizar duración de vista:', error);
        }
    }

    // Modificar el método existente trackPropertyView
    async trackPropertyView(propertyId) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            
            // Obtener datos de sesión
            const sessionData = localStorage.getItem('vibien_session');
            const userSession = sessionData ? JSON.parse(sessionData) : null;
            
            const trackingData = {
                property_id: propertyId,
                duration: 0, // Duración inicial
                interaction_type: 'initial',
                referrer: document.referrer,
                position: urlParams.get('position'),
                page: urlParams.get('page'),
                search_filters: urlParams.get('filters'),
                session: {
                    user_id: userSession?.id || null,
                    user_type: userSession?.user_type || null,
                    session_id: sessionData ? btoa(sessionData) : null,
                    is_authenticated: !!userSession
                },
                client_data: {
                    screen_width: window.innerWidth,
                    screen_height: window.innerHeight,
                    user_agent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform,
                    timestamp: new Date().toISOString()
                }
            };

            const response = await fetch('/api/propiedades/track_property.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(trackingData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                this.startTracking();
                // Actualizar estadísticas después del registro inicial
                await this.updatePropertyStats();
            }
        } catch (error) {
            console.error('Error al registrar vista:', error);
        }
    }

    // No olvides limpiar el intervalo cuando sea necesario
    destructor() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
        }
        // Actualización final de estadísticas
        if (this.currentProperty) {
            this.updatePropertyStats(true);
        }
    }

    createImageModal() {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            transition: opacity 0.3s ease;
            padding: 40px;
            box-sizing: border-box;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            position: relative;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const modalImage = document.createElement('img');
        modalImage.style.cssText = `
            max-height: 100%;
            max-width: 100%;
            object-fit: contain;
            transition: transform 0.3s ease;
            margin: auto;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'modal-close';
        closeButton.style.cssText = `
            position: absolute;
            top: -30px;
            right: 0;
            color: white;
            font-size: 36px;
            font-weight: bold;
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease;
            z-index: 1002;
        `;

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '❮';
        prevButton.className = 'modal-nav prev';
        prevButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            color: white;
            font-size: 36px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 10px;
            transition: transform 0.2s ease;
            z-index: 1002;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const nextButton = document.createElement('button');
        nextButton.innerHTML = '❯';
        nextButton.className = 'modal-nav next';
        nextButton.style.cssText = `
            position: absolute;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            color: white;
            font-size: 36px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 10px;
            transition: transform 0.2s ease;
            z-index: 1002;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Contador de imágenes
        const imageCounter = document.createElement('div');
        imageCounter.className = 'image-counter';
        imageCounter.style.cssText = `
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 16px;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 5px 15px;
            border-radius: 15px;
            z-index: 1002;
        `;

        modalContent.appendChild(modalImage);
        modalContent.appendChild(closeButton);
        modalContent.appendChild(prevButton);
        modalContent.appendChild(nextButton);
        modalContent.appendChild(imageCounter);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        this.modal = modal;
        this.modalImage = modalImage;
        this.imageCounter = imageCounter;

        // Eventos del modal
        closeButton.addEventListener('click', () => this.closeModal());
        prevButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateModal('prev');
        });
        nextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateModal('next');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Eventos de teclado para el modal
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'flex') {
                if (e.key === 'Escape') {
                    this.closeModal();
                } else if (e.key === 'ArrowLeft') {
                    this.navigateModal('prev');
                } else if (e.key === 'ArrowRight') {
                    this.navigateModal('next');
                }
            }
        });

        // Efecto hover en los botones
        [closeButton, prevButton, nextButton].forEach(button => {
            button.addEventListener('mouseover', () => {
                button.style.transform += ' scale(1.1)';
            });
            button.addEventListener('mouseout', () => {
                button.style.transform = button.style.transform.replace(' scale(1.1)', '');
            });
        });
    }

    openModal(index) {
        const imageSlides = document.querySelectorAll('.cart_infe_prop:not(.video-container)');
        if (index >= 0 && index < imageSlides.length) {
            const imgSrc = imageSlides[index].querySelector('img').src;
            this.modalImage.src = imgSrc;
            this.modal.style.display = 'flex';
            this.currentModalIndex = index;
            document.body.style.overflow = 'hidden';
            
            // Actualizar contador
            this.imageCounter.textContent = `${index + 1} / ${imageSlides.length}`;
        }
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    navigateModal(direction) {
        const imageSlides = document.querySelectorAll('.cart_infe_prop:not(.video-container)');
        let newIndex = this.currentModalIndex;

        if (direction === 'prev') {
            newIndex = (newIndex - 1 + imageSlides.length) % imageSlides.length;
        } else {
            newIndex = (newIndex + 1) % imageSlides.length;
        }

        this.openModal(newIndex);
    }

    async updateUI() {
        if (!this.currentProperty) return;

        this.updateBasicInfo();
        this.updateDescription();
        this.updateMainFeatures();
        this.updateLocation();
        this.updateAmenities();
        this.updateContactInfo();
        this.initializeMockup(); // Inicializar la maqueta digital

        if (window.google) {
            this.initializeMap();
        }

        await this.updateCarouselImages();
        this.initializeCarousel();
    }

    initializeMockup() {
        const mockupButton = document.getElementById('show-mockup');
        const carouselTrackInf = document.querySelector('.carousel-track-inf');
        const carouselContainer = document.querySelector('.caru_infe_prop');
        
        // Detectar plataforma móvil
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isMobile = isIOS || isAndroid || window.innerWidth <= 768;
        
        // Función para solicitar pantalla completa
        const requestFullscreen = async (element) => {
            try {
                if (element.requestFullscreen) {
                    await element.requestFullscreen();
                } else if (element.webkitRequestFullscreen) { // iOS/Safari
                    await element.webkitRequestFullscreen();
                } else if (element.mozRequestFullScreen) { // Firefox
                    await element.mozRequestFullScreen();
                } else if (element.msRequestFullscreen) { // IE/Edge
                    await element.msRequestFullscreen();
                }
            } catch (error) {
                console.log('Pantalla completa no disponible:', error);
            }
        };
    
        // Función para salir de pantalla completa
        const exitFullscreen = async () => {
            try {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }
            } catch (error) {
                console.log('Error al salir de pantalla completa:', error);
            }
        };
    
        // Función para mostrar el mensaje de rotación
        const showRotationMessage = () => {
            const existingMessage = document.querySelector('.rotate-device-message');
            if (existingMessage) return;
    
            const rotateMessage = document.createElement('div');
            rotateMessage.className = 'rotate-device-message';
            rotateMessage.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                z-index: 2100;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: opacity 0.3s ease;
            `;
            
            const messageContent = document.createElement('div');
            messageContent.style.cssText = `
                text-align: center;
                color: white;
                padding: 20px;
                max-width: 90%;
            `;
                
            // Personalizar mensaje según la plataforma
            if (isIOS) {
                messageContent.innerHTML = `
                    <div style="margin-bottom: 20px;">
                        <i class="fas fa-mobile fa-rotate-90" style="font-size: 48px; color: white;"></i>
                    </div>
                    <div style="font-size: 16px; line-height: 1.4; color: white;">
                        <p style="margin-bottom: 10px; color: white;">Para una mejor experiencia:</p>
                        <p style="color: white;">1. Activa la rotación en el Centro de Control</p>
                        <p style="color: white;">2. Gira tu dispositivo horizontalmente</p>
                    </div>
                    <button class="continue-anyway" style="
                        background: white;
                        color: black;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-weight: bold;
                        margin-top: 20px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Continuar de todos modos</button>
                `;
            } else {
                messageContent.innerHTML = `
                    <div style="margin-bottom: 20px;">
                        <i class="fas fa-mobile fa-rotate-90" style="font-size: 48px; color: white;"></i>
                    </div>
                    <div style="font-size: 16px; line-height: 1.4; color: white;">
                        <p style="margin-bottom: 10px; color: white;">Para una mejor experiencia:</p>
                        <p style="color: white;">Gira tu dispositivo horizontalmente</p>
                    </div>
                    <button class="continue-anyway" style="
                        background: white;
                        color: black;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-weight: bold;
                        margin-top: 20px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Continuar</button>
                `;
            }
    
            rotateMessage.appendChild(messageContent);
            document.body.appendChild(rotateMessage);
    
            // Configurar botón continuar
            const continueButton = rotateMessage.querySelector('.continue-anyway');
            continueButton.addEventListener('click', () => {
                rotateMessage.remove();
            });
    
            // Remover mensaje cuando el dispositivo se gire
            const handleOrientation = () => {
                if (window.innerWidth > window.innerHeight) {
                    rotateMessage.style.opacity = '0';
                    setTimeout(() => rotateMessage.remove(), 300);
                    window.removeEventListener('resize', handleOrientation);
                }
            };
            
            window.addEventListener('resize', handleOrientation);
        };
        
        if (!mockupButton || !carouselTrackInf || !carouselContainer) return;
        
        if (this.currentProperty?.digital_mockup_url) {
            mockupButton.style.display = 'flex';
            
            let mockupContainer = document.querySelector('.mockup-container');
            if (!mockupContainer) {
                mockupContainer = document.createElement('div');
                mockupContainer.className = 'mockup-container';
                mockupContainer.style.cssText = `
                    display: none;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: #000;
                `;
                carouselContainer.appendChild(mockupContainer);
    
                const controls = document.createElement('div');
                controls.className = 'mockup-controls';
                controls.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 2000;
                    display: flex;
                    gap: 10px;
                `;
                
                const buttonStyles = `
                    background: rgba(0, 0, 0, 0.6);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: background-color 0.3s ease;
                `;
                
                const fullscreenButton = document.createElement('button');
                fullscreenButton.className = 'mockup-button fullscreen-btn';
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenButton.style.cssText = buttonStyles;
                
                const closeButton = document.createElement('button');
                closeButton.className = 'mockup-button close-btn';
                closeButton.innerHTML = '<i class="fas fa-times"></i>';
                closeButton.style.cssText = buttonStyles;
                
                controls.appendChild(fullscreenButton);
                controls.appendChild(closeButton);
                mockupContainer.appendChild(controls);

                // Función para manejar la rotación en Android
                const handleAndroidRotation = async () => {
                    if (isAndroid && screen.orientation && screen.orientation.lock) {
                        try {
                            await screen.orientation.lock('landscape');
                            return true;
                        } catch (error) {
                            console.log('No se pudo rotar la pantalla:', error);
                            return false;
                        }
                    }
                    return false;
                };
    
                // Evento del botón de maqueta
                mockupButton.addEventListener('click', async () => {
                    try {
                        const iframe = document.createElement('iframe');
                        iframe.src = this.currentProperty.digital_mockup_url;
                        iframe.style.cssText = `
                            width: 100%;
                            height: 100%;
                            border: none;
                        `;
                        iframe.allowFullscreen = true;
                        
                        mockupContainer.innerHTML = '';
                        mockupContainer.appendChild(iframe);
                        mockupContainer.appendChild(controls);
                        mockupContainer.style.display = 'block';
                        carouselTrackInf.style.visibility = 'hidden';

                        if (isMobile && window.innerHeight > window.innerWidth) {
                            if (isAndroid) {
                                const rotated = await handleAndroidRotation();
                                if (!rotated) {
                                    showRotationMessage();
                                }
                            } else {
                                showRotationMessage();
                            }
                        }

                        // Intentar pantalla completa
                        await requestFullscreen(mockupContainer);
                        
                    } catch (error) {
                        console.error('Error al abrir la maqueta:', error);
                    }
                });
    
                // Evento del botón de pantalla completa
                fullscreenButton.addEventListener('click', async () => {
                    if (!document.fullscreenElement && 
                        !document.webkitFullscreenElement && 
                        !document.mozFullScreenElement && 
                        !document.msFullscreenElement) {
                        await requestFullscreen(mockupContainer);
                        fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
                    } else {
                        await exitFullscreen();
                        fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
                    }
                });
    
                // Evento del botón de cerrar
                closeButton.addEventListener('click', async () => {
                    await exitFullscreen();
                    
                    // Desbloquear orientación en Android
                    if (isAndroid && screen.orientation && screen.orientation.unlock) {
                        try {
                            await screen.orientation.unlock();
                        } catch (error) {
                            console.log('Error al desbloquear orientación:', error);
                        }
                    }
                    
                    mockupContainer.style.display = 'none';
                    mockupContainer.innerHTML = '';
                    mockupContainer.appendChild(controls);
                    carouselTrackInf.style.visibility = 'visible';

                    const rotateMessage = document.querySelector('.rotate-device-message');
                    if (rotateMessage) {
                        rotateMessage.remove();
                    }
                });
    
                // Detectar cambios en el modo pantalla completa
                document.addEventListener('fullscreenchange', handleFullscreenChange);
                document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
                document.addEventListener('mozfullscreenchange', handleFullscreenChange);
                document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
                function handleFullscreenChange() {
                    if (!document.fullscreenElement && 
                        !document.webkitFullscreenElement && 
                        !document.mozFullScreenElement && 
                        !document.msFullscreenElement) {
                        mockupContainer.classList.remove('fullscreen');
                        fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
                    }
                }
            }
        } else {
            mockupButton.style.display = 'none';
            const existingContainer = document.querySelector('.mockup-container');
            if (existingContainer) existingContainer.remove();
        }
    }

    updateBasicInfo() {
        const titleElement = document.querySelector('.encabeza_propiedad h2');
        const priceElement = document.querySelector('.precio_propiedad h2');
        
        if (titleElement) titleElement.textContent = this.currentProperty.title;
        if (priceElement) {
            priceElement.textContent = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(this.currentProperty.price);
        }
    }

    updateDescription() {
        const descriptionTitle = document.querySelector('.describ_propiedad h3');
        const descriptionContainer = document.querySelector('.describ_propiedad p');
        
        if (!descriptionTitle || !descriptionContainer || !this.currentProperty) return;
        
        // Actualizar el título
        descriptionTitle.textContent = this.currentProperty.title;
        
        // Crear contenedor para la descripción expandible
        const expandableContainer = document.createElement('div');
        expandableContainer.className = 'expandable-description';
        expandableContainer.innerHTML = `
            <p class="description-text">${this.currentProperty.description}</p>
            <button class="expand-button" style="display: none;">Saber más...</button>
        `;
        
        // Reemplazar el contenedor original
        descriptionContainer.parentNode.replaceChild(expandableContainer, descriptionContainer);
        
        const descriptionText = expandableContainer.querySelector('.description-text');
        const expandButton = expandableContainer.querySelector('.expand-button');
        
        // Añadir estilos necesarios
        descriptionText.style.cssText = `
            margin: 0;
            margion-top: 10px
            transition: max-height 0.3s ease-out;
            overflow: hidden;
            position: relative;
        `;
        
        expandButton.style.cssText = `
            background: none;
            border: none;
            color: var(--principal);
            padding: 5px 0;
            cursor: pointer;
            font-weight: 500;
            display: none;
            margin-top: 8px;
        `;
        
        // Función para verificar si el texto excede tres líneas
        const checkTextOverflow = () => {
            // Reset max-height para obtener la altura real
            descriptionText.style.maxHeight = 'none';
            
            const lineHeight = parseInt(window.getComputedStyle(descriptionText).lineHeight);
            const height = descriptionText.offsetHeight;
            const lines = height / lineHeight;
            
            if (lines > 3) {
                descriptionText.style.maxHeight = `${lineHeight * 3}px`;
                expandButton.style.display = 'block';
                expandableContainer.classList.add('collapsed');
            } else {
                expandButton.style.display = 'none';
            }
        };
        
        // Manejar el clic en el botón
        expandButton.addEventListener('click', () => {
            const isCollapsed = expandableContainer.classList.contains('collapsed');
            
            if (isCollapsed) {
                descriptionText.style.maxHeight = `${descriptionText.scrollHeight}px`;
                expandButton.textContent = 'Ver menos';
                expandableContainer.classList.remove('collapsed');
            } else {
                const lineHeight = parseInt(window.getComputedStyle(descriptionText).lineHeight);
                descriptionText.style.maxHeight = `${lineHeight * 3}px`;
                expandButton.textContent = 'Saber más...';
                expandableContainer.classList.add('collapsed');
            }
        });
        
        // Verificar el overflow inicial después de que el contenido se haya cargado
        setTimeout(checkTextOverflow, 0);
        
        // Verificar también cuando la ventana cambie de tamaño
        window.addEventListener('resize', checkTextOverflow);
    }

    updateMainFeatures() {
        if (!this.currentProperty) {
            console.error('No hay datos de propiedad');
            return;
        }
    
        const container = document.getElementById('property-features');
        if (!container) {
            console.error('No se encontró el contenedor de características #property-features');
            return;
        }
    
        const newContainer = document.createElement('div');
        newContainer.id = 'property-features';
        newContainer.className = 'aditional_descrip_principal';
    
        const getAgeText = () => {
            switch(this.currentProperty.age_type) {
                case 'under_construction':
                    return 'En construcción';
                case 'new':
                    return 'Nuevo';
                case 'restored':
                    return 'Restaurado';
                default:
                    return this.currentProperty.age_years > 0 
                        ? `${this.currentProperty.age_years} año${this.currentProperty.age_years !== 1 ? 's' : ''}`
                        : 'Nuevo';
            }
        };
    
        const features = [
            {
                icon: 'area_white.png',
                value: parseFloat(this.currentProperty.built_area).toFixed(2),
                label: 'm² const.'
            },
            {
                icon: 'zona_white.png',
                value: parseFloat(this.currentProperty.total_area).toFixed(2),
                label: 'm² tot.'
            },
            {
                icon: 'bano_white.png',
                value: this.currentProperty.bathrooms,
                label: 'baño',
                plural: true
            },
            {
                icon: 'cama_white.png',
                value: this.currentProperty.bedrooms,
                label: 'rec.'
            },
            {
                icon: 'garaje_white.png',
                value: this.currentProperty.parking_spots,
                label: 'estac.'
            },
            {
                icon: 'calendario_white.png',
                value: getAgeText(),
                label: '',
                noSpaceBetweenValueAndLabel: true
            }
        ];
    
        features.forEach(feature => {
            const div = document.createElement('div');
            div.className = 'principal_descrip';
            
            const img = document.createElement('img');
            img.src = `/assets/img/${feature.icon}`;
            img.alt = '';
            
            const h4 = document.createElement('h4');
            if (feature.noSpaceBetweenValueAndLabel) {
                h4.textContent = `${feature.value}${feature.label}`;
            } else {
                const pluralSuffix = feature.plural && parseFloat(feature.value) !== 1 ? 's' : '';
                h4.textContent = `${feature.value} ${feature.label}${pluralSuffix}`;
            }
            
            div.appendChild(img);
            div.appendChild(h4);
            newContainer.appendChild(div);
        });
    
        if (this.currentProperty.half_bathrooms > 0) {
            const halfBathDiv = document.createElement('div');
            halfBathDiv.className = 'principal_descrip';
            
            const img = document.createElement('img');
            img.src = '/assets/img/medio_bano_white.png';
            img.alt = '';
            
            const h4 = document.createElement('h4');
            h4.textContent = `${this.currentProperty.half_bathrooms} medio baño${this.currentProperty.half_bathrooms !== 1 ? 's' : ''}`;
            
            halfBathDiv.appendChild(img);
            halfBathDiv.appendChild(h4);
            newContainer.appendChild(halfBathDiv);
        }
    
        container.parentElement.replaceChild(newContainer, container);
    }

    updateLocation() {
        const locationText = document.getElementById('property-location');
        if (!locationText) {
            console.error('No se encontró el elemento de ubicación #property-location');
            return;
        }
    
        const location = [
            this.currentProperty.colony_name,
            this.currentProperty.city_name,
            this.currentProperty.state_name
        ].filter(Boolean).join(', ');
        
        locationText.textContent = location;
    }

    updateAmenities() {
        const container = document.querySelector('.caracteristicas-container');
        if (!container || !this.currentProperty.amenities?.length) return;

        container.innerHTML = this.currentProperty.amenities.map(category => `
            <div class="seccion">
                <h3 class="seccion-titulo">
                    ${category.category}
                    <i class="fas fa-chevron-up"></i>
                </h3>
                <ul class="lista-caracteristicas">
                    ${category.amenities.map(amenity => {
                        const iconClass = this.amenityIcons[amenity.name] || 'fa-check';
                        return `
                            <li class="caracteristica-item">
                                <i class="fas ${iconClass}"></i>
                                ${amenity.name}
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `).join('');

        this.initializeAmenitiesAccordion();
    }

    updateContactInfo() {
        if (!this.currentProperty?.owner) {
            console.error('No se encontró información del propietario');
            return;
        }
    
        const owner = this.currentProperty.owner;
        
        const elements = {
            'agent_name': owner.name,
            'property_title': this.currentProperty.title,
            'company_name': owner.company?.name || owner.name
        };
    
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    
        // Modificar el manejo del número de teléfono
        const phoneElement = document.getElementById('agent_phone');
        if (phoneElement) {
            phoneElement.dataset.phone = owner.mobile || owner.phone || 'Sin teléfono disponible';
            phoneElement.textContent = '••• ••• ••••';
            phoneElement.style.display = 'none';
        }

        const logoElement = document.querySelector('.logo_ases img');
        if (logoElement) {
            logoElement.src = owner.company?.logo || '/assets/img/dorado.png';
            logoElement.alt = owner.company?.name || owner.name;
        }

        const messageField = document.querySelector('textarea#mensaje');
        if (messageField) {
            messageField.value = `¡Hola! Me interesa la propiedad "${this.currentProperty.title}" que vi en Master Broker.`;
        }

        const propertyIdInput = document.querySelector('input[name="property_id"]');
        if (propertyIdInput) {
            propertyIdInput.value = this.currentProperty.id;
        }
    }

    async handlePhoneReveal() {
        const form = document.getElementById('contactForm');
        const phoneElement = document.getElementById('agent_phone');
        
        if (!form || !phoneElement) return;
    
        // Validar el formulario
        const requiredFields = ['name', 'email', 'phone'];
        const formData = new FormData(form);
        
        for (const field of requiredFields) {
            if (!formData.get(field)?.trim()) {
                alert('Por favor, complete todos los campos requeridos para ver el número de teléfono.');
                return;
            }
        }
    
        try {
            // Crear lead
            const response = await fetch('/api/propiedades/add_lead.php', {
                method: 'POST',
                body: formData
            });
    
            const data = await response.json();
            
            if (data.status === 'success') {
                // Mostrar el número de teléfono
                phoneElement.textContent = phoneElement.dataset.phone;
                phoneElement.style.display = 'block';
                
                // Ocultar el botón
                const button = document.querySelector('.show-phone-btn');
                if (button) {
                    button.style.display = 'none';
                }
            } else {
                throw new Error(data.message || 'Error al procesar la solicitud');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al procesar la solicitud. Por favor, intente nuevamente.');
        }
    }

    async updateCarouselImages() {
        console.log('Iniciando actualización del carrusel');
        
        const mediaItems = [
            ...(this.currentProperty.images || []).map(image => ({
                type: 'image',
                src: image.file_path,
                alt: this.currentProperty.title,
                is_main: image.is_main,
                display_order: image.display_order
            })),
            ...(this.currentProperty.videos || []).map(video => ({
                type: 'video',
                youtubeId: video.youtube_id,
                title: this.currentProperty.title,
                display_order: video.display_order
            }))
        ].sort((a, b) => a.display_order - b.display_order);

        trackSup = document.querySelector('.carousel-track-sup');
        trackInf = document.querySelector('.carousel-track-inf');

        if (!trackSup || !trackInf || !mediaItems.length) return;

        // Cargar imágenes
        await Promise.all(
            mediaItems
                .filter(item => item.type === 'image')
                .map(image => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = resolve;
                        img.src = image.src;
                    });
                })
        );

        // Actualizar carrusel superior
        trackSup.innerHTML = mediaItems.map((item, index) => {
            if (item.type === 'image') {
                return `
                    <div class="cart_sup_prop" data-index="${index}">
                        <img src="${item.src}" alt="${item.alt}">
                    </div>
                `;
            } else {
                return `
                    <div class="cart_sup_prop video-item" data-index="${index}">
                        <img src="https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg" alt="Video: ${item.title}">
                        <div class="video-indicator">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Actualizar carrusel inferior
        trackInf.innerHTML = mediaItems.map((item, index) => {
            if (item.type === 'image') {
                return `
                    <div class="cart_infe_prop" data-index="${index}">
                        <img src="${item.src}" alt="${item.alt}">
                    </div>
                `;
            } else {
                return `
                    <div class="cart_infe_prop video-container" data-index="${index}">
                        <iframe
                            src="https://www.youtube.com/embed/${item.youtubeId}?rel=0&showinfo=0"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                        ></iframe>
                    </div>
                `;
            }
        }).join('');

        // Agregar eventos de clic a las imágenes del carrusel inferior
        const imageSlides = document.querySelectorAll('.cart_infe_prop:not(.video-container)');
        imageSlides.forEach((slide, index) => {
            slide.style.cursor = 'pointer';
            slide.addEventListener('click', () => {
                this.openModal(index);
            });
        });

        // Inicializar elementos del carrusel
        slidesSup = document.querySelectorAll('.cart_sup_prop');
        slidesInf = document.querySelectorAll('.cart_infe_prop');
        prevButton = document.querySelector('.button:first-child');
        nextButton = document.querySelector('.button:last-child');
        carouselSupContainer = document.querySelector('.caru_sup_prop');

        // Activar la primera miniatura
        if (slidesSup.length > 0) {
            slidesSup[0].classList.add('active');
        }
    }

    initializeCarousel() {
        this.setupResponsiveView();
        this.enableTouchNavigation();
        this.initializeCarouselEvents();
    }

    setupResponsiveView() {
        if (!slidesSup?.length || !slidesInf?.length) return;

        if (isSmallMobileView) {
            slidesInf.forEach(slide => {
                slide.style.flex = '0 0 calc(100% - 10px)';
                slide.style.width = 'calc(100% - 10px)';
                slide.style.height = '249px';
            });
            
            slidesSup.forEach(slide => {
                slide.style.minWidth = '67px';
                slide.style.width = '67px';
                slide.style.height = '41px';
            });
        } else if (isMobileView) {
            slidesInf.forEach(slide => {
                slide.style.flex = '0 0 calc(100% - 10px)';
                slide.style.width = 'calc(100% - 10px)';
                slide.style.height = '407px';
            });
            
            slidesSup.forEach(slide => {
                slide.style.minWidth = '';
                slide.style.width = '122px';
                slide.style.height = '74px';
            });
        } else {
            slidesInf.forEach(slide => {
                slide.style.flex = '0 0 calc(50% - 12px)';
                slide.style.width = '50%';
                slide.style.height = '407px';
            });
            
            slidesSup.forEach(slide => {
                slide.style.minWidth = '';
                slide.style.width = '122px';
                slide.style.height = '74px';
            });
        }

        this.updateCarouselPosition(currentIndex);
    }

    calculateSupOffset(index) {
        if (!carouselSupContainer || !slidesSup?.length) return 0;

        const containerWidth = carouselSupContainer.offsetWidth;
        const slideWidth = slidesSup[0].offsetWidth;
        const slideGap = 10;
        const totalSlideWidth = slideWidth + slideGap;
        
        const visibleSlides = Math.floor(containerWidth / totalSlideWidth);
        const trackWidth = slidesSup.length * totalSlideWidth;
        
        if (trackWidth <= containerWidth) return 0;

        if (isSmallMobileView) {
            const centerPosition = containerWidth / 2;
            const slideCenter = totalSlideWidth / 2;
            let offset = (index * totalSlideWidth) - (centerPosition - slideCenter);
            
            const maxOffset = trackWidth - containerWidth;
            offset = Math.max(0, Math.min(offset, maxOffset));
            return -offset;
        }

        const lastVisibleIndex = slidesSup.length - visibleSlides;
        let targetIndex = Math.min(Math.max(index, 0), lastVisibleIndex);
        return -targetIndex * totalSlideWidth;
    }

    updateCarousel(newIndex) {
        if (!slidesSup?.length) return;

        if (newIndex < 0) {
            newIndex = slidesSup.length - 1;
        } else if (newIndex >= slidesSup.length) {
            newIndex = 0;
        }

        currentIndex = newIndex;
        this.updateCarouselPosition(currentIndex);
    }

    updateCarouselPosition(index) {
        if (!slidesSup?.length || !trackSup || !trackInf) return;

        slidesSup.forEach(slide => slide.classList.remove('active'));
        slidesSup[index].classList.add('active');

        const offsetSup = this.calculateSupOffset(index);
        trackSup.style.transform = `translateX(${offsetSup}px)`;

        const gap = 20;
        const slideWidth = slidesInf[0].offsetWidth;
        const offsetInf = -index * (slideWidth + gap);
        trackInf.style.transform = `translateX(${offsetInf}px)`;

        this.pauseAllVideos();
    }

    pauseAllVideos() {
        document.querySelectorAll('.cart_infe_prop.video-container iframe').forEach(iframe => {
            const src = iframe.src;
            iframe.src = src;
        });
    }

    enableTouchNavigation() {
        if (!trackInf) return;

        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartTime = 0;

        const handleSwipe = () => {
            const touchEndTime = new Date().getTime();
            const touchDuration = touchEndTime - touchStartTime;
            const swipeDistance = touchEndX - touchStartX;
            
            const swipeThreshold = isSmallMobileView ? 30 : 50;
            
            if (touchDuration < 300 && Math.abs(swipeDistance) > swipeThreshold) {
                if (swipeDistance > 0) {
                    this.updateCarousel(currentIndex - 1);
                } else {
                    this.updateCarousel(currentIndex + 1);
                }
            }
        };

        trackInf.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            touchStartTime = new Date().getTime();
        });

        trackInf.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].clientX;
            handleSwipe();
        });
    }

    initializeCarouselEvents() {
        if (!slidesSup?.length || !prevButton || !nextButton) return;

        slidesSup[0].classList.add('active');

        slidesSup.forEach((slide, index) => {
            slide.addEventListener('click', () => {
                this.updateCarousel(index);
            });
        });

        prevButton.addEventListener('click', () => {
            this.updateCarousel(currentIndex - 1);
        });

        nextButton.addEventListener('click', () => {
            this.updateCarousel(currentIndex + 1);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.updateCarousel(currentIndex - 1);
            } else if (e.key === 'ArrowRight') {
                this.updateCarousel(currentIndex + 1);
            }
        });

        window.addEventListener('resize', () => {
            const wasSmallMobile = isSmallMobileView;
            const wasMobile = isMobileView;
            
            isSmallMobileView = window.innerWidth <= 767;
            isMobileView = window.innerWidth <= 1024;
            
            if (wasSmallMobile !== isSmallMobileView || wasMobile !== isMobileView) {
                this.setupResponsiveView();
            }
        });
    }

    initializeEventListeners() {
        this.initializeCopyLink();
        this.initializeVisibilityToggle();
        this.initializeFavoriteButton();
        this.initializeContactForm();
        this.initializeAmenitiesAccordion();
    }

    initializeAmenitiesAccordion() {
        document.querySelectorAll('.seccion-titulo').forEach(titulo => {
            titulo.addEventListener('click', () => {
                titulo.classList.toggle('collapsed');
                const lista = titulo.nextElementSibling;
                if (lista) {
                    lista.classList.toggle('collapsed');
                }
                
                const icon = titulo.querySelector('i');
                if (icon) {
                    icon.style.transform = titulo.classList.contains('collapsed') ? 'rotate(180deg)' : '';
                }
            });
        });
    }

    initializeCopyLink() {
        const copyButton = document.querySelector('.copy input');
        if (copyButton) {
            copyButton.addEventListener('change', async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    setTimeout(() => {
                        copyButton.checked = false;
                    }, 2000);
                } catch (err) {
                    console.error('Error al copiar enlace:', err);
                }
            });
        }
    }

    initializeVisibilityToggle() {
        const toggleButton = document.querySelector('.ojo input');
        const priceElement = document.querySelector('.precio_propiedad h2');
        const phoneElement = document.querySelector('.mirar_number_ases h3');
        const phoneButton = document.querySelector('.mirar_number_ases .show-phone-btn');
        
        if (phoneButton) {
            phoneButton.addEventListener('click', () => {
                this.openContactPhoneModal();
            });
        }

        if (toggleButton && (priceElement || phoneElement)) {
            toggleButton.addEventListener('change', () => {
                const isHidden = toggleButton.checked;
                if (priceElement) {
                    priceElement.style.visibility = isHidden ? 'hidden' : 'visible';
                }
                if (phoneElement) {
                    phoneElement.style.visibility = isHidden ? 'hidden' : 'visible';
                }
            });
        }
    }

    initializeFavoriteButton() {
        const favoriteButton = document.querySelector('.ui-bookmark input');
        if (favoriteButton && this.currentProperty) {
            favoriteButton.addEventListener('change', async () => {
                try {
                    const response = await fetch(`${this.apiUrl}?action=toggleFavorite`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            property_id: this.currentProperty.id,
                            is_favorite: favoriteButton.checked
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Error al actualizar favoritos');
                    }

                } catch (error) {
                    console.error('Error:', error);
                    favoriteButton.checked = !favoriteButton.checked;
                }
            });
        }
    }

    initializeContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) {
            console.error('No se encontró el formulario de contacto');
            return;
        }

        const propertyIdInput = form.querySelector('input[name="property_id"]');
        if (propertyIdInput) {
            propertyIdInput.value = this.currentProperty.id;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleContactSubmit('email');
        });

        const whatsappButton = form.querySelector('.button_whats_contac');
        if (whatsappButton) {
            whatsappButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleContactSubmit('whatsapp');
            });
        }
    }

    async handleContactSubmit(source) {
        const form = document.getElementById('contactForm');
        if (!form) return;
    
        try {
            const requiredFields = ['name', 'email', 'phone'];
            for (const field of requiredFields) {
                const input = form.querySelector(`[name="${field}"]`);
                if (!input || !input.value.trim()) {
                    throw new Error(`El campo ${field} es requerido`);
                }
            }
    
            const formData = new FormData(form);
            formData.append('source', source);
            formData.append('property_id', this.currentProperty.id);
    
            // Agregar mensaje específico según el tipo de contacto
            let title, description;
            switch(source) {
                case 'whatsapp':
                    title = 'Envió un mensaje a WhatsApp';
                    description = 'El usuario envió un mensaje a WhatsApp al agente';
                    break;
                case 'email':
                    title = 'Envió un correo a tu Email';
                    description = 'El usuario envió un correo electrónico';
                    break;
                default:
                    title = 'Contacto general';
                    description = 'El usuario realizó un contacto general';
            }
    
            formData.append('activity_title', title);
            formData.append('activity_description', description);
            formData.append('activity_type', 'first_contact');
    
            const response = await fetch('/api/propiedades/add_lead.php', {
                method: 'POST',
                body: formData
            });
    
            const data = await response.json();
            
            if (data.status === 'success') {
                if (source === 'whatsapp') {
                    const phone = this.currentProperty.owner.mobile || this.currentProperty.owner.phone;
                    if (!phone) {
                        throw new Error('No hay número de teléfono disponible para WhatsApp');
                    }
    
                    const messageField = document.getElementById('mensaje');
                    const message = messageField ? messageField.value : '';
    
                    const cleanPhone = phone.replace(/\D/g, '');
                    const countryCode = formData.get('country_code').replace('+', '');
                    const encodedMessage = encodeURIComponent(message);
                    
                    window.open(`https://wa.me/${countryCode}${cleanPhone}?text=${encodedMessage}`, '_blank');
                }
                
                alert('Mensaje enviado correctamente');
                form.reset();
    
                const messageField = document.getElementById('mensaje');
                if (messageField) {
                    messageField.value = `¡Hola! Me interesa la propiedad "${this.currentProperty.title}" que vi en Master Broker.`;
                }
    
            } else {
                throw new Error(data.message || 'Error al enviar el mensaje');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Error al enviar el mensaje');
        }
    }

    initializeMap() {
        if (!this.currentProperty?.latitude || !this.currentProperty?.longitude || !google) {
            console.log('Inicialización del mapa diferida - esperando datos o Google Maps');
            return;
        }

        const mapContainer = document.getElementById('property-map');
        if (!mapContainer) {
            console.error('No se encontró el contenedor del mapa');
            return;
        }

        const propertyLocation = {
            lat: parseFloat(this.currentProperty.latitude),
            lng: parseFloat(this.currentProperty.longitude)
        };

        const mapOptions = {
            center: propertyLocation,
            zoom: 15,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        this.map = new google.maps.Map(mapContainer, mapOptions);

        const customIcon = {
            url: '/assets/img/pin.png',
            scaledSize: new google.maps.Size(60, 60),
            anchor: new google.maps.Point(30, 60),
            origin: new google.maps.Point(0, 0)
        };

        this.marker = new google.maps.Marker({
            position: propertyLocation,
            map: this.map,
            icon: customIcon,
            title: this.currentProperty.title,
            animation: google.maps.Animation.DROP
        });

        window.addEventListener('resize', () => {
            google.maps.event.trigger(this.map, 'resize');
            this.map.setCenter(propertyLocation);
        });
        
        this.mapInitialized = true;
    }

    // Métodos del Modal
    openModal(index) {
        const imageSlides = document.querySelectorAll('.cart_infe_prop:not(.video-container)');
        if (index >= 0 && index < imageSlides.length) {
            const imgSrc = imageSlides[index].querySelector('img').src;
            this.modalImage.src = imgSrc;
            this.modal.style.display = 'flex';
            this.currentModalIndex = index;
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    navigateModal(direction) {
        const imageSlides = document.querySelectorAll('.cart_infe_prop:not(.video-container)');
        let newIndex = this.currentModalIndex;

        if (direction === 'prev') {
            newIndex = (newIndex - 1 + imageSlides.length) % imageSlides.length;
        } else {
            newIndex = (newIndex + 1) % imageSlides.length;
        }

        this.openModal(newIndex);
    }

    formatPrice(price) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            padding: 15px 25px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 280px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;

        // Establecer colores según el tipo
        switch(type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }

        notification.innerHTML = `
            <span>${message}</span>
            <button style="
                background: none;
                border: none;
                color: white;
                margin-left: 10px;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                line-height: 1;
            ">&times;</button>
        `;

        this.notificationContainer.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Configurar botón de cierre
        const closeButton = notification.querySelector('button');
        closeButton.addEventListener('click', () => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        });

        // Auto-cerrar después de 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 5000);
    }

    updateMapPosition(latitude, longitude) {
        if (!this.map || !this.marker) return;

        const newPosition = {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude)
        };

        this.map.setCenter(newPosition);
        this.marker.setPosition(newPosition);
    }
}

// Inicializar el manejador de propiedades cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.propertyHandler = new PropertyHandler();
});