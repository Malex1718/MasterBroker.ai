// Configuración inicial y constantes
const DAYS_CONFIG = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
};

const SLOT_TYPES = {
    available: { label: 'Disponible', color: 'bg-green-100 text-green-800' },
    break: { label: 'Descanso', color: 'bg-blue-100 text-blue-800' },
    lunch: { label: 'Comida', color: 'bg-orange-100 text-orange-800' },
    meeting: { label: 'Reunión', color: 'bg-purple-100 text-purple-800' },
    other: { label: 'Otro', color: 'bg-gray-100 text-gray-800' }
};

// Funciones para controlar el modal de sincronización
const syncModal = {
    element: null,
    progressBar: null,
    title: null,
    message: null,
    button: null,
    completeIcon: null,
    stats: null,
    
    // Inicializar referencias
    init() {
        this.element = document.getElementById('syncModal');
        this.progressBar = document.getElementById('syncProgressBar');
        this.title = document.getElementById('syncModalTitle');
        this.message = document.getElementById('syncModalMessage');
        this.button = document.getElementById('syncModalBtn');
        this.completeIcon = document.getElementById('syncCompleteIcon');
        this.stats = document.getElementById('syncStats');
        
        // Configurar manejadores de eventos
        this.button.addEventListener('click', () => {
            // Si está en estado de éxito, cerrar
            if (this.button.textContent === 'Aceptar') {
                this.hide();
            } 
            // Si está en estado de error, reintentar
            else if (this.button.textContent === 'Reintentar') {
                this.hide();
                saveSchedule(); // Volver a intentar sincronización
            }
        });
    },
    
    // Mostrar el modal en modo sincronización
    show() {
        // Resetear estado
        this.progressBar.style.width = '0%';
        this.title.textContent = 'Sincronizando con Google Calendar';
        this.message.textContent = 'Por favor espera mientras actualizamos tu calendario...';
        this.button.textContent = 'Espera por favor...';
        this.button.disabled = true;
        this.button.classList.add('opacity-50', 'cursor-not-allowed');
        this.completeIcon.classList.add('hidden');
        this.stats.classList.add('hidden');
        
        // Mostrar animación de carga
        this.element.querySelector('.animate-spin').classList.remove('hidden');
        
        // Mostrar modal
        this.element.classList.remove('hidden');
    },
    
    // Actualizar progreso
    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
        
        if (percent >= 100) {
            this.progressBar.classList.remove('bg-blue-600');
            this.progressBar.classList.add('bg-green-600');
        }
    },
    
    // Mostrar éxito
    showSuccess(stats = {}) {
        // Cambiar apariencia
        this.progressBar.style.width = '100%';
        this.progressBar.classList.remove('bg-blue-600');
        this.progressBar.classList.add('bg-green-600');
        
        // Ocultar spinner y mostrar ícono de éxito
        this.element.querySelector('.animate-spin').classList.add('hidden');
        this.completeIcon.classList.remove('hidden');
        
        // Actualizar texto
        this.title.textContent = '¡Sincronización completada!';
        this.message.textContent = 'Tu horario se ha sincronizado correctamente con Google Calendar.';
        
        // Actualizar estadísticas si están disponibles
        if (stats) {
            if (document.getElementById('syncUpdatedCount')) {
                document.getElementById('syncUpdatedCount').textContent = stats.updatedEvents || 0;
            }
            if (document.getElementById('syncCreatedCount')) {
                document.getElementById('syncCreatedCount').textContent = stats.createdEvents || 0;
            }
            if (document.getElementById('syncDeletedCount')) {
                document.getElementById('syncDeletedCount').textContent = stats.deletedEvents || 0;
            }
            this.stats.classList.remove('hidden');
        }
        
        // Habilitar botón de cerrar
        this.button.textContent = 'Aceptar';
        this.button.disabled = false;
        this.button.classList.remove('opacity-50', 'cursor-not-allowed');
        this.button.classList.add('bg-green-600');
    },
    
    // Mostrar error
    showError(errorMessage) {
        // Cambiar apariencia a error
        this.progressBar.classList.remove('bg-blue-600');
        this.progressBar.classList.add('bg-red-600');
        
        // Actualizar texto
        this.title.textContent = 'Error de sincronización';
        this.message.textContent = errorMessage || 'Ocurrió un error al sincronizar con Google Calendar.';
        
        // Habilitar botón de reintentar
        this.button.textContent = 'Reintentar';
        this.button.disabled = false;
        this.button.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-blue-600');
        this.button.classList.add('bg-red-600');
    },
    
    // Ocultar modal
    hide() {
        this.element.classList.add('hidden');
        
        // Resetear estado
        setTimeout(() => {
            this.progressBar.style.width = '0%';
            this.progressBar.classList.remove('bg-green-600', 'bg-red-600');
            this.progressBar.classList.add('bg-blue-600');
            this.button.classList.remove('bg-green-600', 'bg-red-600');
            this.button.classList.add('bg-blue-600');
        }, 300);
    }
};

