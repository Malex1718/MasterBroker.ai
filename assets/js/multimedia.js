class MultimediaHandler {
    constructor() {
        this.propertyId = new URLSearchParams(window.location.search).get('id');
        this.inputFile = document.querySelector('.agregar_imagenes input[type="file"]');
        this.container = document.getElementById('imagen-container');
        this.draggedItem = null;
        this.uploadedImages = [];
        this.videos = [];
        this.isUploading = false;

        // Inicializar
        this.initializeEventListeners();
        this.loadExistingMedia();
    }

    async loadExistingMedia() {
        try {
            showLoader();
            const response = await fetch(`/api/propiedades/cargar_multimedia.php?id=${this.propertyId}`);
            const data = await response.json();
            
            if (data.success) {
                // Cargar imágenes existentes
                if (data.images && data.images.length > 0) {
                    data.images.forEach(image => {
                        this.createImageElement(image.file_path, true, image);
                    });
                }
                
                // Cargar videos existentes
                if (data.videos && data.videos.length > 0) {
                    data.videos.forEach(video => {
                        this.createVideoElement(video.youtube_id, true, video);
                    });
                }
                
                this.updateProgressBar();
            }
        } catch (error) {
            console.error('Error al cargar multimedia:', error);
            showToast('Error al cargar el contenido multimedia existente', 'error');
        } finally {
            hideLoader();
        }
    }

    initializeEventListeners() {
        // Input de archivos
        this.inputFile.addEventListener('change', (e) => this.handleFileSelect(e));

        // Zona de drop
        const dropZone = document.querySelector('.agregar_imagenes');
        this.setupDropZone(dropZone);

        // Botón de agregar video
        document.querySelector('.agregar_video_btn').addEventListener('click', () => this.handleAddVideo());

        // Botones de navegación
        document.querySelector('.botn_atras').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/dashboard/workspace/publicador.html?id=${this.propertyId}`;
        });

        document.querySelector('.boton_continuar').addEventListener('click', async (e) => {
            e.preventDefault();
            if (this.validateMultimedia()) {
                await this.updateMultimediaOrder(); // Asegurar que el orden esté actualizado
                this.saveMultimedia('continuar');
            }
        });

        document.querySelector('.boton_guardar').addEventListener('click', async (e) => {
            e.preventDefault();
            await this.updateMultimediaOrder(); // Asegurar que el orden esté actualizado
            this.saveMultimedia('guardar');
        });
    }

    setupDropZone(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--principal)';
            dropZone.style.backgroundColor = 'rgba(184, 146, 43, 0.1)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.backgroundColor = '';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.backgroundColor = '';
            
            const files = e.dataTransfer.files;
            const dataTransfer = new DataTransfer();
            Array.from(files).forEach(file => {
                if (file.type.match('image/(jpeg|jpg|png)')) {
                    dataTransfer.items.add(file);
                }
            });
            
            this.inputFile.files = dataTransfer.files;
            this.inputFile.dispatchEvent(new Event('change'));
        });
    }

    validateImage(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.match('image/(jpeg|jpg|png)')) {
                reject(`El archivo ${file.name} no es una imagen válida`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = function() {
                    if (this.width < 500 || this.height < 500 || 
                        this.width > 6000 || this.height > 6000) {
                        reject(`La imagen ${file.name} debe tener un tamaño entre 500x500 y 6000x6000 píxeles`);
                        return;
                    }
                    resolve({
                        dataUrl: e.target.result,
                        width: this.width,
                        height: this.height
                    });
                };
                img.onerror = () => reject(`Error al cargar la imagen ${file.name}`);
                img.src = e.target.result;
            };
            reader.onerror = () => reject(`Error al leer el archivo ${file.name}`);
            reader.readAsDataURL(file);
        });
    }

    async handleFileSelect(event) {
        const files = event.target.files;
        
        // Verificar límite de imágenes
        const totalImages = this.container.getElementsByClassName('imagen_cargada').length;
        if (totalImages + files.length > 40) {
            showToast('No puedes subir más de 40 imágenes', 'error');
            return;
        }

        showLoader();
        for (let file of files) {
            try {
                const imageData = await this.validateImage(file);
                this.createImageElement(imageData.dataUrl, false, {
                    file: file,
                    width: imageData.width,
                    height: imageData.height
                });
            } catch (error) {
                showToast(error, 'error');
            }
        }
        hideLoader();

        this.updateProgressBar();
    }

    createImageElement(src, isExisting, data = {}) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'imagen_cargada';
        imageContainer.draggable = true;

        if (isExisting) {
            imageContainer.dataset.imageId = data.id;
        }

        // Agregar badge de portada si es la primera imagen
        if (this.container.getElementsByClassName('imagen_cargada').length === 0) {
            const badge = document.createElement('div');
            badge.className = 'portada_badge';
            badge.innerHTML = '<i class="fas fa-star"></i><span>Portada</span>';
            imageContainer.appendChild(badge);
        }

        // Botón de eliminar
        const deleteButton = document.createElement('button');
        deleteButton.className = 'eliminar_imagen_cargada';
        deleteButton.innerHTML = '<img src="/assets/img/basura.png" alt="Eliminar">';
        deleteButton.addEventListener('click', async () => {
            imageContainer.remove();
            this.updatePortada();
            this.updateProgressBar();
            await this.updateMultimediaOrder();
        });
        imageContainer.appendChild(deleteButton);

        // Imagen
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Imagen de propiedad';
        imageContainer.appendChild(img);

        // Agregar a la lista de imágenes
        if (!isExisting) {
            this.uploadedImages.push({
                element: imageContainer,
                file: data.file,
                width: data.width,
                height: data.height
            });
        }

        // Setup drag and drop
        this.setupDragAndDrop(imageContainer);

        // Insertar en el contenedor
        this.container.appendChild(imageContainer);
        this.updatePortada();
    }

    setupDragAndDrop(element) {
        element.addEventListener('dragstart', (e) => {
            this.draggedItem = element;
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        element.addEventListener('dragend', async () => {
            element.classList.remove('dragging');
            this.updatePortada();
            await this.updateMultimediaOrder();
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            if (element !== this.draggedItem) {
                const allItems = [...this.container.getElementsByClassName('imagen_cargada')];
                const draggedIndex = allItems.indexOf(this.draggedItem);
                const droppedIndex = allItems.indexOf(element);

                if (draggedIndex < droppedIndex) {
                    element.parentNode.insertBefore(this.draggedItem, element.nextSibling);
                } else {
                    element.parentNode.insertBefore(this.draggedItem, element);
                }
            }
        });
    }

    updatePortada() {
        const allImages = this.container.getElementsByClassName('imagen_cargada');
        Array.from(allImages).forEach((image, index) => {
            let badge = image.querySelector('.portada_badge');
            if (index === 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'portada_badge';
                    badge.innerHTML = '<i class="fas fa-star"></i><span>Portada</span>';
                    image.prepend(badge);
                }
                badge.style.display = 'block';
            } else if (badge) {
                badge.style.display = 'none';
            }
        });
    }

    updateProgressBar() {
        const totalImages = this.container.getElementsByClassName('imagen_cargada').length;
        const progressBar = document.querySelector('.barra_progreso_partes_complet');
        
        if (totalImages >= 6) {
            progressBar.style.width = '63%';
        } else {
            const progress = 33 + ((totalImages / 6) * 30);
            progressBar.style.width = `${progress}%`;
        }
    }

    handleAddVideo() {
        const videoInput = document.querySelector('.input_video');
        const videoUrl = videoInput.value.trim();
        
        if (!videoUrl) {
            showToast('Por favor, ingresa un enlace de YouTube', 'error');
            return;
        }

        const videoId = this.getYoutubeVideoId(videoUrl);
        if (!videoId) {
            showToast('El enlace de YouTube no es válido', 'error');
            return;
        }

        const videosContainer = document.querySelector('.videos_container');
        if (videosContainer.children.length >= 3) {
            showToast('Solo puedes agregar hasta 3 videos', 'error');
            return;
        }

        this.createVideoElement(videoId);
        videoInput.value = '';
    }

    getYoutubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    createVideoElement(videoId, isExisting = false, data = {}) {
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video_cargado';

        if (isExisting) {
            videoContainer.dataset.videoId = data.id;
        }

        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.title = 'YouTube video player';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'eliminar_video';
        deleteButton.innerHTML = '<img src="/assets/img/basura.png" alt="Eliminar">';
        deleteButton.addEventListener('click', async () => {
            videoContainer.remove();
            await this.updateMultimediaOrder();
        });

        videoContainer.appendChild(iframe);
        videoContainer.appendChild(deleteButton);

        document.querySelector('.videos_container').appendChild(videoContainer);

        if (!isExisting) {
            this.videos.push(videoId);
        }
    }

    validateMultimedia() {
        const totalImages = this.container.getElementsByClassName('imagen_cargada').length;
        if (totalImages < 6) {
            showToast('Debes subir al menos 6 imágenes', 'error');
            return false;
        }
        return true;
    }

    async updateMultimediaOrder() {
        try {
            showLoader();
            // Recopilar información actual de imágenes
            const images = Array.from(this.container.getElementsByClassName('imagen_cargada'))
                .map((element, index) => {
                    const imageId = element.dataset.imageId;
                    if (!imageId) return null; // Skip new images
                    
                    return {
                        id: imageId,
                        display_order: index,
                        is_main: index === 0 ? 1 : 0
                    };
                })
                .filter(img => img !== null); // Remove null entries
    
            // Recopilar información de videos
            const videos = Array.from(document.querySelectorAll('.video_cargado'))
                .map((element, index) => {
                    const videoId = element.dataset.videoId;
                    if (!videoId) return null; // Skip new videos
                    
                    return {
                        id: videoId,
                        display_order: index
                    };
                })
                .filter(vid => vid !== null); // Remove null entries
    
            // Solo enviar actualización si hay elementos para actualizar
            if (images.length === 0 && videos.length === 0) {
                return; // No hay nada que actualizar
            }
    
            // Enviar actualización al servidor
            const response = await fetch('/api/propiedades/actualizar_multimedia.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    property_id: this.propertyId,
                    images: images,
                    videos: videos
                })
            });
    
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Error al actualizar el orden');
            }
    
        } catch (error) {
            console.error('Error al actualizar orden:', error);
            showToast('Error al actualizar el orden de los archivos multimedia', 'error');
        } finally {
            hideLoader();
        }
    }

    async saveMultimedia(action) {
        if (this.isUploading) return;
        this.isUploading = true;
    
        try {
            showLoader();
            // Preparar el FormData
            const formData = new FormData();
            formData.append('property_id', this.propertyId);
    
            // Agregar imágenes nuevas
            this.uploadedImages.forEach((imageData, index) => {
                formData.append(`images[${index}]`, imageData.file);
            });
    
            // Agregar videos
            this.videos.forEach((videoId, index) => {
                formData.append(`videos[${index}]`, videoId);
            });
    
            // Deshabilitar botones durante la subida
            this.toggleButtons(true);
    
            // Enviar al servidor
            const response = await fetch('/api/propiedades/guardar_multimedia.php', {
                method: 'POST',
                body: formData
            });
    
            const data = await response.json();
    
            if (!data.success) {
                throw new Error(data.message);
            }
    
            // Redireccionar según la acción
            if (action === 'continuar') {
                window.location.href = `/dashboard/workspace/extras.html?id=${this.propertyId}`;
            } else {
                window.location.href = '/dashboard/publicaciones.html';
            }
    
        } catch (error) {
            console.error('Error al guardar multimedia:', error);
            showToast(`Error al guardar: ${error.message}`, 'error');
        } finally {
            this.isUploading = false;
            this.toggleButtons(false);
            hideLoader();
        }
    }

    toggleButtons(disabled) {
        const buttons = [
            document.querySelector('.boton_guardar'),
            document.querySelector('.boton_continuar'),
            document.querySelector('.botn_atras')
        ];
        
        buttons.forEach(button => {
            if (button) {
                button.disabled = disabled;
                if (button.classList.contains('boton_guardar')) {
                    button.textContent = disabled ? 'Guardando...' : 'Guardar y salir';
                } else if (button.classList.contains('boton_continuar')) {
                    button.textContent = disabled ? 'Guardando...' : 'Continuar';
                }
            }
        });
    }
}

// Funciones auxiliares para el manejo de la UI
function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showToast(message, type = 'success') {
    // Si tienes una librería de notificaciones, úsala aquí
    // Por ejemplo, si usas Toastify:
    if (typeof Toastify === 'function') {
        Toastify({
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            backgroundColor: type === 'success' ? '#4caf50' : '#f44336'
        }).showToast();
    } else {
        // Fallback a alert si no hay librería de notificaciones
        alert(message);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Crear instancia del manejador
    window.multimediaHandler = new MultimediaHandler();
});