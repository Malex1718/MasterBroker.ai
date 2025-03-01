<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

function processImage($file, $propertyId, $order) {
    $targetDir = "../../uploads/properties/" . $propertyId . "/";
    if (!file_exists($targetDir)) {
        mkdir($targetDir, 0777, true);
    }

    $fileName = uniqid() . '_' . basename($file['name']);
    $targetFile = $targetDir . $fileName;
    $imageFileType = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));

    // Verificar tipo de archivo
    if (!in_array($imageFileType, ['jpg', 'jpeg', 'png'])) {
        throw new Exception("Solo se permiten archivos JPG, JPEG y PNG");
    }

    // Verificar dimensiones
    list($width, $height) = getimagesize($file['tmp_name']);
    if ($width < 500 || $height < 500 || $width > 6000 || $height > 6000) {
        throw new Exception("La imagen debe tener entre 500x500 y 6000x6000 píxeles");
    }

    if (!move_uploaded_file($file['tmp_name'], $targetFile)) {
        throw new Exception("Error al subir el archivo");
    }

    return [
        'file_name' => $fileName,
        'file_path' => str_replace("../../", "/", $targetFile),
        'original_name' => $file['name'],
        'file_size' => $file['size'],
        'mime_type' => $file['type'],
        'width' => $width,
        'height' => $height,
        'display_order' => $order,
        'is_main' => ($order === 0) ? 1 : 0
    ];
}

function processVideo($videoUrl, $order) {
    // Limpia la URL de parámetros adicionales
    $cleanUrl = strtok($videoUrl, '?');
    
    // Patrones para diferentes formatos de URL de YouTube
    $patterns = [
        '/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^\"&?\/\s]{11})/', // Formato estándar
        '/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=)?([^\"&?\/\s]{11})/', // Formato completo
        '/^[^\"&?\/\s]{11}$/' // Solo ID
    ];
    
    $videoId = null;
    foreach ($patterns as $pattern) {
        preg_match($pattern, $cleanUrl, $matches);
        if (!empty($matches)) {
            // El ID estará en el último grupo de captura
            $videoId = end($matches);
            break;
        }
    }
    
    if (!$videoId) {
        throw new Exception('URL de YouTube no válida: ' . $videoUrl);
    }

    // Validar longitud del ID
    if (strlen($videoId) !== 11) {
        throw new Exception('ID de video de YouTube no válido');
    }

    return [
        'youtube_url' => $videoUrl,
        'youtube_id' => $videoId,
        'display_order' => $order
    ];
}

function saveImages($db, $propertyId, $images) {
    foreach ($images as $imageData) {
        $query = "INSERT INTO property_images (
            property_id, file_name, file_path, original_name, 
            file_size, mime_type, width, height, display_order, is_main
        ) VALUES (
            :property_id, :file_name, :file_path, :original_name,
            :file_size, :mime_type, :width, :height, :display_order, :is_main
        )";

        $stmt = $db->prepare($query);
        $stmt->execute([
            ':property_id' => $propertyId,
            ':file_name' => $imageData['file_name'],
            ':file_path' => $imageData['file_path'],
            ':original_name' => $imageData['original_name'],
            ':file_size' => $imageData['file_size'],
            ':mime_type' => $imageData['mime_type'],
            ':width' => $imageData['width'],
            ':height' => $imageData['height'],
            ':display_order' => $imageData['display_order'],
            ':is_main' => $imageData['is_main']
        ]);
    }
}

function saveVideos($db, $propertyId, $videos) {
    // Primero, validar que no excedamos el límite
    $existingCount = $db->query("SELECT COUNT(*) FROM property_videos WHERE property_id = $propertyId")->fetchColumn();
    $newVideosCount = count($videos);
    
    if (($existingCount + $newVideosCount) > 3) {
        throw new Exception("No se pueden agregar más de 3 videos");
    }

    foreach ($videos as $index => $videoUrl) {
        try {
            $videoData = processVideo($videoUrl, $index);
            
            $query = "INSERT INTO property_videos (
                property_id, youtube_url, youtube_id, display_order
            ) VALUES (
                :property_id, :youtube_url, :youtube_id, :display_order
            )";

            $stmt = $db->prepare($query);
            $stmt->execute([
                ':property_id' => $propertyId,
                ':youtube_url' => $videoData['youtube_url'],
                ':youtube_id' => $videoData['youtube_id'],
                ':display_order' => $videoData['display_order']
            ]);
        } catch (Exception $e) {
            throw new Exception("Error procesando video " . ($index + 1) . ": " . $e->getMessage());
        }
    }
}

function validateRequest($propertyId, $db) {
    // Validar imágenes
    if (isset($_FILES['images'])) {
        $existingImages = $db->query("SELECT COUNT(*) FROM property_images WHERE property_id = $propertyId")->fetchColumn();
        $newImagesCount = count($_FILES['images']['name']);
        
        if (($existingImages + $newImagesCount) > 40) {
            throw new Exception("No se pueden subir más de 40 imágenes");
        }
    }

    // Validar videos
    if (isset($_POST['videos'])) {
        if (!is_array($_POST['videos'])) {
            throw new Exception("Formato inválido para videos");
        }
        
        $existingVideos = $db->query("SELECT COUNT(*) FROM property_videos WHERE property_id = $propertyId")->fetchColumn();
        $newVideosCount = count($_POST['videos']);
        
        if (($existingVideos + $newVideosCount) > 3) {
            throw new Exception("No se pueden agregar más de 3 videos");
        }
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }

    // Verificar datos requeridos
    if (!isset($_POST['property_id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }

    $propertyId = (int)$_POST['property_id'];
    $database = new Database();
    $db = $database->getConnection();

    // Validar la solicitud
    validateRequest($propertyId, $db);

    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Procesar imágenes
        if (isset($_FILES['images']) && !empty($_FILES['images']['name'][0])) {
            $processedImages = [];
            $fileCount = count($_FILES['images']['name']);

            for ($i = 0; $i < $fileCount; $i++) {
                $file = [
                    'name' => $_FILES['images']['name'][$i],
                    'type' => $_FILES['images']['type'][$i],
                    'tmp_name' => $_FILES['images']['tmp_name'][$i],
                    'error' => $_FILES['images']['error'][$i],
                    'size' => $_FILES['images']['size'][$i]
                ];

                $processedImages[] = processImage($file, $propertyId, $i);
            }

            saveImages($db, $propertyId, $processedImages);
        }

        // Procesar videos
        if (isset($_POST['videos']) && is_array($_POST['videos'])) {
            saveVideos($db, $propertyId, $_POST['videos']);
        }

        // Confirmar transacción
        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Multimedia guardada exitosamente'
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

// Función auxiliar para debugging
function debug_video_processing($videoUrl) {
    try {
        $result = processVideo($videoUrl, 0);
        return [
            'success' => true,
            'original_url' => $videoUrl,
            'processed_data' => $result
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'original_url' => $videoUrl,
            'error' => $e->getMessage()
        ];
    }
}

// Endpoint de prueba para URLs de YouTube
if (isset($_GET['test_url'])) {
    echo json_encode(debug_video_processing($_GET['test_url']));
    exit;
}
?>