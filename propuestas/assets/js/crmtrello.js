// kanban.js
class LeadManager {
    constructor() {
        this.leads = [];
        this.draggedItem = null;
        this.API_ENDPOINT = '/api/crm/leads/lead_manager.php';
        this.SESSION_KEY = 'vibien_session';  // Added session key constant
        this.userId = null;
        this.userType = null;
        this.userEmail = null;
        this.userName = null;

        // Mapeo de estados y configuración
        this.states = {
            nuevo: 'Nuevos Leads',
            contacto: 'En Contacto',
            visita: 'Visita Programada',
            negociacion: 'En Negociación',
            cerrado: 'Cerrados',
            posventa: 'Posventa'
        };

        // Configuración de actividades
        this.activityTypes = {
            llamada: {
                states: ['Contactado', 'No contesta', 'No interesado', 'Interesado'],
                default: 'Contactado',
                fields: [
                    {
                        id: 'callResult',
                        label: 'Resultado de llamada',
                        type: 'select',
                        options: [
                            { value: 'contestó', label: 'Contestó' },
                            { value: 'no contestó', label: 'No contestó' },
                            { value: 'buzón', label: 'Buzón de voz' },
                            { value: 'equivocado', label: 'Número equivocado' }
                        ]
                    }
                ]
            },
            visita: {
                states: ['Visita programada', 'Visita realizada', 'En negociación', 'No interesado'],
                default: 'Visita programada',
                fields: [
                    {
                        id: 'visitTime',
                        label: 'Hora de visita',
                        type: 'time'
                    },
                    {
                        id: 'visitDuration',
                        label: 'Duración (minutos)',
                        type: 'number',
                        min: 15,
                        step: 15,
                        default: 30
                    }
                ]
            },
            email: {
                states: ['Contactado', 'En espera de respuesta', 'No interesado', 'Interesado'],
                default: 'Contactado',
                fields: [
                    {
                        id: 'emailSubject',
                        label: 'Asunto',
                        type: 'text'
                    }
                ]
            },
            mensaje: {
                states: ['Contactado', 'En espera de respuesta', 'No responde', 'Interesado', 'No interesado'],
                default: 'Contactado',
                fields: [
                    {
                        id: 'messageChannel',
                        label: 'Canal de mensaje',
                        type: 'select',
                        options: [
                            { value: 'whatsapp', label: 'WhatsApp' },
                            { value: 'sms', label: 'SMS' },
                            { value: 'telegram', label: 'Telegram' },
                            { value: 'messenger', label: 'Messenger' }
                        ]
                    },
                    {
                        id: 'messageStatus',
                        label: 'Estado del mensaje',
                        type: 'select',
                        options: [
                            { value: 'enviado', label: 'Enviado' },
                            { value: 'entregado', label: 'Entregado' },
                            { value: 'leído', label: 'Leído' },
                            { value: 'respondido', label: 'Respondido' },
                            { value: 'no entregado', label: 'No entregado' }
                        ]
                    }
                ]
            },
            nota: {
                states: [],
                default: '',
                fields: []
            }
        };

        this.init();
    }

