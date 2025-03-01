// Configuración de colores del tema
const themeColors = {
    primary: '#1a5a89',
    secondary: '#288cd5',
    light: '#e2e1e2',
    success: '#1fa953',
    error: '#ff4444',
    border: '#7c7b7c',
    chart: {
        grid: 'rgba(124, 123, 124, 0.1)',
        area: 'rgba(40, 140, 213, 0.1)'
    }
};

// Configuración común para las gráficas
const chartConfig = {
    font: {
        family: "'Urbanist', sans-serif",
        size: 12
    },
    grid: {
        color: themeColors.chart.grid
    }
};

// Variables globales para las gráficas
let usersChart = null;
let propertiesChart = null;

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    initializeEventListeners();
    loadDashboardData();
    initializeMenuToggle();
});

// Cargar datos del dashboard
async function loadDashboardData() {
    try {
        const response = await fetch('/dashboard/general/api/models/dashboard_stats.php');
        if (!response.ok) throw new Error('Error al cargar datos');
        const data = await response.json();
        
        updateStatCards(data);
        updateChartData(data);
        updateRecentActivity(data.recent_activity);
        updateSystemAlerts(data.alerts);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        showErrorMessage('Error al cargar los datos del dashboard');
    }
}

// Actualizar tarjetas de estadísticas
function updateStatCards(data) {
    const { user_stats, property_stats, lead_stats } = data;
    
    updateStatCard('usuarios', {
        value: user_stats.total_users,
        trend: user_stats.monthly_growth,
        isPositive: user_stats.monthly_growth > 0
    });

    updateStatCard('propiedades', {
        value: property_stats.active_properties,
        trend: property_stats.monthly_growth,
        isPositive: property_stats.monthly_growth > 0
    });

    updateStatCard('leads', {
        value: lead_stats.total_leads,
        trend: lead_stats.monthly_growth,
        isPositive: lead_stats.monthly_growth > 0
    });

    updateStatCard('conversion', {
        value: lead_stats.conversion_rate,
        trend: lead_stats.conversion_growth,
        isPositive: lead_stats.conversion_growth > 0
    });
}

// Actualizar una tarjeta de estadística individual
function updateStatCard(type, data) {
    const card = document.querySelector(`.stat-card[data-type="${type}"]`);
    if (!card) return;

    const valueEl = card.querySelector('.stat-value');
    const trendEl = card.querySelector('.stat-trend');
    
    if (valueEl) {
        valueEl.textContent = formatValue(data.value);
    }
    
    if (trendEl) {
        const icon = data.isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
        const trendClass = data.isPositive ? 'positive' : 'negative';
        trendEl.innerHTML = `
            <i class="fas ${icon}"></i>
            ${Math.abs(data.trend)}% este mes
        `;
        trendEl.className = `stat-trend ${trendClass}`;
    }
}

// Inicializar las gráficas
function initializeCharts() {
    initializeUsersChart();
    initializePropertiesChart();
}

// Inicializar gráfica de usuarios
function initializeUsersChart() {
    const ctx = document.getElementById('usersChart')?.getContext('2d');
    if (!ctx) return;

    usersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Usuarios',
                data: [],
                borderColor: themeColors.secondary,
                backgroundColor: themeColors.chart.area,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: themeColors.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: chartConfig.font
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: chartConfig.grid,
                    ticks: {
                        font: chartConfig.font,
                        callback: value => value.toLocaleString()
                    }
                },
                x: {
                    grid: chartConfig.grid,
                    ticks: {
                        font: chartConfig.font
                    }
                }
            }
        }
    });
}

// Inicializar gráfica de propiedades
function initializePropertiesChart() {
    const ctx = document.getElementById('propertiesChart')?.getContext('2d');
    if (!ctx) return;

    propertiesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Propiedades Activas',
                    data: [],
                    backgroundColor: themeColors.primary
                },
                {
                    label: 'Propiedades Inactivas',
                    data: [],
                    backgroundColor: themeColors.light
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: chartConfig.font
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: chartConfig.grid,
                    ticks: {
                        font: chartConfig.font
                    }
                },
                x: {
                    grid: chartConfig.grid,
                    ticks: {
                        font: chartConfig.font
                    }
                }
            }
        }
    });
}

