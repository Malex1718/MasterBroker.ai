// navigation.js

// Clase para manejar la sesión
class SessionManager {
    constructor() {
        this.sessionKey = 'vibien_session';
        this.sessionDuration = 7 * 60 * 60 * 1000; // 7 horas en milisegundos
        this.apiUrl = 'https://masterbroker.ai/api/check_session.php';
    }

    setSession(userData) {
        if (!userData || typeof userData !== 'object') {
            console.error('❌ Datos de usuario inválidos');
            return;
        }

        const sessionData = {
            id: userData.id || '',
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            phone: userData.phone || '',
            mobile: userData.mobile || '',
            email: userData.email || '',
            user_type: userData.user_type || '',
            timestamp: new Date().getTime(),
            expiration: new Date().getTime() + this.sessionDuration
        };

        if (!sessionData.email || !sessionData.id) {
            console.error('❌ Datos de sesión incompletos');
            this.clearSession();
            return;
        }

        try {
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
            console.log('✅ Sesión guardada:', sessionData);
        } catch (error) {
            console.error('❌ Error guardando sesión:', error);
        }
    }

    async checkServerSession() {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'GET',
                credentials: 'include' // Importante para enviar cookies de sesión
            });
            
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            
            const data = await response.json();
            console.log('🔄 Verificación de sesión con servidor:', data);
            
            // Si la sesión no está activa en el servidor, limpiar localmente
            if (!data.is_active) {
                console.log('❌ Sesión expirada o inválida en el servidor');
                this.clearSession();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error verificando sesión con el servidor:', error);
            // En caso de error, confiamos en la validación local
            return this.isLocallyAuthenticated();
        }
    }

    isLocallyAuthenticated() {
        try {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) {
                return false;
            }

            const sessionData = JSON.parse(session);
            
            // Verificar si la sesión ha expirado localmente
            if (sessionData.expiration && new Date().getTime() > sessionData.expiration) {
                console.log('📄 Sesión expirada localmente');
                this.clearSession();
                return false;
            }
            
            if (!sessionData.email || !sessionData.id) {
                console.error('❌ Sesión inválida - Datos incompletos');
                this.clearSession();
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Error verificando autenticación local:', error);
            this.clearSession();
            return false;
        }
    }

    getSession() {
        try {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) {
                console.log('📄 No hay sesión activa');
                return null;
            }

            const sessionData = JSON.parse(session);
            
            // Verificar si la sesión ha expirado
            if (sessionData.expiration && new Date().getTime() > sessionData.expiration) {
                console.log('📄 Sesión expirada');
                this.clearSession();
                return null;
            }
            
            if (!sessionData.email || !sessionData.id) {
                console.error('❌ Sesión inválida - Datos incompletos');
                this.clearSession();
                return null;
            }

            console.log('📄 Sesión activa:', sessionData);
            return sessionData;
        } catch (error) {
            console.error('❌ Error leyendo sesión:', error);
            this.clearSession();
            return null;
        }
    }

    clearSession() {
        try {
            localStorage.removeItem(this.sessionKey);
            console.log('🗑️ Sesión eliminada');
        } catch (error) {
            console.error('❌ Error limpiando sesión:', error);
        }
    }

    async isAuthenticated() {
        // Primero verificamos la autenticación local
        const isLocallyAuth = this.isLocallyAuthenticated();
        console.log('🔐 Estado de autenticación local:', isLocallyAuth);
        
        if (!isLocallyAuth) {
            return false;
        }
        
        // Si está autenticado localmente, verificamos con el servidor
        const isServerAuth = await this.checkServerSession();
        console.log('🔐 Estado de autenticación en servidor:', isServerAuth);
        
        return isServerAuth;
    }
}

// Clase para manejar la navegación
class NavigationManager {
    constructor() {
        this.sessionManager = new SessionManager();
        console.log('🚀 Inicializando NavigationManager');
        this.initElements();
        this.checkAuthState();
        
        // Verificar la expiración de la sesión cada minuto
        this.sessionCheckInterval = setInterval(() => {
            this.checkAuthState();
        }, 60000); // 60 segundos
    }

    initElements() {
        // Elementos de sesión
        this.loginButtons = document.querySelectorAll('.iniciar-btn');
        this.userButtons = document.querySelectorAll('.user-btn');
        this.userMenu = document.querySelector('.nav_user');
        this.menuUser = document.querySelector('.menu_user');
        
        // Elementos de información de usuario
        this.userNameDisplays = document.querySelectorAll('.datos_user h4');
        this.userIdDisplays = document.querySelectorAll('.datos_user span');
        
        // Botones y menús
        this.logoutButtons = document.querySelectorAll('.cerrar_sesion');
        this.publishButtons = document.querySelectorAll('.publicar-btn');

        console.log('🔍 Elementos encontrados:', {
            'Botones login': this.loginButtons.length,
            'Botones usuario': this.userButtons.length,
            'Displays nombre': this.userNameDisplays.length,
            'Displays ID': this.userIdDisplays.length,
            'Menú usuario': !!this.userMenu,
            'Menú usuario móvil': !!this.menuUser
        });
    }

