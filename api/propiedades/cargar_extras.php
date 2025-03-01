<?php
// api/propiedades/cargar_extras.php

require_once __DIR__ . '/../config/database.php';
header('Content-Type: application/json');

try {
    // Crear instancia de la base de datos
    $database = new Database();
    $conn = $database->getConnection();
    
    // Validar que se recibió el ID de la propiedad
    if (!isset($_GET['id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }
    
    $propertyId = intval($_GET['id']);
    
    // Verificar si la propiedad existe
    $checkProperty = "SELECT id FROM properties WHERE id = :id";
    $stmt = $conn->prepare($checkProperty);
    $stmt->bindParam(':id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Propiedad no encontrada');
    }
    
    // Obtener amenities de la propiedad
    $amenitiesQuery = "
        SELECT a.id, a.name, a.category_id,
               LOWER(REPLACE(REPLACE(REPLACE(a.name, ' ', '_'), 'á', 'a'), 'í', 'i')) as code
        FROM property_amenities pa
        JOIN amenities a ON pa.amenity_id = a.id
        WHERE pa.property_id = :property_id";
        
    $stmt = $conn->prepare($amenitiesQuery);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();
    $amenities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Obtener características adicionales
    $featuresQuery = "
        SELECT conservation_status,
               storage_units,
               closets,
               elevators,
               depth_meters,
               front_meters,
               built_levels
        FROM property_additional_features
        WHERE property_id = :property_id";
        
    $stmt = $conn->prepare($featuresQuery);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();
    $additionalFeatures = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Si no hay características adicionales, devolver objeto vacío
    if (!$additionalFeatures) {
        $additionalFeatures = [
            'conservation_status' => '',
            'storage_units' => 0,
            'closets' => 0,
            'elevators' => 0,
            'depth_meters' => 0,
            'front_meters' => 0,
            'built_levels' => 0
        ];
    }
    
    // Preparar respuesta
    $response = [
        'success' => true,
        'amenities' => $amenities ?: [],
        'additional_features' => $additionalFeatures
    ];
    
    echo json_encode($response);

} catch (Exception $e) {
    error_log("Error en cargar_extras.php: " . $e->getMessage());
    
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