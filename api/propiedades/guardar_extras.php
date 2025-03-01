<?php
// api/propiedades/guardar_extras.php

require_once __DIR__ . '/../config/database.php';
header('Content-Type: application/json');

try {
    // Obtener y validar datos de entrada
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);
    
    if (!isset($data['property_id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }
    
    $propertyId = intval($data['property_id']);
    
    // Crear instancia de la base de datos
    $database = new Database();
    $conn = $database->getConnection();
    
    // Iniciar transacción
    $conn->beginTransaction();
    
    // 1. Guardar amenities
    // Primero eliminar amenities existentes
    $deleteAmenities = "DELETE FROM property_amenities WHERE property_id = :property_id";
    $stmt = $conn->prepare($deleteAmenities);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();
    
    // Insertar nuevos amenities
    if (!empty($data['amenities'])) {
        $amenityInsert = "INSERT INTO property_amenities (property_id, amenity_id) 
                         SELECT :property_id, id 
                         FROM amenities 
                         WHERE LOWER(REPLACE(REPLACE(name, ' ', '_'), 'á', 'a')) = :code";
        $stmt = $conn->prepare($amenityInsert);
        
        foreach ($data['amenities'] as $amenityCode) {
            $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
            $stmt->bindParam(':code', $amenityCode, PDO::PARAM_STR);
            $stmt->execute();
        }
    }
    
    // 2. Guardar características adicionales
    $features = $data['additional_features'];
    
    // Verificar si ya existen características adicionales
    $checkFeatures = "SELECT 1 FROM property_additional_features WHERE property_id = :property_id";
    $stmt = $conn->prepare($checkFeatures);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();
    $exists = $stmt->rowCount() > 0;
    
    if ($exists) {
        // Actualizar características existentes
        $updateFeatures = "
            UPDATE property_additional_features 
            SET conservation_status = :conservation_status,
                storage_units = :storage_units,
                closets = :closets,
                elevators = :elevators,
                depth_meters = :depth_meters,
                front_meters = :front_meters,
                built_levels = :built_levels,
                updated_at = CURRENT_TIMESTAMP
            WHERE property_id = :property_id";
            
        $stmt = $conn->prepare($updateFeatures);
    } else {
        // Insertar nuevas características
        $insertFeatures = "
            INSERT INTO property_additional_features (
                property_id,
                conservation_status,
                storage_units,
                closets,
                elevators,
                depth_meters,
                front_meters,
                built_levels
            ) VALUES (
                :property_id,
                :conservation_status,
                :storage_units,
                :closets,
                :elevators,
                :depth_meters,
                :front_meters,
                :built_levels
            )";
            
        $stmt = $conn->prepare($insertFeatures);
    }
    
    // Bind parámetros
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->bindParam(':conservation_status', $features['conservation_status'], PDO::PARAM_STR);
    $stmt->bindParam(':storage_units', $features['storage_units'], PDO::PARAM_INT);
    $stmt->bindParam(':closets', $features['closets'], PDO::PARAM_INT);
    $stmt->bindParam(':elevators', $features['elevators'], PDO::PARAM_INT);
    $stmt->bindParam(':depth_meters', $features['depth_meters'], PDO::PARAM_STR);
    $stmt->bindParam(':front_meters', $features['front_meters'], PDO::PARAM_STR);
    $stmt->bindParam(':built_levels', $features['built_levels'], PDO::PARAM_INT);
    $stmt->execute();
    
    // 3. Registrar en el historial
    $historyInsert = "
        INSERT INTO property_history (
            property_id,
            user_id,
            action_type,
            action_details
        ) VALUES (
            :property_id,
            :user_id,
            'update',
            :action_details
        )";
        
    $userId = 1; // Deberías obtener esto de la sesión
    $actionDetails = json_encode([
        'section' => 'extras',
        'amenities_count' => count($data['amenities']),
        'features_updated' => true
    ]);
    
    $stmt = $conn->prepare($historyInsert);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindParam(':action_details', $actionDetails, PDO::PARAM_STR);
    $stmt->execute();
    
    // Confirmar transacción
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Datos extras guardados correctamente'
    ]);

} catch (Exception $e) {
    // Revertir transacción en caso de error
    if (isset($conn)) {
        $conn->rollBack();
    }
    
    error_log("Error en guardar_extras.php: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

// Cerrar conexión
if (isset($database)) {
    $database->closeConnection();
}