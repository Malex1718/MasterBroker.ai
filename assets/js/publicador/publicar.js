// assets/js/publicador/publicar.js

class PublicarHandler {
    constructor() {
        // Obtener y validar el ID de la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.propertyId = urlParams.get('id');
        
        // Log para debugging
        console.log('ID de propiedad obtenido:', this.propertyId);
        
        // Validar que tenemos un ID
        if (!this.propertyId) {
            console.error('No se encontró el ID de la propiedad en la URL');
            showToast('Error: ID de propiedad no encontrado', 'error');
            return;
        }

        this.propertyData = {};
        this.userData = {};
         
        this.elements = {
            // Elementos de la tarjeta de propiedad
            operationType: document.querySelector('.tip_trans span'),
            propertyImage: document.querySelector('.tarjet_info_img img'),
            ownerImage: document.querySelector('.dueno img'),
            propertyTitle: document.querySelector('.tarjet_info_img + h3'),
            propertyDescription: document.querySelector('.tarjet_info_p'),
            bedrooms: document.querySelector('.info_min_sec img[src*="cama"] + p'),
            bathrooms: document.querySelector('.info_min_sec img[src*="bano"] + p'),
            propertyType: document.querySelector('.info_min_sec img[src*="casa"] + p'),
            price: document.querySelector('.info_pre_deta h3'),
            
            // Elementos de información de contacto
            companyLogo: document.querySelector('.logo_ases img'),
            companyName: document.querySelector('.datos_ases h4'),
            phoneNumber: document.querySelector('.mirar_number_ases h3'),
            
            // Botones de navegación
            backButton: document.querySelector('.botn_atras'),
            saveButton: document.querySelector('.boton_guardar'),
            continueButton: document.querySelector('.boton_continuar')
        };

        this.initialize();
    }

    async initialize() {
        try {
            showLoader();
            await this.loadPropertyData();
            await this.loadUserData();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error al inicializar:', error);
            showToast('Error al cargar los datos', 'error');
        } finally {
            hideLoader();
        }
    }

    async loadPropertyData() {
        try {
            const response = await fetch(`/api/propiedades/cargar_propiedad.php?id=${this.propertyId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar datos de la propiedad');
            }
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Error al cargar datos de la propiedad');
            }
            
            this.propertyData = data.property;
            this.updatePropertyPreview();
            
        } catch (error) {
            console.error('Error al cargar datos de la propiedad:', error);
            throw error;
        }
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/usuarios/datos_contacto.php');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar datos del usuario');
            }
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Error al cargar datos del usuario');
            }
            
            this.userData = data.user;
            this.updateContactInfo();
            
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            throw error;
        }
    }

    updatePropertyPreview() {
        // Actualizar tipo de operación
        if (this.propertyData.operation_type) {
            this.elements.operationType.textContent = this.propertyData.operation_type;
        }
        
        // Actualizar imagen principal si existe
        if (this.propertyData.main_image) {
            this.elements.propertyImage.src = this.propertyData.main_image;
            this.elements.propertyImage.alt = this.propertyData.title || '';
        }
        
        // Actualizar título y descripción
        if (this.propertyData.title) {
            this.elements.propertyTitle.textContent = this.propertyData.title;
        }
        if (this.propertyData.description) {
            this.elements.propertyDescription.textContent = 
                this.propertyData.description.substring(0, 100) + '...';
        }
        
        // Actualizar detalles
        if (this.propertyData.bedrooms !== undefined) {
            this.elements.bedrooms.textContent = this.propertyData.bedrooms;
        }
        if (this.propertyData.bathrooms !== undefined) {
            this.elements.bathrooms.textContent = 
                this.propertyData.bathrooms + (this.propertyData.half_bathrooms ? '.5' : '');
        }
        if (this.propertyData.property_type) {
            this.elements.propertyType.textContent = this.propertyData.property_type;
        }
        
        // Formatear y actualizar precio
        if (this.propertyData.price) {
            const formattedPrice = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(this.propertyData.price);
            
            this.elements.price.textContent = `${formattedPrice} MXN`;
        }
    }

    updateContactInfo() {
        // Actualizar logo si existe
        if (this.userData.company_logo) {
            this.elements.companyLogo.src = this.userData.company_logo;
            // Actualizar también la imagen del dueño con el logo de la empresa
            this.elements.ownerImage.src = this.userData.company_logo;
            this.elements.ownerImage.alt = this.userData.business_name || 'Logo empresa';
        }
        
        // Actualizar nombre de empresa o nombre del usuario
        this.elements.companyName.textContent = 
            this.userData.business_name || 
            `${this.userData.first_name} ${this.userData.last_name}`;
        
        // Actualizar teléfono
        this.elements.phoneNumber.textContent = 
            this.userData.mobile || 
            this.userData.phone || 
            'No disponible';
    }

    setupEventListeners() {
        if (this.elements.backButton) {
            this.elements.backButton.addEventListener('click', () => {
                window.location.href = `/dashboard/workspace/extras.html?id=${this.propertyId}`;
            });
        }

        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => {
                this.saveProperty('draft');
            });
        }

        if (this.elements.continueButton) {
            this.elements.continueButton.addEventListener('click', () => {
                this.saveProperty('published');
            });
        }
    }

    async saveProperty(status) {
        try {
            showLoader();
            
            // Convertir el ID a número entero y validar
            const propertyId = parseInt(this.propertyId);
            
            if (!propertyId || isNaN(propertyId)) {
                throw new Error('ID de propiedad no válido');
            }

            // Crear el objeto de datos
            const data = {
                property_id: propertyId,
                status: status
            };

            console.log('Enviando datos:', data);

            const response = await fetch('/api/propiedades/publicar_propiedad.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);

            // Intentar obtener el texto de la respuesta primero
            const responseText = await response.text();
            console.log('Response text:', responseText);

            let responseData;
            try {
                // Intentar parsear como JSON
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error('Error al parsear respuesta:', e);
                throw new Error('Error en la respuesta del servidor: ' + responseText.substring(0, 100));
            }

            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.message || 'Error en el servidor');
            }

            if (!responseData.success) {
                throw new Error(responseData.message || 'Error al guardar la propiedad');
            }

            // Mostrar mensaje de éxito
            showToast(responseData.message || 'Operación exitosa', 'success');

            // Redireccionar según el estado
            setTimeout(() => {
                window.location.href = status === 'published'
                    ? `/propiedad.html?id=${propertyId}`
                    : '/dashboard/publicaciones.html';
            }, 1500);

        } catch (error) {
            console.error('Error al guardar:', error);
            showToast(error.message || 'Error al guardar la propiedad', 'error');
        } finally {
            hideLoader();
        }
    }
}

// Funciones auxiliares para el loader y notificaciones
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
    // Por ahora, usamos console y alert
    if (type === 'error') {
        console.error(message);
    } else {
        console.log(message);
    }
    alert(message);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.publicarHandler = new PublicarHandler();
});