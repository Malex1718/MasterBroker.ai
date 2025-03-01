// Función para manejar el clic en las tarjetas de servicio
function handleServiceClick(index) {
  // Para la primera tarjeta (Descubrir Hogar)
  if (index === 0) {
    window.location.href = '/propiedades.html';
    return;
  }
  
  // Mapeo de índices a IDs de sección para las demás tarjetas
  const sectionMapping = {
    1: 'maximizar-valor',
    2: 'gestion-inmobiliaria',
    3: 'inversiones-inteligentes'
  };
  
  const sectionId = sectionMapping[index];
  
  // Obtener la URL actual
  const currentPath = window.location.pathname;
  
  if (currentPath === '/servicios.html') {
    // Si ya estamos en la página de servicios, solo hacemos scroll
    scrollToSection(sectionId);
  } else {
    // Si estamos en otra página, redirigimos y agregamos el identificador de sección
    window.location.href = `/servicios.html#${sectionId}`;
  }
}

// Función para hacer scroll suave a una sección con offset
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    // Obtener la posición del elemento
    const elementPosition = section.getBoundingClientRect().top;
    // Obtener la posición actual del scroll
    const offsetPosition = elementPosition + window.pageYOffset;
    // Restar 100px (o el valor que necesites) para compensar la altura de la barra de navegación
    const offsetValue = 100; // Ajusta este valor según la altura de tu barra de navegación

    window.scrollTo({
      top: offsetPosition - offsetValue,
      behavior: 'smooth'
    });
  }
}

// Agregar event listeners a todas las tarjetas
document.addEventListener('DOMContentLoaded', () => {
  const serviceCards = document.querySelectorAll('.intersec_info_tar');
  
  serviceCards.forEach((card, index) => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      handleServiceClick(index);
    });
  });
  
  // Si llegamos con un hash en la URL, scrollear a la sección correspondiente
  if (window.location.hash && window.location.pathname === '/servicios.html') {
    // Pequeño timeout para asegurar que la página esté completamente cargada
    setTimeout(() => {
      const sectionId = window.location.hash.substring(1);
      scrollToSection(sectionId);
    }, 100);
  }
});