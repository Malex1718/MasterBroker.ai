// Declarar la clase en el ámbito global
var CalendarioFullScreen;

function inicializarCalendarioFullScreen() {
    if (typeof CalendarioMejorado === 'undefined') {
      console.log('Esperando a que CalendarioMejorado esté disponible...');
      setTimeout(inicializarCalendarioFullScreen, 500);
      return;
    }

    /**
     * CalendarioFullScreen - Versión mejorada del calendario que ocupa toda la pantalla
     * y muestra las citas de manera más eficiente, similar a Google Calendar
     */
    CalendarioFullScreen = class extends CalendarioMejorado {
        constructor(leadManager) {
        super(leadManager);
        
        // Referencias adicionales
        this.fullscreenContainer = null;
        this.originalParent = null;
        this.isFullscreen = false;
        
        // Número máximo de citas a mostrar antes de colapsar
        this.maxAppointmentsVisible = 2;
        
        // Extender plantillas
        this.plantillas = {
            ...this.plantillas,
            
            // Actualizar la plantilla para visitas colapsadas
            itemCitaColapsado: (citas) => {
            return `
                <div class="more-appointments" data-count="${citas.length}">
                <div class="more-appointments-text">
                    +${citas.length} citas más
                </div>
                </div>
            `;
            },
            
            // Plantilla para modal de citas colapsadas
            modalCitasColapsadas: (citas, fecha) => {
            const formatoFecha = new Date(fecha).toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            return `
                <div class="collapsed-appointments-modal">
                <div class="collapsed-modal-header">
                    <h3>${formatoFecha}</h3>
                    <button class="close-collapsed-modal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    </button>
                </div>
                <div class="collapsed-modal-body">
                    ${citas.map(cita => {
                    const esVirtual = cita.meetLink || (cita.description && cita.description.includes('virtual'));
                    return `
                        <div class="collapsed-appointment-item status-${cita.status} ${esVirtual ? 'virtual' : ''}" data-appointment-id="${cita.id}">
                        <div class="appointment-time">${this.formatTime(cita.date)}</div>
                        <div class="appointment-details">
                            <div class="appointment-name">${cita.leadName}</div>
                            <div class="appointment-property">${cita.propertyTitle || 'Sin propiedad'}</div>
                        </div>
                        <div class="appointment-actions">
                            <button class="view-appointment-btn" data-id="${cita.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            Ver
                            </button>
                        </div>
                        </div>
                    `;
                    }).join('')}
                </div>
                </div>
            `;
            },
            
            // Plantilla para barra de herramientas superior en modo fullscreen
            barraHerramientas: () => {
            return `
                <div class="calendar-toolbar">
                <div class="calendar-toolbar-left">
                    <button id="exitFullscreenBtn" class="toolbar-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Volver
                    </button>
                    <button id="todayBtn" class="toolbar-btn">Hoy</button>
                    <div class="navigation-controls">
                    <button id="prevMonthFullscreen" class="toolbar-btn-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                    <h2 id="currentMonthDisplayFullscreen">Marzo 2025</h2>
                    <button id="nextMonthFullscreen" class="toolbar-btn-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                    </div>
                </div>
                
                <div class="calendar-toolbar-right">
                    <div class="view-selector">
                    <button id="viewDayFullscreen" class="view-btn">Día</button>
                    <button id="viewWeekFullscreen" class="view-btn">Semana</button>
                    <button id="viewMonthFullscreen" class="view-btn active">Mes</button>
                    </div>
                    <button id="newVisitBtnFullscreen" class="new-visit-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Nueva Visita
                    </button>
                </div>
                </div>
            `;
            }
        };
        
        this.showFullscreen = this.showFullscreen.bind(this);
        this.exitFullscreen = this.exitFullscreen.bind(this);
        }

        refreshCalendarDisplay() {
            // Actualizar el calendario principal
            this.renderFullscreenCalendar();
            
            // Actualizar el mini calendario si existe
            if (typeof this.renderMiniCalendar === 'function') {
              this.renderMiniCalendar();
            }
            
            // Actualizar eventos próximos si existe
            if (typeof this.loadUpcomingEvents === 'function') {
              this.loadUpcomingEvents();
            }
            
            // Cerrar cualquier modal abierto de detalles
            const detailsPanel = document.getElementById('appointmentDetailsFullscreen');
            if (detailsPanel && !detailsPanel.classList.contains('hidden')) {
              detailsPanel.classList.add('hidden');
            }
            
            // Cerrar cualquier modal de citas colapsadas
            const collapsedModal = document.getElementById('collapsedAppointmentsModal');
            if (collapsedModal && !collapsedModal.classList.contains('hidden')) {
              collapsedModal.classList.add('hidden');
            }
            
            // Mostrar notificación de actualización
            this.showUpdateNotification('Calendario actualizado');
        }
        
        /**
         * Reemplazar el método de inicialización de eventos
         */
        initEventListeners() {
        super.initEventListeners();
        
        // Agregar botón para mostrar modo fullscreen al modal actual
        const modalHeader = document.querySelector('#calendarModal .modal-content > div:first-child');
        if (modalHeader) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'text-gray-500 hover:text-gray-700 ml-auto mr-2';
            fullscreenBtn.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
            </svg>
            `;
            fullscreenBtn.addEventListener('click', this.showFullscreen);
            
            // Insertar entre el título y el botón de cerrar
            modalHeader.insertBefore(fullscreenBtn, modalHeader.lastElementChild);
        }
        }
        
        /**
         * Muestra el calendario en modo pantalla completa
         */
        showFullscreen() {
        // Ocultar el modal actual
        const calendarModal = document.getElementById('calendarModal');
        if (calendarModal) {
            calendarModal.style.display = 'none';
        }
        
        // Crear contenedor de pantalla completa si no existe
        if (!this.fullscreenContainer) {
            this.fullscreenContainer = document.createElement('div');
            this.fullscreenContainer.id = 'calendarFullscreen';
            this.fullscreenContainer.className = 'calendar-fullscreen';
            document.body.appendChild(this.fullscreenContainer);
        }
        
        // Guardar referencia al contenedor original
        this.originalParent = this.calendarView.parentElement.parentElement.parentElement;
        
        // Agregar estructura básica al contenedor fullscreen
        this.fullscreenContainer.innerHTML = `
            <div class="calendar-fullscreen-container">
            ${this.plantillas.barraHerramientas()}
            <div class="calendar-main-view">
                <div class="sidebar-container">
                <div class="mini-calendar">
                    <!-- Mini calendario para selección rápida de fechas -->
                    <div class="mini-month-header">
                    <span id="miniMonthDisplay">Marzo 2025</span>
                    </div>
                    <div class="mini-calendar-grid" id="miniCalendarGrid">
                    <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                
                <div class="upcoming-events">
                    <h3>Próximas visitas</h3>
                    <div id="upcomingEventsContainer">
                    <!-- Se llenará dinámicamente -->
                    </div>
                </div>
                </div>
                
                <div class="main-calendar-container">
                <div class="main-calendar-header">
                    <div class="day-header">Dom</div>
                    <div class="day-header">Lun</div>
                    <div class="day-header">Mar</div>
                    <div class="day-header">Mié</div>
                    <div class="day-header">Jue</div>
                    <div class="day-header">Vie</div>
                    <div class="day-header">Sáb</div>
                </div>
                <div id="calendarFullscreenView" class="main-calendar-grid">
                    <!-- Se llenará dinámicamente -->
                </div>
                </div>
            </div>
            </div>
            
            <!-- Panel de detalles flotante -->
            <div id="appointmentDetailsFullscreen" class="appointment-details-fullscreen hidden">
            <div class="appointment-details-header">
                <h3>Detalles de la visita</h3>
                <button class="close-details-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                </button>
            </div>
            <div id="appointmentContentFullscreen"></div>
            </div>
            
            <!-- Modal para citas colapsadas -->
            <div id="collapsedAppointmentsModal" class="collapsed-modal hidden">
            <!-- Se llenará dinámicamente -->
            </div>
        `;
        
        // Mostrar el contenedor de pantalla completa
        this.fullscreenContainer.style.display = 'block';
        this.isFullscreen = true;
        
        // Actualizar referencia al contenedor de vista del calendario
        this.calendarViewFullscreen = document.getElementById('calendarFullscreenView');
        
        // Inicializar eventos del modo fullscreen
        this.initFullscreenEventListeners();
        
        // Renderizar el calendario en modo fullscreen
        this.renderFullscreenCalendar();
        
        // Renderizar el mini calendario
        this.renderMiniCalendar();
        
        // Cargar próximas visitas
        this.loadUpcomingEvents();
        }
        
        /**
         * Inicializa los event listeners para el modo fullscreen
         */
        initFullscreenEventListeners() {
        // Botón para salir del modo fullscreen
        document.getElementById('exitFullscreenBtn').addEventListener('click', this.exitFullscreen);
        
        // Botones de navegación
        document.getElementById('prevMonthFullscreen').addEventListener('click', () => {
            this.navigateMonth(-1);
            this.renderFullscreenCalendar();
            this.renderMiniCalendar();
        });
        
        document.getElementById('nextMonthFullscreen').addEventListener('click', () => {
            this.navigateMonth(1);
            this.renderFullscreenCalendar();
            this.renderMiniCalendar();
        });
        
        // Botón de hoy
        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderFullscreenCalendar();
            this.renderMiniCalendar();
        });
        
        // Botones de vista
        document.getElementById('viewDayFullscreen').addEventListener('click', () => this.changeFullscreenView('day'));
        document.getElementById('viewWeekFullscreen').addEventListener('click', () => this.changeFullscreenView('week'));
        document.getElementById('viewMonthFullscreen').addEventListener('click', () => this.changeFullscreenView('month'));
        
        // Botón de nueva visita
        document.getElementById('newVisitBtnFullscreen').addEventListener('click', () => {
            this.leadManager.scheduleVisit();
        });
        
        // Cerrar detalles de cita
        const closeDetailsBtn = document.querySelector('.close-details-btn');
        if (closeDetailsBtn) {
            closeDetailsBtn.addEventListener('click', () => {
            document.getElementById('appointmentDetailsFullscreen').classList.add('hidden');
            });
        }
        }
        
        /**
         * Cambia la vista en el modo fullscreen
         */
        changeFullscreenView(view) {
        this.currentView = view;
        
        // Actualizar botones de vista
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}Fullscreen`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // Renderizar la vista correspondiente
        this.renderFullscreenCalendar();
        }
        
        /**
         * Renderiza el calendario en modo fullscreen
         */
        renderFullscreenCalendar() {
        // Actualizar título del mes
        const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthDisplay = document.getElementById('currentMonthDisplayFullscreen');
        const miniMonthDisplay = document.getElementById('miniMonthDisplay');
        
        if (monthDisplay) {
            monthDisplay.textContent = `${nombresMeses[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }
        
        if (miniMonthDisplay) {
            miniMonthDisplay.textContent = `${nombresMeses[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }
        
        // Renderizar según la vista actual
        switch (this.currentView) {
            case 'day':
            this.renderDayViewFullscreen();
            break;
            case 'week':
            this.renderWeekViewFullscreen();
            break;
            case 'month':
            default:
            this.renderMonthViewFullscreen();
            break;
        }
        }
        
        /**
         * Renderiza la vista de mes en modo fullscreen
         */
        renderMonthViewFullscreen() {
        const calendarView = this.calendarViewFullscreen;
        if (!calendarView) return;
        
        // Limpiar vista
        calendarView.innerHTML = '';
        
        // Obtener el primer día del mes y el último
        const primerDia = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const ultimoDia = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Determinar el primer día a mostrar (puede ser del mes anterior)
        let fechaInicio = new Date(primerDia);
        fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay());
        
        // Determinar el último día a mostrar (puede ser del mes siguiente)
        let fechaFin = new Date(ultimoDia);
        const diasRestantes = 6 - fechaFin.getDay();
        fechaFin.setDate(fechaFin.getDate() + diasRestantes);
        
        // Crear todas las celdas para los días
        let fechaActual = new Date(fechaInicio);
        while (fechaActual <= fechaFin) {
            const celdaDia = document.createElement('div');
            celdaDia.className = 'day-cell';
            
            // Verificar si es un día del mes actual o de meses adyacentes
            if (fechaActual.getMonth() !== this.currentDate.getMonth()) {
            celdaDia.classList.add('adjacent-month');
            }
            
            // Verificar si es el día actual
            const esHoy = this.isSameDay(fechaActual, new Date());
            if (esHoy) {
            celdaDia.classList.add('today');
            }
            
            // Estructura interna de la celda
            celdaDia.innerHTML = `
            <div class="date-header">
                <span class="date-number">${fechaActual.getDate()}</span>
            </div>
            <div class="appointments-container"></div>
            `;
            
            const contenedorCitas = celdaDia.querySelector('.appointments-container');
            
            // Añadir citas del día
            const citasParaDia = this.getAppointmentsForDay(fechaActual);
            
            // Mostrar solo un número limitado de citas y colapsar el resto
            if (citasParaDia.length > this.maxAppointmentsVisible) {
            // Mostrar las primeras citas visibles
            for (let i = 0; i < this.maxAppointmentsVisible; i++) {
                this.renderAppointmentItem(citasParaDia[i], contenedorCitas);
            }
            
            // Añadir indicador de "más citas"
            const citasColapsadas = citasParaDia.slice(this.maxAppointmentsVisible);
            const moreElement = document.createElement('div');
            moreElement.className = 'more-appointments';
            moreElement.innerHTML = this.plantillas.itemCitaColapsado(citasColapsadas);
            moreElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showCollapsedAppointments(citasColapsadas, fechaActual);
            });
            
            contenedorCitas.appendChild(moreElement);
            } else {
            // Mostrar todas las citas
            citasParaDia.forEach(cita => {
                this.renderAppointmentItem(cita, contenedorCitas);
            });
            }
            
            // Evento para crear una nueva cita
            celdaDia.addEventListener('dblclick', (e) => {
            // Prevenir que se active al hacer clic en una cita existente
            if (!e.target.closest('.appointment-item') && !e.target.closest('.more-appointments')) {
                const nuevaFecha = new Date(fechaActual);
                this.createNewAppointment(nuevaFecha);
            }
            });
            
            calendarView.appendChild(celdaDia);
            
            // Avanzar al siguiente día
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        }
        
        /**
         * Renderiza un elemento de cita específico
         */
        renderAppointmentItem(cita, container) {
        const elementoCita = document.createElement('div');
        elementoCita.className = `appointment-item status-${cita.status}`;
        elementoCita.dataset.appointmentId = cita.id;
        
        // Verificar si es una visita virtual
        if (cita.meetLink || (cita.description && cita.description.includes('virtual'))) {
            elementoCita.classList.add('virtual');
        }
        
        elementoCita.innerHTML = this.plantillas.itemCita(cita);
        
        // Añadir event listeners
        elementoCita.addEventListener('click', (e) => {
            if (!e.target.closest('.actions')) {
            this.showAppointmentDetailsFullscreen(cita);
            }
        });
        
        // Configurar menú de acciones
        const toggleAcciones = elementoCita.querySelector('.actions-toggle');
        const menuAcciones = elementoCita.querySelector('.actions-menu');
        
        if (toggleAcciones && menuAcciones) {
            this.setupActionsMenu(toggleAcciones, menuAcciones, elementoCita, cita);
        }
        
        container.appendChild(elementoCita);
        }
        
        /**
         * Configura el menú de acciones para una cita
         */
        setupActionsMenu(toggleButton, menu, appointmentElement, appointment) {
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
            
            // Cerrar otros menús abiertos
            document.querySelectorAll('.actions-menu.show').forEach(otherMenu => {
            if (otherMenu !== menu) {
                otherMenu.classList.remove('show');
            }
            });
            
            // Cerrar menú al hacer clic fuera
            const closeMenu = (event) => {
            if (!menu.contains(event.target) && event.target !== toggleButton) {
                menu.classList.remove('show');
                document.removeEventListener('click', closeMenu);
            }
            };
            
            setTimeout(() => {
            document.addEventListener('click', closeMenu);
            }, 0);
        });
        
        // Configurar botones de acción
        menu.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const accion = btn.dataset.action;
            const citaId = appointmentElement.dataset.appointmentId;
            
            switch (accion) {
                case 'view':
                this.showAppointmentDetailsFullscreen(appointment);
                break;
                case 'complete':
                this.markAppointmentComplete(citaId);
                break;
                case 'reschedule':
                this.rescheduleAppointment(citaId);
                break;
                case 'cancel':
                this.cancelAppointment(citaId);
                break;
                case 'delete':
                this.deleteAppointmentPermanently(citaId);
                break;
            }
            
            menu.classList.remove('show');
            });
        });
        }
        
        /**
         * Muestra las citas colapsadas en un modal
         */
        showCollapsedAppointments(citas, fecha) {
        const modalContainer = document.getElementById('collapsedAppointmentsModal');
        if (!modalContainer) return;
        
        // Rellenar el modal con las citas
        modalContainer.innerHTML = this.plantillas.modalCitasColapsadas(citas, fecha);
        modalContainer.classList.remove('hidden');
        
        // Configurar evento de cierre
        const closeBtn = modalContainer.querySelector('.close-collapsed-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            });
        }
        
        // Configurar eventos para ver detalles de citas
        const viewButtons = modalContainer.querySelectorAll('.view-appointment-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
            const appointmentId = btn.dataset.id;
            const appointment = citas.find(cita => cita.id === appointmentId);
            if (appointment) {
                this.showAppointmentDetailsFullscreen(appointment);
                modalContainer.classList.add('hidden');
            }
            });
        });
        
        // Cerrar al hacer clic fuera del modal
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
            modalContainer.classList.add('hidden');
            }
        });
        }
        
        /**
         * Muestra los detalles de una cita en pantalla completa
         */
        showAppointmentDetailsFullscreen(cita) {
        const detallesContainer = document.getElementById('appointmentDetailsFullscreen');
        const contenidoContainer = document.getElementById('appointmentContentFullscreen');
        
        if (!detallesContainer || !contenidoContainer) return;
        
        // Mostrar los detalles en el panel
        contenidoContainer.innerHTML = this.plantillas.vistaDetalle(cita);
        detallesContainer.classList.remove('hidden');
        
        // Posicionar el panel de forma inteligente
        this.positionDetailsPanel(detallesContainer);
        }
        
        /**
         * Posiciona el panel de detalles de forma inteligente
         */
        positionDetailsPanel(panel) {
        // Obtener punto central de la pantalla
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Calcular posición centrada
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        
        // Si el panel es demasiado alto, ajustarlo al 90% de la altura de la ventana
        if (panelHeight > windowHeight * 0.9) {
            panel.style.height = `${windowHeight * 0.9}px`;
            panel.style.top = `${windowHeight * 0.05}px`;
        } else {
            panel.style.top = `${(windowHeight - panelHeight) / 2}px`;
        }
        
        // Asegurar que el panel esté dentro de los límites de la pantalla
        panel.style.left = `${Math.max(20, (windowWidth - panelWidth) / 2)}px`;
        }
        
        /**
         * Renderiza la vista de día en modo fullscreen
         */
        renderDayViewFullscreen() {
        const calendarView = this.calendarViewFullscreen;
        if (!calendarView) return;
        
        // En esta implementación, mostraremos un mensaje de "Vista no implementada"
        // y se mostrará la vista de mes. En una implementación completa, 
        // debería mostrar la vista de día con horas.
        calendarView.innerHTML = `
            <div class="day-view-container">
            <div class="info-message">
                <p>La vista de día está en desarrollo. Mostrando vista de mes.</p>
            </div>
            </div>
        `;
        
        // Volver a vista de mes después de mostrar mensaje
        setTimeout(() => {
            this.renderMonthViewFullscreen();
        }, 1500);
        }
        
        /**
         * Renderiza la vista de semana en modo fullscreen
         */
        renderWeekViewFullscreen() {
        const calendarView = this.calendarViewFullscreen;
        if (!calendarView) return;
        
        // En esta implementación, mostraremos un mensaje de "Vista no implementada"
        // y se mostrará la vista de mes. En una implementación completa, 
        // debería mostrar la vista de semana con días y horas.
        calendarView.innerHTML = `
            <div class="week-view-container">
            <div class="info-message">
                <p>La vista de semana está en desarrollo. Mostrando vista de mes.</p>
            </div>
            </div>
        `;
        
        // Volver a vista de mes después de mostrar mensaje
        setTimeout(() => {
            this.renderMonthViewFullscreen();
        }, 1500);
        }
        
        /**
         * Renderiza el mini calendario para navegación rápida
         */
        renderMiniCalendar() {
        const miniCalendarGrid = document.getElementById('miniCalendarGrid');
        if (!miniCalendarGrid) return;
        
        // Limpiar el mini calendario
        miniCalendarGrid.innerHTML = '';
        
        // Obtener el primer día del mes y el último
        const primerDia = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const ultimoDia = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Determinar el primer día a mostrar (puede ser del mes anterior)
        let fechaInicio = new Date(primerDia);
        fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay());
        
        // Determinar el último día a mostrar (puede ser del mes siguiente)
        let fechaFin = new Date(ultimoDia);
        const diasRestantes = 6 - fechaFin.getDay();
        fechaFin.setDate(fechaFin.getDate() + diasRestantes);
        
        // Crear encabezados de días
        const diasSemana = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        diasSemana.forEach(dia => {
            const diaElement = document.createElement('div');
            diaElement.className = 'mini-day-header';
            diaElement.textContent = dia;
            miniCalendarGrid.appendChild(diaElement);
        });
        
        // Crear todas las celdas para los días
        let fechaActual = new Date(fechaInicio);
        while (fechaActual <= fechaFin) {
            const celdaDia = document.createElement('div');
            celdaDia.className = 'mini-day-cell';
            
            // Verificar si es un día del mes actual o de meses adyacentes
            if (fechaActual.getMonth() !== this.currentDate.getMonth()) {
            celdaDia.classList.add('adjacent-month');
            }
            
            // Verificar si es el día actual
            const esHoy = this.isSameDay(fechaActual, new Date());
            if (esHoy) {
            celdaDia.classList.add('today');
            }
            
            // Añadir el número del día
            celdaDia.textContent = fechaActual.getDate();
            
            // Verificar si hay citas en este día
            const hayCitas = this.getAppointmentsForDay(fechaActual).length > 0;
            if (hayCitas) {
            celdaDia.classList.add('has-appointments');
            }
            
            // Evento para seleccionar el día
            celdaDia.addEventListener('click', () => {
            // Si hacemos clic en un día, actualizar la fecha seleccionada
            this.currentDate = new Date(fechaActual);
            this.renderFullscreenCalendar();
            this.renderMiniCalendar();
            });
            
            miniCalendarGrid.appendChild(celdaDia);
            
            // Avanzar al siguiente día
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        }
        
        /**
         * Carga y muestra las próximas visitas
         */
        loadUpcomingEvents() {
        const container = document.getElementById('upcomingEventsContainer');
        if (!container) return;
        
        // Filtrar solo las próximas citas (a partir de hoy)
        const ahora = new Date();
        const proximasCitas = this.appointments
            .filter(cita => {
            const fechaCita = new Date(cita.date);
            return fechaCita >= ahora && ['programada', 'reprogramada'].includes(cita.status);
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5); // Mostrar solo las 5 más próximas
        
        if (proximasCitas.length === 0) {
            container.innerHTML = `
            <div class="empty-events">
                <p>No hay visitas programadas próximamente</p>
            </div>
            `;
            return;
        }
        
        // Agrupar citas por día
        const citasPorDia = {};
        proximasCitas.forEach(cita => {
            const fechaCita = new Date(cita.date);
            const fechaKey = fechaCita.toISOString().split('T')[0];
            
            if (!citasPorDia[fechaKey]) {
            citasPorDia[fechaKey] = [];
            }
            
            citasPorDia[fechaKey].push(cita);
        });
        
        // Crear HTML para las próximas citas
        let upcomingHTML = '';
        
        Object.keys(citasPorDia).forEach(fechaKey => {
            const fecha = new Date(fechaKey);
            const hoy = this.isSameDay(fecha, new Date());
            const manana = this.isSameDay(fecha, new Date(new Date().setDate(new Date().getDate() + 1)));
            
            let encabezadoDia;
            if (hoy) {
            encabezadoDia = 'Hoy';
            } else if (manana) {
            encabezadoDia = 'Mañana';
            } else {
            encabezadoDia = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            }
            
            upcomingHTML += `
            <div class="upcoming-day">
                <h4>${encabezadoDia}</h4>
                <div class="upcoming-day-events">
            `;
            
            citasPorDia[fechaKey].forEach(cita => {
            const esVirtual = cita.meetLink || (cita.description && cita.description.includes('virtual'));
            
            upcomingHTML += `
                <div class="upcoming-event-item ${esVirtual ? 'virtual' : ''}" data-id="${cita.id}">
                <div class="upcoming-event-time">${this.formatTime(cita.date)}</div>
                <div class="upcoming-event-details">
                    <div class="upcoming-event-name">${cita.leadName}</div>
                    <div class="upcoming-event-property">${cita.propertyTitle || 'Sin propiedad'}</div>
                </div>
                </div>
            `;
            });
            
            upcomingHTML += `
                </div>
            </div>
            `;
        });
        
        container.innerHTML = upcomingHTML;
        
        // Añadir eventos para mostrar detalles al hacer clic
        container.querySelectorAll('.upcoming-event-item').forEach(item => {
            item.addEventListener('click', () => {
            const citaId = item.dataset.id;
            const cita = this.appointments.find(c => c.id === citaId);
            if (cita) {
                this.showAppointmentDetailsFullscreen(cita);
            }
            });
        });
        }
         
        showUpdateNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'calendar-update-notification';
            notification.innerHTML = `
              <div class="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-blue-700 text-sm">${message}</span>
              </div>
            `;
            
            // Estilos para la notificación
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.zIndex = '9999';
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease-in-out';
            
            document.body.appendChild(notification);
            
            // Aparecer
            setTimeout(() => {
              notification.style.opacity = '1';
            }, 10);
            
            // Desaparecer después de 2 segundos
            setTimeout(() => {
              notification.style.opacity = '0';
              notification.addEventListener('transitionend', () => {
                notification.remove();
              });
            }, 2000);
        }
        
        /**
         * Sale del modo pantalla completa
         */
        exitFullscreen() {
            if (!this.isFullscreen || !this.fullscreenContainer) return;
            
            // Ocultar y limpiar el contenedor de pantalla completa
            this.fullscreenContainer.style.display = 'none';
            this.fullscreenContainer.innerHTML = '';
            this.isFullscreen = false;
            
            // No mostrar el modal original
            // Eliminamos o comentamos estas líneas:
            // const calendarModal = document.getElementById('calendarModal');
            // if (calendarModal) {
            //     calendarModal.style.display = 'flex';
            //     this.renderCalendar();
            // }
            
            // Si necesitamos actualizar algo más al salir del modo pantalla completa
            // podemos hacerlo aquí
        }
    }
    
    /**
     * Función para añadir CSS personalizado para el calendario fullscreen
     */
    function addCalendarFullscreenStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = 'calendar-fullscreen-styles';
        styleElement.textContent = `
        /* Estilos para el modo fullscreen */
        .calendar-fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #ffffff;
            z-index: 9999;
            overflow: hidden;
            display: none;
        }
        
        .calendar-fullscreen-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }
        
        /* Barra de herramientas superior */
        .calendar-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1.5rem;
            border-bottom: 1px solid #e5e7eb;
            background-color: #ffffff;
        }
        
        .calendar-toolbar-left,
        .calendar-toolbar-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .navigation-controls {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .navigation-controls h2 {
            font-size: 1.25rem;
            font-weight: 500;
            margin: 0 0.5rem;
        }
        
        .toolbar-btn {
            padding: 0.5rem 0.75rem;
            border-radius: 0.25rem;
            border: 1px solid #e5e7eb;
            background-color: #ffffff;
            font-size: 0.875rem;
            color: #374151;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .toolbar-btn-icon {
            padding: 0.375rem;
            border-radius: 0.25rem;
            border: 1px solid #e5e7eb;
            background-color: #ffffff;
            color: #374151;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .toolbar-btn:hover,
        .toolbar-btn-icon:hover {
            background-color: #f3f4f6;
        }
        
        .view-selector {
            display: flex;
            border-radius: 0.25rem;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        }
        
        .view-btn {
            padding: 0.5rem 0.75rem;
            background-color: #ffffff;
            border: none;
            border-right: 1px solid #e5e7eb;
            font-size: 0.875rem;
            color: #374151;
            cursor: pointer;
        }
        
        .view-btn:last-child {
            border-right: none;
        }
        
        .view-btn:hover {
            background-color: #f3f4f6;
        }
        
        .view-btn.active {
            background-color: #e0e7ff;
            color: #4f46e5;
            font-weight: 500;
        }
        
        .new-visit-btn {
            padding: 0.5rem 0.75rem;
            border-radius: 0.25rem;
            background-color: #4f46e5;
            color: #ffffff;
            font-size: 0.875rem;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.375rem;
        }
        
        .new-visit-btn:hover {
            background-color: #4338ca;
        }
        
        /* Área principal del calendario */
        .calendar-main-view {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .sidebar-container {
            width: 250px;
            border-right: 1px solid #e5e7eb;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            background-color: #f9fafb;
            padding: 1rem;
        }
        
        .mini-calendar {
            margin-bottom: 1.5rem;
        }
        
        .mini-month-header {
            text-align: center;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #374151;
        }
        
        .mini-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 2px;
        }
        
        .mini-day-header {
            text-align: center;
            font-size: 0.75rem;
            color: #6b7280;
            padding: 0.25rem 0;
        }
        
        .mini-day-cell {
            text-align: center;
            padding: 0.25rem;
            font-size: 0.875rem;
            cursor: pointer;
            border-radius: 0.25rem;
            color: #374151;
        }
        
        .mini-day-cell:hover {
            background-color: #e5e7eb;
        }
        
        .mini-day-cell.adjacent-month {
            color: #9ca3af;
        }
        
        .mini-day-cell.today {
            background-color: #e0e7ff;
            color: #4f46e5;
            font-weight: 500;
        }
        
        .mini-day-cell.has-appointments {
            font-weight: 600;
            position: relative;
        }
        
        .mini-day-cell.has-appointments::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background-color: #4f46e5;
        }
        
        .upcoming-events {
            flex: 1;
        }
        
        .upcoming-events h3 {
            font-size: 1rem;
            font-weight: 500;
            margin-bottom: 0.75rem;
            color: #374151;
        }
        
        .upcoming-day {
            margin-bottom: 1rem;
        }
        
        .upcoming-day h4 {
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #4b5563;
        }
        
        .upcoming-day-events {
            display: flex;
            flex-direction: column;
            gap: 0.375rem;
        }
        
        .upcoming-event-item {
            display: flex;
            background-color: #ffffff;
            border-left: 3px solid #4f46e5;
            border-radius: 0.25rem;
            padding: 0.5rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            cursor: pointer;
            transition: all 0.15s ease;
        }
        
        .upcoming-event-item:hover {
            transform: translateX(2px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .upcoming-event-item.virtual {
            border-style: dashed;
        }
        
        .upcoming-event-time {
            font-weight: 600;
            font-size: 0.8rem;
            color: #4b5563;
            margin-right: 0.5rem;
            min-width: 3rem;
        }
        
        .upcoming-event-details {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .upcoming-event-name {
            font-size: 0.8rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 500;
        }
        
        .upcoming-event-property {
            font-size: 0.75rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #6b7280;
        }
        
        .empty-events {
            color: #6b7280;
            font-size: 0.875rem;
            text-align: center;
            margin-top: 1rem;
        }
        
        /* Contenedor principal del calendario */
        .main-calendar-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .main-calendar-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            border-bottom: 1px solid #e5e7eb;
            background-color: #f9fafb;
        }
        
        .main-calendar-header .day-header {
            padding: 0.75rem 0;
            text-align: center;
            font-weight: 500;
            color: #4b5563;
            border-right: 1px solid #f3f4f6;
        }
        
        .main-calendar-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-auto-rows: 1fr;
            overflow-y: auto;
        }
        
        .main-calendar-grid .day-cell {
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            padding: 0.25rem;
            position: relative;
            display: flex;
            flex-direction: column;
            min-height: 120px;
        }
        
        .main-calendar-grid .day-cell.adjacent-month {
            background-color: #f9fafb;
        }
        
        .main-calendar-grid .day-cell.today {
            background-color: #f0f7ff;
        }
        
        .main-calendar-grid .date-header {
            display: flex;
            justify-content: flex-end;
            padding: 0.25rem;
        }
        
        .main-calendar-grid .date-number {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 1.75rem;
            height: 1.75rem;
            font-weight: 500;
            color: #4b5563;
        }
        
        .main-calendar-grid .day-cell.today .date-number {
            background-color: #4f46e5;
            color: white;
            border-radius: 9999px;
        }
        
        .main-calendar-grid .appointments-container {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            padding: 0.25rem;
        }
        
        /* Estilo de citas */
        .appointment-item {
            display: flex;
            justify-content: space-between;
            background-color: #ffffff;
            border-left: 3px solid;
            border-radius: 0.25rem;
            padding: 0.5rem 0.5rem 0.5rem 0.75rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            cursor: pointer;
            transition: all 0.15s ease;
        }
        
        .appointment-item:hover {
            transform: translateX(2px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .appointment-item .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
        }
        
        .appointment-item .time {
            font-weight: 600;
            font-size: 0.75rem;
            color: #4b5563;
        }
        
        .appointment-item .name {
            font-size: 0.8rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 500;
        }
        
        .appointment-item .property {
            font-size: 0.75rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #6b7280;
        }
        
        .appointment-item .actions {
            display: flex;
            align-items: flex-start;
        }
        
        .appointment-item .actions-toggle {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
        }
        
        .appointment-item .actions-toggle:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }
        
        .appointment-item .actions-menu {
            position: absolute;
            right: 0;
            top: 100%;
            background-color: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.25rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 50;
            min-width: 150px;
            display: none;
        }
        
        .appointment-item .actions-menu.show {
            display: block;
        }
        
        .appointment-item .actions-menu button {
            width: 100%;
            text-align: left;
            padding: 0.5rem 0.75rem;
            font-size: 0.8rem;
            border: none;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .appointment-item .actions-menu button:hover {
            background-color: #f3f4f6;
        }
        
        /* Estados de citas */
        .appointment-item.status-programada {
            border-color: #3b82f6;
            background-color: #eff6ff;
        }
        
        .appointment-item.status-realizada {
            border-color: #10b981;
            background-color: #ecfdf5;
        }
        
        .appointment-item.status-cancelada {
            border-color: #ef4444;
            background-color: #fef2f2;
        }
        
        .appointment-item.status-reprogramada {
            border-color: #f59e0b;
            background-color: #fffbeb;
        }
        
        .appointment-item.status-no_asistio {
            border-color: #6b7280;
            background-color: #f3f4f6;
        }
        
        /* Indicador de "más citas" */
        .more-appointments {
            background-color: #f3f4f6;
            border-radius: 0.25rem;
            padding: 0.375rem;
            text-align: center;
            cursor: pointer;
            color: #4f46e5;
            font-size: 0.75rem;
            font-weight: 500;
            transition: background-color 0.15s ease;
        }
        
        .more-appointments:hover {
            background-color: #e5e7eb;
        }
        
        /* Modal para citas colapsadas */
        .collapsed-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
        }
        
        .collapsed-modal.hidden {
            display: none;
        }
        
        .collapsed-appointments-modal {
            background-color: white;
            border-radius: 0.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        .collapsed-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .collapsed-modal-header h3 {
            font-size: 1rem;
            font-weight: 600;
            margin: 0;
        }
        
        .close-collapsed-modal {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .close-collapsed-modal:hover {
            background-color: #f3f4f6;
        }
        
        .collapsed-modal-body {
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .collapsed-appointment-item {
            display: flex;
            align-items: center;
            background-color: #ffffff;
            border-left: 3px solid;
            border-radius: 0.25rem;
            padding: 0.75rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            cursor: default;
        }
        
        .collapsed-appointment-item .appointment-time {
            font-weight: 600;
            font-size: 0.875rem;
            color: #4b5563;
            width: 3.5rem;
            flex-shrink: 0;
        }
        
        .collapsed-appointment-item .appointment-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .collapsed-appointment-item .appointment-name {
            font-size: 0.875rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 500;
        }
        
        .collapsed-appointment-item .appointment-property {
            font-size: 0.75rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #6b7280;
        }
        
        .collapsed-appointment-item .appointment-actions {
            display: flex;
            align-items: center;
            margin-left: 0.5rem;
        }
        
        .collapsed-appointment-item .view-appointment-btn {
            background-color: #f3f4f6;
            border: none;
            border-radius: 0.25rem;
            padding: 0.375rem 0.75rem;
            font-size: 0.75rem;
            color: #4b5563;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.375rem;
        }
        
        .collapsed-appointment-item .view-appointment-btn:hover {
            background-color: #e5e7eb;
        }
        
        /* Estados de citas colapsadas */
        .collapsed-appointment-item.status-programada {
            border-color: #3b82f6;
            background-color: #eff6ff;
        }
        
        .collapsed-appointment-item.status-realizada {
            border-color: #10b981;
            background-color: #ecfdf5;
        }
        
        .collapsed-appointment-item.status-cancelada {
            border-color: #ef4444;
            background-color: #fef2f2;
        }
        
        .collapsed-appointment-item.status-reprogramada {
            border-color: #f59e0b;
            background-color: #fffbeb;
        }
        
        .collapsed-appointment-item.status-no_asistio {
            border-color: #6b7280;
            background-color: #f3f4f6;
        }
        
        /* Panel de detalles de cita */
        .appointment-details-fullscreen {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            border-radius: 0.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            z-index: 100;
        }
        
        .appointment-details-fullscreen.hidden {
            display: none;
        }
        
        .appointment-details-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .appointment-details-header h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin: 0;
        }
        
        .close-details-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .close-details-btn:hover {
            background-color: #f3f4f6;
        }
        
        /* Vista de día */
        .day-view-container,
        .week-view-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 2rem;
        }
        
        .info-message {
            text-align: center;
            color: #6b7280;
            font-size: 1rem;
        }
        
        /* Responsividad */
        @media (max-width: 768px) {
            .sidebar-container {
            display: none;
            }
            
            .calendar-toolbar {
            padding: 0.5rem;
            flex-wrap: wrap;
            gap: 0.5rem;
            }
            
            .calendar-toolbar-left,
            .calendar-toolbar-right {
            width: 100%;
            justify-content: space-between;
            }
            
            .navigation-controls h2 {
            font-size: 1rem;
            }
            
            .toolbar-btn,
            .view-btn {
            padding: 0.375rem 0.5rem;
            font-size: 0.75rem;
            }
            
            .main-calendar-grid .day-cell {
            min-height: 80px;
            }
            
            .appointment-item .time,
            .appointment-item .name,
            .appointment-item .property {
            font-size: 0.7rem;
            }
        }
        `;
        
        document.head.appendChild(styleElement);
    }
    
    /**
     * Función para inicializar el calendario mejorado
     */
    function inicializarCalendarioFullScreen() {
        // Reemplazar el calendario original con el mejorado
        if (window.appointmentCalendar) {
        // Guardar referencia al leadManager original
        const leadManager = window.appointmentCalendar.leadManager;
        
        // Crear el nuevo calendario
        window.appointmentCalendar = new CalendarioFullScreen(leadManager);
        
        // Integrar con VisitManager
        if (window.visitManager) {
            window.visitManager.integrateWithLeadCalendar(window.appointmentCalendar);
        }
        
        // Cargar citas
        window.appointmentCalendar.loadAppointments();
        
        // Añadir estilos para el modo fullscreen
        addCalendarFullscreenStyles();
        }
    }
}
    
// Inicializar el calendario mejorado cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Dejar un breve retraso para asegurar que todo esté cargado
    setTimeout(inicializarCalendarioFullScreen, 1500);
});