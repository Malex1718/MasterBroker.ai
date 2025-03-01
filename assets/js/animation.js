// Agregar al final de tu archivo JavaScript existente
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observar las secciones principales
    document.querySelectorAll('.seccion_info_prop').forEach(section => {
        observer.observe(section);
    });

    // Observar las tarjetas de valores
    document.querySelectorAll('.nosotros_valor').forEach(card => {
        observer.observe(card);
    });
});