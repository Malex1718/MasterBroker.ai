<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../config/database.php';

try {
    // Validar ID
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        throw new Exception("ID de propiedad inválido");
    }

    $property_id = intval($_GET['id']);

    // Inicializar conexión
    $database = new Database();
    $db = $database->getConnection();

    // Consulta principal
    $query = "
        SELECT 
            p.*,
            ot.name as operation_name,
            pt.name as property_type_name,
            pv.name as variant_name,
            s.name as state_name,
            c.name as city_name,
            col.name as colony_name
        FROM properties p
        LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
        LEFT JOIN property_types pt ON p.property_type_id = pt.id
        LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
        LEFT JOIN states s ON p.state_id = s.id
        LEFT JOIN cities c ON p.city_id = c.id
        LEFT JOIN colonies col ON p.colony_id = col.id
        WHERE p.id = :id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(":id", $property_id, PDO::PARAM_INT);
    $stmt->execute();

    $property = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$property) {
        throw new Exception("Propiedad no encontrada");
    }

    // Formatear los datos para el frontend
    $formatted_property = [
        'operacion' => $property['operation_name'],
        'tipo_inmueble' => $property['property_type_name'],
        'variante' => $property['variant_name'],
        'direccion' => $property['address'],
        'estado' => $property['state_name'],
        'ciudad' => $property['city_name'],
        'colonia' => $property['colony_name'],
        'coordenadas' => [
            'lat' => floatval($property['latitude']),
            'lng' => floatval($property['longitude'])
        ],
        'precision_ubicacion' => $property['precision_ubicacion'],
        'caracteristicas' => [
            'recamaras' => intval($property['bedrooms']),
            'banos' => intval($property['bathrooms']),
            'mediobano' => intval($property['half_bathrooms']),
            'estacionamientos' => intval($property['parking_spots'])
        ],
        'superficie' => [
            'construida' => floatval($property['built_area']),
            'total' => floatval($property['total_area'])
        ],
        'antiguedad' => [
            'tipo' => $property['age_type'],
            'anos' => intval($property['age_years'])
        ],
        'precio' => [
            'monto' => floatval($property['price']),
            'mantenimiento' => floatval($property['maintenance_fee'])
        ],
        'titulo' => $property['title'],
        'descripcion' => $property['description']
    ];

    echo json_encode([
        'success' => true,
        'propiedad' => $formatted_property
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}