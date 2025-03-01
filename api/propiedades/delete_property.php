<?php
require_once '../config/database.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'No autorizado'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Método no permitido'
    ]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['property_id'])) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'ID de propiedad no proporcionado'
    ]);
    exit;
}

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Verificar que la propiedad pertenezca al usuario y esté archivada
    $stmt = $conn->prepare("
        SELECT id, status 
        FROM properties 
        WHERE id = ? AND user_id = ? AND status = 'archived'
    ");
    $stmt->execute([$data['property_id'], $_SESSION['user_id']]);
    
    if (!$stmt->fetch()) {
        throw new Exception('Propiedad no encontrada, no autorizada o no está archivada');
    }

    // Obtener rutas de imágenes antes de borrar
    $stmt = $conn->prepare("
        SELECT file_path 
        FROM property_images 
        WHERE property_id = ?
    ");
    $stmt->execute([$data['property_id']]);
    $imagePaths = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Iniciar transacción
    $conn->beginTransaction();

    // Borrar registros relacionados en orden (añadiendo las tablas faltantes)
    $tables = [
        'property_exposure_logs',
        'property_view_logs',
        'property_lead_logs',
        'property_view_stats',
        'property_views',
        'property_videos',        // Añadimos esta tabla
        'property_images',
        'property_reactions',     // Añadimos esta tabla
        'property_favorites',     // Añadimos esta tabla
        'property_leads',         // Añadimos esta tabla
        'saved_properties',       // Añadimos esta tabla
        'property_amenities',
        'property_additional_features',
        'property_media_counts',
        'property_history',
        'property_statistics'        // Por si existe
    ];

    foreach ($tables as $table) {
        try {
            $stmt = $conn->prepare("DELETE FROM $table WHERE property_id = ?");
            $stmt->execute([$data['property_id']]);
        } catch (PDOException $e) {
            // Si la tabla no existe, continuamos con la siguiente
            if ($e->getCode() != '42S02') {
                throw $e;
            }
        }
    }

    // Finalmente borrar la propiedad
    $stmt = $conn->prepare("DELETE FROM properties WHERE id = ?");
    $stmt->execute([$data['property_id']]);

    // Confirmar transacción
    $conn->commit();

    // Borrar archivos físicos
    foreach ($imagePaths as $path) {
        $fullPath = $_SERVER['DOCUMENT_ROOT'] . $path;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }
    }

    // Borrar directorio de la propiedad si existe
    $propertyDir = $_SERVER['DOCUMENT_ROOT'] . "/uploads/properties/" . $data['property_id'];
    if (is_dir($propertyDir)) {
        array_map('unlink', glob("$propertyDir/*.*"));
        rmdir($propertyDir);
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Propiedad eliminada correctamente'
    ]);

} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollBack();
    }
    error_log("Error en delete_property.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($db)) {
        $db->closeConnection();
    }
}