    async init() {
        try {
            console.log('Iniciando LeadManager');
            
            // Verify session before proceeding
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            console.log('Datos de sesión encontrados:', sessionData);

            if (!sessionData) {
                throw new Error('No hay sesión almacenada');
            }

            try {
                const userSession = JSON.parse(sessionData);
                
                // Validate required session data
                if (!userSession || !userSession.id) {
                    throw new Error('Datos de sesión incompletos');
                }

                // Store user data
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

                // Continue with initialization
                await this.loadLeads();
                this.initializeBoard();
                this.initializeEventListeners();
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

    async loadLeads() {
        try {
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            if (!sessionData) {
                throw new Error('No hay sesión activa');
            }

            const userSession = JSON.parse(sessionData);
            if (!userSession || !userSession.id) {
                throw new Error('Sesión inválida');
            }

            const response = await fetch(this.API_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userSession.id,
                    'X-Session-Token': userSession.token || ''
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Sesión expirada o inválida');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.leads = Array.isArray(data.data) ? data.data : [];
                return true;
            }
            console.error('Error cargando leads:', data.message);
            return false;
        } catch (error) {
            console.error('Error en la petición:', error);
            this.leads = [];
            return false;
        }
    }

    checkSession() {
        const sessionData = localStorage.getItem(this.SESSION_KEY);
        if (!sessionData) {
            throw new Error('No hay sesión activa');
        }

        const userSession = JSON.parse(sessionData);
        if (!userSession || !userSession.id) {
            throw new Error('Sesión inválida');
        }

        return userSession;
    }

    initializeBoard() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        board.innerHTML = '';

        if (!Array.isArray(this.leads)) {
            this.leads = [];
        }

        Object.entries(this.states).forEach(([state, title]) => {
            const leads = this.leads.filter(lead => 
                lead && lead.status && lead.status.toLowerCase() === state
            );
            const column = this.createColumn(state, title, leads);
            board.appendChild(column);
        });
    }

    createColumn(id, title, items) {
        const div = document.createElement('div');
        div.className = 'kanban-column';
        div.dataset.id = id;

        div.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-bold text-lg">${title}</h2>
                <span class="bg-gray-200 px-2 py-1 rounded-full text-sm">
                    ${items.length}
                </span>
            </div>
            <div class="column-content min-h-[500px]"></div>
        `;

        const content = div.querySelector('.column-content');
        items.forEach(item => {
            content.appendChild(this.createLeadCard(item));
        });

        div.addEventListener('dragover', this.handleDragOver.bind(this));
        div.addEventListener('dragleave', this.handleDragLeave.bind(this));
        div.addEventListener('drop', (e) => this.handleDrop(e, div));

        return div;
    }

    createLeadCard(lead) {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.draggable = true;
        card.dataset.id = lead.id;

        card.innerHTML = `
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span class="font-medium">${lead.name}</span>
                </div>
                <div class="text-sm text-gray-600">
                    <div class="flex items-center gap-2 mb-1">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        ${lead.phone}
                    </div>
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        ${lead.property_title || 'Sin propiedad'}
                    </div>
                </div>
                <div class="flex flex-col gap-2 mt-2">
                    <div class="flex items-center">
                        <span class="status-badge">${lead.status}</span>
                    </div>
                    <button onclick="leadManager.showUpdateModal('${lead.id}')" 
                            class="text-white text-sm flex items-center gap-1 w-full justify-center py-2 rounded-lg mb-color-principal mb-color-principal:hover">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        Actualizar Lead
                    </button>
                    <div class="text-xs text-gray-500 text-center mt-2 pt-2 border-t">
                        Última actualización: ${this.formatDateTime(lead.updated_at || lead.created_at)}
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('dragstart', this.handleDragStart.bind(this));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));

        return card;
    }

