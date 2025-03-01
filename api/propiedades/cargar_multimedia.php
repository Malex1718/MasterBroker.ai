<?php
// api/propiedades/cargar_multimedia.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

// Habilitar el registro de errores
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/multimedia_errors.log');

try {
    // Verificar método de solicitud
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Método no permitido: ' . $_SERVER['REQUEST_METHOD']);
    }

    // Verificar y validar ID de propiedad
    if (!isset($_GET['id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }

    $propertyId = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    if ($propertyId === false) {
        throw new Exception('ID de propiedad inválido');
    }

    // Inicializar conexión a la base de datos
    $database = new Database();
    $db = $database->getConnection();

    // Verificar si la propiedad existe
    $checkProperty = "SELECT id FROM properties WHERE id = :id";
    $stmt = $db->prepare($checkProperty);
    $stmt->execute([':id' => $propertyId]);
    
    if (!$stmt->fetch()) {
        throw new Exception("Propiedad no encontrada con ID: $propertyId");
    }

    // Obtener imágenes
    $imagesQuery = "
        SELECT 
            id,
            file_name,
            file_path,
            original_name,
            file_size,
            mime_type,
            width,
            height,
            display_order,
            is_main,
            created_at
        FROM property_images 
        WHERE property_id = :property_id
        ORDER BY display_order ASC, created_at ASC";

    $stmt = $db->prepare($imagesQuery);
    $stmt->execute([':property_id' => $propertyId]);
    $images = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatear imágenes
    $formattedImages = [];
    foreach ($images as $image) {
        // Verificar que el archivo existe
        $fullPath = $_SERVER['DOCUMENT_ROOT'] . $image['file_path'];
        if (!file_exists($fullPath)) {
            error_log("Archivo no encontrado: $fullPath");
            continue;
        }

        $formattedImages[] = [
            'id' => $image['id'],
            'file_name' => $image['file_name'],
            'file_path' => $image['file_path'],
            'original_name' => $image['original_name'],
            'file_size' => formatFileSize($image['file_size']),
            'mime_type' => $image['mime_type'],
            'width' => $image['width'],
            'height' => $image['height'],
            'display_order' => $image['display_order'],
            'is_main' => (bool)$image['is_main'],
            'created_at' => $image['created_at'],
            'dimensions' => "{$image['width']}x{$image['height']}"
        ];
    }

    // Obtener videos
    $videosQuery = "
        SELECT 
            id,
            youtube_url,
            youtube_id,
            display_order,
            created_at
        FROM property_videos 
        WHERE property_id = :property_id
        ORDER BY display_order ASC, created_at ASC";

    $stmt = $db->prepare($videosQuery);
    $stmt->execute([':property_id' => $propertyId]);
    $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatear videos
    $formattedVideos = array_map(function($video) {
        return [
            'id' => $video['id'],
            'youtube_url' => $video['youtube_url'],
            'youtube_id' => $video['youtube_id'],
            'thumbnail' => "https://img.youtube.com/vi/{$video['youtube_id']}/mqdefault.jpg",
            'embed_url' => "https://www.youtube.com/embed/{$video['youtube_id']}",
            'display_order' => $video['display_order'],
            'created_at' => $video['created_at']
        ];
    }, $videos);

    // Obtener conteos
    $counts = [
        'total_images' => count($formattedImages),
        'total_videos' => count($formattedVideos)
    ];

    // Preparar respuesta
    $response = [
        'success' => true,
        'property_id' => $propertyId,
        'images' => $formattedImages,
        'videos' => $formattedVideos,
        'counts' => $counts,
        'limits' => [
            'max_images' => 40,
            'max_videos' => 3,
            'min_images' => 6
        ]
    ];

    echo json_encode($response, JSON_PRETTY_PRINT);
    exit;

} catch (PDOException $e) {
    error_log("Error de base de datos: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error de base de datos',
        'debug' => $e->getMessage()
    ]);
    exit;
} catch (Exception $e) {
    error_log("Error en cargar_multimedia.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
    exit;
}

/**
 * Función auxiliar para formatear el tamaño de archivo
 * @param int $bytes
 * @return string
 */
function formatFileSize($bytes) {
    if ($bytes <= 0) return '0 B';
    
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, 2) . ' ' . $units[$pow];
}