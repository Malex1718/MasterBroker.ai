// inicio_sesion.js

document.addEventListener('DOMContentLoaded', function() {
    // Verificar si el usuario viene de una sesión expirada
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
        showError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        
        // Limpiar la URL
        const newUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, newUrl);
    }
    // Elementos del DOM
    const loginForm = document.querySelector('.login_form');
    const registroForm = document.querySelector('.registro_form');
    const registerLink = document.querySelector('.register_link');
    const backButtons = document.querySelectorAll('.back_button');
    const passwordInputs = document.querySelectorAll('.password_input');
    const selects = document.querySelectorAll('.custom_select select');
    const userTypeSelect = document.querySelector('#user_type');
    const fiscalFields = document.getElementById('fiscal_fields');
    const phoneField = document.getElementById('phone_field');
    const lastNameField = document.getElementById('last_name_field');

    // Clase para manejar la autenticación

    class AuthService {
        constructor() {
            this.baseUrl = window.location.origin;
            this.sessionKey = 'vibien_session';
            this.sessionDuration = 7 * 60 * 60 * 1000; // 7 horas en milisegundos
            this.apiCheckUrl = '/api/check_session.php';
        }

        setSession(userData) {
            const sessionData = {
                id: userData.id,
                first_name: userData.first_name,
                last_name: userData.last_name || '',
                phone: userData.phone || '',
                mobile: userData.mobile,
                email: userData.email,
                user_type: userData.user_type,
                timestamp: new Date().getTime(),
                expiration: new Date().getTime() + this.sessionDuration
            };
    
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        }

        async checkServerSession() {
            try {
                const response = await fetch(this.apiCheckUrl, {
                    method: 'GET',
                    credentials: 'include' // Importante para enviar cookies de sesión
                });
                
                if (!response.ok) {
                    throw new Error('Error en la respuesta del servidor');
                }
                
                const data = await response.json();
                
                // Si la sesión no está activa en el servidor, limpiar localmente
                if (!data.is_active) {
                    this.clearSession();
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('Error verificando sesión con el servidor:', error);
                // En caso de error de conexión, confiamos en la validación local
                return this.isLocallyAuthenticated();
            }
        }

        isLocallyAuthenticated() {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) return false;
            
            const sessionData = JSON.parse(session);
            
            // Verificar si la sesión ha expirado
            if (sessionData.expiration && new Date().getTime() > sessionData.expiration) {
                this.clearSession();
                return false;
            }
            
            return true;
        }

        getSession() {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) return null;
            
            const sessionData = JSON.parse(session);
            
            // Verificar si la sesión ha expirado
            if (sessionData.expiration && new Date().getTime() > sessionData.expiration) {
                this.clearSession();
                return null;
            }
            
            return sessionData;
        }
    
        clearSession() {
            localStorage.removeItem(this.sessionKey);
        }

        async register(userData) {
            try {
                console.log('Datos a enviar:', userData);
                const response = await fetch('/api/register.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Error en el registro');

                // Si el registro es exitoso, guardamos los datos en sessionStorage
                if (data.success) {
                    this.setSession({
                        id: data.user.id,
                        first_name: userData.first_name,
                        last_name: userData.last_name || '',
                        phone: userData.phone || '',
                        mobile: userData.mobile,
                        email: userData.email,
                        user_type: userData.user_type
                    });
                }

                return data;
            } catch (error) {
                console.error('Error en registro:', error);
                throw error;
            }
        }

        async login(credentials) {
            try {
                const response = await fetch('/api/login.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(credentials)
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Error en el inicio de sesión');

                // Si el login es exitoso, guardamos los datos
                if (data.success && data.user) {
                    this.setSession({
                        id: data.user.id,
                        first_name: data.user.first_name,
                        last_name: data.user.last_name || '',
                        phone: data.user.phone || '',
                        mobile: data.user.mobile,
                        email: data.user.email,
                        user_type: data.user.user_type
                    });
                }
                return data;
            } catch (error) {
                console.error('Error en login:', error);
                throw error;
            }
        }
    
        async isAuthenticated() {
            // Primero verificamos la autenticación local
            const isLocallyAuth = this.isLocallyAuthenticated();
            
            if (!isLocallyAuth) {
                return false;
            }
            
            // Si está autenticado localmente, verificamos con el servidor
            return await this.checkServerSession();
        }
    
        logout() {
            this.clearSession();
            
            // También hacer logout en el servidor
            fetch('/api/logout.php', {
                method: 'POST',
                credentials: 'include'
            }).then(() => {
                window.location.href = '/inicio_sesion.html';
            }).catch(error => {
                console.error('Error en logout:', error);
                window.location.href = '/inicio_sesion.html';
            });
        }
    }

    const authService = new AuthService();

    // Configuración inicial
    loginForm.classList.add('active');
    registroForm.classList.remove('active');
    registroForm.style.display = 'none';

    // Funciones auxiliares
    function showError(message) {
        alert(message);
    }

    function showSuccess(message) {
        alert(message);
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validateCURP(curp) {
        return /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/.test(curp.toUpperCase());
    }

    function validateRFC(rfc) {
        return /^[A-Z]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase());
    }

    function validatePhone(phone) {
        return /^\d{10}$/.test(phone.replace(/\D/g, ''));
    }

    // Función para cambiar entre formularios
    function switchForms(hideForm, showForm) {
        hideForm.classList.remove('active');
        hideForm.classList.add('inactive');

        setTimeout(() => {
            hideForm.style.display = 'none';
            showForm.style.display = 'block';
            showForm.offsetHeight;
            showForm.classList.remove('inactive');
            showForm.classList.add('active');
        }, 300);
    }

    // Función para limpiar formularios
    function limpiarFormulario(form) {
        form.reset();
        form.querySelectorAll('select').forEach(select => {
            select.style.color = 'var(--colorp)';
        });
        // Resetear campos ocultos y estados
        if (form === registroForm) {
            toggleFields('');
        }
    }

    // Función para mostrar/ocultar campos según tipo de usuario
    function toggleFields(userType) {
        console.log('Tipo de usuario seleccionado:', userType);

        if (!userType || userType === '') {
            if (lastNameField) lastNameField.style.display = 'none';
            if (fiscalFields) fiscalFields.style.display = 'none';
            return;
        }

        // Manejo del apellido
        if (lastNameField) {
            if (['Regular', 'particular'].includes(userType)) {
                lastNameField.style.display = 'block';
                const lastNameInput = lastNameField.querySelector('input');
                if (lastNameInput) {
                    lastNameInput.required = true;
                    lastNameInput.disabled = false;
                }
            } else {
                lastNameField.style.display = 'none';
                const lastNameInput = lastNameField.querySelector('input');
                if (lastNameInput) {
                    lastNameInput.required = false;
                    lastNameInput.disabled = true;
                    lastNameInput.value = '';
                }
            }
        }

        // Manejo de campos fiscales y teléfono
        if (userType === 'Regular') {
            if (fiscalFields) {
                fiscalFields.style.display = 'none';
                fiscalFields.querySelectorAll('input, select').forEach(input => {
                    input.required = false;
                    input.disabled = true;
                    input.value = '';
                });
            }
            if (phoneField) {
                const phoneInput = phoneField.querySelector('input');
                if (phoneInput) {
                    phoneInput.required = false;
                    phoneField.querySelector('label').textContent = 'Teléfono (opcional)';
                }
            }
        } else {
            if (fiscalFields) {
                fiscalFields.style.display = 'block';
                fiscalFields.querySelectorAll('input, select').forEach(input => {
                    input.required = true;
                    input.disabled = false;
                });
            }
            if (phoneField) {
                const phoneInput = phoneField.querySelector('input');
                if (phoneInput) {
                    phoneInput.required = true;
                    phoneField.querySelector('label').textContent = 'Teléfono';
                }
            }
        }
    }

    // Event Listeners
    registerLink?.addEventListener('click', (e) => {
        e.preventDefault();
        // Mostrar el formulario de registro en lugar de redirigir
        switchForms(loginForm, registroForm);
    });

    backButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentForm = button.closest('form');
            
            if (currentForm.classList.contains('registro_form')) {
                switchForms(registroForm, loginForm);
                limpiarFormulario(registroForm);
            } else {
                if (window.history.length > 1 && document.referrer) {
                    window.history.back();
                } else {
                    window.location.href = '/';
                }
            }
        });
    });

    // Toggle contraseña
    passwordInputs.forEach(container => {
        const input = container.querySelector('input');
        const toggleButton = container.querySelector('.toggle_password');
        const toggleIcon = toggleButton.querySelector('img');
        
        toggleButton.addEventListener('click', function() {
            const newType = input.type === 'password' ? 'text' : 'password';
            input.type = newType;
            toggleIcon.src = newType === 'password' ? '/assets/img/ojo.png' : '/assets/img/ojo-cerrado.png';
            toggleIcon.style.opacity = newType === 'password' ? '0.5' : '1';
        });
    });

    // Manejo de selects
    selects.forEach(select => {
        select.addEventListener('change', function() {
            this.style.color = this.value ? 'var(--colortxt)' : 'var(--colorp)';
        });
    });

    // Escuchar cambios en tipo de usuario
    userTypeSelect?.addEventListener('change', function(e) {
        const selectedValue = this.value;
        console.log('Cambio de tipo de usuario:', selectedValue);
        toggleFields(selectedValue);
        this.style.color = selectedValue ? 'var(--colortxt)' : 'var(--colorp)';
    });

    // Formulario de registro
    registroForm?.addEventListener('submit', async function(e) {
        e.preventDefault();

        try {
            const formData = new FormData(this);
            const userType = formData.get('user_type');

            console.log('Tipo de usuario seleccionado en submit:', userType);

            if (!userType) {
                showError('Por favor, selecciona un tipo de usuario');
                return;
            }

            // Datos base del usuario
            const userData = {
                user_type: userType,
                email: formData.get('email')?.trim(),
                password: formData.get('password'),
                first_name: formData.get('first_name')?.trim(),
                mobile: formData.get('mobile')?.trim()
            };

            // Validaciones básicas
            if (!userData.email || !userData.password || !userData.first_name || !userData.mobile) {
                showError('Por favor, completa todos los campos básicos requeridos');
                return;
            }

            if (!isValidEmail(userData.email)) {
                showError('Por favor, ingresa un email válido');
                return;
            }

            if (userData.password.length < 6) {
                showError('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            if (!validatePhone(userData.mobile)) {
                showError('Por favor, ingresa un número de celular válido (10 dígitos)');
                return;
            }

            // Campos adicionales según tipo de usuario
            if (['Regular', 'particular'].includes(userType)) {
                const lastName = formData.get('last_name')?.trim();
                if (!lastName) {
                    showError('Por favor, ingresa el apellido');
                    return;
                }
                userData.last_name = lastName;
            }

            // Campos para usuarios profesionales
            if (userType !== 'Regular') {
                const businessName = formData.get('business_name')?.trim();
                const fiscalCondition = formData.get('fiscal_condition');
                const taxId = formData.get('tax_id')?.trim();
                const phone = formData.get('phone')?.trim();

                if (!businessName || !fiscalCondition || !taxId) {
                    showError('Por favor, completa todos los campos fiscales');
                    return;
                }

                if (fiscalCondition === 'curp' && !validateCURP(taxId)) {
                    showError('Por favor, ingresa un CURP válido');
                    return;
                } else if (['rfc_moral', 'rfc_fisica'].includes(fiscalCondition) && !validateRFC(taxId)) {
                    showError('Por favor, ingresa un RFC válido');
                    return;
                }

                if (phone && !validatePhone(phone)) {
                    showError('Por favor, ingresa un número de teléfono válido');
                    return;
                }

                Object.assign(userData, {
                    business_name: businessName,
                    fiscal_condition: fiscalCondition,
                    tax_id: taxId.toUpperCase(),
                    phone: phone
                });
            }

            console.log('Datos a enviar:', userData);

            const response = await authService.register(userData);
            
            if (response.success) {
                showSuccess('Registro exitoso');
                window.location.href = '/inicio_sesion.html';
            }
        } catch (error) {
            showError(error.message || 'Error en el registro');
        }
    });

    // Formulario de login
    loginForm?.addEventListener('submit', async function(e) {
        e.preventDefault();

        try {
            const formData = new FormData(this);
            const email = formData.get('email')?.trim();
            const password = formData.get('password');

            if (!email || !password) {
                showError('Por favor, completa todos los campos');
                return;
            }

            if (!isValidEmail(email)) {
                showError('Por favor, ingresa un email válido');
                return;
            }

            const response = await authService.login({ email, password });

            if (response.success) {
                window.location.href = '/dashboard/publicaciones.html';
            }
        } catch (error) {
            showError(error.message || 'Error en el inicio de sesión');
        }
    });

    // Prevenir envío con Enter en inputs
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.type !== 'submit') {
                e.preventDefault();
                return false;
            }
        });
    });

    // Texto circular
    const text = "MASTER ◇ BROKER ◇ MASTER ◇ BROKER ◇ ";
    const textContainer = document.getElementById('texto-circular');
    if (textContainer) {
        const deg = 360 / text.length;
        text.split('').forEach((char, i) => {
            const span = document.createElement('span');
            span.innerText = char;
            span.style.transform = `rotate(${deg * i}deg)`;
            textContainer.appendChild(span);
        });
    }
});