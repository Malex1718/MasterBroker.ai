/**
 * Este archivo se encarga de integrar el CalendarioFullScreen con la interfaz existente.
 * Gestiona la inicialización, la transición del modal original al modo pantalla completa,
 * y asegura que todas las funcionalidades se mantengan.
 */

// Función para verificar si todos los requisitos están disponibles
function checkDependencies() {
    return typeof CalendarioFullScreen !== 'undefined' && 
           typeof window.appointmentCalendar !== 'undefined' &&
           typeof window.appointmentCalendar.leadManager !== 'undefined';
  }
  
  /**
   * Abre directamente el calendario en modo pantalla completa
   */
  function openFullscreenCalendar() {
    // Verificar si el calendario fullscreen ya está inicializado
    if (window.appointmentCalendar && typeof window.appointmentCalendar.showFullscreen === 'function') {
      // Usar la función showFullscreen directamente
      window.appointmentCalendar.showFullscreen();
    } else {
      // Si no está inicializado, mostramos un mensaje de carga temporal
      const loadingMessage = document.createElement('div');
      loadingMessage.id = 'calendar-loading-message';
      loadingMessage.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
      loadingMessage.innerHTML = `
        <div class="bg-white p-4 rounded-lg shadow-lg text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Cargando calendario...</p>
        </div>
      `;
      document.body.appendChild(loadingMessage);
      
      // Inicializar el calendario si es necesario
      initializeFullscreenCalendar().then(() => {
        // Eliminar mensaje de carga
        const loadingEl = document.getElementById('calendar-loading-message');
        if (loadingEl) loadingEl.remove();
        
        // Mostrar calendario
        if (window.appointmentCalendar && typeof window.appointmentCalendar.showFullscreen === 'function') {
          window.appointmentCalendar.showFullscreen();
        } else {
          alert('No se pudo inicializar el calendario. Por favor, recarga la página.');
        }
      }).catch(error => {
        console.error('Error al inicializar el calendario:', error);
        const loadingEl = document.getElementById('calendar-loading-message');
        if (loadingEl) {
          loadingEl.innerHTML = `
            <div class="bg-white p-4 rounded-lg shadow-lg text-center">
              <div class="text-red-600 mb-2">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p>Error al cargar el calendario. Por favor, recarga la página.</p>
              <button class="mt-4 px-4 py-2 bg-blue-600 text-white rounded" 
                      onclick="window.location.reload()">Recargar</button>
            </div>
          `;
        }
      });
    }
  }
  
  /**
   * Inicializa el calendario fullscreen y devuelve una promesa
   */
  function initializeFullscreenCalendar() {
    return new Promise((resolve, reject) => {
      // Intentar hasta 10 veces (5 segundos total) para dar tiempo a que todo cargue
      let attempts = 0;
      const maxAttempts = 10;
      
      function tryInitialize() {
        attempts++;
        console.log(`Intento ${attempts} de inicializar calendario fullscreen...`);
        
        // Si ya está inicializado, resolver inmediatamente
        if (window.appointmentCalendar && typeof window.appointmentCalendar.showFullscreen === 'function') {
          console.log('El calendario ya está inicializado');
          resolve();
          return;
        }
        
        // Si CalendarioFullScreen aún no está definido, esperar y reintentar
        if (typeof CalendarioFullScreen === 'undefined') {
          if (attempts < maxAttempts) {
            console.log('CalendarioFullScreen aún no está definido, reintentando...');
            setTimeout(tryInitialize, 500);
          } else {
            const error = new Error('No se pudo inicializar el calendario después de varios intentos: CalendarioFullScreen no está definido');
            console.error(error);
            reject(error);
          }
          return;
        }
        
        // Verificar que appointmentCalendar existe
        if (!window.appointmentCalendar || !window.appointmentCalendar.leadManager) {
          if (attempts < maxAttempts) {
            console.log('AppointmentCalendar no está listo, reintentando...');
            setTimeout(tryInitialize, 500);
          } else {
            const error = new Error('No se pudo inicializar el calendario: appointmentCalendar no está disponible');
            console.error(error);
            reject(error);
          }
          return;
        }
        
        try {
          console.log('Creando instancia de CalendarioFullScreen...');
          const leadManager = window.appointmentCalendar.leadManager;
          
          // Crear instancia de CalendarioFullScreen
          window.appointmentCalendar = new CalendarioFullScreen(leadManager);
          
          // Integrar con VisitManager
          if (window.visitManager) {
            window.visitManager.integrateWithLeadCalendar(window.appointmentCalendar);
          }
          
          // Cargar citas
          window.appointmentCalendar.loadAppointments();
          
          console.log('Calendario de pantalla completa inicializado correctamente');
          resolve();
        } catch (error) {
          console.error('Error al inicializar el calendario:', error);
          if (attempts < maxAttempts) {
            setTimeout(tryInitialize, 500);
          } else {
            reject(error);
          }
        }
      }
      
      // Iniciar el primer intento
      tryInitialize();
    });
  }
  
  /**
   * Función para reemplazar showCalendarModal de forma segura
   */
  function setupCalendarButton() {
    // Si originalmente no existe la función, crear una versión básica
    if (typeof window.showCalendarModal !== 'function') {
      window.showCalendarModal = function() {
        console.log('Configurando apertura del calendario...');
        openFullscreenCalendar();
      };
    } else {
      // Guardar referencia al método original por si acaso
      window._originalShowCalendarModal = window.showCalendarModal;
      
      // Reemplazar con nuestra versión
      window.showCalendarModal = function() {
        openFullscreenCalendar();
      };
    }
    
    // También asegurar que closeCalendarModal esté configurado
    window.closeCalendarModal = function() {
      if (window.appointmentCalendar && typeof window.appointmentCalendar.exitFullscreen === 'function') {
        window.appointmentCalendar.exitFullscreen();
      }
    };
    
    // Actualizar el botón del calendario si existe
    const calendarBtn = document.querySelector('button[onclick="window.showCalendarModal()"]');
    if (calendarBtn) {
      calendarBtn.onclick = openFullscreenCalendar;
    }
  }
  
  /**
   * Inicialización cuando el DOM está listo
   */
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, configurando calendario de pantalla completa...');
    
    // Configurar el botón de calendario para usar directamente el modo fullscreen
    setupCalendarButton();
    
    // Exponer funciones globalmente
    window.openFullscreenCalendar = openFullscreenCalendar;
    
    // Mantener compatibilidad con el código existente
    window.showCalendarModal = openFullscreenCalendar;
    
    // Inicializar todo después de un pequeño retraso para asegurar
    // que todos los scripts se hayan cargado correctamente
    setTimeout(() => {
      // Solo inicializar automáticamente si alguna otra parte del código
      // no lo ha hecho ya
      if (!window.appointmentCalendar || !window.appointmentCalendar.showFullscreen) {
        console.log('Iniciando inicialización automática del calendario...');
        initializeFullscreenCalendar()
          .then(() => console.log('Inicialización automática completa'))
          .catch(err => console.error('Error en inicialización automática:', err));
      }
    }, 2000);
  });