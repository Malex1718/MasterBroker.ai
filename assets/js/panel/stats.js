class PropertyStats {
    constructor() {
        this.container = document.querySelector('.stats-container');
        this.propertyId = this.getPropertyIdFromUrl();
        this.timeRange = document.getElementById('timeRange');
        this.charts = {};
        this.currentData = null;
        
        this.init();
    }

    getPropertyIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    async init() {
        if (!this.propertyId) {
            alert('ID de propiedad no proporcionado');
            window.location.href = '/dashboard/publicaciones.html';
            return;
        }

        this.setupEventListeners();
        await this.loadStats();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        if (this.timeRange) {
            this.timeRange.addEventListener('change', () => this.loadStats());
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
                this.loadStats();
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => this.loadStats(), 300000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    showLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'flex';
    }

    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }

    async loadStats() {
        try {
            this.showLoader();
            const response = await fetch(`/api/propiedades/get_property_stats.php?id=${this.propertyId}&range=${this.timeRange?.value || '7d'}`);
            const result = await response.json();

            if (result.status === 'success') {
                this.currentData = result.data;
                this.renderStats(result.data);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            this.showError('Error al cargar las estadísticas. Por favor, intenta de nuevo más tarde.');
        } finally {
            this.hideLoader();
        }
    }

    showError(message) {
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = `
                background-color: var(--error);
                color: white;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: center;
            `;
            this.container.insertBefore(errorDiv, this.container.firstChild);
        }
        errorDiv.textContent = message;

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    renderStats(data) {
        this.renderKPIs(data);
        this.renderCharts(data);
        this.renderEngagementDetails(data.engagement);
        this.renderLeadsDetails(data.leads);
        this.renderMarketComparison(data.market_comparison || {});
    }

    renderKPIs(data) {
        const kpiContainer = document.querySelector('.stats-kpi-grid');
        if (!kpiContainer) return;

        const kpis = [
            {
                icon: 'eye.png',
                label: 'Vistas Únicas',
                value: data.views?.unique || 0,
                trend: this.calculateTrend(
                    data.views?.unique || 0, 
                    data.views?.previous_unique || 0
                )
            },
            {
                icon: 'users.png',
                label: 'Leads Generados',
                value: data.leads?.total || 0,
                trend: this.calculateTrend(
                    data.leads?.total || 0, 
                    data.leads?.previous_total || 0
                )
            },
            {
                icon: 'chart.png',
                label: 'Tasa de Conversión',
                value: `${data.conversion?.rate || 0}%`,
                trend: this.calculateTrend(
                    data.conversion?.rate || 0, 
                    data.conversion?.previous_rate || 0
                )
            },
            {
                icon: 'score.png',
                label: 'Score de Calidad',
                value: `${data.quality_score || 0}%`,
                trend: null
            }
        ];

        kpiContainer.innerHTML = kpis.map(kpi => this.createKPICard(kpi)).join('');
    }

    calculateTrend(current, previous) {
        if (!previous || !current) return null;
        const percentage = ((current - previous) / previous) * 100;
        return {
            value: Math.abs(percentage.toFixed(1)),
            direction: percentage >= 0 ? 'up' : 'down'
        };
    }

    createKPICard({ icon, label, value, trend }) {
        return `
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <div class="kpi-icon">
                        <img src="/assets/img/${icon}" alt="${label}">
                    </div>
                    <div>
                        <h3 class="kpi-value">${value}</h3>
                        <p class="kpi-label">${label}</p>
                    </div>
                </div>
                ${trend ? `
                    <p class="kpi-trend ${trend.direction === 'up' ? 'trend-up' : 'trend-down'}">
                        ${trend.direction === 'up' ? '↑' : '↓'} ${trend.value}% vs período anterior
                    </p>
                ` : ''}
            </div>
        `;
    }

    renderCharts(data) {
        const ctx = document.getElementById('viewsChart');
        if (!ctx) return;

        const chartData = {
            labels: data.timeline.map(item => item.date),
            datasets: [
                {
                    label: 'Vistas Únicas',
                    data: data.timeline.map(item => item.unique_views),
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--principal').trim(),
                    backgroundColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--principal').trim() + '20',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Leads',
                    data: data.timeline.map(item => item.leads),
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bueno').trim(),
                    backgroundColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bueno').trim() + '20',
                    tension: 0.4,
                    fill: true
                }
            ]
        };

        if (this.charts.views) {
            this.charts.views.destroy();
        }

        this.charts.views = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: 'var(--txt)',
                                size: 12
                            },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'white',
                        titleColor: 'black',
                        titleFont: {
                            family: 'var(--titulo)',
                            size: 13
                        },
                        bodyColor: 'black',
                        bodyFont: {
                            family: 'var(--txt)',
                            size: 12
                        },
                        borderColor: 'var(--border)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        usePointStyle: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--border').trim() + '20'
                        },
                        ticks: {
                            font: {
                                family: 'var(--txt)',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'var(--txt)',
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    renderDetails(data) {
        this.renderEngagementDetails(data.engagement);
        this.renderLeadsDetails(data.leads);
        this.renderDeviceDistribution(data.engagement.devices);
    }

    renderEngagementDetails(engagement) {
        const container = document.querySelector('.engagement-metrics');
        if (!container) return;
    
        // Define los colores para dispositivos
        const colors = {
            mobile: 'var(--principal_2)',
            desktop: 'var(--bueno)',
            tablet: '#ff9800',
            backgroundBar: 'var(--body)',
            textSecondary: 'var(--colorp)',
            border: 'var(--border)'
        };
    
        // Métricas principales
        const metrics = [
            {
                label: 'Tiempo promedio',
                icon: 'clock.png',
                value: this.formatDuration(engagement?.average_duration || 0),
                trend: this.calculateTrend(
                    engagement?.average_duration || 0,
                    engagement?.previous_average_duration || 0
                )
            },
            {
                label: 'Tasa de rebote',
                icon: 'bounce.png',
                value: `${engagement?.bounce_rate || 0}%`,
                trend: this.calculateTrendInverse(
                    engagement?.bounce_rate || 0,
                    engagement?.previous_bounce_rate || 0
                )
            },
            {
                label: 'Vistas únicas',
                icon: 'unique.png',
                value: this.currentData.views?.unique || 0,
                trend: this.calculateTrend(
                    this.currentData.views?.unique || 0,
                    this.currentData.views?.previous_unique || 0
                )
            },
            {
                label: 'Guardados',
                icon: 'heart.png',
                value: engagement.favorites || 0,
                trend: this.calculateTrend(
                    engagement.favorites || 0,
                    engagement.previous_favorites || 0
                )
            }
        ];
    
        // Procesar datos de dispositivos
        const devices = engagement.devices || {};
        const totalViews = Object.values(devices).reduce((sum, device) => sum + device.unique, 0) || 1;
        const devicePercentages = {
            mobile: ((devices.mobile?.unique || 0) / totalViews * 100).toFixed(1),
            desktop: ((devices.desktop?.unique || 0) / totalViews * 100).toFixed(1),
            tablet: ((devices.tablet?.unique || 0) / totalViews * 100).toFixed(1)
        };
    
        // Renderizar HTML completo
        container.innerHTML = `
            ${metrics.map(metric => `
                <div class="metric-row">
                    <div class="metric-label">
                        <div class="metric-icon">
                            <img src="/assets/img/${metric.icon}" alt="${metric.label}">
                        </div>
                        <span>${metric.label}</span>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metric.value}</div>
                        ${metric.trend ? `
                            <div class="metric-trend ${metric.trend.direction === 'up' ? 'trend-up' : 'trend-down'}">
                                ${metric.trend.direction === 'up' ? '↑' : '↓'}
                                ${metric.trend.value}%
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
    
            <div class="metric-row" style="flex-direction: column; align-items: stretch; gap: 12px;">
                <div class="metric-label">
                    <div class="metric-icon">
                        <img src="/assets/img/devices.png" alt="Dispositivos">
                    </div>
                    <span>Distribución por dispositivo</span>
                </div>
    
                <div style="background: ${colors.backgroundBar}; 
                            border-radius: 10px; 
                            padding: 15px; 
                            border: 1px solid ${colors.border};">
                    <div class="progress-bar" style="height: 15px; 
                                                    background: var(--body); 
                                                    border: 1px solid ${colors.border};">
                        <div style="display: flex; width: 100%; height: 100%;">
                            <div class="progress-fill" 
                                 style="width: ${devicePercentages.mobile}%; 
                                        background: ${colors.mobile};
                                        transition: width 0.3s ease;" 
                                 title="Móvil ${devicePercentages.mobile}%">
                            </div>
                            <div class="progress-fill" 
                                 style="width: ${devicePercentages.desktop}%; 
                                        background: ${colors.desktop};
                                        transition: width 0.3s ease;" 
                                 title="Desktop ${devicePercentages.desktop}%">
                            </div>
                            <div class="progress-fill" 
                                 style="width: ${devicePercentages.tablet}%; 
                                        background: ${colors.tablet};
                                        transition: width 0.3s ease;" 
                                 title="Tablet ${devicePercentages.tablet}%">
                            </div>
                        </div>
                    </div>
    
                    <div style="display: flex; 
                                justify-content: space-between; 
                                margin-top: 10px; 
                                font-size: 12px; 
                                color: ${colors.textSecondary};">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="display: inline-block; 
                                       width: 10px; 
                                       height: 10px; 
                                       background: ${colors.mobile}; 
                                       border-radius: 50%;"></span>
                            <span>Móvil ${devicePercentages.mobile}%</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="display: inline-block; 
                                       width: 10px; 
                                       height: 10px; 
                                       background: ${colors.desktop}; 
                                       border-radius: 50%;"></span>
                            <span>Desktop ${devicePercentages.desktop}%</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="display: inline-block; 
                                       width: 10px; 
                                       height: 10px; 
                                       background: ${colors.tablet}; 
                                       border-radius: 50%;"></span>
                            <span>Tablet ${devicePercentages.tablet}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLeadsDetails(leads) {
        const container = document.querySelector('.leads-metrics');
        if (!container) return;
    
        const total = leads.total || 1;
        const statuses = [
            { 
                label: 'Nuevos', 
                count: leads.new || 0, 
                color: 'var(--principal)',
                className: 'new'
            },
            { 
                label: 'En contacto', 
                count: leads.contacted || 0, 
                color: 'var(--bueno)',
                className: 'contacted'
            },
            { 
                label: 'En negociación', 
                count: leads.negotiating || 0, 
                color: 'var(--accent)',
                className: 'negotiating'
            },
            { 
                label: 'Cerrados', 
                count: leads.won || 0, 
                color: 'var(--principal_2)',
                className: 'closed'
            }
        ];
    
        container.innerHTML = statuses.map(status => {
            const percentage = (status.count / total * 100).toFixed(1);
            return `
                <div class="lead-status-row">
                    <div class="status-header">
                        <span>${status.label}</span>
                        <span>${status.count} lead${status.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${status.className}"
                             style="width: ${percentage}%"
                             title="${percentage}%">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDeviceDistribution(devices) {
        const container = document.querySelector('.device-distribution');
        if (!container) return;

        const deviceTypes = [
            { type: 'mobile', name: 'Mobile', icon: 'mobile.png' },
            { type: 'desktop', name: 'Desktop', icon: 'desktop.png' },
            { type: 'tablet', name: 'Tablet', icon: 'tablet.png' }
        ];

        const totalUnique = Object.values(devices)
            .reduce((sum, device) => sum + device.unique, 0) || 1;

        container.innerHTML = `
            <div class="stats-detail-card">
                <h3>Distribución por Dispositivo</h3>
                ${deviceTypes.map(device => {
                    const stats = devices[device.type] || { unique: 0, total: 0 };
                    const percentage = ((stats.unique / totalUnique) * 100).toFixed(1);
                    
                    return `
                        <div class="device-row">
                            <div class="device-info">
                                <img src="/assets/img/${device.icon}" alt="${device.name}">
                                <span>${device.name}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span>${percentage}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderMarketComparison(data) {
        const container = document.querySelector('.comparison-metrics');
        if (!container) return;
    
        const metrics = [
            {
                label: 'Percentil de exposición',
                value: `Top ${data.exposure_percentile || 0}%`,
                isPositive: true
            },
            {
                label: 'vs. Promedio de zona',
                value: `${data.vs_area_avg >= 0 ? '+' : ''}${data.vs_area_avg || 0}%`,
                isPositive: data.vs_area_avg >= 0
            },
            {
                label: 'Precio vs. Mercado',
                value: `${data.price_comparison >= 0 ? '+' : ''}${data.price_comparison || 0}%`,
                isPositive: data.price_comparison >= 0 && data.price_comparison <= 10
            },
            {
                label: 'Tiempo en mercado',
                value: `${data.days_on_market || 0} días`,
                isPositive: (data.days_on_market || 0) <= 45
            }
        ];
    
        container.innerHTML = metrics.map(metric => `
            <div class="comparison-row">
                <span class="metric-label">${metric.label}</span>
                <span class="metric-value ${metric.isPositive ? 'positive' : 'negative'}">${metric.value}</span>
            </div>
        `).join('');
    }

    calculateTrendInverse(current, previous) {
        if (!previous || !current) return null;
        const percentage = ((previous - current) / previous) * 100;
        return {
            value: Math.abs(percentage.toFixed(1)),
            direction: percentage >= 0 ? 'up' : 'down'
        };
    }

    formatDuration(seconds) {
        if (!seconds) return '0s';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes === 0) {
            return `${remainingSeconds}s`;
        } else if (remainingSeconds === 0) {
            return `${minutes}m`;
        } else {
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PropertyStats();
});