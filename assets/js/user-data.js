// Configuración de rutas de API
const API_ROUTES = {
    GET_USER_DATA: '/api/usuarios/get_user_data.php',
    UPDATE_USER_DATA: '/api/usuarios/update_user_data.php',
    UPLOAD_LOGO: '/api/usuarios/upload_logo.php',
    UPDATE_PASSWORD: '/api/usuarios/update_password.php',
    GOOGLE_AUTH: '/api/auth/google_auth.php',
    GOOGLE_DISCONNECT: '/api/auth/google_disconnect.php',
    GOOGLE_STATUS: '/api/auth/google_status.php',
    SAVE_OAUTH_STATE: '/api/auth/save_oauth_state.php'
};

// Función para manejar la visualización de imágenes con fallback
function setImageWithFallback(imgElement, mainSrc, fallbackSrc = '/assets/img/vendedor.png') {
    if (!imgElement) return;
    
    imgElement.onerror = function() {
        console.log('Error al cargar la imagen:', mainSrc);
        this.src = fallbackSrc;
        this.onerror = null;
    };
    
    imgElement.src = mainSrc;
}

// Función para manejar respuestas de la API
async function handleResponse(response) {
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        throw new TypeError("La respuesta no es JSON");
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Error del servidor: ${response.status}`);
    }

    return data;
}

// Función para cargar los datos del usuario
function loadUserData() {
    toggleLoader(true);

    fetch(API_ROUTES.GET_USER_DATA)
        .then(handleResponse)
        .then(data => {
            if (data.success && data.data) {
                populateForm(data.data);
            } else {
                throw new Error(data.error || 'No se pudieron cargar los datos');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Error al cargar los datos: ' + error.message);
        })
        .finally(() => {
            toggleLoader(false);
        });
}

// Función para rellenar el formulario
function populateForm(userData) {
    const inputs = document.querySelectorAll('.cuenta_datos input[type="text"], .cuenta_datos input[type="tel"]');
    
    inputs.forEach(input => {
        const parentLabel = input.closest('label');
        if (!parentLabel) return;

        const labelText = parentLabel.textContent.trim().toLowerCase();

        if (labelText.includes('nombre')) {
            input.value = userData.first_name || '';
        }
        else if (labelText.includes('apellido')) {
            input.value = userData.last_name || '';
        }
        else if (labelText.includes('razón social')) {
            input.value = userData.business_name || '';
            parentLabel.style.display = [2,3,4,5].includes(userData.role_id) ? 'block' : 'none';
        }
        else if (labelText.includes('rfc') || labelText.includes('curp')) {
            input.value = userData.tax_id || '';
        }
        else if (labelText.includes('teléfono')) {
            input.value = userData.phone || '';
        }
        else if (labelText.includes('celular')) {
            input.value = userData.mobile || '';
        }
    });

    // Email
    const emailElement = document.querySelector('.correo_cuenta p');
    if (emailElement) {
        emailElement.textContent = userData.email || '';
    }

    // Condición Fiscal
    const fiscalConditionElement = document.querySelector('.fiscal-condition-display .readonly-value');
    if (fiscalConditionElement && userData.fiscal_condition_name) {
        fiscalConditionElement.textContent = userData.fiscal_condition_name;
    }

    // Logo
    const logoContainer = document.querySelector('.logo_de_empresa');
    const logoImg = document.querySelector('.mostrar_logo_cargado img');
    
    if (logoContainer && logoImg) {
        logoContainer.style.display = [2,3,4,5].includes(userData.role_id) ? 'block' : 'none';
        
        if (userData.company_logo) {
            setImageWithFallback(logoImg, `/uploads/logos/${userData.company_logo}`);
        } else {
            logoImg.src = '/assets/img/vendedor.png';
        }
    }
}

// Función para guardar datos
function saveUserData() {
    toggleLoader(true);

    const formData = {
        first_name: '',
        last_name: '',
        business_name: '',
        tax_id: '',
        phone: '',
        mobile: ''
    };

    const inputs = document.querySelectorAll('.cuenta_datos input[type="text"], .cuenta_datos input[type="tel"]');
    
    inputs.forEach(input => {
        const parentLabel = input.closest('label');
        if (!parentLabel) return;

        const labelText = parentLabel.textContent.trim().toLowerCase();

        if (labelText.includes('nombre')) {
            formData.first_name = input.value;
        }
        else if (labelText.includes('apellido')) {
            formData.last_name = input.value;
        }
        else if (labelText.includes('razón social')) {
            formData.business_name = input.value;
        }
        else if (labelText.includes('rfc') || labelText.includes('curp')) {
            formData.tax_id = input.value;
        }
        else if (labelText.includes('teléfono')) {
            formData.phone = input.value;
        }
        else if (labelText.includes('celular')) {
            formData.mobile = input.value;
        }
    });

    if (!formData.first_name.trim()) {
        showError('El nombre es requerido');
        toggleLoader(false);
        return;
    }

    if (formData.tax_id && !validateTaxId(formData.tax_id)) {
        showError('El formato del RFC/CURP no es válido');
        toggleLoader(false);
        return;
    }

    fetch(API_ROUTES.UPDATE_USER_DATA, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(handleResponse)
    .then(data => {
        if (data.success) {
            showSuccess(data.message || 'Datos actualizados correctamente');
            loadUserData();
        } else {
            throw new Error(data.error || 'Error al actualizar los datos');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Error al guardar los datos: ' + error.message);
    })
    .finally(() => {
        toggleLoader(false);
    });
}

// Función para actualizar contraseña
function updatePassword() {
    const currentPassword = document.querySelector('input[name="current_password"]');
    const newPassword = document.querySelector('input[name="new_password"]');
    const confirmPassword = document.querySelector('input[name="confirm_password"]');

    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('Error en el formulario de contraseña');
        return;
    }

    const currentValue = currentPassword.value.trim();
    const newValue = newPassword.value.trim();
    const confirmValue = confirmPassword.value.trim();

    if (!currentValue || !newValue || !confirmValue) {
        showError('Todos los campos son requeridos');
        return;
    }

    if (newValue !== confirmValue) {
        showError('Las contraseñas nuevas no coinciden');
        return;
    }

    if (newValue.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    toggleLoader(true);

    fetch(API_ROUTES.UPDATE_PASSWORD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            current_password: currentValue,
            new_password: newValue
        })
    })
    .then(handleResponse)
    .then(data => {
        if (data.success) {
            showSuccess('Contraseña actualizada correctamente');
            currentPassword.value = '';
            newPassword.value = '';
            confirmPassword.value = '';
            toggleViews('data');
        } else {
            throw new Error(data.error || 'Error al actualizar la contraseña');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Error al cambiar la contraseña: ' + error.message);
    })
    .finally(() => {
        toggleLoader(false);
    });
}

// Función para manejar la carga del logo
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('Por favor seleccione una imagen válida');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showError('La imagen no debe exceder 2MB');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    toggleLoader(true);

    fetch(API_ROUTES.UPLOAD_LOGO, {
        method: 'POST',
        headers: {
            'Accept': 'application/json'
        },
        body: formData
    })
    .then(handleResponse)
    .then(data => {
        if (data.success) {
            const logoImg = document.querySelector('.mostrar_logo_cargado img');
            if (logoImg) {
                setImageWithFallback(logoImg, `${data.logoUrl}?v=${new Date().getTime()}`);
            }
            showSuccess('Logo actualizado correctamente');
        } else {
            throw new Error(data.error || 'Error al subir el logo');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Error al subir el archivo: ' + error.message);
    })
    .finally(() => {
        toggleLoader(false);
    });
}

// Función para setup del toggle de contraseña
function setupPasswordVisibility() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'password-toggle';
        
        const toggleImg = document.createElement('img');
        toggleImg.src = '/assets/img/ojo-cerrado.png';
        toggleImg.alt = 'Toggle password visibility';
        toggleButton.appendChild(toggleImg);
        
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(toggleButton);
        
        toggleButton.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggleImg.src = isPassword ? '/assets/img/ojo.png' : '/assets/img/ojo-cerrado.png';
        });
    });
}

// Función para validar RFC/CURP
function validateTaxId(taxId) {
    taxId = taxId.trim().toUpperCase();
    
    const rfcMoralPattern = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/;
    const rfcFisicaPattern = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
    const curpPattern = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/;
    
    return rfcMoralPattern.test(taxId) || 
           rfcFisicaPattern.test(taxId) || 
           curpPattern.test(taxId);
}

// Función para alternar vistas
function toggleViews(view) {
    const dataView = document.querySelector('.cuenta_datos');
    const passwordView = document.querySelector('.cambiar_contrasena');

    if (view === 'password') {
        passwordView.style.display = 'block';
        dataView.style.display = 'none';
    } else {
        passwordView.style.display = 'none';
        dataView.style.display = 'block';
    }
}

// Funciones de utilidad
function toggleLoader(show = true) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showSuccess(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: message,
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        alert(message);
    }
}

function showError(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message
        });
    } else {
        alert('Error: ' + message);
    }
}

// Función para manejar la conexión con Google
async function conectarGoogle() {
    console.log('Iniciando conexión con Google...');
    toggleLoader(true);
    
    try {
        // 1. Generar estado aleatorio para seguridad CSRF
        const state = generateRandomState();
        
        // 2. Guardar el estado en el servidor para validarlo después
        const stateResponse = await fetch(API_ROUTES.SAVE_OAUTH_STATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ state: state })
        }).then(handleResponse);
        
        if (!stateResponse.success) {
            throw new Error('No se pudo guardar el estado de seguridad');
        }
        
        // 3. Construir URL de autorización con el flujo de código
        const authParams = new URLSearchParams({
            client_id: '939527510238-dl9tuciuu2igh1ino8dfsttqog76a4vu.apps.googleusercontent.com',
            redirect_uri: window.location.origin + '/api/auth/oauth2callback.php',
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
            access_type: 'offline',
            prompt: 'consent',
            state: state,
            include_granted_scopes: 'true'
        });
        
        // 4. Redireccionar al usuario a Google para autenticación
        window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + authParams.toString();
        
    } catch (error) {
        console.error('Error al iniciar autenticación con Google:', error);
        showError('Error al conectar con Google: ' + error.message);
        toggleLoader(false);
    }
}

// Función auxiliar para generar un state aleatorio
function generateRandomState() {
    const array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Función para cargar la biblioteca de Google
function loadGoogleLibrary() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = resolve;
        document.body.appendChild(script);
    });
}

// Manejar la respuesta de autenticación de Google
async function handleGoogleAuthResponse(response) {
    console.log('Respuesta completa de Google:', response);
    
    if (response.error) {
        console.error('Error de Google:', response.error);
        showError('Error al conectar con Google: ' + response.error);
        return;
    }

    console.log('Access Token:', response.access_token);
    console.log('Refresh Token:', response.refresh_token);
    console.log('Expires In:', response.expires_in);

    toggleLoader(true);
    try {
        const requestData = {
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            expires_in: response.expires_in
        };
        
        console.log('Datos a enviar al servidor:', requestData);

        const result = await fetch(API_ROUTES.GOOGLE_AUTH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        }).then(handleResponse);

        console.log('Respuesta del servidor:', result);

        if (result.success) {
            updateGoogleConnectionStatus(true);
            showSuccess('Cuenta de Google conectada correctamente');
        } else {
            throw new Error(result.error || 'Error al conectar la cuenta de Google');
        }
    } catch (error) {
        console.error('Error en autenticación de Google:', error);
        showError('Error al conectar cuenta: ' + error.message);
    } finally {
        toggleLoader(false);
    }
}

// Función para desconectar la cuenta de Google
async function desconectarGoogle() {
    toggleLoader(true);
    try {
        // Revocar el token en el servidor
        const result = await fetch(API_ROUTES.GOOGLE_DISCONNECT, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        }).then(handleResponse);

        if (result.success) {
            // Actualizar la UI para mostrar que la cuenta está desconectada
            updateGoogleConnectionStatus(false);
            showSuccess('Cuenta de Google desconectada correctamente');
        } else {
            throw new Error(result.error || 'Error al desconectar la cuenta');
        }
    } catch (error) {
        console.error('Error al desconectar Google:', error);
        showError('Error al desconectar cuenta: ' + error.message);
    } finally {
        toggleLoader(false);
    }
}

// Función para actualizar el estado de conexión en la UI
function updateGoogleConnectionStatus(isConnected) {
    const statusText = document.querySelector('.google-status');
    const connectButton = document.querySelector('[data-google-connect]');
    
    if (statusText && connectButton) {
        if (isConnected) {
            // Estado conectado
            statusText.textContent = 'Cuenta conectada';
            statusText.classList.add('text-green-600');
            connectButton.textContent = 'Desconectar Google';
            connectButton.classList.remove('bg-blue-50', 'text-blue-600');
            connectButton.classList.add('bg-red-50', 'text-red-600');
            
            // Usar setAttribute para cambiar el handler
            connectButton.setAttribute('onclick', 'desconectarGoogle()');
        } else {
            // Estado desconectado
            statusText.textContent = 'Conecta tu cuenta de Google';
            statusText.classList.remove('text-green-600');
            connectButton.textContent = 'Conectar Google';
            connectButton.classList.remove('bg-red-50', 'text-red-600');
            connectButton.classList.add('bg-blue-50', 'text-blue-600');
            
            // Usar setAttribute para cambiar el handler
            connectButton.setAttribute('onclick', 'conectarGoogle()');
        }
    }
}

// Función para verificar el estado de conexión al cargar la página
async function checkGoogleConnectionStatus() {
    try {
        const result = await fetch(API_ROUTES.GOOGLE_STATUS)
            .then(handleResponse);
        
        updateGoogleConnectionStatus(result.connected);
    } catch (error) {
        console.error('Error al verificar estado de Google:', error);
        updateGoogleConnectionStatus(false);
    }
}

// Inicialization
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();

    const saveButton = document.getElementById('guardar_datos');
    if (saveButton) {
        saveButton.addEventListener('click', saveUserData);
    }

    const changePassButton = document.getElementById('ir_cambiar_contraseña');
    if (changePassButton) {
        changePassButton.addEventListener('click', () => toggleViews('password'));
    }

    const backButton = document.getElementById('regresar_a_datos');
    if (backButton) {
        backButton.addEventListener('click', () => toggleViews('data'));
    }

    const savePasswordButton = document.getElementById('guardar_contrasena');
    if (savePasswordButton) {
        savePasswordButton.addEventListener('click', updatePassword);
    }

    const logoInput = document.querySelector('.file-input-wrapper input[type="file"]');
    if (logoInput) {
        logoInput.addEventListener('change', handleLogoUpload);
    }

    // Setup password visibility toggles
    setupPasswordVisibility();
    checkGoogleConnectionStatus();
});