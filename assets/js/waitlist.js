document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const form = document.getElementById('waitlistForm');
    const submitButton = form.querySelector('.submit-button');
    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.spinner');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    // Validaciones
    const validators = {
        name: (value) => {
            if (value.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
            if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) return 'El nombre solo debe contener letras';
            return '';
        },
        email: (value) => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ingresa un email válido';
            return '';
        },
        phone: (value) => {
            if (value && !/^\d{10}$/.test(value.replace(/\D/g, ''))) {
                return 'El teléfono debe tener 10 dígitos';
            }
            return '';
        },
        userType: (value) => {
            if (!value) return 'Selecciona un tipo de usuario';
            return '';
        }
    };

    // Función para mostrar/ocultar mensajes
    function toggleMessage(element, show = true, message = '') {
        element.textContent = message;
        element.style.display = show ? 'block' : 'none';
    }

    // Función para mostrar/ocultar el estado de carga
    function toggleLoading(loading) {
        submitButton.disabled = loading;
        buttonText.textContent = loading ? 'Procesando...' : 'Unirme a la lista de espera';
        spinner.style.display = loading ? 'block' : 'none';
    }

    // Validación en tiempo real
    form.querySelectorAll('input, select').forEach(field => {
        field.addEventListener('input', function() {
            const errorElement = document.getElementById(`${field.id}Error`);
            const validator = validators[field.id];
            
            if (validator) {
                const error = validator(field.value);
                toggleMessage(errorElement, error !== '', error);
            }
        });
    });

    // Manejo del envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validar todos los campos
        let hasErrors = false;
        const formData = new FormData(form);
        
        for (const [field, value] of formData.entries()) {
            const validator = validators[field];
            if (validator) {
                const error = validator(value);
                const errorElement = document.getElementById(`${field}Error`);
                toggleMessage(errorElement, error !== '', error);
                if (error) hasErrors = true;
            }
        }

        if (hasErrors) return;

        // Preparar datos para envío
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone') || '',
            user_type: formData.get('userType') // Cambiado a user_type para coincidir con la API
        };

        try {
            toggleLoading(true);
            toggleMessage(errorMessage, false);
            toggleMessage(successMessage, false);

            // Llamada real a la API
            const response = await fetch('/api/waitlist.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error al registrar');
            }

            if (result.success) {
                // Personalizar mensaje de éxito con la posición en la lista
                const successText = `¡Gracias por registrarte! ${
                    result.data.position 
                    ? `Estás en la posición #${result.data.position} de la lista de espera.` 
                    : ''
                } Te notificaremos cuando la aplicación esté disponible.`;
                
                toggleMessage(successMessage, true, successText);
                form.reset();

                // Opcional: Guardar en localStorage como respaldo
                const waitlist = JSON.parse(localStorage.getItem('waitlist') || '[]');
                waitlist.push({...userData, id: result.data.id, position: result.data.position});
                localStorage.setItem('waitlist', JSON.stringify(waitlist));
            } else {
                throw new Error(result.message || 'Error al procesar el registro');
            }

        } catch (error) {
            console.error('Error:', error);
            toggleMessage(
                errorMessage, 
                true, 
                error.message || 'Ha ocurrido un error. Por favor, intenta nuevamente.'
            );
        } finally {
            toggleLoading(false);
        }
    });

    // Opcional: Verificar estado si el email ya existe
    const emailInput = form.querySelector('#email');
    let checkTimeout;

    emailInput.addEventListener('blur', async function() {
        const email = this.value.trim();
        if (!email || !validators.email(email) === '') return;

        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/waitlist.php?email=${encodeURIComponent(email)}`);
                const result = await response.json();

                if (result.success) {
                    toggleMessage(
                        errorMessage, 
                        true, 
                        'Este email ya está registrado en la lista de espera.'
                    );
                }
            } catch (error) {
                console.error('Error verificando email:', error);
            }
        }, 500);
    });
});