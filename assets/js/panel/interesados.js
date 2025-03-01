class LeadsManager {
    constructor() {
        this.leads = [];
        this.filters = {
            source: null,
            status: null,
            search: ''
        };
        this.modalInitialized = false;
        this.modal = null;
        this.SESSION_KEY = 'vibien_session';
    }

    async init() {
        try {
            console.log('Iniciando LeadsManager');
            
            // Obtener el contenedor
            const container = document.querySelector('.container_interesados');
            if (!container) {
                throw new Error('No se encontró el contenedor de interesados');
            }

            // Obtener datos de sesión
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            console.log('Datos de sesión encontrados:', sessionData);

            if (!sessionData) {
                throw new Error('No hay sesión almacenada');
            }

            try {
                const userSession = JSON.parse(sessionData);
                
                // Validar que tengamos los datos necesarios
                if (!userSession || !userSession.id) {
                    throw new Error('Datos de sesión incompletos');
                }

                // Guardar datos del usuario
                this.userId = userSession.id;
                this.userType = userSession.user_type;
                this.userEmail = userSession.email;
                this.userName = userSession.first_name;

                console.log('Usuario identificado:', {
                    userId: this.userId,
                    userType: this.userType,
                    userEmail: this.userEmail,
                    userName: this.userName
                });

                // Inicializar componentes
                this.initializeModal();
                this.initializeGlobalListeners();
                await this.getLeads();

                return true;
            } catch (parseError) {
                console.error('Error al parsear datos de sesión:', parseError);
                throw new Error('Error al procesar datos de sesión');
            }
        } catch (error) {
            console.error('Error en inicialización:', error);
            return false;
        }
    }

    initializeGlobalListeners() {
        console.log('Inicializando listeners globales');
        
        // Botones de filtro
        const filterButtons = document.querySelectorAll('.ver_por_buttons button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const source = this.getSourceFromButton(e.currentTarget);
                this.filters.source = source;
                this.getLeads();
            });
        });
        console.log(`Listeners de filtros inicializados: ${filterButtons.length} botones`);

        // Búsqueda
        const searchInput = document.querySelector('.buscar_publicacion input');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filters.search = searchInput.value;
                this.getLeads();
            }, 300));
            console.log('Listener de búsqueda inicializado');
        }

        // Ordenamiento
        const orderSelect = document.querySelector('.buscar_publicacion select');
        if (orderSelect) {
            orderSelect.addEventListener('change', () => {
                this.filters.order = orderSelect.value;
                this.getLeads();
            });
            console.log('Listener de ordenamiento inicializado');
        }
    }

    initializeModal() {
        // Primero intentamos obtener el modal existente
        let existingModal = document.querySelector('.modal_linea_tiempo');
        
        if (existingModal) {
            console.log('Usando modal existente en el DOM');
            this.modal = existingModal;
        } else {
            console.log('Creando modal dinámicamente');
            const modalHTML = `
                <div class="modal_linea_tiempo" style="display: none;">
                    <form id="activityForm">
                        <button type="button" id="cerrar_form_mesaje">x</button>
                        
                        <label for="activity_type">
                            Etapa:
                            <select name="activity_type" id="activity_type" required>
                                <option value="">Selecciona una etapa</option>
                                <option value="prospection">Prospección</option>
                                <option value="first_contact">Primer Contacto</option>
                                <option value="visit">Visita</option>
                                <option value="negotiation">Negociación</option>
                                <option value="documentation">Documentación</option>
                                <option value="closing">Cierre</option>
                            </select>
                        </label>

                        <label for="title">
                            Asunto:
                            <input type="text" id="title" name="title" required 
                                placeholder="Escribe un título descriptivo">
                        </label>

                        <label for="description">
                            Nota:
                            <textarea id="description" name="description" required
                                placeholder="Describe los detalles de la actividad"></textarea>
                        </label>

                        <label for="status">
                            Estado:
                            <select name="status" id="status" required>
                                <option value="">Selecciona un estado</option>
                                <option value="effective">Efectivo</option>
                                <option value="not_effective">No Efectivo</option>
                                <option value="in_progress">En Progreso</option>
                                <option value="pending">Pendiente</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </label>

                        <label for="scheduled_at">
                            Fecha programada:
                            <input type="datetime-local" id="scheduled_at" name="scheduled_at"
                                min="${new Date().toISOString().slice(0, 16)}">
                        </label>

                        <div class="acciones_form_mesaje">
                            <button type="button" id="cancelar" class="btn-secondary">Cancelar</button>
                            <button type="submit" id="guardar" class="btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            `;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHTML;
            this.modal = tempDiv.firstElementChild;
            document.body.appendChild(this.modal);
            console.log('Modal creado y añadido al DOM');
        }

        if (!this.modalInitialized) {
            this.initializeModalListeners();
            this.modalInitialized = true;
        }
    }

    initializeModal() {
        // Primero limpiamos cualquier modal existente y sus listeners
        if (this.modal) {
            const oldForm = this.modal.querySelector('form');
            if (oldForm) {
                // Eliminar todos los event listeners antiguos
                oldForm.replaceWith(oldForm.cloneNode(true));
            }
            this.modal.remove();
            this.modal = null;
            this.modalInitialized = false;
        }

        // Crear el nuevo modal
        console.log('Creando modal dinámicamente');
        const modalHTML = `
            <div class="modal_linea_tiempo" style="display: none;">
                <form id="activityForm">
                    <button type="button" id="cerrar_form_mesaje">x</button>
                    
                    <label for="activity_type">
                        Etapa:
                        <select name="activity_type" id="activity_type" required>
                            <option value="">Selecciona una etapa</option>
                            <option value="prospection">Prospección</option>
                            <option value="first_contact">Primer Contacto</option>
                            <option value="visit">Visita</option>
                            <option value="negotiation">Negociación</option>
                            <option value="documentation">Documentación</option>
                            <option value="closing">Cierre</option>
                        </select>
                    </label>

                    <label for="title">
                        Asunto:
                        <input type="text" id="title" name="title" required 
                            placeholder="Escribe un título descriptivo">
                    </label>

                    <label for="description">
                        Nota:
                        <textarea id="description" name="description" required
                            placeholder="Describe los detalles de la actividad"></textarea>
                    </label>

                    <label for="status">
                        Estado:
                        <select name="status" id="status" required>
                            <option value="">Selecciona un estado</option>
                            <option value="effective">Efectivo</option>
                            <option value="not_effective">No Efectivo</option>
                            <option value="in_progress">En Progreso</option>
                            <option value="pending">Pendiente</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                    </label>

                    <div class="acciones_form_mesaje">
                        <button type="button" id="cancelar" class="btn-secondary">Cancelar</button>
                        <button type="submit" id="guardar" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHTML;
        this.modal = tempDiv.firstElementChild;
        document.body.appendChild(this.modal);
        console.log('Modal creado y añadido al DOM');

        // Inicializar los listeners una sola vez
        this.initializeModalListeners();
        this.modalInitialized = true;
    }

    initializeModalListeners() {
        if (!this.modal) {
            console.error('Modal no encontrado en initializeModalListeners');
            return;
        }

        console.log('Inicializando listeners del modal');

        const closeModal = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.modal.style.display = 'none';
            const form = this.modal.querySelector('form');
            if (form) {
                form.reset();
                this.modal.dataset.leadId = '';
            }
        };

        const form = this.modal.querySelector('form');
        if (form) {
            const handleSubmit = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevenir múltiples envíos
                if (form.dataset.submitting === 'true') {
                    return;
                }
                
                const leadId = this.modal.dataset.leadId;
                if (!leadId) {
                    this.showNotification('Error: No se encontró el ID del lead', 'error');
                    return;
                }

                const submitButton = form.querySelector('#guardar');
                const cancelButton = form.querySelector('#cancelar');
                
                try {
                    form.dataset.submitting = 'true';
                    
                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.textContent = 'Guardando...';
                    }
                    if (cancelButton) cancelButton.disabled = true;

                    const success = await this.saveActivity(leadId, form);
                    if (success) {
                        closeModal();
                    }
                } finally {
                    form.dataset.submitting = 'false';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Guardar';
                    }
                    if (cancelButton) cancelButton.disabled = false;
                }
            };

            // Único listener para el submit del formulario
            form.addEventListener('submit', handleSubmit);

            // Prevenir envío con Enter en inputs que no sean textarea
            form.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                }
            });
        }

        // Botones para cerrar
        ['#cerrar_form_mesaje', '#cancelar'].forEach(selector => {
            const button = this.modal.querySelector(selector);
            if (button) {
                button.addEventListener('click', closeModal);
            }
        });

        // Cerrar al hacer clic fuera
        this.modal.addEventListener('click', e => {
            if (e.target === this.modal) {
                closeModal(e);
            }
        });

        // Prevenir cierre al hacer clic dentro del form
        if (form) {
            form.addEventListener('click', e => {
                e.stopPropagation();
            }); 
        }
    }

    async getLeads() {
        try {
            console.log('Obteniendo leads con filtros:', this.filters);
            const queryParams = new URLSearchParams(this.filters).toString();
            const response = await fetch(`/api/propiedades/get_leads.php?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos de la API:', data);
            
            if (data.status === 'success' && Array.isArray(data.data)) {
                this.leads = data.data;
                console.log(`Leads actualizados: ${this.leads.length} elementos`);
                this.renderLeads();
            } else {
                console.error('Formato de respuesta inválido:', data);
                this.leads = [];
                this.renderLeads();
            }
        } catch (error) {
            console.error('Error al obtener leads:', error);
            this.leads = [];
            this.renderLeads();
        }
    }

    renderLeads() {
        console.log('Iniciando renderizado de leads');
        const container = document.querySelector('.container_interesados');
        
        if (!container) {
            console.error('No se encontró el contenedor de interesados');
            return;
        }

        // Mantener los filtros
        const filtros = container.querySelector('.filtros_publicaciones');
        const filtrosHtml = filtros ? filtros.outerHTML : '';
        
        console.log('Estado actual de leads:', {
            leadsExist: !!this.leads,
            leadsLength: this.leads?.length,
            isArray: Array.isArray(this.leads)
        });

        // Verificar si hay leads
        if (!this.leads || this.leads.length === 0) {
            console.log('No hay leads para mostrar');
            container.innerHTML = `
                ${filtrosHtml}
                <div class="no-leads" style="text-align: center; padding: 20px;">
                    <p>No se encontraron leads</p>
                </div>
            `;
            return;
        }

        // Construir HTML para cada lead
        const leadsHtml = this.leads.map(lead => {
            console.log('Procesando lead:', lead.id);
            
            // Generar HTML para actividades
            const activitiesHtml = lead.activities && Array.isArray(lead.activities) 
                ? lead.activities.map(activity => `
                    <div class="nota_mensaje">
                        <div class="marcador_mesaje"></div>
                        <p>${this.formatDate(activity.created_at)}</p>
                        <h3>${this.escapeHtml(activity.title || '')}</h3>
                        <p>${this.getActivityTypeText(activity.activity_type)}</p>
                        <div class="nota_mensa_linea">
                            <h4>Nota:</h4>
                            <p>${this.escapeHtml(activity.description || '')}</p>
                        </div>
                        <div class="estado_nota_linea">
                            <p>${this.getActivityStatusText(activity.status)}</p>
                        </div>
                    </div>
                `).join('')
                : '';

            return `
                <div class="mensaje_contacto" data-lead-id="${lead.id}">
                    <div class="mensaje_header">
                        <div class="informacion_mensaje">
                            <div class="img_user_mensaje">
                                <img src="/assets/img/usuario.png?v=1.0.1" alt="Usuario">
                            </div>
                            <div class="nombre_mensaje">
                                <h4>${this.escapeHtml(lead.name)} ${lead.phone ? `(${this.escapeHtml(lead.phone)})` : ''}</h4>
                                <p class="property-info">${this.escapeHtml(lead.property_title)}</p>
                                <p class="lead-message">${this.escapeHtml(lead.message || '')}</p>
                                <p class="lead-email">${this.escapeHtml(lead.email || '')}</p>
                            </div>
                        </div>
                        <div class="acciones_informacion">
                            <div class="info_contacto">
                                <h4>Contacto por ${this.getContactPreferenceText(lead.contact_preference || 'email')}</h4>
                                <span class="status ${lead.status}">Estado: ${this.getStatusText(lead.status)}</span>
                                <p>Fecha: ${this.formatDate(lead.created_at)}</p>
                                ${lead.budget ? `<p>Presupuesto: ${this.formatCurrency(lead.budget)}</p>` : ''}
                                ${lead.urgency ? `<p>Urgencia: ${this.getUrgencyText(lead.urgency)}</p>` : ''}
                            </div>
                            <div class="acciones_botones">
                                <button class="btn-favorito" data-tooltip="Marcar/Desmarcar favorito">
                                    <img src="/assets/img/${lead.is_favorite ? 'favorito' : 'no_favorito'}.png" 
                                        alt="${lead.is_favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                                </button>
                                <button class="btn-nota" data-tooltip="Añadir nota">
                                    <img src="/assets/img/notas.png" alt="Añadir nota">
                                </button>
                                <button class="btn-whatsapp" data-tooltip="Contactar por WhatsApp">
                                    <img src="/assets/img/whatsapp.png" alt="Contactar por WhatsApp">
                                </button>
                                <button class="btn-borrar" data-tooltip="Eliminar lead">
                                    <img src="/assets/img/basura.png" alt="Eliminar">
                                </button>
                                <button class="btn-desplegar" data-tooltip="Ver detalles">
                                    <img src="/assets/img/angulo-hacia-abajo.png" alt="Desplegar">
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="mensaje_body" style="display: none;">
                        <div class="linea_tiempo">
                            ${activitiesHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Actualizar el contenedor
        container.innerHTML = `${filtrosHtml}${leadsHtml}`;

        // Inicializar listeners
        this.leads.forEach(lead => {
            const leadElement = container.querySelector(`[data-lead-id="${lead.id}"]`);
            if (leadElement) {
                this.initializeLeadListeners(leadElement);
            }
        });

        console.log('Renderizado completado');
    }

    initializeLeadListeners(leadElement) {
        if (!leadElement) return;

        const header = leadElement.querySelector('.mensaje_header');
        const body = leadElement.querySelector('.mensaje_body');
        const btnDesplegar = leadElement.querySelector('.btn-desplegar');
        const leadId = leadElement.dataset.leadId;

        // Toggle mensaje
        const toggleMessage = (e) => {
            e?.stopPropagation();
            const isVisible = body.style.display !== 'none';
            body.style.display = isVisible ? 'none' : 'block';
            const icon = btnDesplegar.querySelector('img');
            if (icon) {
                icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                icon.style.transition = 'transform 0.3s ease';
            }
        };

        if (header && body && btnDesplegar) {
            header.addEventListener('click', (e) => {
                if (!e.target.closest('button')) toggleMessage(e);
            });
            btnDesplegar.addEventListener('click', toggleMessage);
        }

        // Botones de acción
        const btnNota = leadElement.querySelector('.btn-nota');
        if (btnNota) {
            btnNota.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showActivityModal(leadId);
            });
        }

        // Resto de los botones
        const actions = {
            '.btn-favorito': () => this.toggleFavorite(leadId),
            '.btn-borrar': () => this.deleteLead(leadId),
            '.btn-whatsapp': () => {
                const phone = leadElement.querySelector('.nombre_mensaje h4')?.textContent.match(/\(([^)]+)\)/)?.[1];
                this.openWhatsApp(phone);
            }
        };

        Object.entries(actions).forEach(([selector, action]) => {
            const button = leadElement.querySelector(selector);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    action();
                });
            }
        });
    }

    showActivityModal(leadId) {
        if (!this.modal) {
            console.error('Modal no encontrado, intentando reinicializar');
            this.initializeModal();
            
            if (!this.modal) {
                console.error('No se pudo inicializar el modal');
                return;
            }
        }
        
        console.log('Mostrando modal para lead:', leadId);
        
        // Asegurarse de que el modal esté en el DOM
        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
        }
        
        // Limpiar estilos anteriores
        this.modal.removeAttribute('style');
        
        // Aplicar estilos base
        this.modal.style.cssText = `
            display: flex !important;
            position: fixed !important;
            justify-content: center !important;
            align-items: center !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background-color: rgba(0, 0, 0, 0.5) !important;
            z-index: 9999 !important;
        `;
        
        this.modal.dataset.leadId = leadId;

        // Asegurarse de que el formulario esté limpio y visible
        const form = this.modal.querySelector('form');
        if (form) {
            form.reset();
            form.style.display = 'flex';
            form.style.flexDirection = 'column';
            form.style.gap = '15px';
            
            // Asegurarse de que los botones sean visibles
            const buttons = form.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.display = 'inline-block';
            });
        }

        // Enfocar el primer input después de un breve delay
        setTimeout(() => {
            const firstInput = this.modal.querySelector('select, input, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);

        // Debug
        console.log('Estado del modal:', {
            visible: this.modal.style.display,
            zIndex: this.modal.style.zIndex,
            inDOM: document.body.contains(this.modal),
            form: form?.style.display
        });
    }

    async saveActivity(leadId, form) {
        try {
            console.log('Guardando actividad para lead:', leadId);
            
            // Obtener la sesión usando la clave correcta
            const userSession = JSON.parse(localStorage.getItem(this.SESSION_KEY));
            
            if (!userSession || !userSession.id) {
                this.showNotification('Error: Usuario no identificado. Por favor, vuelve a iniciar sesión.', 'error');
                return false;
            }
    
            const formData = new FormData(form);
            const activityData = {
                action: 'add_activity',
                lead_id: parseInt(leadId),
                user_id: parseInt(userSession.id),
                activity_type: formData.get('activity_type'),
                title: formData.get('title').trim(),
                description: formData.get('description').trim(),
                status: formData.get('status'),
                scheduled_at: new Date().toISOString() // Siempre usar la fecha actual
            };
    
            console.log('Datos de actividad a guardar:', activityData);
    
            const response = await fetch('/api/propiedades/get_leads.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activityData)
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error en la respuesta del servidor: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.getLeads();
                this.showNotification('Actividad guardada exitosamente', 'success');
                return true;
            } else {
                throw new Error(data.message || 'Error desconocido al guardar la actividad');
            }
        } catch (error) {
            console.error('Error al guardar actividad:', error);
            this.showNotification('Error: ' + error.message, 'error');
            return false;
        }
    }
    
    showNotification(message, type = 'success') {
        // Implementar según tu sistema de notificaciones
        alert(message);
    }

async toggleFavorite(leadId) {
    try {
        // Agregar validación del leadId
        if (!leadId) {
            console.error('ID de lead no válido');
            return;
        }

        // Agregar headers y mejorar el manejo de la respuesta
        const response = await fetch('/api/propiedades/get_leads.php', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                action: 'toggle_favorite',
                lead_id: parseInt(leadId)
            })
        });

        // Verificar si la respuesta es OK
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'success') {
            await this.getLeads();
            this.showNotification('Estado de favorito actualizado exitosamente', 'success');
        } else {
            throw new Error(data.message || 'Error al cambiar el estado de favorito');
        }
    } catch (error) {
        console.error('Error al cambiar favorito:', error);
        this.showNotification(
            'Error al cambiar el estado de favorito. ' + error.message, 
            'error'
        );
    }
}

    async deleteLead(leadId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este lead?')) return;

        try {
            const response = await fetch('/api/propiedades/get_leads.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_lead',
                    lead_id: leadId
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                await this.getLeads();
            } else {
                console.error('Error al eliminar lead:', data);
                alert('Error al eliminar el lead. Por favor, intente nuevamente.');
            }
        } catch (error) {
            console.error('Error al eliminar lead:', error);
            alert('Error al eliminar el lead. Por favor, intente nuevamente.');
        }
    }

    openWhatsApp(phone) {
        if (!phone) {
            alert('No hay número de teléfono disponible');
            return;
        }
        const formattedPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${formattedPhone}`, '_blank');
    }

    getSourceFromButton(button) {
        const text = button.textContent.toLowerCase();
        if (text.includes('whatsapp')) return 'whatsapp';
        if (text.includes('email')) return 'email';
        if (text.includes('teléfono')) return 'phone';
        return null;
    }

    getActivityTypeText(type) {
        const types = {
            'call': 'Llamada',
            'meeting': 'Reunión',
            'note': 'Nota',
            'email': 'Correo',
            'visit': 'Visita',
            'prospection': 'Prospección',
            'first_contact': 'Primer Contacto',
            'negotiation': 'Negociación',
            'documentation': 'Documentación',
            'closing': 'Cierre'
        };
        return types[type] || type;
    }

    getActivityStatusText(status) {
        const statuses = {
            'completed': 'Completado',
            'pending': 'Pendiente',
            'cancelled': 'Cancelado',
            'effective': 'Efectivo',
            'not_effective': 'No Efectivo',
            'in_progress': 'En Proceso'
        };
        return statuses[status] || status;
    }

    getSourceText(source) {
        const sources = {
            'whatsapp': 'WhatsApp',
            'email': 'Email',
            'phone': 'Teléfono',
            'web': 'Email',
            'social': 'Redes Sociales'
        };
        return sources[source] || source;
    }

    getContactPreferenceText(preference) {
        const preferences = {
            'email': 'Email',
            'phone': 'Teléfono',
            'whatsapp': 'WhatsApp'
        };
        return preferences[preference] || preference;
    }

    getStatusText(status) {
        const statuses = {
            'new': 'Nuevo',
            'contacted': 'Contactado',
            'interested': 'Interesado',
            'not_interested': 'No Interesado',
            'negotiating': 'En Negociación',
            'closed_won': 'Cerrado Ganado',
            'closed_lost': 'Cerrado Perdido'
        };
        return statuses[status] || status;
    }

    getUrgencyText(urgency) {
        const urgencies = {
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        };
        return urgencies[urgency] || urgency;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return 'Fecha no disponible';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('Error al formatear fecha:', error);
            return dateString;
        }
    }

    escapeHtml(unsafe) {
        if (unsafe == null) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}

