class MobileInteractionManager {
    constructor(leadManager) {
        this.leadManager = leadManager;
        this.touchStartTime = 0;
        this.touchStartY = 0;
        this.longPressTimer = null;
        this.isDragging = false;
        this.currentCard = null;
        this.initialTouchPos = { x: 0, y: 0 };
        this.ghostElement = null;

        this.initializeInteractions();
    }

    initializeInteractions() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    handleTouchStart(e) {
        const card = e.target.closest('.lead-card');
        if (!card) return;

        this.touchStartTime = Date.now();
        this.currentCard = card;
        this.initialTouchPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        // Iniciar timer para long press
        this.longPressTimer = setTimeout(() => {
            this.startDragging(card, e.touches[0]);
        }, 500); // 500ms para long press
    }

    handleTouchMove(e) {
        if (!this.currentCard) return;

        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - this.initialTouchPos.x);
        const moveY = Math.abs(touch.clientY - this.initialTouchPos.y);

        // Si el usuario se mueve más de 10px, cancelar el long press
        if (!this.isDragging && (moveX > 10 || moveY > 10)) {
            this.cancelLongPress();
        }

        if (this.isDragging) {
            e.preventDefault();
            this.moveGhostElement(touch);
            this.checkDropTarget(touch);
        }
    }

    handleTouchEnd(e) {
        if (!this.currentCard) return;

        const touchDuration = Date.now() - this.touchStartTime;

        if (!this.isDragging && touchDuration < 500) {
            // Click rápido - mostrar detalles
            this.leadManager.detailView.show(this.currentCard.dataset.id);
        } else if (this.isDragging) {
            // Finalizar drag & drop
            this.completeDrag(e);
        }

        this.cancelLongPress();
        this.cleanup();
    }

    startDragging(card, touch) {
        this.isDragging = true;
        this.currentCard.classList.add('dragging');
        
        // Crear elemento fantasma
        this.createGhostElement(card);
        
        // Notificar al usuario
        this.showDragFeedback();
    }

    createGhostElement(card) {
        this.ghostElement = card.cloneNode(true);
        this.ghostElement.classList.add('drag-ghost');
        this.ghostElement.style.cssText = `
            position: fixed;
            width: ${card.offsetWidth}px;
            height: ${card.offsetHeight}px;
            background: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            opacity: 0.9;
            pointer-events: none;
            transition: transform 0.1s ease-out;
            z-index: 1000;
        `;
        document.body.appendChild(this.ghostElement);
    }

    moveGhostElement(touch) {
        if (!this.ghostElement) return;
        
        const x = touch.clientX - this.initialTouchPos.x;
        const y = touch.clientY - this.initialTouchPos.y;
        
        this.ghostElement.style.transform = `translate(${x}px, ${y}px)`;
    }

    checkDropTarget(touch) {
        const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        const column = elementAtTouch?.closest('.kanban-column');
        
        // Remover highlight previo
        document.querySelectorAll('.kanban-column').forEach(col => {
            col.classList.remove('drop-target');
        });
        
        if (column) {
            column.classList.add('drop-target');
        }
    }

    completeDrag(e) {
        const touch = e.changedTouches[0];
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY)
            ?.closest('.kanban-column');

        if (dropTarget && this.currentCard) {
            const newStatus = dropTarget.dataset.id;
            const leadId = this.currentCard.dataset.id;
            this.leadManager.handleDrop({ preventDefault: () => {} }, dropTarget);
        }
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    cleanup() {
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
        if (this.currentCard) {
            this.currentCard.classList.remove('dragging');
        }
        this.isDragging = false;
        this.currentCard = null;
        document.querySelectorAll('.kanban-column').forEach(col => {
            col.classList.remove('drop-target');
        });
    }

    showDragFeedback() {
        // Vibrar el dispositivo si está soportado
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }
}