// Estado global
let schedule = {
    weeklySchedule: {},
    isDraft: false
};

// Inicializar el estado
Object.keys(DAYS_CONFIG).forEach(day => {
    schedule.weeklySchedule[day] = {
        isActive: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day),
        slots: day === 'saturday' || day === 'sunday' ? [] : [
            { start: '09:00', end: '17:00', type: 'available', description: '' }
        ]
    };
});

// Funciones de utilidad
function calculateDailyHours(slots) {
    return slots.reduce((total, slot) => {
        if (slot.type === 'available') {
            const start = new Date(`2000-01-01T${slot.start}`);
            const end = new Date(`2000-01-01T${slot.end}`);
            return total + (end - start) / (1000 * 60 * 60);
        }
        return total;
    }, 0);
}

function validateTimeSlots(slots) {
    const errors = [];
    
    if (slots.length > 5) {
        errors.push('Máximo 5 intervalos por día');
    }

    slots.forEach((slot, index) => {
        const start = new Date(`2000-01-01T${slot.start}`);
        const end = new Date(`2000-01-01T${slot.end}`);

        if (end <= start) {
            errors.push(`Intervalo ${index + 1}: La hora de fin debe ser mayor que la de inicio`);
        }

        slots.forEach((otherSlot, otherIndex) => {
            if (index !== otherIndex) {
                const otherStart = new Date(`2000-01-01T${otherSlot.start}`);
                const otherEnd = new Date(`2000-01-01T${otherSlot.end}`);

                if (
                    (start >= otherStart && start < otherEnd) ||
                    (end > otherStart && end <= otherEnd) ||
                    (start <= otherStart && end >= otherEnd)
                ) {
                    errors.push(`Intervalo ${index + 1} se solapa con el intervalo ${otherIndex + 1}`);
                }
            }
        });
    });

    return errors;
}

// Funciones de manipulación del DOM
function createSlotElement(dayId, slotData = { start: '09:00', end: '17:00', type: 'available', description: '' }) {
    const template = document.getElementById('slotTemplate');
    const slot = template.content.cloneNode(true);
    
    const container = slot.querySelector('div');
    const startInput = slot.querySelector('.slot-start');
    const endInput = slot.querySelector('.slot-end');
    const typeSelect = slot.querySelector('.slot-type');
    const descInput = slot.querySelector('.slot-description');
    const deleteBtn = slot.querySelector('.delete-slot');

    startInput.value = slotData.start;
    endInput.value = slotData.end;
    typeSelect.value = slotData.type;
    descInput.value = slotData.description;

    // Event listeners
    startInput.addEventListener('change', () => updateSlot(dayId, container));
    endInput.addEventListener('change', () => updateSlot(dayId, container));
    typeSelect.addEventListener('change', () => updateSlot(dayId, container));
    descInput.addEventListener('input', () => updateSlot(dayId, container));
    deleteBtn.addEventListener('click', () => {
        container.remove();
        updateDay(dayId);
    });

    return container;
}

function createDayElement(dayId) {
    const template = document.getElementById('dayTemplate');
    const day = template.content.cloneNode(true);
    
    const container = day.querySelector('.day-container');
    container.id = `day-${dayId}`;
    
    const checkbox = day.querySelector('.day-active');
    const nameSpan = day.querySelector('.day-name');
    const slotsContainer = day.querySelector('.slots-container');
    const addButton = day.querySelector('.add-slot');

    // Configuración inicial
    nameSpan.textContent = DAYS_CONFIG[dayId];
    checkbox.checked = schedule.weeklySchedule[dayId].isActive;

    // Mostrar el contenedor de slots si el día está activo
    if (schedule.weeklySchedule[dayId].isActive) {
        slotsContainer.style.display = 'block';
        
        // Agregar slots existentes
        schedule.weeklySchedule[dayId].slots.forEach(slotData => {
            const slotElement = createSlotElement(dayId, slotData);
            slotsContainer.insertBefore(slotElement, addButton);
        });
    }

    // Event listeners
    checkbox.addEventListener('change', () => toggleDay(dayId));
    addButton.addEventListener('click', () => addSlot(dayId));

    return container;
}

