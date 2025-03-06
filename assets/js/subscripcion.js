// Configuración del entorno
const ENV = {
    isTestMode: true, // Cambiar a false en producción
    stripePublishableKey: 'pk_test_51QwoDVCorMZEmsUnDz1rVqPRdpgHEM7bVLufMNzm8vg1ErwvzqN9VI0QtxB56ICHRuHpjNDGxCqqu0cwUtf4N2PH00Hj24DDNR', // Reemplazar con la clave adecuada según el entorno
    planPrices: {
        // Mapeo de IDs locales a IDs de precio de Stripe
        // Test mode
        test: {
            '1': 'price_1QzVfYCorMZEmsUnOLzbG1IF',
            '2': 'price_1QzWEtCorMZEmsUncToobQdL',
            '3': 'price_1QzWbuCorMZEmsUnDY7sg1zN',
            '4': 'price_1QzWedCorMZEmsUn4TmudeJi'
        },
        // Production mode
        production: {
            '1': 'price_1QygzwCorMZEmsUnLV6Vryxx',
            '2': 'price_1Qz0EECorMZEmsUnnJ8WyTyB',
            '3': 'price_1Qz0LqCorMZEmsUn2cNGiIun',
            '4': 'price_1Qz0Q7CorMZEmsUncUX9Wj67'
        }
    }
};

// Función para cambiar entre tabs
function showTab(tabName) {
    // Ocultar todos los contenidos de tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar el tab seleccionado y su contenido
    document.getElementById(tabName + '-content').classList.add('active');
    
    // Encontrar el tab que fue clickeado y activarlo
    const clickedTab = Array.from(tabs).find(tab => 
        tab.textContent.trim().toLowerCase().includes(tabName)
    );
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
}

// Inicializar Stripe y manejo de pagos
document.addEventListener('DOMContentLoaded', function() {
    // Mostrar banner de modo de prueba si corresponde
    if (ENV.isTestMode) {
        const testBanner = document.getElementById('test-mode-banner');
        if (testBanner) {
            testBanner.style.display = 'block';
        } else {
            // Si no existe el elemento, crearlo
            const banner = document.createElement('div');
            banner.id = 'test-mode-banner';
            banner.className = 'test-mode-banner';
            banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> MODO DE PRUEBA - Las transacciones no generarán cargos reales';
            document.body.prepend(banner);
        }
    }
    
    // Inicializar Stripe con la clave pública
    const stripeKey = ENV.isTestMode 
        ? ENV.stripePublishableKey 
        : 'pk_live_51QwoDVCorMZEmsUnbvQBXt33HBIJJwD2hMOuVOk10fZrndb81XAacHdspzGOI6W36NULeH1PQgq9ffAQHCqXeObc00B4BQTbLU';
        
    const stripe = Stripe(stripeKey);
    
    // Inicializar gestor de sesión (usando la clase existente)
    const sessionManager = new SessionManager();
    
    // Agregar event listeners a todos los botones de checkout
    const checkoutButtons = document.querySelectorAll('.checkout-button');
    
    checkoutButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Verificar si el usuario está logueado
            if (!sessionManager.isAuthenticated()) {
                alert('Debes iniciar sesión para suscribirte a un plan');
                window.location.href = '/inicio_sesion.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }
            
            // Obtener ID del plan del atributo data
            const planId = this.getAttribute('data-plan-id');
            if (!planId) return;
            
            // Obtener el ID de precio correspondiente según el modo
            const priceMode = ENV.isTestMode ? 'test' : 'production';
            const priceId = ENV.planPrices[priceMode][planId];
            
            if (!priceId) {
                console.error('ID de precio no encontrado para el plan:', planId);
                alert('Error en la configuración del plan. Por favor, intenta más tarde.');
                return;
            }
            
            // Deshabilitar botón y mostrar carga
            this.disabled = true;
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="spinner-border" role="status" aria-hidden="true"></span> Procesando...';
            
            try {
                // Obtener ID de usuario de la sesión
                // Usamos getSession() en lugar de getUserId()
                const session = sessionManager.getSession();
                if (!session || !session.id) {
                    throw new Error('No se pudo obtener el ID de usuario');
                }
                const userId = session.id;
                
                // Obtener sesión de checkout desde el servidor
                const response = await fetch('/api/auth/create-checkout-session.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        plan_id: planId,
                        price_id: priceId,
                        user_id: userId
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok || data.error) {
                    throw new Error(data.error || 'Error al crear la sesión de checkout');
                }
                
                // Redirigir a Checkout
                const result = await stripe.redirectToCheckout({
                    sessionId: data.sessionId
                });
                
                if (result.error) {
                    throw new Error(result.error.message);
                }
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error: ' + error.message);
                this.disabled = false;
                this.innerHTML = originalText;
            }
        });
    });
});