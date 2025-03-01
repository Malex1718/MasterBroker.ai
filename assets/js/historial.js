class ActivityHistory {
    constructor() {
        this.SESSION_KEY = 'vibien_session';
        this.activities = [];
        this.userSession = null;
        this.filters = {
            type: 'all',
            page: 1,
            limit: 10
        };
    }

    async init() {
        try {
            console.log('Iniciando ActivityHistory');
            
            // 1. Verificar el contenedor
            const container = document.querySelector('#activity-history');
            if (!container) {
                throw new Error('No se encontró el contenedor de actividades');
            }
    
            // 2. Obtener y validar la sesión
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            console.log('Datos de sesión encontrados:', sessionData);
    
            if (!sessionData) {
                console.error('No hay sesión almacenada');
                window.location.href = '/inicio_sesion.html';
                return false;
            }
    
            try {
                // 3. Parsear y validar datos de sesión
                this.userSession = JSON.parse(sessionData);
                console.log('Sesión parseada:', this.userSession);
                
                if (!this.userSession || !this.userSession.id) {
                    console.error('Datos de sesión incompletos');
                    localStorage.removeItem(this.SESSION_KEY);
                    window.location.href = '/inicio_sesion.html';
                    return false;
                }
    
                // 4. Configurar datos del usuario
                this.userId = parseInt(this.userSession.id, 10);
                if (isNaN(this.userId)) {
                    throw new Error('ID de usuario inválido');
                }
                console.log('ID de usuario establecido:', this.userId);
    
                this.userType = this.userSession.user_type;
                this.userEmail = this.userSession.email;
                this.userName = this.userSession.first_name;
    
                console.log('Usuario identificado:', {
                    userId: this.userId,
                    userType: this.userType,
                    userEmail: this.userEmail,
                    userName: this.userName
                });
    
                // 5. Inicializar componentes
                this.initializeFilters();
                await this.loadActivities();
    
                return true;
    
            } catch (parseError) {
                console.error('Error al parsear datos de sesión:', parseError);
                localStorage.removeItem(this.SESSION_KEY);
                window.location.href = '/inicio_sesion.html';
                return false;
            }
        } catch (error) {
            console.error('Error en inicialización:', error);
            // Si el error es de contenedor, no redirigimos al login
            if (error.message !== 'No se encontró el contenedor de actividades') {
                window.location.href = '/inicio_sesion.html';
            }
            return false;
        }
    }

    initializeFilters() {
        const filterSelect = document.getElementById('activity-filter');
        if (filterSelect) {
            filterSelect.innerHTML = '';
            
            const options = [
                { value: 'all', text: 'Todas las actividades' },
                { value: 'view', text: 'Vistas' },
                { value: 'like', text: 'Me gusta' },
                { value: 'dislike', text: 'No me gusta' },
                { value: 'saved', text: 'Guardadas' },
                { value: 'contact', text: 'Contactadas' }
            ];
    
            options.forEach(option => {
                const optElement = document.createElement('option');
                optElement.value = option.value;
                optElement.textContent = option.text;
                filterSelect.appendChild(optElement);
            });
    
            filterSelect.addEventListener('change', (e) => {
                this.filters.type = e.target.value;
                this.filters.page = 1;
                this.loadActivities();
            });
        }
    }
    
    async loadActivities() {
        try {
            console.log('Cargando actividades con filtros:', this.filters);
            
            if (!this.userId) {
                throw new Error('No hay ID de usuario');
            }
    
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.userId}`
            };
    
            const url = new URL('/api/usuarios/historial.php', window.location.origin);
            Object.keys(this.filters).forEach(key => 
                url.searchParams.append(key, this.filters[key])
            );
    
            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error detallado:', errorData);
                throw new Error(`Error al cargar actividades: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (data.success) {
                this.activities = data.data;
                this.renderActivities();
                if (data.pagination) {
                    this.updatePagination(data.pagination);
                }
            } else {
                throw new Error(data.error || 'Error al cargar actividades');
            }
        } catch (error) {
            console.error('Error completo:', error);
            this.showError(error.message);
        }
    }

    renderActivities() {
        const container = document.getElementById('activities-container');
        if (!container) return;
    
        if (!this.activities || this.activities.length === 0) {
            let message = this.getEmptyStateMessage(this.filters.type);
            container.innerHTML = `
                <div class="no-activities">
                    <p>${message}</p>
                </div>
            `;
            return;
        }
    
        container.innerHTML = this.activities.map(activity => 
            this.createActivityElement(activity)
        ).join('');
    }

    getEmptyStateMessage(filterType) {
        switch(filterType) {
            case 'view':
                return 'No has visto ninguna propiedad aún';
            case 'like':
                return 'No has marcado ninguna propiedad como "Me gusta"';
            case 'dislike':
                return 'No has marcado ninguna propiedad como "No me gusta"';
            case 'saved':
                return 'No has guardado ninguna propiedad';
            case 'contact':
                return 'No has contactado a ningún vendedor';
            default:
                return 'No hay actividades que mostrar';
        }
    }

    getActivityAltText(type, reactionType) {
        switch(type) {
            case 'view':
                return 'Vista';
            case 'reaction':
                return reactionType === 'like' ? 'Me gusta' : 'No me gusta';
            case 'contact':
                return 'Contacto';
            case 'saved':
                return 'Guardado';
            default:
                return 'Actividad';
        }
    }

    createActivityElement(activity) {
        // Verificamos el tipo de actividad
        const activityType = activity.type;
        const reactionType = activity.reactionType;

        // Variable para controlar si se muestra el botón de eliminar
        const showDeleteButton = false; // Los administradores pueden cambiar esto a true cuando sea necesario


        return `
            <div class="activity-card" id="activity-${activity.id}">
                <div class="activity-content">
                    <div class="activity-icon">
                        <img src="${this.getActivityIcon(activityType, reactionType)}" 
                            alt="${this.getActivityAltText(activityType, reactionType)}">
                    </div>
                    <div class="activity-details">
                        <div class="activity-header">
                            <div class="activity-title-container">
                                <h3 class="property-title">${this.escapeHtml(activity.propertyTitle)}</h3>
                                <span class="property-code">(${this.escapeHtml(activity.propertyCode)})</span>
                            </div>
                            ${showDeleteButton ? `
                                <button 
                                    class="delete-button" 
                                    onclick="activityHistory.deleteActivity(${activity.id})"
                                    title="Eliminar actividad">
                                    <img src="/assets/img/basura.png" alt="Eliminar">
                                </button>
                            ` : ''}
                        </div>
                        <p class="activity-message">${this.getActivityMessage(activity)}</p>
                        <div class="activity-footer">
                            <span class="activity-date">
                                <img src="/assets/img/clock_blue.png" alt="clock">
                                ${this.formatDate(activity.date)}
                            </span>
                            <span class="activity-price">
                                ${this.formatCurrency(activity.price)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async deleteActivity(activityId) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta actividad?')) {
            return;
        }
    
        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.userId}` // Usar Authorization en lugar de X-User-Id
            };
    
            console.log('Headers para eliminar:', headers);
    
            const response = await fetch('/api/usuarios/historial.php', {
                method: 'DELETE',
                headers: headers,
                body: JSON.stringify({ activity_id: activityId })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                console.log('Error al eliminar:', errorData);
                throw new Error('Error al eliminar la actividad');
            }
    
            const data = await response.json();
            
            if (data.success) {
                await this.loadActivities();
                this.showNotification('Actividad eliminada correctamente');
            } else {
                throw new Error(data.error || 'Error al eliminar la actividad');
            }
        } catch (error) {
            console.error('Error al eliminar actividad:', error);
            this.showError(error.message);
        }
    }

    getActivityIcon(type, reactionType = null) {
        const iconBase = '/assets/img/';
        switch(type) {
            case 'view':
                return `${iconBase}eye.png`;
            case 'reaction':
                return reactionType === 'like' 
                    ? `${iconBase}thumbs-up.png`
                    : `${iconBase}thumbs-down.png`;
            case 'contact':
                return `${iconBase}chart.png`;
            case 'saved':
                return `${iconBase}bookmark.png`;
            default:
                return `${iconBase}activity.png`;
        }
    }

    getActivityMessage(activity) {
        const type = activity.type;
        const reactionType = activity.reactionType;

        switch(type) {
            case 'view':
                return `Visitaste esta propiedad durante ${activity.duration || '0 segundos'}`;
            case 'reaction':
                return reactionType === 'like' 
                    ? 'Marcaste que te gusta esta propiedad'
                    : 'Marcaste que no te gusta esta propiedad';
            case 'contact':
                return `Contactaste al vendedor${activity.message ? `: ${activity.message}` : ''}`;
            case 'saved':
                return `Guardaste esta propiedad${activity.folderName ? ` en la carpeta: ${activity.folderName}` : ''}`;
            default:
                return activity.message || 'Sin detalles disponibles';
        }
    }

    updatePagination(pagination) {
        const container = document.querySelector('.pagination-container');
        if (!container) return;

        const { total, page, limit, totalPages } = pagination;

        let html = '<div class="pagination">';
        
        html += `<button class="prev-page" ${page === 1 ? 'disabled' : ''}>Anterior</button>`;

        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-number ${i === page ? 'active' : ''}">${i}</button>`;
        }

        html += `<button class="next-page" ${page === totalPages ? 'disabled' : ''}>Siguiente</button>`;
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                if (button.classList.contains('prev-page') && page > 1) {
                    this.filters.page = page - 1;
                } else if (button.classList.contains('next-page') && page < totalPages) {
                    this.filters.page = page + 1;
                } else if (button.classList.contains('page-number')) {
                    this.filters.page = parseInt(button.textContent);
                }
                this.loadActivities();
            });
        });
    }

    formatDate(dateString) {
        if (!dateString) return 'Fecha no disponible';
        const date = new Date(dateString);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleDateString('es-MX', options);
    }

    formatCurrency(amount) {
        if (!amount) return 'Precio no disponible';
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    showError(message) {
        console.error('Error:', message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    showNotification(message) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification-message';
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 3000);
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
}

// Inicialización cuando el DOM esté listo
let activityHistory;
document.addEventListener('DOMContentLoaded', async () => {
    activityHistory = new ActivityHistory();
    try {
        const initialized = await activityHistory.init();
        if (!initialized) {
            console.error('No se pudo inicializar el historial de actividades');
        }
    } catch (error) {
        console.error('Error al inicializar el historial:', error);
    }
});

// Hacer la clase disponible globalmente
window.activityHistory = activityHistory;