async function updateSlot(dayId, slotElement) {
    const startInput = slotElement.querySelector('.slot-start');
    const endInput = slotElement.querySelector('.slot-end');
    const typeSelect = slotElement.querySelector('.slot-type');
    const descInput = slotElement.querySelector('.slot-description');

    if (!startInput || !endInput || !typeSelect) {
        console.error('No se encontraron los elementos necesarios para actualizar el slot');
        return;
    }

    const slotData = {
        start: startInput.value,
        end: endInput.value,
        type: typeSelect.value,
        description: descInput.value || ''
    };

    // Validar el rango de tiempo
    const start = new Date(`2000-01-01T${slotData.start}`);
    const end = new Date(`2000-01-01T${slotData.end}`);
    
    if (end <= start) {
        startInput.classList.add('border-red-500');
        endInput.classList.add('border-red-500');
        return;
    } else {
        startInput.classList.remove('border-red-500');
        endInput.classList.remove('border-red-500');
    }

    // Actualizar la visualización de tipo de slot
    const typeIndicator = slotElement.querySelector('.slot-type-indicator');
    if (typeIndicator) {
        // Eliminar clases anteriores
        Object.values(SLOT_TYPES).forEach(typeConfig => {
            const colorClass = typeConfig.color.split(' ')[0]; // Obtener solo la clase de color de fondo
            typeIndicator.classList.remove(colorClass);
        });
        
        // Agregar nueva clase de color
        const newColorClass = SLOT_TYPES[slotData.type].color.split(' ')[0];
        typeIndicator.classList.add(newColorClass);
    }

    // Actualizar el estado
    const slotIndex = Array.from(slotElement.parentNode.children)
        .filter(child => !child.classList.contains('add-slot'))
        .indexOf(slotElement);
        
    if (slotIndex === -1) {
        console.error('No se pudo determinar el índice del slot');
        return;
    }
    
    schedule.weeklySchedule[dayId].slots[slotIndex] = slotData;

    // Actualizar el día completo
    updateDay(dayId);
    
    // Obtener IDs necesarios para la sincronización
    const slotId = slotElement.dataset.slotId || null;
    let scheduleId = null;
    
    try {
        // Buscar el schedule_id correspondiente a este día
        const schedulesResponse = await fetch('/api/crm/calendario/get_schedule_id.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ day: dayId })
        });
        
        const schedulesData = await schedulesResponse.json();
        if (schedulesData.success && schedulesData.schedule_id) {
            scheduleId = schedulesData.schedule_id;
        }
    } catch (error) {
        console.error('Error al obtener schedule_id:', error);
    }
    
    // Si está habilitada la sincronización con Google y tenemos los IDs necesarios
    if (document.getElementById('syncWithGoogleEnabled')?.checked && scheduleId && slotId) {
        try {
            // Mostrar indicador de sincronización
            const syncIndicator = slotElement.querySelector('.sync-status');
            if (syncIndicator) {
                syncIndicator.innerHTML = '<span class="animate-pulse text-blue-500">Sincronizando...</span>';
            }
            
            await syncSpecificEvent(scheduleId, slotId, slotData);
            
            // Actualizar indicador de sincronización
            if (syncIndicator) {
                syncIndicator.innerHTML = '<span class="text-green-500">Sincronizado</span>';
                setTimeout(() => {
                    syncIndicator.innerHTML = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Error al sincronizar con Google Calendar:', error);
            
            // Mostrar error de sincronización
            const syncIndicator = slotElement.querySelector('.sync-status');
            if (syncIndicator) {
                syncIndicator.innerHTML = '<span class="text-red-500">Error de sincronización</span>';
                setTimeout(() => {
                    syncIndicator.innerHTML = '';
                }, 5000);
            }
            
            // Opcional: mostrar notificación de error
            if (typeof showWarning === 'function') {
                showWarning('No se pudo sincronizar este horario con Google Calendar. Los cambios se guardarán localmente.');
            }
        }
    }
    
    // Habilitar el botón de guardar si hay cambios
    const saveButton = document.getElementById('saveSchedule');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.classList.remove('opacity-50');
    }
    
    // Marcar como borrador
    schedule.isDraft = true;
    document.getElementById('draftNotice')?.classList.remove('hidden');
}

// Función auxiliar para sincronizar un evento específico
async function syncSpecificEvent(scheduleId, slotId, slotData = null) {
    const response = await fetch('/api/crm/calendario/sync_specific_event.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            schedule_id: scheduleId,
            slot_id: slotId,
            slot_data: slotData // Opcional: enviar datos del slot para evitar una consulta adicional
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Error desconocido durante la sincronización');
    }
    
    return result;
}

async function syncSpecificEvent(scheduleId, slotId) {
    const response = await fetch('/api/crm/calendario/sync_specific_event.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            schedule_id: scheduleId,
            slot_id: slotId
        })
    });
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error);
    }
    
    return result;
}

