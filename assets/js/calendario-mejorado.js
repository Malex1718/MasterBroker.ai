/**
 * Calendario de Citas Mejorado - extiende la funcionalidad del calendario actual
 */
class CalendarioMejorado extends AppointmentCalendar {
    constructor(leadManager) {
      super(leadManager);
      
      // Plantillas mejoradas
      this.plantillas = {
        itemCita: (cita) => {
          const esVirtual = cita.meetLink || (cita.description && cita.description.includes('virtual'));
          return `
            <div class="content">
              <div class="time">${this.formatTime(cita.date)}</div>
              <div class="name">${cita.leadName}</div>
              <div class="property">${cita.propertyTitle || 'Sin propiedad'}</div>
            </div>
            <div class="actions">
              <button class="actions-toggle p-1 text-gray-500 hover:text-gray-700" aria-label="Más acciones">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="6" r="2"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                  <circle cx="12" cy="18" r="2"></circle>
                </svg>
              </button>
              <div class="actions-menu">
                <button data-action="view">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  Ver detalles
                </button>
                ${this.getBotonesAccionHTML(cita)}
              </div>
            </div>
          `;
        },
        
        vistaDetalle: (cita) => {
          // Plantilla de vista detallada mejorada con mejor organización
          const fechaAjustada = new Date(cita.date);
          fechaAjustada.setHours(fechaAjustada.getHours() - 6);
          
          const insigniaEstado = `<span class="px-2 py-1 rounded-full text-xs ${this.getStatusColor(cita.status)}">
                             ${this.formatStatus(cita.status)}
                           </span>`;
          
          return `
            <div class="space-y-4">
              <div class="flex justify-between items-start border-b pb-3">
                <div>
                  <h5 class="font-semibold text-lg">${cita.title || 'Visita programada'}</h5>
                  <p class="text-sm text-gray-600 mt-1">${fechaAjustada.toLocaleString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}</p>
                </div>
                <div>
                  ${insigniaEstado}
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span class="font-medium text-gray-700">Lead:</span>
                  <div class="mt-1">${cita.leadName}</div>
                </div>
                
                <div>
                  <span class="font-medium text-gray-700">Propiedad:</span>
                  <div class="mt-1">${cita.propertyTitle}</div>
                </div>
                
                ${cita.meetLink ? `
                  <div class="col-span-2 mt-2">
                    <span class="font-medium text-gray-700">Enlace de reunión:</span>
                    <div class="mt-1">
                      <a href="${cita.meetLink}" target="_blank" class="text-blue-600 hover:text-blue-800 flex items-center">
                        <svg class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 12h2a8 8 0 1 0-8 8v-2a6 6 0 1 1 6-6z"/>
                        </svg>
                        Unirse a Google Meet
                      </a>
                    </div>
                  </div>
                ` : ''}
                
                ${cita.description ? `
                  <div class="col-span-2 mt-2">
                    <span class="font-medium text-gray-700">Descripción:</span>
                    <div class="mt-1 text-gray-600 bg-gray-50 p-2 rounded">${cita.description}</div>
                  </div>
                ` : ''}
              </div>
              
              <div class="flex justify-end gap-2 pt-3 border-t">
                <button class="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                        onclick="leadManager.detailView.show('${cita.leadId}')">
                    Ver Lead
                </button>
                ${this.getBotonesDetalleHTML(cita)}
              </div>
            </div>
          `;
        }
      };
    }
    
    getBotonesAccionHTML(cita) {
      if (cita.status === 'programada' || cita.status === 'reprogramada') {
        return `
          <button data-action="complete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 13l4 4L19 7"></path>
            </svg>
            Completar
          </button>
          <button data-action="reschedule">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            Reprogramar
          </button>
          <button data-action="cancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Cancelar
          </button>
        `;
      } else if (cita.status === 'cancelada') {
        return `
          <button data-action="delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Eliminar
          </button>
        `;
      }
      return '';
    }
    
    getBotonesDetalleHTML(cita) {
      if (cita.status === 'programada' || cita.status === 'reprogramada') {
        return `
          <button class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  onclick="appointmentCalendar.markAppointmentComplete('${cita.id}')">
              Marcar Realizada
          </button>
          <button class="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  onclick="appointmentCalendar.rescheduleAppointment('${cita.id}')">
              Reprogramar
          </button>
          <button class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  onclick="appointmentCalendar.cancelAppointment('${cita.id}')">
              Cancelar
          </button>
        `;
      } else if (cita.status === 'cancelada' || cita.status === 'realizada') {
        return `
          <button class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  onclick="appointmentCalendar.deleteAppointmentPermanently('${cita.id}')">
              Eliminar
          </button>
        `;
      }
      return '';
    }
    