// Actualizar datos de las gráficas
function updateChartData(data) {
    if (usersChart) {
        usersChart.data.labels = data.monthly_stats.map(stat => stat.month);
        usersChart.data.datasets[0].data = data.monthly_stats.map(stat => stat.user_count);
        usersChart.update();
    }

    if (propertiesChart) {
        propertiesChart.data.labels = data.property_stats.months;
        propertiesChart.data.datasets[0].data = data.property_stats.active;
        propertiesChart.data.datasets[1].data = data.property_stats.inactive;
        propertiesChart.update();
    }
}

// Actualizar actividad reciente
function updateRecentActivity(activities) {
    const container = document.querySelector('.activity-list');
    if (!container) return;

    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-indicator" style="background-color: ${getActivityColor(activity.type)}"></div>
            <div class="activity-text">
                <div>${activity.description}</div>
                <div class="activity-time">${formatActivityDate(activity.date)}</div>
            </div>
        </div>
    `).join('');
}

// Actualizar alertas del sistema
function updateSystemAlerts(alerts) {
    const container = document.querySelector('.alerts-list');
    if (!container) return;

    container.innerHTML = alerts.map(alert => `
        <div class="activity-item">
            <div class="activity-indicator" style="background-color: ${getAlertColor(alert.severity)}"></div>
            <div class="activity-text">
                <div>${alert.message}</div>
                <div class="activity-time">${alert.action_required}</div>
            </div>
        </div>
    `).join('');
}

// Inicializar event listeners
function initializeEventListeners() {
    // Navegación del sidebar
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                window.location.href = href;
            }
        });
    });

    // Buscador
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
}

// Inicializar el menú toggle
function initializeMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggle) {
        menuToggle.addEventListener('change', function() {
            if (this.checked) {
                sidebar.style.transform = 'translateX(0)';
                mainContent.style.marginLeft = '250px';
            } else {
                sidebar.style.transform = 'translateX(-100%)';
                mainContent.style.marginLeft = '0';
            }
        });
    }

    // Responsive handling
    handleResponsiveLayout();
    window.addEventListener('resize', handleResponsiveLayout);
}

// Manejar layout responsive
function handleResponsiveLayout() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const menuToggle = document.getElementById('menu-toggle');

    if (window.innerWidth > 1024) {
        sidebar.style.transform = 'translateX(0)';
        mainContent.style.marginLeft = '250px';
    } else if (!menuToggle.checked) {
        sidebar.style.transform = 'translateX(-100%)';
        mainContent.style.marginLeft = '0';
    }
}

// Utilidades
function formatValue(value) {
    if (typeof value !== 'number') return value;
    return value % 1 === 0 ? 
           value.toLocaleString() : 
           value.toFixed(1) + '%';
}

function formatActivityDate(date) {
    const now = new Date();
    const activityDate = new Date(date);
    const diffMinutes = Math.floor((now - activityDate) / 60000);

    if (diffMinutes < 1) return 'Justo ahora';
    if (diffMinutes < 60) return `Hace ${diffMinutes} minutos`;
    if (diffMinutes < 1440) return `Hace ${Math.floor(diffMinutes/60)} horas`;
    return `Hace ${Math.floor(diffMinutes/1440)} días`;
}

function getActivityColor(type) {
    const colors = {
        user: 'var(--principal)',
        property: 'var(--principal_2)',
        lead: 'var(--bueno)',
        default: 'var(--border)'
    };
    return colors[type] || colors.default;
}

function getAlertColor(severity) {
    const colors = {
        high: 'var(--error)',
        medium: 'var(--principal_2)',
        low: 'var(--bueno)',
        default: 'var(--border)'
    };
    return colors[severity] || colors.default;
}

function showErrorMessage(message) {
    // Implementar según el diseño de tu sistema de notificaciones
    console.error(message);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Actualización periódica de datos
setInterval(loadDashboardData, 300000); // Cada 5 minutos