function updateDay(dayId) {
    const dayElement = document.getElementById(`day-${dayId}`);
    const slotsContainer = dayElement.querySelector('.slots-container');
    const hoursSpan = dayElement.querySelector('.day-hours');
    const errorsDiv = dayElement.querySelector('.errors');

    // Actualizar slots en el estado
    schedule.weeklySchedule[dayId].slots = Array.from(
        slotsContainer.querySelectorAll('.slot-start')
    ).map((startInput, index) => ({
        start: startInput.value,
        end: slotsContainer.querySelectorAll('.slot-end')[index].value,
        type: slotsContainer.querySelectorAll('.slot-type')[index].value,
        description: slotsContainer.querySelectorAll('.slot-description')[index].value
    }));

    // Actualizar horas totales
    const totalHours = calculateDailyHours(schedule.weeklySchedule[dayId].slots);
    hoursSpan.textContent = totalHours > 0 ? `(${totalHours.toFixed(1)}h)` : '';

    // Validar y mostrar errores
    const errors = validateTimeSlots(schedule.weeklySchedule[dayId].slots);
    errorsDiv.innerHTML = errors.map(error => `<div class="flex items-center gap-2">
        <i data-lucide="alert-circle" class="w-4 h-4"></i>
        <span>${error}</span>
    </div>`).join('');
    lucide.createIcons();

    updatePreview();
}

// Funciones de toggle y añadir slots
function toggleDay(dayId) {
    const dayElement = document.getElementById(`day-${dayId}`);
    const checkbox = dayElement.querySelector('.day-active');
    const slotsContainer = dayElement.querySelector('.slots-container');

    schedule.weeklySchedule[dayId].isActive = checkbox.checked;
    slotsContainer.style.display = checkbox.checked ? 'block' : 'none';

    if (checkbox.checked && schedule.weeklySchedule[dayId].slots.length === 0) {
        schedule.weeklySchedule[dayId].slots = [
            { start: '09:00', end: '17:00', type: 'available', description: '' }
        ];
        const newSlot = createSlotElement(dayId, schedule.weeklySchedule[dayId].slots[0]);
        slotsContainer.insertBefore(newSlot, slotsContainer.querySelector('.add-slot'));
    }

    updateDay(dayId);
}

function addSlot(dayId) {
    const dayElement = document.getElementById(`day-${dayId}`);
    const slotsContainer = dayElement.querySelector('.slots-container');
    const addButton = slotsContainer.querySelector('.add-slot');

    if (schedule.weeklySchedule[dayId].slots.length >= 5) {
        showError('Máximo 5 intervalos por día');
        return;
    }

    const newSlot = createSlotElement(dayId);
    slotsContainer.insertBefore(newSlot, addButton);
    updateDay(dayId);
}

