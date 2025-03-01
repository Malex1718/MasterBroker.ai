// session_check.js

document.addEventListener('DOMContentLoaded', async function() {
    // Crear instancia de SessionManager
    const sessionManager = new SessionManager();
    
    // Verificar autenticación (incluye verificación con servidor)
    const isAuth = await sessionManager.isAuthenticated();
    
    // Si no está autenticado y estamos en una página protegida, redirigir
    if (!isAuth && isProtectedPage()) {
        redirectToLogin();
    }
    
    // Configurar verificación periódica
    setInterval(async () => {
        const stillAuth = await sessionManager.isAuthenticated();
        if (!stillAuth && isProtectedPage()) {
            showSessionExpiredMessage();
            setTimeout(() => {
                redirectToLogin();
            }, 2000);
        }
    }, 60000); // Verificar cada minuto
});

function isProtectedPage() {
    // Detectar si estamos en una página que requiere autenticación
    return window.location.pathname.includes('/dashboard/') || 
           window.location.pathname.includes('/workspace/');
}

function redirectToLogin() {
    window.location.href = '/inicio_sesion.html?expired=true';
}

function showSessionExpiredMessage() {
    // Crear y mostrar un mensaje de sesión expirada
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #f8d7da;
        color: #721c24;
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        font-family: Arial, sans-serif;
    `;
    messageDiv.textContent = 'Tu sesión ha expirado. Serás redirigido a la página de inicio de sesión.';
    document.body.appendChild(messageDiv);
}