    // Sobreescribir el renderMonthView original
    renderMonthView() {
      // Actualizar título
      const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      this.currentMonthDisplay.textContent = `${nombresMeses[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
      
      // Limpiar vista manteniendo los encabezados
      const encabezadosDias = Array.from(this.calendarView.querySelectorAll('.day-header'));
      this.calendarView.innerHTML = '';
      encabezadosDias.forEach(encabezado => this.calendarView.appendChild(encabezado));
      
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
          <div class="date-header">${fechaActual.getDate()}</div>
          <div class="appointments-container"></div>
        `;
        
        const contenedorCitas = celdaDia.querySelector('.appointments-container');
        
        // Añadir citas del día
        const citasParaDia = this.getAppointmentsForDay(fechaActual);
        citasParaDia.forEach(cita => {
          const elementoCita = document.createElement('div');
          elementoCita.className = `appointment-item status-${cita.status}`;
          
          // Verificar si es una visita virtual
          if (cita.meetLink || (cita.description && cita.description.includes('virtual'))) {
            elementoCita.classList.add('virtual');
          }
          
          elementoCita.innerHTML = this.plantillas.itemCita(cita);
          elementoCita.dataset.appointmentId = cita.id;
          
          // Añadir event listeners
          elementoCita.addEventListener('click', (e) => {
            if (!e.target.closest('.actions')) {
              this.showAppointmentDetails(cita);
            }
          });
          
          // Configurar menú de acciones
          const toggleAcciones = elementoCita.querySelector('.actions-toggle');
          const menuAcciones = elementoCita.querySelector('.actions-menu');
          
          if (toggleAcciones && menuAcciones) {
            toggleAcciones.addEventListener('click', (e) => {
              e.stopPropagation();
              menuAcciones.classList.toggle('show');
              
              // Cerrar otros menús abiertos
              document.querySelectorAll('.actions-menu.show').forEach(menu => {
                if (menu !== menuAcciones) {
                  menu.classList.remove('show');
                }
              });
              
              // Cerrar menú al hacer clic fuera
              const cerrarMenu = (event) => {
                if (!menuAcciones.contains(event.target) && event.target !== toggleAcciones) {
                  menuAcciones.classList.remove('show');
                  document.removeEventListener('click', cerrarMenu);
                }
              };
              
              setTimeout(() => {
                document.addEventListener('click', cerrarMenu);
              }, 0);
            });
            
            // Configurar botones de acción
            menuAcciones.querySelectorAll('button[data-action]').forEach(btn => {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const accion = btn.dataset.action;
                const citaId = elementoCita.dataset.appointmentId;
                
                switch (accion) {
                  case 'view':
                    this.showAppointmentDetails(cita);
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
                
                menuAcciones.classList.remove('show');
              });
            });
          }
          
          contenedorCitas.appendChild(elementoCita);
        });
        
        // Evento para crear una nueva cita
        celdaDia.addEventListener('dblclick', (e) => {
          // Prevenir que se active al hacer clic en una cita existente
          if (!e.target.closest('.appointment-item')) {
            const nuevaFecha = new Date(fechaActual);
            this.createNewAppointment(nuevaFecha);
          }
        });
        
        this.calendarView.appendChild(celdaDia);
        
        // Avanzar al siguiente día
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }
    
    // Sobreescribir el método de mostrar detalles
    showAppointmentDetails(cita) {
      this.appointmentDetails.classList.remove('hidden');
      this.appointmentContent.innerHTML = this.plantillas.vistaDetalle(cita);
    }
  }
  
  // Función auxiliar para inicializar el calendario mejorado
  function inicializarCalendarioMejorado() {
    // Reemplazar el calendario original con el mejorado
    if (window.appointmentCalendar) {
      // Guardar referencia al leadManager original
      const leadManager = window.appointmentCalendar.leadManager;
      
      // Crear el nuevo calendario
      window.appointmentCalendar = new CalendarioMejorado(leadManager);
      
      // Integrar con VisitManager
      if (window.visitManager) {
        window.visitManager.integrateWithLeadCalendar(window.appointmentCalendar);
      }
      
      // Cargar citas
      window.appointmentCalendar.loadAppointments();
    }
  }
  
  // Inicializar el calendario mejorado cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', function() {
    // Dejar un breve retraso para asegurar que todo esté cargado
    setTimeout(inicializarCalendarioMejorado, 1000);
  });