// Funciones de vista previa
function updatePreview() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    // Limpiar el contenido actual
    previewContent.innerHTML = '';
    
    // Contenedor de días
    const daysContainer = document.createElement('div');
    daysContainer.className = 'flex gap-4 overflow-x-auto';
    
    // Crear columna para cada día
    Object.entries(DAYS_CONFIG).forEach(([dayId, dayName]) => {
        const dayConfig = schedule.weeklySchedule[dayId];
        const totalHours = calculateDailyHours(dayConfig.slots);
        
        // Contenedor del día
        const dayColumn = document.createElement('div');
        dayColumn.className = 'flex-1 min-w-[140px]';
        
        // Header del día
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center border-b pb-2 mb-2';
        
        // Nombre del día
        const dayTitle = document.createElement('div');
        dayTitle.className = 'font-medium';
        dayTitle.textContent = dayName;
        
        dayHeader.appendChild(dayTitle);
        
        // Información de horas si el día está activo
        if (dayConfig.isActive) {
            const hoursInfo = document.createElement('div');
            hoursInfo.className = 'text-sm text-gray-600';
            hoursInfo.textContent = `${totalHours.toFixed(1)}h disponibles`;
            dayHeader.appendChild(hoursInfo);
        }
        
        dayColumn.appendChild(dayHeader);
        
        // Contenido del día
        if (dayConfig.isActive) {
            const slotsContainer = document.createElement('div');
            slotsContainer.className = 'space-y-1';
            
            // Crear slots
            dayConfig.slots.forEach(slot => {
                const slotElement = document.createElement('div');
                slotElement.className = `my-1 p-1 rounded ${SLOT_TYPES[slot.type].color}`;
                
                const timeRange = document.createElement('div');
                timeRange.className = 'font-medium text-xs';
                timeRange.textContent = `${slot.start} - ${slot.end}`;
                slotElement.appendChild(timeRange);
                
                if (slot.description) {
                    const description = document.createElement('div');
                    description.className = 'text-xs opacity-75';
                    description.textContent = slot.description;
                    slotElement.appendChild(description);
                }
                
                slotsContainer.appendChild(slotElement);
            });
            
            dayColumn.appendChild(slotsContainer);
        } else {
            const unavailable = document.createElement('div');
            unavailable.className = 'text-center text-sm text-gray-500';
            unavailable.textContent = 'No disponible';
            dayColumn.appendChild(unavailable);
        }
        
        daysContainer.appendChild(dayColumn);
    });
    
    previewContent.appendChild(daysContainer);
}

// Funciones de copiar horarios
function copySchedule() {
    const fromDay = document.getElementById('copyFrom').value;
    const toDay = document.getElementById('copyTo').value;

    if (!fromDay || !toDay) {
        showError('Selecciona los días de origen y destino');
        return;
    }

    if (fromDay === toDay) {
        showError('Selecciona días diferentes');
        return;
    }

    // Hacer una copia profunda de los slots del día origen
    const sourceSlots = JSON.parse(JSON.stringify(schedule.weeklySchedule[fromDay].slots));
    
    const dayElement = document.getElementById(`day-${toDay}`);
    const slotsContainer = dayElement.querySelector('.slots-container');
    
    // 1. Activar el día
    const checkbox = dayElement.querySelector('.day-active');
    checkbox.checked = true;
    slotsContainer.style.display = 'block';

    // 2. Limpiar el estado
    schedule.weeklySchedule[toDay] = {
        isActive: true,
        slots: sourceSlots
    };
    
    // 3. Limpiar completamente los slots existentes
    const existingSlots = slotsContainer.querySelectorAll('.flex.items-center:not(.add-slot)');
    existingSlots.forEach(slot => slot.remove());
    
    // 4. Agregar los nuevos slots
    const addButton = slotsContainer.querySelector('.add-slot');
    sourceSlots.forEach(slotData => {
        const newSlot = createSlotElement(toDay, slotData);
        slotsContainer.insertBefore(newSlot, addButton);
    });
    
    // 5. Actualizar vista y mostrar mensaje
    updateDay(toDay);
    showSuccess('Horario copiado correctamente');

    // 6. Limpiar selectores
    document.getElementById('copyFrom').value = '';
    document.getElementById('copyTo').value = '';
}

