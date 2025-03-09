// Función para obtener y mostrar el límite de propiedades
function showPropertyLimits() {
    fetch('/api/propiedades/get_property_limits.php')
        .then(response => response.json())
        .then(data => {
            // Crear o actualizar el indicador
            updatePropertyLimitIndicator(data);
        })
        .catch(error => {
            console.error('Error al obtener límites de propiedades:', error);
        });
}

// Función para actualizar el indicador visual
function updatePropertyLimitIndicator(data) {
    // Buscar el elemento de filtros de publicaciones
    const filtrosContainer = document.querySelector('.filtros_publicaciones');
    
    if (!filtrosContainer) return;
    
    // Verificar si existe el elemento de propiedades
    let propiedadesIndicator = document.querySelector('.propiedades-indicator');
    
    if (!propiedadesIndicator) {
        // Crear el elemento si no existe
        propiedadesIndicator = document.createElement('div');
        propiedadesIndicator.className = 'propiedades-indicator';
        
        // Insertar después del checkbox de "Se encontro"
        const checkboxLabel = filtrosContainer.querySelector('.seleccionar_todas_publicaciones');
        if (checkboxLabel) {
            filtrosContainer.insertBefore(propiedadesIndicator, checkboxLabel.nextSibling);
        } else {
            filtrosContainer.insertBefore(propiedadesIndicator, filtrosContainer.firstChild.nextSibling);
        }
        
        // Agregar estilos
        addPropertyLimitStyles();
    }
    
    // Determinar el estado del límite
    let statusClass = 'normal';
    let limitText = data.limit;
    
    // Si es infinito
    if (data.limit === "∞") {
        statusClass = 'unlimited';
    } else {
        // Calcular porcentaje de uso
        const limit = parseInt(data.limit);
        const total = parseInt(data.total_properties);
        const percentage = limit > 0 ? (total / limit) * 100 : 100;
        
        if (percentage >= 90) {
            statusClass = 'danger';
        } else if (percentage >= 70) {
            statusClass = 'warning';
        }
    }
    
    // Actualizar contenido
    propiedadesIndicator.innerHTML = `
        <div class="propiedades-text">Propiedades: ${data.total_properties}/${limitText}</div>
    `;
    
    // Actualizar clase
    propiedadesIndicator.className = `propiedades-indicator ${statusClass}`;
}

// Función para agregar estilos
function addPropertyLimitStyles() {
    if (!document.getElementById('property-limit-styles')) {
        const style = document.createElement('style');
        style.id = 'property-limit-styles';
        style.textContent = `
            .propiedades-indicator {
                display: flex;
                align-items: center;
                padding: 4px 12px;
                background-color: var(--border);
                border-radius: 30px;
                margin-left: 15px;
                font-family: var(--txt);
                font-size: 14px;
                color: var(--colortxt);
                border: 1px solid var(--border);
                white-space: nowrap;
            }
            
            .propiedades-indicator.warning {
                background-color: rgba(255, 152, 0, 0.2);
                border-color: #FF9800;
                color: #e65100;
            }
            
            .propiedades-indicator.danger {
                background-color: rgba(244, 67, 54, 0.2);
                border-color: #F44336;
                color: #b71c1c;
            }
            
            .propiedades-indicator.unlimited {
                background-color: rgba(76, 175, 80, 0.2);
                border-color: #4CAF50;
                color: #1b5e20;
            }
            
            @media (max-width: 767px) {
                .propiedades-indicator {
                    order: -1;
                    margin-left: 0;
                    margin-right: auto;
                    font-size: 12px;
                    padding: 3px 10px;
                }
                
                .filtros_publicaciones {
                    flex-wrap: wrap;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Solo en páginas relevantes (dashboard de propiedades)
    if (document.querySelector('.dashboard_container')) {
        // Pequeño retraso para asegurar que otros elementos ya se cargaron
        setTimeout(showPropertyLimits, 500);
    }
});