// subscription_enforcer.js - Para bloqueo y redirección agresiva

class SubscriptionEnforcer {
    constructor() {
        this.overlayCreated = false;
        this.redirectUrl = '/planes.html';
        this.redirectTimeout = null;
        this.checkCount = 0;
        this.maxChecks = 3; // Intentar máximo 3 veces antes de forzar redirección
    }

    // Verificar suscripción de forma agresiva
    async enforceSubscription() {
        try {
            const response = await fetch('/api/auth/check_subscription.php');
            const data = await response.json();
            
            // Si hay error o usuario no autenticado, session_check.js se encargará
            if (data.error || !data.user_id) {
                return;
            }
            
            // Si no tiene suscripción, bloquear pantalla y redirigir
            if (!data.has_subscription) {
                this.blockScreenAndRedirect(data.user_name || 'Usuario', data.redirect || this.redirectUrl);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error al verificar la suscripción:', error);
            this.checkCount++;
            
            // Si fallamos demasiadas veces, mejor redirigir por precaución
            if (this.checkCount >= this.maxChecks) {
                this.blockScreenAndRedirect('Usuario', this.redirectUrl);
                return false;
            }
            
            return null; // Estado indeterminado
        }
    }
    
    // Bloquear pantalla completamente y redirigir
    blockScreenAndRedirect(userName, redirectUrl) {
        // Evitar crear múltiples overlays
        if (this.overlayCreated) return;
        
        // Prevenir scroll en el documento
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        // Crear overlay de bloqueo
        const overlay = document.createElement('div');
        overlay.id = 'subscription-enforcer-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(23, 37, 85, 0.97);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        // Contenido del overlay - todo el texto en blanco
        overlay.innerHTML = `
            <div style="max-width: 600px; padding: 30px; text-align: center; color: white;">
                <img src="/assets/img/master-white.png" alt="Logo" style="max-width: 180px; margin-bottom: 30px; margin: 0px auto;">
                <h1 style="font-size: 28px; margin-bottom: 20px; color: white;">¡Acceso Restringido!</h1>
                <p style="font-size: 18px; margin-bottom: 30px; color: white;">Hola ${userName}, para acceder a esta sección necesitas tener una suscripción activa.</p>
                <div style="font-size: 16px; margin-bottom: 30px; color: white;">Serás redirigido a nuestra página de planes en <span id="countdown" style="color: white;">5</span> segundos.</div>
                <button id="redirect-now-btn" style="
                    background-color: #3498db;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    font-weight: bold;
                    border-radius: 4px;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    transition: background-color 0.3s;
                ">Ver Planes Ahora</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.overlayCreated = true;
        
        // Countdown para redirección automática
        let secondsLeft = 5;
        const countdownElement = document.getElementById('countdown');
        
        this.redirectTimeout = setInterval(() => {
            secondsLeft--;
            if (countdownElement) {
                countdownElement.textContent = secondsLeft;
            }
            
            if (secondsLeft <= 0) {
                clearInterval(this.redirectTimeout);
                window.location.href = redirectUrl;
            }
        }, 1000);
        
        // Botón para redirección inmediata
        const redirectButton = document.getElementById('redirect-now-btn');
        if (redirectButton) {
            redirectButton.addEventListener('click', () => {
                clearInterval(this.redirectTimeout);
                window.location.href = redirectUrl;
            });
        }
    }
}

// Determinar si estamos en una página protegida
function isProtectedPage() {
    return window.location.pathname.includes('/dashboard/') || 
           window.location.pathname.includes('/workspace/');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Verificar en todas las páginas protegidas
    if (isProtectedPage()) {
        const enforcer = new SubscriptionEnforcer();
        
        // Verificar inmediatamente con un pequeño retraso para evitar carrera con session_check.js
        setTimeout(() => {
            enforcer.enforceSubscription();
        }, 800);
        
        // También verificar cuando la página esté completamente cargada
        window.addEventListener('load', () => {
            enforcer.enforceSubscription();
        });
    }
});