    async checkAuthState() {
        console.log('🔄 Verificando estado de autenticación...');
        
        // Primero obtenemos los datos de la sesión local para UI rápida
        const sessionData = this.sessionManager.getSession();
        
        // Actualizamos UI basado en datos locales
        this.updateUI(sessionData);
        
        // Luego verificamos con el servidor (asíncrono)
        const isAuth = await this.sessionManager.isAuthenticated();
        
        // Si no está autenticado después de verificar con el servidor, actualizamos UI
        if (!isAuth) {
            console.log('👤 Sesión expirada o inválida después de verificar con servidor');
            this.updateUI(null);
        }
    }

    updateUI(session) {
        if (session && session.email && session.id) {
            console.log('👤 Usuario autenticado:', session);

            // Ocultar botones de login
            this.loginButtons.forEach(button => {
                if (button) button.style.cssText = 'display: none !important;';
            });

            // Mostrar botones de usuario
            this.userButtons.forEach(button => {
                if (button) {
                    button.style.cssText = 'display: flex !important;';
                    button.textContent = session.first_name.charAt(0).toUpperCase();
                }
            });

            // Actualizar información de usuario
            this.userNameDisplays.forEach(display => {
                if (display) {
                    display.textContent = session.first_name + 
                        (session.last_name ? ' ' + session.last_name : '');
                }
            });

            this.userIdDisplays.forEach(display => {
                if (display) display.textContent = session.id;
            });

            // Mostrar menús de usuario
            if (this.menuUser) {
                this.menuUser.style.display = 'flex';
                const menuList = this.menuUser.querySelector('.main-menu');
                if (menuList) {
                    menuList.style.display = 'none';
                    menuList.style.maxHeight = '0';
                }
                const arrowIcon = this.menuUser.querySelector('.datos_user img');
                if (arrowIcon) {
                    arrowIcon.style.transform = 'translateY(-50%) rotate(180deg)';
                }
            }

            // Actualizar URLs de publicación
            this.publishButtons.forEach(button => {
                if (button) button.href = '/dashboard/workspace/publicador.html';
            });

        } else {
            console.log('👤 Usuario no autenticado');
            
            // Mostrar botones de login y ocultar elementos de usuario
            this.loginButtons.forEach(button => {
                if (button) button.style.cssText = 'display: flex !important;';
            });

            this.userButtons.forEach(button => {
                if (button) button.style.cssText = 'display: none !important;';
            });

            if (this.userMenu) this.userMenu.style.display = 'none';
            if (this.menuUser) this.menuUser.style.display = 'none';

            // Actualizar URLs de publicación
            this.publishButtons.forEach(button => {
                if (button) button.href = '/inicio_sesion.html';
            });
        }
    }

    destroy() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }
    }
}

// Función para manejar el menú de usuario principal
function handleUserMenu() {
    const userBtn = document.querySelector('.user-btn');
    const navUser = document.querySelector('.nav_user');
    const logoutButtons = document.querySelectorAll('.cerrar_sesion');
    
    if (!userBtn || !navUser) {
        console.log('❌ Elementos del menú de usuario no encontrados');
        return;
    }

    let isMenuOpen = false;

    function toggleUserMenu() {
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            navUser.style.display = 'flex';
            void navUser.offsetHeight;
            navUser.style.right = '0';
            console.log('📂 Menú de usuario abierto');
        } else {
            navUser.style.right = '-100%';
            setTimeout(() => {
                if (!isMenuOpen) {
                    navUser.style.display = 'none';
                }
            }, 300);
            console.log('📁 Menú de usuario cerrado');
        }
    }

    // Event Listeners del menú de usuario
    userBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleUserMenu();
    });

    document.addEventListener('click', function(e) {
        if (!navUser.contains(e.target) && !userBtn.contains(e.target) && isMenuOpen) {
            toggleUserMenu();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isMenuOpen) {
            toggleUserMenu();
        }
    });

    // Manejar cierre de sesión
    logoutButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('👋 Iniciando cierre de sesión');
                const sessionManager = new SessionManager();
                sessionManager.clearSession();
                window.location.href = '/inicio_sesion.html';
            });
        }
    });
}