// Aplicar horario laboral predeterminado
function applyWorkweekSchedule() {
    const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const defaultSchedule = {
        isActive: true,
        slots: [
            { start: '10:00', end: '13:00', type: 'available', description: 'Mañana' },
            { start: '13:00', end: '14:00', type: 'lunch', description: 'Almuerzo' },
            { start: '14:00', end: '19:00', type: 'available', description: 'Tarde' }
        ]
    };

    workDays.forEach(day => {
        schedule.weeklySchedule[day] = JSON.parse(JSON.stringify(defaultSchedule));
        
        const dayElement = document.getElementById(`day-${day}`);
        const checkbox = dayElement.querySelector('.day-active');
        checkbox.checked = true;
        
        const slotsContainer = dayElement.querySelector('.slots-container');
        slotsContainer.style.display = 'block';
        
        // Limpiar slots existentes
        const slots = slotsContainer.querySelectorAll('.flex.items-center');
        slots.forEach(slot => slot.remove());
        
        // Agregar nuevos slots
        defaultSchedule.slots.forEach(slotData => {
            slotsContainer.insertBefore(
                createSlotElement(day, slotData),
                slotsContainer.querySelector('.add-slot')
            );
        });
        
        updateDay(day);
    });

    showSuccess('Horario laboral aplicado correctamente');
}

// Funciones de guardado
function saveDraft() {
    schedule.isDraft = true;
    localStorage.setItem('scheduleConfig', JSON.stringify(schedule));
    document.getElementById('draftNotice').style.display = 'block';
    showSuccess('Borrador guardado correctamente');
}

let isSynchronizing = false;

async function saveSchedule() {
    // Evitar múltiples solicitudes simultáneas
    if (isSynchronizing) {
        showWarning('Ya hay una sincronización en curso. Por favor espera...');
        return;
    }

    // Validar todos los días
    let hasErrors = false;
    Object.entries(schedule.weeklySchedule).forEach(([dayId, config]) => {
        if (config.isActive) {
            const errors = validateTimeSlots(config.slots);
            if (errors.length > 0) {
                hasErrors = true;
                const dayElement = document.getElementById(`day-${dayId}`);
                const errorsDiv = dayElement.querySelector('.errors');
                errorsDiv.innerHTML = errors.map(error => `
                    <div class="flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                        <span>${error}</span>
                    </div>
                `).join('');
                lucide.createIcons();
            }
        }
    });

    if (hasErrors) {
        showError('Corrige los errores antes de guardar');
        return;
    }

    // Establecer estado de sincronización
    isSynchronizing = true;

    // Inicializar y mostrar el modal de sincronización
    syncModal.init();
    syncModal.show();
    
    try {
        // Actualizar progreso
        syncModal.updateProgress(20);
        
        // Guardar el horario
        const saveResponse = await fetch('/api/crm/calendario/save_schedule.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(schedule)
        });

        if (!saveResponse.ok) {
            throw new Error(`Error HTTP ${saveResponse.status} al guardar horario`);
        }

        const saveData = await saveResponse.json();
        syncModal.updateProgress(50);

        if (!saveData.success) {
            throw new Error(saveData.error || 'Error al guardar horario');
        }

        // Verificar si la sincronización con Google está habilitada
        const googleSyncEnabled = document.getElementById('syncWithGoogleEnabled')?.checked;

        if (googleSyncEnabled) {
            // Verificar la conexión con Google antes de sincronizar
            syncModal.message.textContent = 'Verificando conexión con Google Calendar...';
            const googleStatusResponse = await fetch('/api/auth/google_status.php');
            
            if (!googleStatusResponse.ok) {
                throw new Error('No se pudo verificar el estado de la conexión con Google');
            }
            
            const googleStatus = await googleStatusResponse.json();
            
            if (!googleStatus.success || !googleStatus.connected) {
                throw new Error('No hay una cuenta de Google conectada. Por favor, conecta tu cuenta primero.');
            }
            
            if (!googleStatus.token_valid) {
                // Intentar renovar el token
                syncModal.message.textContent = 'Renovando credenciales de Google...';
                const renewResponse = await fetch('/api/auth/google_refresh.php', {
                    method: 'POST'
                });
                
                if (!renewResponse.ok || !(await renewResponse.json()).success) {
                    throw new Error('Tu sesión con Google ha expirado. Necesitas volver a conectar tu cuenta.');
                }
            }

            // Proceder con la sincronización
            syncModal.updateProgress(70);
            syncModal.message.textContent = 'Sincronizando eventos con Google Calendar...';
            
            const syncResponse = await fetch('/api/crm/calendario/sync_calendar.php');
            
            if (!syncResponse.ok) {
                throw new Error(`Error HTTP ${syncResponse.status} al sincronizar`);
            }
            
            const syncData = await syncResponse.json();
            syncModal.updateProgress(95);
            
            if (syncData.success) {
                // Limpiar el estado local
                schedule.isDraft = false;
                localStorage.removeItem('scheduleConfig');
                document.getElementById('draftNotice').style.display = 'none';
                
                // Actualizar modal con éxito y estadísticas
                setTimeout(() => {
                    syncModal.showSuccess({
                        updatedEvents: (syncData.stats?.active_slots || 0) - (syncData.stats?.created_events || 0),
                        createdEvents: syncData.stats?.created_events || 0,
                        deletedEvents: syncData.stats?.removed_events || 0
                    });
                }, 500);
            } else {
                throw new Error(syncData.error || 'Error de sincronización');
            }
        } else {
            // No hay sincronización con Google, pero el guardado local fue exitoso
            schedule.isDraft = false;
            localStorage.removeItem('scheduleConfig');
            document.getElementById('draftNotice').style.display = 'none';
            
            syncModal.updateProgress(100);
            setTimeout(() => {
                syncModal.showSuccess({
                    updatedEvents: 0,
                    createdEvents: 0,
                    deletedEvents: 0
                });
                syncModal.message.textContent = 'Horario guardado correctamente. La sincronización con Google Calendar está desactivada.';
            }, 500);
        }
    } catch (error) {
        console.error('Error:', error);
        
        if (error.message.includes('Google') || error.message.includes('sincronizar')) {
            // Error relacionado con Google - guardado local exitoso
            schedule.isDraft = false;
            localStorage.removeItem('scheduleConfig');
            document.getElementById('draftNotice').style.display = 'none';
            
            syncModal.showError(
                'Tu horario se guardó correctamente, pero hubo un problema al sincronizar con Google Calendar: ' +
                error.message
            );
        } else {
            // Error al guardar
            syncModal.showError('Error al guardar el horario: ' + error.message);
        }
    } finally {
        // Restablecer el estado de sincronización cuando termine
        isSynchronizing = false;
        
        // Actualizar la interfaz 
        updatePreview();
        document.querySelectorAll('.day-container').forEach(container => {
            const dayId = container.id.replace('day-', '');
            updateDay(dayId);
        });
        
        // Deshabilitar botón de guardar si no hay cambios pendientes
        if (!schedule.isDraft) {
            const saveButton = document.getElementById('saveSchedule');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.classList.add('opacity-50');
            }
        }
    }
}

