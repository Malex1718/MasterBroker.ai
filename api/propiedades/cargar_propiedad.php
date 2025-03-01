<?php
// api/propiedades/cargar_propiedad.php

require_once __DIR__ . '/../config/database.php';
header('Content-Type: application/json');

try {
    if (!isset($_GET['id'])) {
        throw new Exception('ID de propiedad no proporcionado');
    }

    $propertyId = intval($_GET['id']);
    $database = new Database();
    $conn = $database->getConnection();

    // Consulta para obtener los datos de la propiedad
    $query = "
        SELECT p.*,
               pt.name as property_type,
               ot.name as operation_type,
               COALESCE(pmc.image_count, 0) as image_count,
               COALESCE(pmc.video_count, 0) as video_count,
               pi.file_path as main_image
        FROM properties p
        LEFT JOIN property_types pt ON p.property_type_id = pt.id
        LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
        LEFT JOIN property_media_counts pmc ON p.id = pmc.property_id
        LEFT JOIN property_images pi ON p.id = pi.property_id AND pi.is_main = 1
        WHERE p.id = :id";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();

    $property = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$property) {
        throw new Exception('Propiedad no encontrada');
    }

    echo json_encode([
        'success' => true,
        'property' => $property
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}