// Función para manejar el menú lateral móvil
function handleNavLateral() {
    const hamburger = document.querySelector('.hamburger input');
    const navLateralFondo = document.querySelector('.nav_lateral_fondo');
    
    if (!hamburger || !navLateralFondo) return;

    hamburger.addEventListener('change', function() {
        if (this.checked) {
            navLateralFondo.style.display = 'block';
            void navLateralFondo.offsetHeight;
            navLateralFondo.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            navLateralFondo.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (!this.checked) {
                    navLateralFondo.style.display = 'none';
                }
            }, 300);
        }
    });

    navLateralFondo.addEventListener('click', function(e) {
        if (e.target === this) {
            hamburger.checked = false;
            this.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (!hamburger.checked) {
                    this.style.display = 'none';
                }
            }, 300);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && hamburger.checked) {
            hamburger.checked = false;
            navLateralFondo.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (!hamburger.checked) {
                    navLateralFondo.style.display = 'none';
                }
            }, 300);
        }
    });
}

// Función para manejar el menú de usuario móvil
function handleMenuUserMobile() {
    const menuUserDataElements = document.querySelectorAll('.menu_user .datos_user');
    
    menuUserDataElements.forEach(menuUserData => {
        const menuList = menuUserData.parentElement.querySelector('.main-menu');
        const arrowIcon = menuUserData.querySelector('img');
        
        if (!menuList || !arrowIcon) return;

        // Establecer estado inicial
        let isOpen = false;
        menuList.style.display = 'none';
        menuList.style.maxHeight = '0';
        arrowIcon.style.transform = 'translateY(-50%) rotate(180deg)';

        menuUserData.addEventListener('click', function(e) {
            e.preventDefault();
            isOpen = !isOpen;
            
            if (isOpen) {
                // Abrir menú
                menuList.style.display = 'flex';
                // Forzar reflow
                void menuList.offsetHeight;
                menuList.style.maxHeight = `${menuList.scrollHeight}px`;
                arrowIcon.style.transform = 'translateY(-50%) rotate(0deg)';
            } else {
                // Cerrar menú
                menuList.style.maxHeight = '0';
                arrowIcon.style.transform = 'translateY(-50%) rotate(180deg)';
                setTimeout(() => {
                    if (!isOpen) menuList.style.display = 'none';
                }, 300);
            }
        });
    });
}

// Función para actualizar elementos activos del menú
function updateActiveNavItem() {
    const currentPath = window.location.pathname;
    const menuItems = document.querySelectorAll('.main-menu a');
    const lateralMenuItems = document.querySelectorAll('.nav_lateral .main-menu a');
    
    const updateActive = (items) => {
        items.forEach(item => {
            item.classList.remove('active');
            item.parentElement.classList.remove('active');
            
            const itemPath = item.getAttribute('href');
            if (currentPath === itemPath || 
                (currentPath.includes(itemPath) && itemPath !== '/') ||
                (currentPath === '/' && itemPath === '/')) {
                item.classList.add('active');
                item.parentElement.classList.add('active');
            }
        });
    };

    updateActive(menuItems);
    updateActive(lateralMenuItems);
}

// Función de depuración
function debugSession() {
    console.group('🔍 Depuración de Sesión');
    const sessionManager = new SessionManager();
    const session = sessionManager.getSession();
    
    if (session) {
        console.log('📋 Datos de sesión encontrados:', {
            ID: session.id,
            Email: session.email,
            Nombre: session.first_name,
            Apellido: session.last_name,
            Tipo: session.user_type,
            Timestamp: new Date(session.timestamp).toLocaleString()
        });
    } else {
        console.log('❌ No se encontró sesión activa');
    }
    console.groupEnd();
}

// Función de inicialización principal
function initNavigation() {
    console.group('🚀 Inicialización de Navegación');
    console.log('⏳ Iniciando navegación...');
    
    // Inicializar NavigationManager
    const navigationManager = new NavigationManager();
    
    // Inicializar componentes
    console.log('📍 Actualizando estado activo del menú');
    updateActiveNavItem();
    
    console.log('📱 Configurando navegación lateral');
    handleNavLateral();
    
    console.log('👤 Configurando menú de usuario');
    handleUserMenu();
    
    console.log('📱 Configurando menú de usuario móvil');
    handleMenuUserMobile();
    
    console.groupEnd();
}

// Event Listeners
window.addEventListener('popstate', updateActiveNavItem);
document.addEventListener('DOMContentLoaded', initNavigation);

// Exportaciones globales
window.SessionManager = SessionManager;
window.NavigationManager = NavigationManager;
window.debugSession = debugSession;