class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.notifications = new Map();
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        document.body.appendChild(container);
        return container;
    }

    getIcon(type) {
        const icons = {
            success: `<svg class="notification-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>`,
            error: `<svg class="notification-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>`,
            warning: `<svg class="notification-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>`,
            info: `<svg class="notification-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>`
        };
        return icons[type] || icons.info;
    }

    show(message, type = 'info') {
        const id = Date.now();
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            ${this.getIcon(type)}
            <div class="notification-message">${message}</div>
            <button class="notification-close" aria-label="Cerrar">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        `;

        // Añadir al contenedor
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Configurar cierre automático
        const timeout = setTimeout(() => this.remove(id), 5000);

        // Configurar cierre manual
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.remove(id);
            clearTimeout(timeout);
        });

        return id;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.classList.add('removing');
            notification.addEventListener('animationend', () => {
                notification.remove();
                this.notifications.delete(id);
            });
        }
    }
}

class AppointmentCalendar {
    constructor(leadManager) {
        this.leadManager = leadManager;
        this.appointments = [];
        this.currentDate = new Date();
        this.currentView = 'month'; // 'day', 'week', 'month'
        this.selectedDate = null;
        
        // Referencias a elementos del DOM
        this.calendarView = document.getElementById('calendarView');
        this.currentMonthDisplay = document.getElementById('currentMonthDisplay');
        this.appointmentDetails = document.getElementById('appointmentDetails');
        this.appointmentContent = document.getElementById('appointmentContent');
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Navegación entre meses
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
        
        // Cambio de vista
        document.getElementById('viewDay').addEventListener('click', () => this.changeView('day'));
        document.getElementById('viewWeek').addEventListener('click', () => this.changeView('week'));
        document.getElementById('viewMonth').addEventListener('click', () => this.changeView('month'));
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '';
        
        // Crear una nueva fecha para no modificar la original
        const adjustedDate = new Date(dateStr);
        adjustedDate.setHours(adjustedDate.getHours() - 6);
        
        return adjustedDate.toLocaleString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
    
    async loadAppointments() {
        try {
            // Extraer todas las citas de las actividades de los leads
            this.appointments = [];
            
            this.leadManager.leads.forEach(lead => {
                if (!lead.activities) return;
                
                const activities = typeof lead.activities === 'string' ? 
                    JSON.parse(lead.activities) : lead.activities;
                
                if (!Array.isArray(activities)) return;
                
                activities.forEach(activity => {
                    // Solo considerar actividades de tipo visita
                    if (activity.type === 'visita' || 
                        activity.activity_type === 'visit') {
                        
                        // Extraer fecha y hora
                        const dateStr = activity.date || activity.created_at;
                        if (!dateStr) return;
                        
                        const appointmentDate = new Date(dateStr);
                        if (isNaN(appointmentDate.getTime())) return;
                        
                        // Crear objeto de cita
                        this.appointments.push({
                            id: `${lead.id}-${appointmentDate.getTime()}`,
                            leadId: lead.id,
                            leadName: lead.name,
                            date: appointmentDate,
                            title: activity.title || 'Visita programada',
                            description: activity.description || '',
                            status: activity.sub_state || 'programada',
                            propertyTitle: lead.property_title || lead.original_property_title || 'Sin propiedad',
                            type: 'visita'
                        });
                    }
                });
            });
            
            // Ordenar citas por fecha
            this.appointments.sort((a, b) => a.date - b.date);
            
            // Renderizar calendario con las citas cargadas
            this.renderCalendar();
            
            return true;
        } catch (error) {
            console.error('Error al cargar citas:', error);
            return false;
        }
    }
    
    renderCalendar() {
        switch (this.currentView) {
            case 'day':
                this.renderDayView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'month':
            default:
                this.renderMonthView();
                break;
        }
    }
    
    renderMonthView() {
        // Actualizar título
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        this.currentMonthDisplay.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        
        // Limpiar vista previa (manteniendo los encabezados)
        const dayHeaders = Array.from(this.calendarView.querySelectorAll('.day-header'));
        this.calendarView.innerHTML = '';
        dayHeaders.forEach(header => this.calendarView.appendChild(header));
        
        // Obtener el primer día del mes y el último
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Determinar el primer día a mostrar (puede ser del mes anterior)
        let startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        
        // Determinar el último día a mostrar (puede ser del mes siguiente)
        let endDate = new Date(lastDay);
        const remainingDays = 6 - endDate.getDay();
        endDate.setDate(endDate.getDate() + remainingDays);
        
        // Crear todas las celdas para los días
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            
            // Verificar si es día del mes actual o de meses adyacentes
            if (currentDate.getMonth() !== this.currentDate.getMonth()) {
                dayCell.classList.add('adjacent-month');
            }
            
            // Verificar si es día actual
            const isToday = this.isSameDay(currentDate, new Date());
            if (isToday) {
                dayCell.classList.add('today');
            }
            
            // Estructura interna de la celda
            dayCell.innerHTML = `
                <div class="date-header">${currentDate.getDate()}</div>
                <div class="appointments-container"></div>
            `;
            
            const appointmentsContainer = dayCell.querySelector('.appointments-container');
            
            // Añadir citas del día
            const appointmentsForDay = this.getAppointmentsForDay(currentDate);
            appointmentsForDay.forEach(appointment => {
                const appointmentElement = document.createElement('div');
                appointmentElement.className = `appointment-item status-${appointment.status}`;
                appointmentElement.innerHTML = `
                    <div class="font-medium">${this.formatTime(appointment.date)}</div>
                    <div class="truncate">${appointment.leadName}</div>
                `;
                appointmentElement.dataset.appointmentId = appointment.id;
                
                // Evento para mostrar detalles
                appointmentElement.addEventListener('click', () => {
                    this.showAppointmentDetails(appointment);
                });
                
                appointmentsContainer.appendChild(appointmentElement);
            });
            
            // Evento para crear nueva cita
            dayCell.addEventListener('dblclick', (e) => {
                // Evitar que se dispare cuando se hace click en una cita existente
                if (!e.target.closest('.appointment-item')) {
                    const newDate = new Date(currentDate);
                    this.createNewAppointment(newDate);
                }
            });
            
            this.calendarView.appendChild(dayCell);
            
            // Avanzar al siguiente día
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    renderWeekView() {
        // Implementación similar a monthView pero solo para una semana
        // Se omite por brevedad, pero seguiría la misma lógica
        this.renderMonthView(); // Por ahora, usar la vista mensual
    }
    
    renderDayView() {
        // Implementación para vista diaria con horas
        // Se omite por brevedad
        this.renderMonthView(); // Por ahora, usar la vista mensual
    }
    
    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }
    
    changeView(view) {
        this.currentView = view;
        
        // Actualizar botones de vista
        document.getElementById('viewDay').classList.remove('bg-blue-100', 'text-blue-800');
        document.getElementById('viewWeek').classList.remove('bg-blue-100', 'text-blue-800');
        document.getElementById('viewMonth').classList.remove('bg-blue-100', 'text-blue-800');
        
        document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`)
            .classList.add('bg-blue-100', 'text-blue-800');
        
        this.renderCalendar();
    }
    
    getAppointmentsForDay(date) {
        return this.appointments.filter(appointment => 
            this.isSameDay(appointment.date, date)
        );
    }
    
    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }
    
    formatTime(date) {
        if (!date) return '';
        
        // Crear una nueva fecha para no modificar la original
        const adjustedDate = new Date(date);
        adjustedDate.setHours(adjustedDate.getHours() - 6);
        
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        
        return new Intl.DateTimeFormat('es-MX', options).format(adjustedDate);
    }
    
    getStatusColor(status) {
        const colors = {
            'programada': 'bg-blue-100 text-blue-800',
            'realizada': 'bg-green-100 text-green-800',
            'cancelada': 'bg-red-100 text-red-800',
            'reprogramada': 'bg-yellow-100 text-yellow-800',
            'no_asistio': 'bg-gray-100 text-gray-800'
        };
        return colors[status] || colors['programada'];
    }
    
    showAppointmentDetails(appointment) {
        this.appointmentDetails.classList.remove('hidden');
        
        // Ajustar la fecha del appointment
        const adjustedDate = new Date(appointment.date);
        adjustedDate.setHours(adjustedDate.getHours() - 6);
        
        const statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs ${this.getStatusColor(appointment.status)}">
                               ${this.formatStatus(appointment.status)}
                             </span>`;
        
        this.appointmentContent.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h6 class="font-medium">${appointment.title}</h6>
                        <p class="text-sm text-gray-600">${adjustedDate.toLocaleString('es-MX', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })}</p>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>
                
                <div class="text-sm">
                    <div class="mb-1"><span class="font-medium">Lead:</span> ${appointment.leadName}</div>
                    <div class="mb-1"><span class="font-medium">Propiedad:</span> ${appointment.propertyTitle}</div>
                    ${appointment.description ? `<div class="mb-1"><span class="font-medium">Descripción:</span> ${appointment.description}</div>` : ''}
                </div>
                
                <div class="flex justify-end gap-2 pt-4">
                    <!-- Botón para ver detalles del lead -->
                    <button class="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                            onclick="leadManager.detailView.show('${appointment.leadId}')">
                        Ver Lead
                    </button>
    
                    ${appointment.status === 'programada' ? `
                        <!-- Botones de gestión solo para citas programadas -->
                        <button class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                onclick="appointmentCalendar.markAppointmentComplete('${appointment.id}')">
                            Marcar Realizada
                        </button>
                        <button class="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                onclick="appointmentCalendar.rescheduleAppointment('${appointment.id}')">
                            Reprogramar
                        </button>
                        <button class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                onclick="appointmentCalendar.cancelAppointment('${appointment.id}')">
                            Cancelar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }    

    // Método para marcar una cita como completada
    async markAppointmentComplete(appointmentId) {
        if (!confirm('¿Confirmar que la visita fue realizada?')) return;
        
        try {
            const result = await this.updateAppointmentStatus(appointmentId, 'realizada');
            if (result) {
                this.leadManager.showNotification('Visita marcada como realizada', 'success');
            }
        } catch (error) {
            console.error('Error al marcar visita como realizada:', error);
            this.leadManager.showNotification('Error al actualizar la visita', 'error');
        }
    }

    // Método para cancelar una cita
    async cancelAppointment(appointmentId) {
        const reason = prompt('Por favor, ingrese el motivo de la cancelación:');
        if (reason === null) return; // Usuario canceló el prompt
        
        try {
            const appointment = this.appointments.find(a => a.id === appointmentId);
            if (!appointment) throw new Error('Cita no encontrada');

            const updateData = {
                id: appointment.leadId,
                activity_type: 'visita',
                sub_state: 'cancelada',
                description: `Visita cancelada. Motivo: ${reason || 'No especificado'}`,
                activity_date: new Date().toISOString()
            };

            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            const result = await response.json();
            
            if (result.success) {
                await this.syncCancelWithGoogle(appointment.leadId, appointmentId);
                await this.leadManager.loadLeads();
                await this.loadAppointments();
                this.leadManager.showNotification('Visita cancelada correctamente', 'success');
            } else {
                throw new Error(result.message || 'Error al cancelar la visita');
            }
        } catch (error) {
            console.error('Error al cancelar visita:', error);
            this.leadManager.showNotification('Error al cancelar la visita', 'error');
        }
    }

    // Método para reprogramar una cita
    async rescheduleAppointment(appointmentId) {
        try {
            const appointment = this.appointments.find(a => a.id === appointmentId);
            if (!appointment) throw new Error('Cita no encontrada');
    
            // Marcar la cita actual como reprogramada
            const updateData = {
                id: appointment.leadId,
                activity_type: 'visita',
                sub_state: 'reprogramada',
                description: 'Visita reprogramada',
                activity_date: new Date().toISOString()
            };
    
            await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
    
            // Configurar el modal de agendar visita con los datos actuales
            const modal = document.getElementById('scheduleVisitModal');
            const currentDate = new Date(appointment.date);
            
            document.getElementById('scheduleVisitLeadId').value = appointment.leadId;
            document.getElementById('visitDate').value = currentDate.toISOString().split('T')[0];
            document.getElementById('visitTime').value = currentDate.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            // Mostrar el modal
            modal.style.display = 'flex';
            
            // Actualizar el mensaje de descripción para indicar que es una reprogramación
            const notesField = document.getElementById('visitNotes');
            // Usar el formatDateTime del leadManager
            const originalDateFormatted = this.leadManager.formatDateTime(appointment.date);
            notesField.value = `Visita reprogramada. Cita original: ${originalDateFormatted}`;
            
        } catch (error) {
            console.error('Error al reprogramar visita:', error);
            this.leadManager.showNotification('Error al reprogramar la visita', 'error');
        }
    }

    // Método para sincronizar la cancelación con Google Calendar
    async syncCancelWithGoogle(leadId, appointmentId) {
        try {
            const response = await fetch('/api/crm/calendario/cancel_visit_event.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    lead_id: leadId,
                    appointment_id: appointmentId
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('Evento cancelado en Google Calendar');
            }
        } catch (error) {
            console.warn('Error al cancelar evento en Google Calendar:', error);
        }
    }
    
    formatStatus(status) {
        const statusMap = {
            'programada': 'Programada',
            'realizada': 'Realizada',
            'cancelada': 'Cancelada',
            'reprogramada': 'Reprogramada',
            'no_asistio': 'No Asistió'
        };
        return statusMap[status] || status;
    }
    
    async updateAppointmentStatus(appointmentId, newStatus) {
        try {
            // Encontrar la cita correspondiente
            const appointmentIndex = this.appointments.findIndex(a => a.id === appointmentId);
            if (appointmentIndex === -1) return false;
            
            const appointment = this.appointments[appointmentIndex];
            const leadId = appointment.leadId;
            
            // Actualizar en la base de datos a través del leadManager
            const updateData = {
                id: leadId,
                activity_type: 'visita',
                sub_state: newStatus,
                description: `Visita ${this.formatStatus(newStatus)}`,
                activity_date: new Date().toISOString()
            };
            
            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Actualizar localmente
                this.appointments[appointmentIndex].status = newStatus;
                
                // Recargar datos y actualizar vista
                await this.leadManager.loadLeads();
                await this.loadAppointments();
                this.showAppointmentDetails(this.appointments[appointmentIndex]);
                
                this.leadManager.showNotification(`Cita marcada como ${this.formatStatus(newStatus)}`, 'success');
                
                // NUEVO: Sincronizar estado con Google Calendar
                await this.syncAppointmentStatusWithGoogle(leadId, appointmentId, newStatus);
                
                return true;
            } else {
                throw new Error(result.message || 'Error al actualizar estado de cita');
            }
        } catch (error) {
            console.error('Error al actualizar estado de cita:', error);
            this.leadManager.showNotification('Error al actualizar cita', 'error');
            return false;
        }
    }

    // Agregar nuevo método para sincronizar estado con Google
    async syncAppointmentStatusWithGoogle(leadId, appointmentId, newStatus) {
        try {
            // Verificar conexión con Google
            const statusCheck = await fetch('/api/auth/google_status.php');
            const statusData = await statusCheck.json();
            
            if (!statusData.success || !statusData.connected) {
                console.log('No hay conexión con Google Calendar, omitiendo actualización');
                return false;
            }
            
            // Obtener mapeo del evento
            const response = await fetch('/api/crm/calendario/update_visit_status.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    lead_id: leadId,
                    appointment_id: appointmentId,
                    status: newStatus
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Evento de Google Calendar actualizado');
                return true;
            } else {
                console.warn('No se pudo actualizar evento en Google Calendar:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Error al sincronizar estado con Google Calendar:', error);
            return false;
        }
    }
    
    createNewAppointment(date) {
        // Esta función podría abrir un modal para crear una nueva cita
        // O redirigir al usuario a la pantalla de creación de actividad de visita
        this.leadManager.showNotification(
            'Crear nueva cita: ' + date.toLocaleDateString(), 
            'info'
        );
        
        // Por ahora, simplemente mostrar el modal de nuevo lead
        window.showNewLeadModal();
    }
    
    clearDetails() {
        this.appointmentDetails.classList.add('hidden');
        this.appointmentContent.innerHTML = '';
    }
}

// Funciones para manejar el modal de calendario
function showCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Cargar citas y renderizar calendario
        if (window.appointmentCalendar) {
            window.appointmentCalendar.loadAppointments();
        }
    }
}

