document.querySelectorAll('.opciones_select').forEach(selectContainer => {
    const select = selectContainer.querySelector('.select');
    const opcionesMenu = selectContainer.querySelector('.opciones');
    const checkbox = selectContainer.querySelector('input[type="checkbox"]');

    // Click en el select o la flecha
    select.addEventListener('click', function(e) {
        // Cerrar todos los demás menus primero
        document.querySelectorAll('.opciones').forEach(menu => {
            if (menu !== opcionesMenu) {
                menu.style.display = 'none';
                // Desmarcar otros checkboxes
                const otherCheckbox = menu.parentElement.querySelector('input[type="checkbox"]');
                if (otherCheckbox) otherCheckbox.checked = false;
            }
        });

        // Toggle del menú actual
        if (opcionesMenu.style.display === 'flex') {
            opcionesMenu.style.display = 'none';
            checkbox.checked = false;
        } else {
            opcionesMenu.style.display = 'flex';
            checkbox.checked = true;
        }
    });
});

// Cerrar los menús al hacer click fuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('.opciones_select')) {
        document.querySelectorAll('.opciones').forEach(menu => {
            menu.style.display = 'none';
            // Desmarcar checkboxes
            const checkbox = menu.parentElement.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        });
    }
});

// Prevenir que los clicks dentro de las opciones cierren el menú
document.querySelectorAll('.opciones').forEach(menu => {
    menu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
});