// Manejador de errores global
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error:', {
        message: msg,
        url: url,
        line: lineNo,
        column: columnNo,
        error: error
    });
    return false;
};

// Variable para controlar la inicialización
let leadManagerInitialized = false;

// Función de inicialización segura
async function initializeLeadManager() {
    if (leadManagerInitialized) {
        console.log('LeadManager ya está inicializado');
        return;
    }

    console.log('Verificando prerequisitos para inicialización...');
    
    const container = document.querySelector('.container_interesados');
    if (!container) {
        console.error('No se encontró el contenedor .container_interesados');
        return;
    }

    try {
        console.log('Iniciando LeadsManager...');
        window.leadsManager = new LeadsManager();
        const initialized = await window.leadsManager.init();
        
        if (initialized) {
            leadManagerInitialized = true;
            console.log('LeadsManager inicializado exitosamente');
        } else {
            throw new Error('Fallo en la inicialización');
        }
    } catch (error) {
        console.error('Error al inicializar LeadsManager:', error);
        leadManagerInitialized = false;
    }
}

// Función para reintentar la inicialización
async function retryInitialization(maxRetries = 3, delay = 1000) {
    let retries = 0;

    async function attempt() {
        if (leadManagerInitialized) return;
        
        if (retries >= maxRetries) {
            console.error(`Fallaron ${maxRetries} intentos de inicialización`);
            return;
        }

        console.log(`Intento de inicialización ${retries + 1}/${maxRetries}`);
        await initializeLeadManager();

        if (!leadManagerInitialized) {
            retries++;
            setTimeout(attempt, delay);
        }
    }

    await attempt();
}

// Inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM cargado, iniciando LeadsManager');
        retryInitialization();
    });
} else {
    console.log('DOM ya cargado, iniciando LeadsManager inmediatamente');
    retryInitialization();
}

// Reintentar en caso de fallos
window.addEventListener('load', () => {
    if (!leadManagerInitialized) {
        console.log('Reintentando inicialización después de carga completa');
        retryInitialization();
    }
});

// Exponer funciones de debug
window.debugLeadsManager = {
    reInitialize: () => {
        leadManagerInitialized = false;
        retryInitialization();
    },
    checkStatus: () => {
        console.log({
            initialized: leadManagerInitialized,
            instance: window.leadsManager,
            container: document.querySelector('.container_interesados'),
            leads: window.leadsManager?.leads
        });
    }
};