    // Handlers para drag and drop
    handleDragStart(e) {
        this.draggedItem = e.target;
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedItem = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    async handleDrop(e, column) {
        e.preventDefault();
        column.classList.remove('drag-over');

        if (!this.draggedItem) return;

        const leadId = this.draggedItem.dataset.id;
        const newStatus = column.dataset.id;

        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: leadId,
                    status: newStatus
                })
            });

            const result = await response.json();

            if (result.success) {
                await this.loadLeads();
                this.initializeBoard();
            } else {
                console.error('Error actualizando estado:', result.message);
            }
        } catch (error) {
            console.error('Error en la actualización:', error);
        }
    }

    // Agregar este método a la clase LeadManager, justo después del loadLeads()
    async loadProperties() {
        try {
            const sessionData = this.checkSession();
            
            const response = await fetch(`${this.API_ENDPOINT}?action=properties`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': sessionData.id,
                    'X-Session-Token': sessionData.token || ''
                }
            });
    
            if (!response.ok) {
                throw new Error('Error al cargar propiedades');
            }
    
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error cargando propiedades:', error);
            return [];
        }
    }    

    // Actualizar el método showNewLeadModal
    async showNewLeadModal() {
        const modal = document.getElementById('newLeadModal');
        if (modal) {
            try {
                const propertySelect = document.getElementById('newLeadProperty');
                if (propertySelect) {
                    propertySelect.innerHTML = `
                        <option value="">Seleccione una propiedad</option>
                        <option value="manual">Ingresar manualmente</option>
                    `;
    
                    // Cargar las propiedades
                    const properties = await this.loadProperties();
                    if (Array.isArray(properties) && properties.length > 0) {
                        const propertyOptions = properties.map(prop => 
                            `<option value="${prop.id}">${prop.title || ''} ${prop.code ? `(${prop.code})` : ''}</option>`
                        ).join('');
                        
                        propertySelect.innerHTML = `
                            <option value="">Seleccione una propiedad</option>
                            <option value="manual">Ingresar manualmente</option>
                            ${propertyOptions}
                        `;
                    }
                }
                modal.style.display = 'flex';
            } catch (error) {
                console.error('Error al mostrar modal:', error);
                this.showNotification('Error al cargar las propiedades', 'error');
            }
        }
    }

    handlePropertySelectChange() {
        const select = document.getElementById('newLeadProperty');
        const manualInputContainer = document.getElementById('manualPropertyContainer');
        
        if (select.value === 'manual') {
            manualInputContainer.style.display = 'block';
        } else {
            manualInputContainer.style.display = 'none';
        }
    }

    closeNewLeadModal() {
        const modal = document.getElementById('newLeadModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('newLeadForm')?.reset();
        }
    }

    showUpdateModal(leadId) {
        const lead = this.leads.find(l => l.id === leadId);
        if (!lead) return;

        const modal = document.getElementById('leadUpdateModal');
        if (!modal) return;

        document.getElementById('updateLeadId').value = leadId;
        document.getElementById('leadInfoName').textContent = lead.name;
        document.getElementById('leadInfoProperty').textContent = lead.property_title || 'Sin propiedad';
        document.getElementById('leadInfoStatus').textContent = lead.status;
        
        document.getElementById('updateDateTime').value = new Date().toISOString().slice(0, 16);
        
        this.updateRecentHistory(lead);
        modal.style.display = 'flex';
    }

    closeUpdateModal() {
        const modal = document.getElementById('leadUpdateModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('leadUpdateForm')?.reset();
            document.getElementById('additionalFields').innerHTML = '';
        }
    }

    // Métodos auxiliares
    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateStatusByActivity(activityType) {
        const statusSelect = document.getElementById('updateStatus');
        const config = this.activityTypes[activityType];
        const leadId = document.getElementById('updateLeadId').value;
        const lead = this.leads.find(l => l.id === leadId);
        
        statusSelect.innerHTML = `<option value="">Mantener estado actual (${lead?.status || 'Sin estado'})</option>`;
        
        if (config && config.states.length > 0) {
            config.states.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                if (state === config.default) {
                    option.selected = true;
                }
                statusSelect.appendChild(option);
            });
        }
    }

    generateActivityFields(activityType) {
        const config = this.activityTypes[activityType];
        const container = document.getElementById('additionalFields');
        
        if (!container || !config || !config.fields.length) {
            if (container) container.innerHTML = '';
            return;
        }

        container.innerHTML = config.fields.map(field => {
            switch (field.type) {
                // Continuación de generateActivityFields
                case 'select':
                    return `
                        <div class="mb-3">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <select id="${field.id}" class="w-full p-2 border rounded" required>
                                ${field.options.map(opt => 
                                    `<option value="${opt.value}">${opt.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                    `;
                case 'time':
                    return `
                        <div class="mb-3">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <input type="time" id="${field.id}" class="w-full p-2 border rounded" required>
                        </div>
                    `;
                case 'number':
                    return `
                        <div class="mb-3">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <input type="number" id="${field.id}" 
                                   class="w-full p-2 border rounded" 
                                   min="${field.min || 0}" 
                                   step="${field.step || 1}" 
                                   value="${field.default || ''}"
                                   required>
                        </div>
                    `;
                default:
                    return `
                        <div class="mb-3">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <input type="text" id="${field.id}" class="w-full p-2 border rounded" required>
                        </div>
                    `;
            }
        }).join('');
}

collectActivityData(activityType) {
const config = this.activityTypes[activityType];
if (!config || !config.fields.length) return '';

const fieldData = config.fields
.map(field => {
    const element = document.getElementById(field.id);
    if (element) {
        return `${field.label}: ${element.value}`;
    }
    return null;
})
.filter(Boolean);

return fieldData.length ? ` (${fieldData.join(' | ')})` : '';
}

updateRecentHistory(lead) {
const container = document.getElementById('recentHistory');
if (!container) return;

const activities = lead.activities || [];
const updates = lead.updates || [];

const allHistory = [
...activities.map(a => ({
    ...a,
    isActivity: true,
    sortDate: new Date(a.date)
})),
...updates.map(u => ({
    ...u,
    isActivity: false,
    sortDate: new Date(u.date)
}))
].sort((a, b) => b.sortDate - a.sortDate)
.slice(0, 5);

container.innerHTML = allHistory.map(item => `
<div class="activity-item">
    <div class="flex items-center gap-2 mb-1">
        <span class="${item.isActivity ? this.getActivityTypeStyle(item.type) : 'bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs'}">
            ${item.isActivity ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Actualización'}
        </span>
        <span class="text-sm text-gray-600">${this.formatDateTime(item.date)}</span>
    </div>
    <p class="text-sm">${item.description}</p>
</div>
`).join('');
}

getActivityTypeStyle(type) {
const styles = {
llamada: 'type-llamada',
visita: 'type-visita',
email: 'type-email',
mensaje: 'type-mensaje',
nota: 'type-nota'
};
return `activity-type ${styles[type] || 'type-nota'}`;
}

// Modificar el método handleNewLead dentro de la clase LeadManager
async handleNewLead(e) {
    e.preventDefault();

    try {
        const sessionData = this.checkSession();
        const form = e.target;
        
        const propertySelectValue = form.querySelector('#newLeadProperty').value;
        const manualPropertyTitle = form.querySelector('#manualPropertyTitle');
        const manualPropertyDetails = form.querySelector('#manualPropertyDetails');
        
        // Preparar los datos según el tipo de selección de propiedad
        const propertyData = propertySelectValue === 'manual' ? {
            property_id: null,
            property_title: manualPropertyTitle?.value?.trim() || null,
            property_description: manualPropertyDetails?.value?.trim() || null
        } : propertySelectValue ? {
            property_id: parseInt(propertySelectValue),
            property_title: null,
            property_description: null
        } : {
            property_id: null,
            property_title: null,
            property_description: null
        };

        // Crear el objeto de datos completo
        const data = {
            name: form.querySelector('#newLeadName').value.trim(),
            email: form.querySelector('#newLeadEmail').value.trim(),
            phone: form.querySelector('#newLeadPhone').value.trim(),
            message: form.querySelector('#newLeadNotes')?.value?.trim() || null,
            status: 'nuevo',
            contact_preference: 'email', // Valor por defecto según la tabla
            country_code: '+52',  // Valor por defecto según la tabla
            source: 'web',  // Valor por defecto según la tabla
            priority: 'media', // Valor por defecto según la tabla
            urgency: 'medium', // Valor por defecto según la tabla
            assigned_to: sessionData.id,
            ...propertyData
        };

        const response = await fetch(this.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': sessionData.id,
                'X-Session-Token': sessionData.token || ''
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al crear el lead');
        }

        const result = await response.json();

        if (result.success) {
            await this.loadLeads();
            this.initializeBoard();
            this.closeNewLeadModal();
            this.showNotification('Lead creado exitosamente', 'success');
        } else {
            throw new Error(result.message || 'Error al crear el lead');
        }
    } catch (error) {
        console.error('Error al crear lead:', error);
        this.showNotification(error.message || 'Error al crear el lead', 'error');
    }
}

async handleLeadUpdate(e) {
    e.preventDefault();

    const leadId = document.getElementById('updateLeadId').value;
    const activityType = document.getElementById('updateType').value;
    const updateDateTime = document.getElementById('updateDateTime').value;
    const propertyDescription = document.getElementById('updateDescription').value; // Cambiado el nombre de la variable
    const newStatus = document.getElementById('updateStatus').value;

    const updateData = {
        id: leadId,
        activity_type: activityType !== 'none' ? activityType : null,
        property_description: propertyDescription, // Cambiado a property_description
        status: newStatus || null,
        activity_date: updateDateTime,
        activity_data: activityType !== 'none' ? this.collectActivityData(activityType) : null
    };

    try {
        const response = await fetch(this.API_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
            await this.loadLeads();
            this.initializeBoard();
            this.closeUpdateModal();
            this.showNotification('Lead actualizado exitosamente', 'success');
        } else {
            this.showNotification(result.message || 'Error al actualizar el lead', 'error');
        }
    } catch (error) {
        console.error('Error al actualizar lead:', error);
        this.showNotification('Error al actualizar el lead', 'error');
    }
}

showNotification(message, type = 'info') {
// Implementar según el sistema de notificaciones que uses
alert(message);
}

initializeEventListeners() {
// Formulario de nuevo lead
const newLeadForm = document.getElementById('newLeadForm');
if (newLeadForm) {
newLeadForm.addEventListener('submit', this.handleNewLead.bind(this));
}

// Formulario de actualización
const updateForm = document.getElementById('leadUpdateForm');
if (updateForm) {
updateForm.addEventListener('submit', this.handleLeadUpdate.bind(this));
}

// Tipo de actividad
const activityTypeSelect = document.getElementById('updateType');
if (activityTypeSelect) {
activityTypeSelect.addEventListener('change', (e) => {
    const activityType = e.target.value;
    if (activityType !== 'none') {
        this.updateStatusByActivity(activityType);
        this.generateActivityFields(activityType);
    } else {
        document.getElementById('additionalFields').innerHTML = '';
    }
});
}

// Click fuera de modales
window.addEventListener('click', (e) => {
const updateModal = document.getElementById('leadUpdateModal');
const newLeadModal = document.getElementById('newLeadModal');

if (e.target === updateModal) {
    this.closeUpdateModal();
}
if (e.target === newLeadModal) {
    this.closeNewLeadModal();
}
});

// Inicializar eventos táctiles para móvil
this.initializeTouchEvents();
}

initializeTouchEvents() {
document.addEventListener('touchstart', (e) => {
if (e.target.closest('.lead-card')) {
    e.preventDefault();
    this.handleDragStart({ target: e.target.closest('.lead-card') });
}
}, { passive: false });

document.addEventListener('touchmove', (e) => {
if (this.draggedItem) {
    e.preventDefault();
    const touch = e.touches[0];
    const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    const column = elementAtTouch?.closest('.kanban-column');
    
    if (column) {
        this.handleDragOver.call(column, e);
    }
}
}, { passive: false });

document.addEventListener('touchend', (e) => {
if (this.draggedItem) {
    const touch = e.changedTouches[0];
    const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    const column = elementAtTouch?.closest('.kanban-column');
    
    if (column) {
        this.handleDrop(e, column);
    }
    
    this.handleDragEnd(e);
}
});
}
}

function showNewLeadModal() {
    if (window.leadManager) {
        window.leadManager.showNewLeadModal();
    }
}

function closeNewLeadModal() {
    if (window.leadManager) {
        window.leadManager.closeNewLeadModal();
    }
}

function closeLeadUpdateModal() {
    if (window.leadManager) {
        window.leadManager.closeUpdateModal();
    }
}

function handleNewLead(event) {
    if (window.leadManager) {
        return window.leadManager.handleNewLead(event);
    }
    event.preventDefault();
    console.error('LeadManager no está inicializado');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.leadManager = new LeadManager();

    // Exponer funciones del modal al objeto window
    window.showNewLeadModal = showNewLeadModal;
    window.closeNewLeadModal = closeNewLeadModal;
    window.closeLeadUpdateModal = closeLeadUpdateModal;
});