function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Limpiar detalles
        if (window.appointmentCalendar) {
            window.appointmentCalendar.clearDetails();
        }
    }
}

class ReminderSystem {
    constructor(leadManager) {
        this.leadManager = leadManager;
        this.reminders = new Map();
        this.rules = {
            nuevo: 24, // horas para primer contacto
            contacto: 48, // horas para seguimiento
            visita: 72, // horas post visita
            negociacion: 48, // horas en negociación
            general: 120 // horas máximo sin actividad
        };
        
        // Estado de notificaciones
        this.notificationPermission = false;
        this.checkNotificationPermission();
    }

    async checkNotificationPermission() {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission === "granted";
        }
    }

    initializeReminders() {
        // Verificar cada lead y crear recordatorios iniciales
        this.leadManager.leads.forEach(lead => {
            this.checkLeadActivity(lead);
        });

        // Iniciar verificación periódica
        this.startMonitoring();
    }

    checkLeadActivity(lead) {
        const lastActivity = new Date(lead.last_activity_date || lead.updated_at || lead.created_at);
        const now = new Date();
        const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);

        // Verificar regla específica del estado
        const stateRule = this.rules[lead.status] || this.rules.general;
        
        if (hoursSinceActivity >= stateRule) {
            this.createReminder(lead, 'inactivity');
        }

        // Verificar visitas programadas solo si el lead está en estado "visita"
        if (lead.status === 'visita' && lead.activities) {
            const activities = typeof lead.activities === 'string' ? 
                JSON.parse(lead.activities) : lead.activities;

            activities.forEach(activity => {
                // Verificar que la actividad sea de tipo visita y tenga sub-estado "programada"
                if (activity.type === 'visita' && 
                    activity.sub_state === 'programada' && 
                    new Date(activity.date) > now) {
                    this.createReminder(lead, 'scheduled_visit', new Date(activity.date));
                }
            });
        }
    }

    createReminder(lead, type, date = null) {
        const reminderId = `${lead.id}-${type}`;
        
        // Evitar duplicados
        if (this.reminders.has(reminderId)) {
            const existingReminder = this.reminders.get(reminderId);
            if (existingReminder.status === 'pending') {
                return;
            }
        }

        const reminder = {
            id: reminderId,
            leadId: lead.id,
            type: type,
            created: new Date(),
            dueDate: date || new Date(),
            status: 'pending',
            message: this.generateMessage(lead, type, date)
        };

        this.reminders.set(reminderId, reminder);
        this.notifyUser(reminder);
    }

    generateMessage(lead, type, date = null) {
        const adjustedDate = date ? new Date(date) : null;
        if (adjustedDate) {
            adjustedDate.setHours(adjustedDate.getHours() - 6);
        }
        
        const messages = {
            inactivity: `El lead ${lead.name} no ha tenido actividad en las últimas ${this.rules[lead.status]} horas`,
            scheduled_visit: `Visita programada con ${lead.name} para ${adjustedDate ? this.formatDateTime(adjustedDate) : 'próximamente'}`,
            follow_up: `Seguimiento pendiente para ${lead.name}`
        };
        return messages[type] || 'Recordatorio de actividad pendiente';
    }

    notifyUser(reminder) {
        // Crear notificación en la UI
        const notification = document.createElement('div');
        notification.className = 'reminder-notification';
        notification.innerHTML = `
            <div class="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg mb-4">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-yellow-700">${reminder.message}</p>
                    </div>
                    <div class="ml-auto pl-3">
                        <div class="flex space-x-2">
                            <button onclick="leadManager.detailView.show('${reminder.leadId}')" 
                                    class="text-sm text-yellow-700 hover:text-yellow-900 font-medium">
                                Ver lead
                            </button>
                            <button onclick="this.closest('.reminder-notification').remove()" 
                                    class="text-yellow-700 hover:text-yellow-900">
                                <span class="sr-only">Cerrar</span>
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Añadir a la UI
        document.body.appendChild(notification);

        // Notificación del sistema si está permitido
        if (this.notificationPermission) {
            new Notification("Recordatorio de Lead", {
                body: reminder.message,
                icon: "/assets/img/icon.png"
            });
        }

        // Auto-cerrar después de 10 segundos
        setTimeout(() => {
            notification.remove();
        }, 10000);
    }

    startMonitoring() {
        // Verificar cada 15 minutos
        setInterval(() => {
            this.leadManager.leads.forEach(lead => {
                this.checkLeadActivity(lead);
            });
        }, 15 * 60 * 1000);
    }

    postponeReminder(reminderId, hours = 24) {
        const reminder = this.reminders.get(reminderId);
        if (reminder) {
            reminder.dueDate = new Date(reminder.dueDate.getTime() + (hours * 60 * 60 * 1000));
            reminder.status = 'postponed';
            this.reminders.set(reminderId, reminder);
        }
    }

    completeReminder(reminderId) {
        const reminder = this.reminders.get(reminderId);
        if (reminder) {
            reminder.status = 'completed';
            this.reminders.set(reminderId, reminder);
        }
    }

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        
        // Crear objeto Date desde el string
        const date = new Date(dateStr);
        
        // Restar 6 horas
        date.setHours(date.getHours() - 6);
        
        // Configurar opciones para el formato
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        
        // Usar el locale es-MX sin especificar zona horaria
        return new Intl.DateTimeFormat('es-MX', options).format(date);
    }

    clearAllReminders() {
        this.reminders.clear();
        // Eliminar todas las notificaciones visuales
        document.querySelectorAll('.reminder-notification').forEach(notification => {
            notification.remove();
        });
    }

    getActiveReminders() {
        return Array.from(this.reminders.values())
            .filter(reminder => reminder.status === 'pending');
    }
}

class LeadScoringSystem {
    constructor() {
        // Factores de puntuación base
        this.scoringFactors = {
            // Interacción y Engagement (40 puntos max)
            interactions: {
                first_contact: 5,    // Primer contacto
                visit: 15,          // Visita
                negotiation: 10,     // Negociación
                documentation: 5     // Documentación
            },
            
            // Tiempo de respuesta (20 puntos max)
            responseTime: {
                within_1h: 20,
                within_4h: 15,
                within_24h: 10,
                within_48h: 5,
                over_48h: 0
            },
            
            // Calidad del lead (25 puntos max)
            leadQuality: {
                complete_info: 5,
                verified_phone: 5,
                verified_email: 5,
                property_match: 10
            },
            
            // Comportamiento (15 puntos max)
            behavior: {
                multiple_inquiries: 5,
                specific_questions: 5,
                price_discussion: 5,
                document_request: 10,
                urgency_signals: 15
            }
        };

        // Puntos de decaimiento por tiempo
        this.decayRules = {
            days_7: 0.9,  // 90% del score después de 7 días sin actividad
            days_15: 0.7, // 70% del score después de 15 días
            days_30: 0.5  // 50% del score después de 30 días
        };
    }

    calculateLeadScore(lead) {
        let score = 0;
        let details = {
            baseScore: 0,
            interactionScore: 0,
            qualityScore: 0,
            behaviorScore: 0,
            decayFactor: 1,
            temperature: '',
            lastCalculated: new Date()
        };
    
        try {
            // 1. Calcular puntuación por interacciones
            if (lead.activities) {
                const activities = typeof lead.activities === 'string' ? 
                    JSON.parse(lead.activities || '[]') : 
                    (Array.isArray(lead.activities) ? lead.activities : []);
    
                details.interactionScore = this.calculateInteractionScore(activities);
                score += details.interactionScore;
            }
    
            // 2. Calcular puntuación por calidad del lead
            const qualityScore = this.calculateQualityScore(lead);
            details.qualityScore = qualityScore;
            score += qualityScore;
    
            // 3. Calcular puntuación por comportamiento
            const behaviorScore = this.calculateBehaviorScore(lead);
            details.behaviorScore = behaviorScore;
            score += behaviorScore;
    
            // 4. Aplicar factor de decaimiento por tiempo
            const decayFactor = this.calculateDecayFactor(lead.last_activity_date || lead.updated_at || lead.created_at);
            details.decayFactor = decayFactor;
            score = score * decayFactor;
    
            // 5. Normalizar score final (0-100)
            score = Math.min(Math.round(score), 100);
            details.baseScore = score;
    
            // 6. Determinar temperatura del lead
            details.temperature = this.determineTemperature(score);
    
        } catch (error) {
            console.error('Error calculando lead score:', error);
            // Establecer valores por defecto en caso de error
            score = 0;
            details.temperature = 'cold';
        }
    
        return {
            score: score,
            details: details
        };
    }

    calculateInteractionScore(activities) {
        if (!Array.isArray(activities)) return 0;
        
        let score = 0;
        activities.forEach(activity => {
            const activityType = activity?.type?.toLowerCase();
            if (this.scoringFactors.interactions[activityType]) {
                score += this.scoringFactors.interactions[activityType];
            }
        });
        return Math.min(score, 40); // Máximo 40 puntos
    }

    calculateQualityScore(lead) {
        if (!lead) return 0;
        
        let score = 0;
        
        // Verificar información completa
        if (lead.name && lead.email && lead.phone) {
            score += this.scoringFactors.leadQuality.complete_info;
        }
    
        // Verificar teléfono y email
        if (lead.phone_verified) {
            score += this.scoringFactors.leadQuality.verified_phone;
        }
        if (lead.email_verified) {
            score += this.scoringFactors.leadQuality.verified_email;
        }
    
        // Verificar match con propiedad
        if (lead.property_id) {
            score += this.scoringFactors.leadQuality.property_match;
        }
    
        return Math.min(score, 25);
    }

    calculateBehaviorScore(lead) {
        let score = 0;
        try {
            // Asegurarse de que behavior_signals sea un array válido
            const behavior = Array.isArray(lead.behavior_signals) ? 
                lead.behavior_signals : 
                (typeof lead.behavior_signals === 'string' ? 
                    JSON.parse(lead.behavior_signals || '[]') : 
                    []);
    
            // Si behavior_signals es null o undefined, usar array vacío
            if (!behavior) return 0;
    
            behavior.forEach(signal => {
                if (this.scoringFactors.behavior[signal]) {
                    score += this.scoringFactors.behavior[signal];
                }
            });
        } catch (error) {
            console.warn('Error al calcular behavior score:', error);
            return 0; // Retornar 0 si hay algún error
        }
    
        return Math.min(score, 15);
    }

    calculateDecayFactor(lastActivityDate) {
        const daysSinceLastActivity = this.getDaysSinceDate(lastActivityDate);
        
        if (daysSinceLastActivity > 30) {
            return this.decayRules.days_30;
        } else if (daysSinceLastActivity > 15) {
            return this.decayRules.days_15;
        } else if (daysSinceLastActivity > 7) {
            return this.decayRules.days_7;
        }
        
        return 1;
    }

    determineTemperature(score) {
        if (score >= 80) return 'hot';
        if (score >= 60) return 'warm';
        if (score >= 40) return 'lukewarm';
        if (score >= 20) return 'cool';
        return 'cold';
    }

    getDaysSinceDate(date) {
        if (!date) return 31; // Si no hay fecha, asumimos más de 30 días
        const now = new Date();
        const activityDate = new Date(date);
        const diffTime = Math.abs(now - activityDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getTemperatureColor(temperature) {
        const colors = {
            hot: '#ff4444',
            warm: '#ff8c00',
            lukewarm: '#ffd700',
            cool: '#87ceeb',
            cold: '#b0c4de'
        };
        return colors[temperature] || colors.cold;
    }

    getTemperatureIcon(temperature) {
        const icons = {
            hot: '🔥',
            warm: '⭐',
            lukewarm: '✨',
            cool: '❄️',
            cold: '🧊'
        };
        return icons[temperature] || icons.cold;
    }
}

class LeadDetailView {
    constructor(leadManager) {
        this.leadManager = leadManager;
        this.currentLead = null;
        this.initializeModal();
        this.initializeVerificationModals();
        this.initializeModals(); // Nueva función para inicializar los modales de visita y contacto
        
        // Exponer las funciones globalmente
        window.confirmEmailVerification = this.confirmEmailVerification.bind(this);
        window.confirmPhoneVerification = this.confirmPhoneVerification.bind(this);
        window.closeVerificationModal = this.closeVerificationModal.bind(this);
        
        // Exponer nuevas funciones
        this.leadManager.scheduleVisit = this.scheduleVisit.bind(this);
        this.leadManager.closeScheduleVisitModal = this.closeScheduleVisitModal.bind(this);
        this.leadManager.showContactOptions = this.showContactOptions.bind(this);
    }

    initializeVerificationModals() {
        // Añadir modales de verificación al DOM
        const verificationModalsHTML = `
            <div id="emailVerificationModal" class="modal">
                <div class="modal-content max-w-md">
                    <div class="p-6">
                        <h3 class="text-lg font-semibold mb-4">Verificar Email</h3>
                        <p class="text-gray-600 mb-4">¿Pudiste confirmar que el email ${this.currentLead?.email} es válido?</p>
                        <div class="flex justify-end gap-3">
                            <button onclick="closeVerificationModal('email')" 
                                    class="px-4 py-2 border rounded hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button onclick="confirmEmailVerification()" 
                                    class="px-4 py-2 text-white rounded mb-color-principal mb-color-principal:hover">
                                Confirmar Email Válido
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="phoneVerificationModal" class="modal">
                <div class="modal-content max-w-md">
                    <div class="p-6">
                        <h3 class="text-lg font-semibold mb-4">Verificar Teléfono</h3>
                        <p class="text-gray-600 mb-4">¿Pudiste confirmar que el teléfono ${this.currentLead?.phone} es válido?</p>
                        <div class="flex justify-end gap-3">
                            <button onclick="closeVerificationModal('phone')" 
                                    class="px-4 py-2 border rounded hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button onclick="confirmPhoneVerification()" 
                                    class="px-4 py-2 text-white rounded mb-color-principal mb-color-principal:hover">
                                Confirmar Teléfono Válido
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', verificationModalsHTML);
    }

    handleEmailClick() {
        if (!this.currentLead) return;
        
        // Abrir cliente de correo
        window.location.href = `mailto:${this.currentLead.email}`;
        
        // Mostrar modal de verificación solo si el email no está verificado
        if (!this.currentLead.email_verified) {
            setTimeout(() => {
                const modal = document.getElementById('emailVerificationModal');
                modal.style.display = 'flex';
            }, 1000);
        }
    }

    handlePhoneClick() {
        if (!this.currentLead) return;
        
        // Abrir marcador telefónico
        window.location.href = `tel:${this.currentLead.phone}`;
        
        // Mostrar modal de verificación solo si el teléfono no está verificado
        if (!this.currentLead.phone_verified) {
            setTimeout(() => {
                const modal = document.getElementById('phoneVerificationModal');
                modal.style.display = 'flex';
            }, 1000);
        }
    }

    async confirmEmailVerification() {
        if (!this.currentLead) return;
        
        try {
            const responseData = {
                id: this.currentLead.id,
                email_verified: true,
                status: this.currentLead.status,
                activity_type: 'email',
                title: 'Verificación de Email', // Título explícito
                description: 'Email verificado después de contacto'
            };
    
            console.log('Enviando datos:', responseData); // Log para debug
    
            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(responseData)
            });
    
            const responseText = await response.text();
            console.log('Response text:', responseText);
            const result = JSON.parse(responseText);
    
            if (result.success) {
                this.leadManager.showNotification('Email verificado correctamente', 'success');
                await this.leadManager.loadLeads();
                this.show(this.currentLead.id);
            } else {
                throw new Error(result.message || 'Error al verificar email');
            }
        } catch (error) {
            console.error('Error completo:', error);
            this.leadManager.showNotification(`Error al verificar email: ${error.message}`, 'error');
        }
        
        this.closeVerificationModal('email');
    }
    
    async confirmPhoneVerification() {
        if (!this.currentLead) return;
        
        try {
            const responseData = {
                id: this.currentLead.id,
                phone_verified: true,
                status: this.currentLead.status,
                activity_type: 'llamada',
                title: 'Verificación de Teléfono', // Título explícito
                description: 'Teléfono verificado después de contacto'
            };
    
            console.log('Enviando datos:', responseData); // Log para debug
    
            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(responseData)
            });
    
            const responseText = await response.text();
            console.log('Response text:', responseText);
            const result = JSON.parse(responseText);
    
            if (result.success) {
                this.leadManager.showNotification('Teléfono verificado correctamente', 'success');
                await this.leadManager.loadLeads();
                this.show(this.currentLead.id);
            } else {
                throw new Error(result.message || 'Error al verificar teléfono');
            }
        } catch (error) {
            console.error('Error completo:', error);
            this.leadManager.showNotification(`Error al verificar teléfono: ${error.message}`, 'error');
        }
        
        this.closeVerificationModal('phone');
    }

    closeVerificationModal(type) {
        const modal = document.getElementById(`${type}VerificationModal`);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    initializeModal() {
        // Crear el modal HTML
        const modalHtml = `
            <div id="leadDetailModal" class="modal">
                <div class="modal-content max-w-6xl">
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h2 class="text-2xl font-bold mb-2" id="leadDetailName"></h2>
                            <div class="flex items-center gap-3">
                                <span class="status-badge text-sm" id="leadDetailStatus"></span>
                                <span class="text-gray-500 text-sm" id="leadDetailDate"></span>
                            </div>
                        </div>
                        <button onclick="leadManager.closeDetailModal()" class="text-gray-500 hover:text-gray-700">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
    
                    <!-- Contenido Principal -->
                    <div class="flex flex-col lg:flex-row gap-6">
                        <!-- Columna Izquierda: Información del Lead -->
                        <div class="flex-1">
                            <!-- Información de Contacto -->
                            <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
                                <h3 class="font-semibold mb-4 text-gray-700">Información de Contacto</h3>
                                <div class="space-y-3">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        <span id="leadDetailFullName"></span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <svg class="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                                        </svg>
                                        <span id="leadDetailPhone"></span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <svg class="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                            <polyline points="22,6 12,13 2,6"/>
                                        </svg>
                                        <span id="leadDetailEmail"></span>
                                    </div>
                                </div>
                            </div>
    
                            <!-- Información de la Propiedad -->
                            <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
                                <h3 class="font-semibold mb-4 text-gray-700">Información de la Propiedad</h3>
                                <div id="leadDetailProperty" class="space-y-2">
                                    <!-- Se llenará dinámicamente -->
                                </div>
                            </div>
    
                            <!-- Notas -->
                            <div class="bg-white rounded-lg shadow-sm p-4">
                                <h3 class="font-semibold mb-4 text-gray-700">Notas</h3>
                                <div id="leadDetailNotes" class="space-y-3">
                                    <!-- Se llenará dinámicamente -->
                                </div>
                            </div>
                        </div>
    
                        <!-- Columna Derecha: Actividades y Acciones -->
                        <div class="lg:w-96">
                            <!-- Acciones -->
                            <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
                                <div class="space-y-2">
                                    <button onclick="leadManager.showUpdateModal()" 
                                            class="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                        </svg>
                                        Actualizar Lead
                                    </button>
                                    
                                    <!-- Nuevos botones organizados en grid -->
                                    <div class="grid grid-cols-2 gap-2">
                                        <button data-action="schedule-visit" onclick="leadManager.scheduleVisit()" 
                                                class="flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            Agendar Visita
                                        </button>
                                        <button data-action="contact" 
                                                class="flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                            </svg>
                                            Contactar
                                        </button>
                                    </div>
                                </div>
                            </div>
    
                            <!-- Timeline de Actividades -->
                            <div class="bg-white rounded-lg shadow-sm p-4">
                                <h3 class="font-semibold mb-4 text-gray-700">Actividades</h3>
                                <div id="leadDetailTimeline" class="space-y-4">
                                    <!-- Se llenará dinámicamente -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    
        // Añadir el modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    show(leadId) {
        const lead = this.leadManager.leads.find(l => l.id == leadId);
        if (!lead) return;
    
        this.currentLead = lead;
            
        // Usar directamente los valores de la base de datos
        const scoreData = {
            score: lead.score || 0,
            temperature: lead.temperature || 'cold',
            interactionScore: lead.interaction_score || 0,
            qualityScore: lead.quality_score || 0,
            behaviorScore: lead.behavior_score || 0,
            responseTimeScore: lead.response_time_score || 0,
            decayFactor: lead.decay_factor || 1.00
        };
        
        const temperatureColor = this.leadManager.scoringSystem.getTemperatureColor(scoreData.temperature);      
    
        // Actualizar información básica
        document.getElementById('leadDetailName').textContent = lead.name;
        document.getElementById('leadDetailStatus').textContent = this.leadManager.states[lead.status] || lead.status;
        document.getElementById('leadDetailDate').textContent = `Creado: ${this.leadManager.formatDateTime(lead.created_at)}`;
        document.getElementById('leadDetailFullName').textContent = lead.name;
        document.getElementById('leadDetailPhone').textContent = lead.phone;
        document.getElementById('leadDetailEmail').textContent = lead.email;
    
        // Eliminar el contenedor de temperatura existente si lo hay
        const existingTemperature = document.querySelector('.temperature-container');
        if (existingTemperature) {
            existingTemperature.remove();
        }
    
        const temperatureHtml = `
            <div class="temperature-container bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 class="font-semibold mb-4 text-gray-700">Temperatura del Lead</h3>
                <div class="space-y-4">
                    <!-- Indicador principal -->
                    <div class="flex items-center gap-4">
                        <div class="text-3xl" style="color: ${temperatureColor}">
                            ${this.leadManager.scoringSystem.getTemperatureIcon(scoreData.temperature)}
                        </div>
                        <div class="flex-1">
                            <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full transition-all duration-500" 
                                    style="width: ${scoreData.score}%; background-color: ${temperatureColor}">
                                </div>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span class="text-sm font-medium" style="color: ${temperatureColor}">
                                    ${scoreData.score}%
                                </span>
                                <span class="text-sm text-gray-500">
                                    ${scoreData.temperature.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
    
                    <!-- Desglose de puntuación -->
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">Interacción</div>
                            <div class="font-medium">${scoreData.interactionScore}/40</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Calidad</div>
                            <div class="font-medium">${scoreData.qualityScore}/25</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Comportamiento</div>
                            <div class="font-medium">${scoreData.behaviorScore}/15</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Respuesta</div>
                            <div class="font-medium">${scoreData.responseTimeScore}/20</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    
        // Actualizar los manejadores de eventos para los nuevos botones
        const scheduleVisitButton = document.querySelector('[data-action="schedule-visit"]');
        const contactButton = document.querySelector('[data-action="contact"]');
        
        if (scheduleVisitButton) {
            scheduleVisitButton.onclick = () => this.scheduleVisit();
        }
        
        if (contactButton) {
            contactButton.addEventListener('click', (e) => {
              e.preventDefault();
              this.showContactOptions(e);
            });
        }
    
        const contactInfo = document.querySelector('#leadDetailModal .bg-white');
        contactInfo.insertAdjacentHTML('afterend', temperatureHtml);
    
        // Actualizar información de la propiedad
        const propertyContainer = document.getElementById('leadDetailProperty');
        propertyContainer.innerHTML = `
            <div class="flex items-center gap-2 text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>${lead.property_title || 'Sin propiedad asignada'}</span>
            </div>
            ${lead.property_description ? `
                <p class="mt-2 text-gray-600">${lead.property_description}</p>
            ` : ''}
        `;
    
        // Actualizar timeline de actividades
        this.updateTimeline(lead);
    
        // Mostrar el modal
        document.getElementById('leadDetailModal').style.display = 'flex';
    }

    scheduleVisit() {
        if (!this.currentLead) return;
        
        // Configurar valores iniciales
        document.getElementById('scheduleVisitLeadId').value = this.currentLead.id;
        
        // Establecer fecha mínima (hoy)
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const visitDateInput = document.getElementById('visitDate');
        visitDateInput.min = formattedDate;
        visitDateInput.value = formattedDate;
        
        // Hora por defecto (hora actual redondeada a la siguiente hora)
        let hours = today.getHours();
        let minutes = today.getMinutes() > 30 ? 0 : 30;
        if (minutes === 0) hours++;
        
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        document.getElementById('visitTime').value = formattedTime;
        
        // Mostrar el modal
        const modal = document.getElementById('scheduleVisitModal');
        modal.style.display = 'flex';
    
        // Asegurar que el formulario tenga el event listener
        const form = document.getElementById('scheduleVisitForm');
        if (form) {
            // Remover handlers previos para evitar duplicados
            const boundHandler = this.handleScheduleVisitSubmit.bind(this);
            form.removeEventListener('submit', boundHandler);
            form.addEventListener('submit', boundHandler);
        }
    }

    closeScheduleVisitModal() {
        const modal = document.getElementById('scheduleVisitModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('scheduleVisitForm').reset();
        }
    }
    
    showContactOptions(e) {
        if (!this.currentLead) return;
        
        // Asegurarnos de que tengamos un evento válido
        if (!e || !e.currentTarget) {
          console.warn('Evento no válido para mostrar opciones de contacto');
          return;
        }
        
        const menu = document.getElementById('contactOptionsMenu');
        if (!menu) {
          console.error('El menú de contacto no existe en el DOM');
          return;
        }
        
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        
        // Calcular posición óptima para el menú (evitar que se salga de la pantalla)
        const menuWidth = 220; // Ancho del menú
        let leftPos = rect.left + window.scrollX;
        const bottomSpace = window.innerHeight - rect.bottom - window.scrollY;
        const rightSpace = window.innerWidth - rect.left;
        
        // Ajustar posición horizontal si no hay suficiente espacio a la derecha
        if (rightSpace < menuWidth) {
          leftPos = rect.right - menuWidth + window.scrollX;
        }
        
        // Posicionar el menú
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${leftPos}px`;
        menu.classList.remove('hidden');
        
        // Configurar manejadores de eventos para las opciones
        menu.querySelectorAll('button').forEach(option => {
          option.onclick = () => this.handleContactOption(option.dataset.action);
        });
        
        // Cerrar el menú al hacer clic fuera de él
        const closeMenu = (event) => {
          if (!menu.contains(event.target) && event.target !== button) {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeMenu);
          }
        };
        
        // Pequeño delay para evitar que el mismo clic que abre cierre inmediatamente
        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 100);
      }

    handleContactOption(action) {
        if (!this.currentLead) return;
        
        switch (action) {
            case 'email':
                this.handleEmailClick();
                break;
            case 'phone':
                this.handlePhoneClick();
                break;
            case 'whatsapp':
                this.handleWhatsAppClick();
                break;
            case 'sms':
                this.handleSMSClick();
                break;
        }
        
        // Ocultar el menú
        document.getElementById('contactOptionsMenu').classList.add('hidden');
    }

    handleWhatsAppClick() {
        if (!this.currentLead?.phone) return;
        
        // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
        let phone = this.currentLead.phone.replace(/[\s-\(\)]/g, '');
        
        // Asegurarse de que el número tenga el formato correcto (+52...)
        if (phone.startsWith('+')) {
            // Ya tiene código de país
        } else if (phone.startsWith('52')) {
            phone = '+' + phone;
        } else {
            phone = '+52' + phone;
        }
        
        // Abrir WhatsApp
        window.open(`https://wa.me/${phone}`, '_blank');
        
        // Registrar actividad
        this.registerContactActivity('mensaje', 'whatsapp');
    }

    // Método para manejar click en SMS
    handleSMSClick() {
        if (!this.currentLead?.phone) return;
        
        // Abrir cliente de SMS
        window.location.href = `sms:${this.currentLead.phone}`;
        
        // Registrar actividad
        this.registerContactActivity('mensaje', 'sms');
    }

    // Modificar métodos existentes para registrar actividad
    handleEmailClick() {
        if (!this.currentLead?.email) return;
        
        // Abrir cliente de correo
        window.location.href = `mailto:${this.currentLead.email}`;
        
        // Registrar actividad y mostrar verificación si es necesario
        this.registerContactActivity('email', 'email');
        
        if (!this.currentLead.email_verified) {
            setTimeout(() => {
                const modal = document.getElementById('emailVerificationModal');
                modal.style.display = 'flex';
            }, 1000);
        }
    }

    handlePhoneClick() {
        if (!this.currentLead?.phone) return;
        
        // Abrir marcador telefónico
        window.location.href = `tel:${this.currentLead.phone}`;
        
        // Registrar actividad y mostrar verificación si es necesario
        this.registerContactActivity('llamada', 'telefono');
        
        if (!this.currentLead.phone_verified) {
            setTimeout(() => {
                const modal = document.getElementById('phoneVerificationModal');
                modal.style.display = 'flex';
            }, 1000);
        }
    }

    async registerContactActivity(type, channel) {
        if (!this.currentLead) return;
        
        try {
            const activityData = {
                id: this.currentLead.id,
                activity_type: type,
                sub_state: channel || 'contacto',
                description: `Contacto por ${channel || type}`,
                register_activity: true
            };
            
            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(activityData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`Actividad de ${type} registrada correctamente`);
            }
        } catch (error) {
            console.error('Error al registrar actividad:', error);
        }
    }

    // Inicialización
    initializeModals() {
        // Agregar el modal de agendar visita al DOM
        if (!document.getElementById('scheduleVisitModal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <!-- Modal para Agendar Visita -->
                <div id="scheduleVisitModal" class="modal">
                    <!-- Contenido del modal ya definido en el HTML -->
                </div>
            `);
            
            // Configurar evento submit del formulario
            const form = document.getElementById('scheduleVisitForm');
            if (form) {
                // Remover cualquier event listener existente
                form.removeEventListener('submit', this.handleScheduleVisitSubmit.bind(this));
                // Agregar el nuevo event listener
                form.addEventListener('submit', this.handleScheduleVisitSubmit.bind(this));
            }
        }
        
        // Agregar el menú contextual al DOM
        if (!document.getElementById('contactOptionsMenu')) {
            document.body.insertAdjacentHTML('beforeend', `
                <!-- Menú contextual para contactar -->
                <div id="contactOptionsMenu" class="hidden absolute bg-white rounded-lg shadow-lg border z-50">
                    <div class="py-1">
                        <button data-action="email" class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            Enviar Email
                        </button>
                        <button data-action="phone" class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                            Llamar por Teléfono
                        </button>
                        <button data-action="whatsapp" class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            WhatsApp
                        </button>
                        <button data-action="sms" class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                            </svg>
                            Enviar SMS
                        </button>
                    </div>
                </div>
            `);
        }
    }

    // Manejar envío del formulario de agendar visita
    async handleScheduleVisitSubmit(e) {
        if (e && e.preventDefault) {
            e.preventDefault();  // Asegurar que se previene el comportamiento por defecto
        }
        
        // Obtener datos del formulario
        const leadId = document.getElementById('scheduleVisitLeadId').value;
        const visitDate = document.getElementById('visitDate').value;
        const visitTime = document.getElementById('visitTime').value;
        const visitDuration = document.getElementById('visitDuration').value;
        const visitNotes = document.getElementById('visitNotes').value;
    
        // Validaciones
        if (!visitDate || !visitTime || !visitDuration) {
            this.leadManager.showNotification('Todos los campos son requeridos', 'error');
            return;
        }
    
        // Validar que la fecha y hora sean futuras
        const selectedDateTime = new Date(`${visitDate}T${visitTime}`);
        const now = new Date();
        if (selectedDateTime < now) {
            this.leadManager.showNotification('La fecha y hora deben ser futuras', 'error');
            return;
        }
    
        // Verificar zona horaria del usuario
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone !== 'America/Mexico_City') {
            this.leadManager.showNotification(
                'Asegúrate de que la hora corresponda a CDMX', 
                'warning'
            );
        }
        
        try {
            // Crear fecha local (ya está en UTC-6 por la configuración del navegador)
            const localDateTime = new Date(`${visitDate}T${visitTime}`);
            
            // El ajuste de -6 horas ya se realiza en otras partes del código cuando sea necesario
            const dateTimeForDB = localDateTime.toISOString();
            
            // Formatear para la descripción
            const localTimeFormatted = new Intl.DateTimeFormat('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/Mexico_City'
            }).format(localDateTime);
    
            const visitData = {
                id: leadId,
                activity_type: 'visita',
                status: 'visita',
                sub_state: 'programada',
                description: `Visita programada para ${localTimeFormatted}. ${visitNotes ? 'Notas: ' + visitNotes : ''}`,
                duration: parseInt(visitDuration),
                activity_date: dateTimeForDB,
                activity_data: JSON.stringify({
                    visit_date: dateTimeForDB,
                    duration: visitDuration,
                    notes: visitNotes,
                    scheduled_by: this.leadManager.currentUser || 'sistema'
                })
            };
            
            // Enviar a la API
            const response = await fetch(this.leadManager.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(visitData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Obtener ID de la actividad
                let activityId = null;
                if (result.data && result.data.activities) {
                    const activities = typeof result.data.activities === 'string' ? 
                        JSON.parse(result.data.activities) : result.data.activities;
                    
                    if (Array.isArray(activities) && activities.length > 0) {
                        const visitActivity = activities.find(act => 
                            act.type === 'visita' || act.activity_type === 'visita'
                        );
                        if (visitActivity) {
                            activityId = visitActivity.id;
                        }
                    }
                }
                
                // Si no encontramos el ID, consultar actividades
                if (!activityId) {
                    try {
                        const activitiesResponse = await fetch(
                            `${this.leadManager.API_ENDPOINT}?action=get_activities&lead_id=${leadId}`
                        );
                        const activitiesData = await activitiesResponse.json();
                        
                        if (activitiesData.success && Array.isArray(activitiesData.data)) {
                            const visitActivity = activitiesData.data.find(act => 
                                (act.type === 'visita' || act.activity_type === 'visita') && 
                                act.sub_state === 'programada'
                            );
                            if (visitActivity) {
                                activityId = visitActivity.id;
                            }
                        }
                    } catch (error) {
                        console.warn('No se pudo obtener el ID de la actividad:', error);
                    }
                }
                
                // Actualizar interfaz
                this.leadManager.showNotification('Visita programada correctamente', 'success');
                await this.leadManager.loadLeads();
                this.leadManager.detailView.show(leadId);
                this.closeScheduleVisitModal();
                
                // Refrescar calendario
                if (window.appointmentCalendar) {
                    await window.appointmentCalendar.loadAppointments();
                }
    
                // Actualizar el estado del lead a 'visita' si no lo está ya
                const lead = this.leadManager.leads.find(l => l.id == leadId);
                if (lead && lead.status !== 'visita') {
                    await this.leadManager.handleDrop(
                        { preventDefault: () => {} },
                        { dataset: { id: 'visita' } }
                    );
                }
                
                // Sincronizar con Google Calendar
                try {
                    const googleStatusResponse = await fetch('/api/auth/google_status.php');
                    const googleStatus = await googleStatusResponse.json();
                    
                    if (googleStatus.success && googleStatus.connected && googleStatus.token_valid) {
                        // Calcular hora de fin
                        const endTime = new Date(localDateTime);
                        endTime.setMinutes(endTime.getMinutes() + parseInt(visitDuration));
                        
                        // Obtener información del lead
                        const leadData = result.data || this.leadManager.leads.find(l => l.id == leadId);
                        const leadName = leadData?.name || 'Cliente';
                        const propertyTitle = leadData?.property_title || leadData?.original_property_title || 'Propiedad';
                        
                        // Datos del evento
                        const eventData = {
                            summary: `Visita: ${leadName}`,
                            location: propertyTitle,
                            description: `Visita programada con ${leadName} para propiedad: ${propertyTitle}.\n\n${visitNotes || ''}`,
                            start: {
                                dateTime: localDateTime.toISOString(),
                                timeZone: 'America/Mexico_City'
                            },
                            end: {
                                dateTime: endTime.toISOString(),
                                timeZone: 'America/Mexico_City'
                            },
                            reminders: {
                                useDefault: false,
                                overrides: [
                                    {method: 'popup', minutes: 30},
                                    {method: 'email', minutes: 60}
                                ]
                            },
                            colorId: '4',
                            source: {
                                title: 'Sistema CRM MasterBroker',
                                url: window.location.origin
                            }
                        };
                        
                        // Crear evento en Google Calendar
                        const syncResponse = await fetch('/api/crm/calendario/create_visit_event.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                lead_id: leadId,
                                activity_id: activityId,
                                event_data: eventData
                            })
                        });
                        
                        const syncResult = await syncResponse.json();
                        
                        if (syncResult.success) {
                            this.leadManager.showNotification(
                                'Visita sincronizada con Google Calendar',
                                'success'
                            );
                            
                            // Mostrar enlace al evento si está disponible
                            if (syncResult.event_url) {
                                setTimeout(() => {
                                    const notification = document.createElement('div');
                                    notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 max-w-md';
                                    notification.innerHTML = `
                                        <div class="flex items-center gap-3">
                                            <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            <div>
                                                <h4 class="font-medium">Evento creado en Google Calendar</h4>
                                                <div class="flex mt-2">
                                                    <a href="${syncResult.event_url}" target="_blank" 
                                                       class="text-sm text-blue-600 hover:text-blue-800">
                                                        Abrir en Google Calendar
                                                    </a>
                                                </div>
                                            </div>
                                            <button class="ml-auto text-gray-400 hover:text-gray-600" 
                                                    onclick="this.parentElement.parentElement.remove()">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                          d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        </div>
                                    `;
                                    document.body.appendChild(notification);
                                    
                                    setTimeout(() => {
                                        notification.remove();
                                    }, 10000);
                                }, 2000);
                            }
                        }
                    }
                } catch (syncError) {
                    console.warn('Error al sincronizar con Google Calendar:', syncError);
                }
                
                // Configurar recordatorio
                if (this.leadManager.reminderSystem) {
                    this.leadManager.reminderSystem.createReminder(
                        result.data || { id: leadId },
                        'scheduled_visit',
                        localDateTime
                    );
                }
            } else {
                throw new Error(result.message || 'Error al programar visita');
            }
        } catch (error) {
            console.error('Error al programar visita:', error);
            this.leadManager.showNotification(
                `Error: ${error.message || 'No se pudo programar la visita'}`,
                'error'
            );
        }
    }
    
    // Agregar método para sincronizar visita con Google Calendar
    async syncVisitWithGoogleCalendar(visitData) {
        try {
            // Verificar estado de la conexión con Google
            const statusResponse = await fetch('/api/auth/google_status.php');
            const statusData = await statusResponse.json();
            
            if (!statusData.success || !statusData.connected) {
                console.log('No hay conexión con Google Calendar, omitiendo sincronización');
                return false;
            }
            
            // Preparar datos para el evento
            const endTime = new Date(visitData.visitDate);
            endTime.setMinutes(endTime.getMinutes() + parseInt(visitData.duration));
            
            const eventData = {
                summary: `Visita: ${visitData.leadName}`,
                location: visitData.propertyTitle,
                description: visitData.notes || 'Visita programada',
                start: {
                    dateTime: visitData.visitDate.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: endTime.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        {method: 'popup', minutes: 30},
                        {method: 'email', minutes: 60}
                    ]
                },
                colorId: '4', // Color verde en Google Calendar
                source: {
                    title: 'MasterBroker CRM',
                    url: window.location.origin
                }
            };
            
            // Enviar solicitud al endpoint de sincronización
            const syncResponse = await fetch('/api/crm/calendario/create_visit_event.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    lead_id: visitData.leadId,
                    event_data: eventData
                })
            });
            
            const syncResult = await syncResponse.json();
            
            if (syncResult.success) {
                this.leadManager.showNotification(
                    'Visita sincronizada con Google Calendar',
                    'success'
                );
                return true;
            } else {
                console.warn('Error al sincronizar con Google Calendar:', syncResult.error);
                this.leadManager.showNotification(
                    'La visita se guardó pero no se pudo sincronizar con Google Calendar',
                    'warning'
                );
                return false;
            }
        } catch (error) {
            console.error('Error en sincronización con Google Calendar:', error);
            // No mostramos error al usuario para no confundirlo, ya que la visita se guardó correctamente
            return false;
        }
    }

    updateTimeline(lead) {
        const timelineContainer = document.getElementById('leadDetailTimeline');
        const activities = lead.activities ? JSON.parse(lead.activities) : [];
        const updates = lead.updates ? JSON.parse(lead.updates) : [];

        const allEvents = [...activities, ...updates]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        timelineContainer.innerHTML = allEvents.map(event => `
            <div class="border-l-2 border-blue-500 pl-4 pb-4 relative">
                <div class="text-sm text-gray-500 mb-1">
                    ${this.leadManager.formatDateTime(event.date)}
                </div>
                <div class="text-gray-800">
                    ${event.description}
                </div>
            </div>
        `).join('');
    }

    close() {
        const modal = document.getElementById('leadDetailModal');
        modal.style.display = 'none';
        this.currentLead = null;
    
        // Cerrar también el modal de actualización si está abierto
        const updateModal = document.getElementById('leadUpdateModal');
        if (updateModal && updateModal.style.display === 'flex') {
            this.leadManager.closeUpdateModal();
        }
    }
}

function adjustDateTime(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setHours(date.getHours() - 6);
    return date;
}

class LeadManager {
    constructor() {
        // Propiedades existentes
        this.leads = [];
        this.draggedItem = null;
        this.API_ENDPOINT = '/api/crm/leads/lead_manager.php';

        // Nuevo sistema de vistas
        this.detailView = new LeadDetailView(this);
        this.scoringSystem = new LeadScoringSystem();
        this.reminderSystem = new ReminderSystem(this);

        // Estados y configuración
        this.states = {
            nuevo: 'Nuevos Leads',
            contacto: 'En Contacto',
            visita: 'Visita Programada',
            negociacion: 'En Negociación',
            cerrado: 'Cerrados',
            posventa: 'Posventa'
        };

        // Configuración de actividades con estados automáticos y sub-estados
        this.activityTypes = {
            llamada: {
                autoState: 'contacto',
                states: [
                    { value: 'contestó', label: 'Contestó - Interesado' },
                    { value: 'no_interesado', label: 'Contestó - No Interesado' },
                    { value: 'no_contesta', label: 'No Contesta' },
                    { value: 'buzon', label: 'Buzón de Voz' },
                    { value: 'equivocado', label: 'Número Equivocado' }
                ],
                default: 'contestó',
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
            email: {
                autoState: 'contacto',
                states: [
                    { value: 'enviado', label: 'Email Enviado' },
                    { value: 'respondido', label: 'Email Respondido' },
                    { value: 'rebotado', label: 'Email Rebotado' },
                    { value: 'no_responde', label: 'Sin Respuesta' }
                ],
                default: 'enviado',
                fields: [
                    {
                        id: 'emailSubject',
                        label: 'Asunto',
                        type: 'text'
                    },
                    {
                        id: 'emailStatus',
                        label: 'Estado del email',
                        type: 'select',
                        options: [
                            { value: 'enviado', label: 'Enviado' },
                            { value: 'respondido', label: 'Respondido' },
                            { value: 'rebotado', label: 'Rebotado' },
                            { value: 'no_responde', label: 'Sin Respuesta' }
                        ]
                    }
                ]
            },
            mensaje: {
                autoState: 'contacto',
                states: [
                    { value: 'enviado', label: 'Mensaje Enviado' },
                    { value: 'entregado', label: 'Mensaje Entregado' },
                    { value: 'leido', label: 'Mensaje Leído' },
                    { value: 'respondido', label: 'Mensaje Respondido' },
                    { value: 'no_entregado', label: 'No Entregado' }
                ],
                default: 'enviado',
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
                            { value: 'no_entregado', label: 'No entregado' }
                        ]
                    }
                ]
            },
            nota: {
                autoState: null,
                states: [],
                default: '',
                fields: []
            }
        }

        this.mobileInteractions = new MobileInteractionManager(this);
        this.notificationSystem = new NotificationSystem();
        this.init();
    }

    /**
     * Inicializa el LeadManager
     * 1) Verifica si la sesión en el servidor sigue activa
     * 2) Carga los leads y configura el tablero
     */
    async init() {
        try {
            console.log('Iniciando LeadManager');
            
            // Cargar leads
            const loaded = await this.loadLeads();
            if (!loaded) {
                throw new Error('No se pudieron cargar los leads. Posible sesión inválida.');
            }

            // Inicializar componentes
            this.initializeBoard();
            this.initializeEventListeners();
            this.reminderSystem.initializeReminders();
            
            return true;
        } catch (error) {
            console.error('Error en inicialización:', error);
            return false;
        }
    }

    /**
     * Obtiene la lista de leads desde el servidor
     */
    async loadLeads() {
        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'  // <--- Enviamos cookie de sesión
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

    /**
     * Obtiene las propiedades para mostrarlas en el modal de "Nuevo Lead"
     */
    async loadProperties() {
        try {
            const response = await fetch(`${this.API_ENDPOINT}?action=properties`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'  // <--- Enviamos cookie de sesión
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Sesión expirada o inválida');
                }
                throw new Error('Error al cargar propiedades');
            }

            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error cargando propiedades:', error);
            return [];
        }
    }

    /**
     * Configura el tablero Kanban (columnas) según los estados
     */
    initializeBoard() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        board.innerHTML = '';

        if (!Array.isArray(this.leads)) {
            this.leads = [];
        }

        Object.entries(this.states).forEach(([state, title]) => {
            const leadsInState = this.leads.filter(lead => 
                lead && lead.status && lead.status.toLowerCase() === state
            );
            const column = this.createColumn(state, title, leadsInState);
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

        // Evento de arrastre (drag & drop)
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
    
        // Usar directamente los valores de la base de datos
        const scoreData = {
            score: lead.score || 0,
            temperature: lead.temperature || 'cold',
            interactionScore: lead.interaction_score || 0,
            qualityScore: lead.quality_score || 0,
            behaviorScore: lead.behavior_score || 0,
            responseTimeScore: lead.response_time_score || 0,
            decayFactor: lead.decay_factor || 1.00
        };
    
        const temperatureColor = this.scoringSystem.getTemperatureColor(scoreData.temperature);
        const temperatureIcon = this.scoringSystem.getTemperatureIcon(scoreData.temperature);
    
        // Determinar el título de la propiedad a mostrar
        let propertyTitle = 'Sin propiedad asignada';
        if (lead.property_id && lead.original_property_title) {
            propertyTitle = lead.original_property_title;
        } else if (lead.property_title) {
            propertyTitle = lead.property_title;
        }
    
        card.innerHTML = `
            <div class="flex flex-col gap-2">
                <!-- Cabecera con nombre y temperatura -->
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span class="font-medium">${lead.name}</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-1 rounded-full" style="background-color: ${temperatureColor}20">
                        <span class="text-sm" style="color: ${temperatureColor}">${temperatureIcon}</span>
                        <span class="text-xs font-medium" style="color: ${temperatureColor}">${scoreData.score}%</span>
                    </div>
                </div>

                <!-- Detalles de contacto -->
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
                        ${propertyTitle}
                    </div>
                </div>

                <!-- Estado y acciones -->
                <div class="flex flex-col gap-2 mt-2">
                    <div class="flex items-center">
                        <span class="status-badge">${this.states[lead.status] || lead.status}</span>
                    </div>
                    <button class="text-white text-sm flex items-center gap-1 w-full justify-center py-2 rounded-lg mb-color-principal mb-color-principal:hover">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Ver detalles
                    </button>
                    <div class="text-xs text-gray-500 text-center mt-2 pt-2 border-t">
                        Última interacción: ${this.formatDateTime(lead.last_activity_date || lead.updated_at || lead.created_at)}
                    </div>
                </div>
            </div>
        `;
    
        // Prevenir que el drag and drop se active al hacer clic en los botones
        const button = card.querySelector('button');
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.detailView.show(lead.id);
        });
    
        // Añadir evento de clic a toda la tarjeta
        card.addEventListener('click', (e) => {
            // No mostrar el detalle si estamos arrastrando
            if (!this.draggedItem && e.target !== button) {
                this.detailView.show(lead.id);
            }
        });
    
        // Eventos para drag and drop
        card.addEventListener('dragstart', (e) => {
            this.draggedItem = card;
            card.classList.add('dragging');
            // Añadir un pequeño delay para que se vea el efecto visual
            setTimeout(() => {
                card.classList.add('opacity-50');
            }, 0);
        });
    
        card.addEventListener('dragend', (e) => {
            card.classList.remove('dragging', 'opacity-50');
            this.draggedItem = null;
        });
    
        // Añadir efectos hover
        card.addEventListener('mouseenter', () => {
            if (!this.draggedItem) {
                card.classList.add('hover:shadow-lg');
                card.style.transform = 'translateY(-2px)';
            }
        });
    
        card.addEventListener('mouseleave', () => {
            card.classList.remove('hover:shadow-lg');
            card.style.transform = 'translateY(0)';
        });
    
        return card;
    }

    // Añadir métodos para el nuevo modal
    showDetailModal(leadId) {
        const lead = this.leads.find(l => l.id == leadId);
        if (!lead) return;

        // Usar directamente los valores de la base de datos
        const scoreData = {
            score: lead.score || 0,
            temperature: lead.temperature || 'cold',
            interactionScore: lead.interaction_score || 0,
            qualityScore: lead.quality_score || 0,
            behaviorScore: lead.behavior_score || 0,
            responseTimeScore: lead.response_time_score || 0,
            decayFactor: lead.decay_factor || 1.00
        };

        const temperatureColor = this.scoringSystem.getTemperatureColor(scoreData.temperature);

        // Actualizar la vista detallada con los datos correctos
        document.getElementById('leadDetailScore').innerHTML = `
            <div class="temperature-container bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 class="font-semibold mb-4 text-gray-700">Temperatura del Lead</h3>
                <div class="space-y-4">
                    <div class="flex items-center gap-4">
                        <div class="text-3xl" style="color: ${temperatureColor}">
                            ${this.scoringSystem.getTemperatureIcon(scoreData.temperature)}
                        </div>
                        <div class="flex-1">
                            <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full transition-all duration-500" 
                                    style="width: ${scoreData.score}%; background-color: ${temperatureColor}">
                                </div>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span class="text-sm font-medium" style="color: ${temperatureColor}">
                                    ${scoreData.score}%
                                </span>
                                <span class="text-sm text-gray-500">
                                    ${scoreData.temperature.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">Interacción</div>
                            <div class="font-medium">${scoreData.interactionScore}/40</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Calidad</div>
                            <div class="font-medium">${scoreData.qualityScore}/25</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Comportamiento</div>
                            <div class="font-medium">${scoreData.behaviorScore}/15</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Respuesta</div>
                            <div class="font-medium">${scoreData.responseTimeScore}/20</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.detailView.show(leadId);
    }

    closeDetailModal() {
        this.detailView.close();
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
        const currentLead = this.leads.find(l => l.id == leadId);
        const oldStatus = currentLead?.status;
    
        try {
            // Determinar el tipo de actividad basado en el estado
            let activityType = 'documentation';
            switch (newStatus) {
                case 'contacto':
                    activityType = 'first_contact';
                    break;
                case 'visita':
                    activityType = 'visit';
                    break;
                case 'negociacion':
                    activityType = 'negotiation';
                    break;
                case 'cerrado':
                    activityType = 'closing';
                    break;
            }
    
            const updateData = {
                id: leadId,
                status: newStatus,
                old_status: oldStatus,
                activity_type: activityType,
                description: `Cambio de estado de ${this.states[oldStatus]} a ${this.states[newStatus]}`,
                register_activity: true, // Flag para indicar que debe registrarse como actividad
            };
    
            const response = await fetch(this.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
    
            const responseText = await response.text();
            let result;
    
            try {
                result = responseText ? JSON.parse(responseText) : { success: false };
            } catch (error) {
                console.error('Error parsing response:', responseText);
                throw new Error('Invalid server response');
            }
    
            if (result.success) {
                await this.loadLeads();
                this.initializeBoard();
                this.showNotification(`Lead movido a ${this.states[newStatus]}`, 'success');
            } else {
                throw new Error(result.message || 'Error al actualizar el estado');
            }
        } catch (error) {
            console.error('Error en la actualización:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
            
            await this.loadLeads();
            this.initializeBoard();
        }
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

        // Click fuera de modales para cerrarlos
        window.addEventListener('click', (e) => {
            const updateModal = document.getElementById('leadUpdateModal');
            const detailModal = document.getElementById('leadDetailModal');
            const newLeadModal = document.getElementById('newLeadModal');
    
            if (e.target === updateModal) {
                this.closeUpdateModal();
            } else if (e.target === detailModal) {
                this.detailView.close();
            } else if (e.target === newLeadModal) {
                this.closeNewLeadModal();
            }
        });

        // Inicializar eventos táctiles para móvil
        this.initializeTouchEvents();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const updateModal = document.getElementById('leadUpdateModal');
                const detailModal = document.getElementById('leadDetailModal');
                
                if (updateModal?.style.display === 'flex') {
                    this.closeUpdateModal();
                } else if (detailModal?.style.display === 'flex') {
                    this.detailView.close();
                } else {
                    this.closeNewLeadModal();
                }
            }
        });

        // Eventos para notificaciones del sistema
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            this.requestNotificationPermission();
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notificaciones activadas');
            }
        } catch (error) {
            console.error('Error al solicitar permisos de notificación:', error);
        }
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

    /**
     * Modal para crear un nuevo Lead
     */
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
                    // Cargar propiedades
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
        const lead = leadId ? 
            this.leads.find(l => l.id == leadId) : 
            this.detailView.currentLead;
    
        if (!lead) return;
    
        const updateModal = document.getElementById('leadUpdateModal');
        if (!updateModal) return;
    
        // Actualizar el select de tipo de actividad para excluir la opción de visita
        const activityTypeSelect = document.getElementById('updateType');
        if (activityTypeSelect) {
            activityTypeSelect.innerHTML = `
                <option value="none">Seleccione tipo de actividad</option>
                <option value="llamada">Llamada</option>
                <option value="email">Email</option>
                <option value="mensaje">Mensaje</option>
                <option value="nota">Nota</option>
            `;
        }
    
        // Resto del código del modal permanece igual
        document.getElementById('updateLeadId').value = lead.id;
        document.getElementById('leadInfoName').textContent = lead.name;
        document.getElementById('leadInfoProperty').textContent = lead.property_title || 'Sin propiedad';
        document.getElementById('leadInfoStatus').textContent = lead.status;
        
        document.getElementById('updateDateTime').value = new Date().toISOString().slice(0, 16);
        
        this.updateRecentHistory(lead);
    
        const detailModal = document.getElementById('leadDetailModal');
        if (detailModal && detailModal.style.display === 'flex') {
            detailModal.classList.add('modal-overlay');
        }
    
        updateModal.style.display = 'flex';
    }   

    closeUpdateModal() {
        const modal = document.getElementById('leadUpdateModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('leadUpdateForm')?.reset();
            document.getElementById('additionalFields').innerHTML = '';
    
            // Remover clase overlay del modal de detalles
            const detailModal = document.getElementById('leadDetailModal');
            if (detailModal) {
                detailModal.classList.remove('modal-overlay');
            }
        }
    }

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        
        // Crear objeto Date desde el string
        const date = new Date(dateStr);
        
        // Restar 6 horas
        date.setHours(date.getHours() - 6);
        
        // Configurar opciones para el formato
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        
        // Usar el locale es-MX sin especificar zona horaria
        return new Intl.DateTimeFormat('es-MX', options).format(date);
    }

    updateStatusByActivity(activityType) {
        const statusSelect = document.getElementById('updateStatus');
        const config = this.activityTypes[activityType];
        const leadId = document.getElementById('updateLeadId').value;
        const lead = this.leads.find(l => l.id == leadId);
        
        statusSelect.innerHTML = '';
        
        if (config) {
            if (config.autoState) {
                const option = document.createElement('option');
                option.value = config.autoState;
                option.textContent = `${this.states[config.autoState]} (Automático)`;
                option.selected = true;
                statusSelect.appendChild(option);
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = `Mantener estado actual (${lead?.status || 'Sin estado'})`;
                option.selected = true;
                statusSelect.appendChild(option);
            }
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
    
        // Parsear las actividades y updates que vienen como strings JSON
        const activities = lead.activities ? JSON.parse(lead.activities) : [];
        const updates = lead.updates ? JSON.parse(lead.updates) : [];
    
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

    /**
     * Maneja la creación de un nuevo Lead (POST)
     */
    async handleNewLead(e) {
        e.preventDefault();

        try {
            const form = e.target;
            
            const propertySelectValue = form.querySelector('#newLeadProperty').value;
            const manualPropertyTitle = form.querySelector('#manualPropertyTitle');
            const manualPropertyDetails = form.querySelector('#manualPropertyDetails');

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

            const data = {
                name: form.querySelector('#newLeadName').value.trim(),
                email: form.querySelector('#newLeadEmail').value.trim(),
                phone: form.querySelector('#newLeadPhone').value.trim(),
                message: form.querySelector('#newLeadNotes')?.value?.trim() || null,
                status: 'nuevo',
                contact_preference: 'email',
                country_code: '+52',
                source: 'web',
                priority: 'media',
                urgency: 'medium',
                assigned_to: null, // O a quien corresponda
                ...propertyData
            };

            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // <--- Enviamos cookie de sesión
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

    /**
     * Maneja la actualización de un Lead (PUT)
     */
    async handleLeadUpdate(e) {
        e.preventDefault();

        const leadId = document.getElementById('updateLeadId').value;
        const activityType = document.getElementById('updateType').value;
        const updateDateTime = document.getElementById('updateDateTime').value;
        const propertyDescription = document.getElementById('updateDescription').value;
        
        // Obtener el estado automático si existe
        const config = this.activityTypes[activityType];
        const autoState = config?.autoState;
        
        // Usar el estado automático o el seleccionado manualmente
        const newStatus = autoState || document.getElementById('updateStatus').value;

        // Recopilar datos de sub-estado
        const subState = this.collectSubStateData(activityType);

        const updateData = {
            id: leadId,
            activity_type: activityType !== 'none' ? activityType : null,
            property_description: propertyDescription,
            status: newStatus || null,
            sub_state: subState,
            activity_date: updateDateTime,
            activity_data: activityType !== 'none' ? this.collectActivityData(activityType) : null
        };

        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
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

    collectSubStateData(activityType) {
        const config = this.activityTypes[activityType];
        if (!config) return null;

        // Recopilar el sub-estado según el tipo de actividad
        switch (activityType) {
            case 'llamada':
                return document.getElementById('callResult')?.value;
            case 'visita':
                return document.getElementById('visitStatus')?.value;
            case 'email':
                return document.getElementById('emailStatus')?.value;
            case 'mensaje':
                return document.getElementById('messageStatus')?.value;
            default:
                return null;
        }
    }

    showNotification(message, type = 'info') {
        this.notificationSystem.show(message, type);
    }

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        
        // Crear objeto Date desde el string
        const date = new Date(dateStr);
        
        // Restar 6 horas
        date.setHours(date.getHours() - 6);
        
        // Configurar opciones para el formato
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        
        // Usar el locale es-MX sin especificar zona horaria
        return new Intl.DateTimeFormat('es-MX', options).format(date);
    }
}

window.leadManager = null;

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

function closeLeadDetailModal() {
    if (window.leadManager) {
        window.leadManager.detailView.close();
    }
}

// Modificar la inicialización de LeadManager para incluir el calendario
document.addEventListener('DOMContentLoaded', () => {
    window.leadManager = new LeadManager();
    window.appointmentCalendar = new AppointmentCalendar(window.leadManager);
    
    // Exponer funciones globalmente
    window.showNewLeadModal = showNewLeadModal;
    window.closeNewLeadModal = closeNewLeadModal;
    window.closeLeadUpdateModal = closeLeadUpdateModal;
    window.closeLeadDetailModal = closeLeadDetailModal;
    window.showCalendarModal = showCalendarModal;
    window.closeCalendarModal = closeCalendarModal;
});