// Función para verificar el estado de conexión de Google antes de sincronizar
async function checkGoogleConnectionBeforeSync() {
    try {
        const response = await fetch('/api/auth/google_status.php');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('No se pudo verificar el estado de la conexión');
        }
        
        if (!data.connected) {
            showError('No hay una cuenta de Google conectada. Por favor, conecta tu cuenta primero.');
            return false;
        }
        
        if (!data.token_valid) {
            const renewResponse = await fetch('/api/auth/google_refresh.php', {
                method: 'POST'
            });
            
            const renewData = await renewResponse.json();
            if (!renewData.success) {
                showWarning('Tu sesión con Google ha expirado. Necesitas volver a conectar tu cuenta.');
                return false;
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('Error al verificar conexión con Google:', error);
        showError('Error al verificar la conexión con Google');
        return false;
    }
}

// Funciones de utilidad para notificaciones
function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message
    });
}

function showWarning(message) {
    Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: message
    });
}

async function updateGoogleSyncSection() {
    try {
      // Obtener elementos del DOM
      const syncCheckbox = document.getElementById('syncWithGoogleEnabled');
      const syncLockOverlay = document.getElementById('syncLockOverlay');
      const syncLabel = document.getElementById('syncLabel');
      const syncDescription = document.getElementById('syncDescription');
      const connectionIndicator = document.getElementById('connectionIndicator');
      const connectionMessage = document.getElementById('connectionMessage');
      const connectLink = connectionMessage.nextElementSibling;
      
      // Verificar el estado de conexión con Google
      const response = await fetch('/api/auth/google_status.php');
      const data = await response.json();
      
      if (data.success && data.connected) {
        // Cuenta conectada - habilitar sincronización
        syncCheckbox.disabled = false;
        syncLockOverlay.classList.add('hidden');
        syncLabel.classList.remove('text-gray-500');
        syncLabel.classList.add('text-blue-800');
        syncDescription.classList.remove('text-gray-500');
        syncDescription.classList.add('text-blue-600');
        
        // Actualizar indicador de conexión
        connectionIndicator.classList.remove('bg-red-500');
        connectionIndicator.classList.add('bg-green-500');
        connectionMessage.textContent = 'Cuenta de Google conectada';
        
        // Ocultar enlace de conexión
        connectLink.classList.add('hidden');
        
        // Restablecer valor del checkbox según la preferencia guardada
        const savedConfig = localStorage.getItem('scheduleConfig');
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          syncCheckbox.checked = parsedConfig.syncWithGoogle || false;
        }
      } else {
        // Cuenta no conectada - deshabilitar sincronización
        syncCheckbox.disabled = true;
        syncCheckbox.checked = false;
        syncLockOverlay.classList.remove('hidden');
        syncLabel.classList.remove('text-blue-800');
        syncLabel.classList.add('text-gray-500');
        syncDescription.classList.remove('text-blue-600');
        syncDescription.classList.add('text-gray-500');
        
        // Actualizar indicador de conexión
        connectionIndicator.classList.remove('bg-green-500');
        connectionIndicator.classList.add('bg-red-500');
        connectionMessage.textContent = 'No hay cuenta de Google conectada';
        
        // Mostrar enlace de conexión
        connectLink.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error al verificar estado de Google:', error);
      // Mostrar estado de error por defecto
      document.getElementById('googleSyncSection').classList.add('bg-red-50', 'border-red-200');
      document.getElementById('syncDescription').textContent = 'Error al verificar conexión con Google Calendar';
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Intentar cargar desde el servidor primero
        const response = await fetch('/api/crm/calendario/get_schedule.php');
        const result = await response.json();
        
        if (result.success) {
            schedule = result.data;
        } else {
            // Si falla, intentar cargar del localStorage
            const savedConfig = localStorage.getItem('scheduleConfig');
            if (savedConfig) {
                schedule = JSON.parse(savedConfig);
            }
        }
        
        // Mostrar notificación de borrador si existe
        document.getElementById('draftNotice').style.display = schedule.isDraft ? 'block' : 'none';

    } catch (error) {
        console.error('Error al cargar horario:', error);
        // Intentar cargar del localStorage como respaldo
        const savedConfig = localStorage.getItem('scheduleConfig');
        if (savedConfig) {
            schedule = JSON.parse(savedConfig);
            document.getElementById('draftNotice').style.display = schedule.isDraft ? 'block' : 'none';
        }
    }

    // Inicializar días
    const container = document.getElementById('scheduleContainer');
    Object.keys(DAYS_CONFIG).forEach(dayId => {
        const dayElement = createDayElement(dayId);
        container.appendChild(dayElement);
        updateDay(dayId);
    });

    // Event listeners
    document.getElementById('togglePreview').addEventListener('click', function(e) {
        e.preventDefault();
        const modal = document.getElementById('previewModal');
        modal.classList.remove('hidden');
        updatePreview();
        lucide.createIcons();
    });

    document.getElementById('closePreview').addEventListener('click', function() {
        document.getElementById('previewModal').classList.add('hidden');
    });

    // Cerrar modal al hacer clic en el overlay
    document.getElementById('previewModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.add('hidden');
        }
    });

    // Evitar que el clic en el contenido del modal lo cierre
    document.querySelector('#previewModal .bg-white').addEventListener('click', function(e) {
        e.stopPropagation();
    });

    document.getElementById('copySchedule').addEventListener('click', copySchedule);
    document.getElementById('applyWorkweek').addEventListener('click', applyWorkweekSchedule);
    document.getElementById('saveDraft').addEventListener('click', saveDraft);
    document.getElementById('saveSchedule').addEventListener('click', saveSchedule);

    // Actualizar vista previa inicial
    updatePreview();
    // Inicializar sección de sincronización de Google
    updateGoogleSyncSection();
    
    // Agregar al evento saveSchedule para guardar la preferencia de sincronización
    const originalSaveSchedule = saveSchedule;
    saveSchedule = async function() {
    // Guardar la preferencia de sincronización en el objeto schedule
    const syncCheckbox = document.getElementById('syncWithGoogleEnabled');
    schedule.syncWithGoogle = syncCheckbox && !syncCheckbox.disabled ? syncCheckbox.checked : false;
    
    // Llamar a la función original
    return await originalSaveSchedule.apply(this, arguments);
  };
});