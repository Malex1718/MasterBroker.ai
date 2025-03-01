<?php
// api/propiedades/actualizar_multimedia.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }

    // Obtener y validar datos
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);
    
    if (!isset($data['property_id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }

    $propertyId = (int)$data['property_id'];
    $database = new Database();
    $db = $database->getConnection();
    
    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Actualizar orden de imágenes y eliminar las que ya no están
        if (isset($data['images']) && is_array($data['images'])) {
            // Obtener todas las imágenes existentes para esta propiedad
            $stmt = $db->prepare("SELECT id FROM property_images WHERE property_id = :property_id");
            $stmt->execute([':property_id' => $propertyId]);
            $existingImages = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            // Crear array de IDs de imágenes que permanecen
            $remainingImageIds = array_map(function($img) {
                return $img['id'];
            }, $data['images']);
            
            // Encontrar imágenes a eliminar
            $imagesToDelete = array_diff($existingImages, $remainingImageIds);
            
            // Eliminar imágenes que ya no están
            if (!empty($imagesToDelete)) {
                $placeholders = str_repeat('?,', count($imagesToDelete) - 1) . '?';
                $deleteStmt = $db->prepare("
                    DELETE FROM property_images 
                    WHERE property_id = ? AND id IN ($placeholders)
                ");
                
                $deleteParams = array_merge([$propertyId], array_values($imagesToDelete));
                $deleteStmt->execute($deleteParams);
            }
            
            // Actualizar orden y estado de portada de las imágenes restantes
            $updateStmt = $db->prepare("
                UPDATE property_images 
                SET display_order = :order,
                    is_main = :is_main
                WHERE id = :id AND property_id = :property_id
            ");
            
            foreach ($data['images'] as $index => $image) {
                $updateStmt->execute([
                    ':order' => $index,
                    ':is_main' => ($index === 0) ? 1 : 0,
                    ':id' => $image['id'],
                    ':property_id' => $propertyId
                ]);
            }
        }

        // Actualizar videos
        if (isset($data['videos']) && is_array($data['videos'])) {
            // Obtener videos existentes
            $stmt = $db->prepare("SELECT id FROM property_videos WHERE property_id = :property_id");
            $stmt->execute([':property_id' => $propertyId]);
            $existingVideos = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            // Crear array de IDs de videos que permanecen
            $remainingVideoIds = array_map(function($vid) {
                return $vid['id'];
            }, $data['videos']);
            
            // Encontrar videos a eliminar
            $videosToDelete = array_diff($existingVideos, $remainingVideoIds);
            
            // Eliminar videos que ya no están
            if (!empty($videosToDelete)) {
                $placeholders = str_repeat('?,', count($videosToDelete) - 1) . '?';
                $deleteStmt = $db->prepare("
                    DELETE FROM property_videos 
                    WHERE property_id = ? AND id IN ($placeholders)
                ");
                
                $deleteParams = array_merge([$propertyId], array_values($videosToDelete));
                $deleteStmt->execute($deleteParams);
            }
            
            // Actualizar orden de videos restantes
            $updateStmt = $db->prepare("
                UPDATE property_videos 
                SET display_order = :order
                WHERE id = :id AND property_id = :property_id
            ");
            
            foreach ($data['videos'] as $index => $video) {
                $updateStmt->execute([
                    ':order' => $index,
                    ':id' => $video['id'],
                    ':property_id' => $propertyId
                ]);
            }
        }

        // Actualizar conteos
        $updateCounts = $db->prepare("
            INSERT INTO property_media_counts (property_id, image_count, video_count)
            SELECT 
                :property_id,
                (SELECT COUNT(*) FROM property_images WHERE property_id = :pid1),
                (SELECT COUNT(*) FROM property_videos WHERE property_id = :pid2)
            ON DUPLICATE KEY UPDATE
                image_count = VALUES(image_count),
                video_count = VALUES(video_count)
        ");
        
        $updateCounts->execute([
            ':property_id' => $propertyId,
            ':pid1' => $propertyId,
            ':pid2' => $propertyId
        ]);

        // Confirmar transacción
        $db->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Orden actualizado correctamente',
            'debug' => [
                'images_remaining' => count($data['images'] ?? []),
                'videos_remaining' => count($data['videos'] ?? [])
            ]
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        throw new Exception('Error en la base de datos: ' . $e->getMessage());
    }

} catch (Exception $e) {
    error_log("Error en actualizar_multimedia.php: " . $e->getMessage());
    
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'debug' => $e->getTraceAsString()
    ]);
}