<?php
// api/propiedades/cargar_principales.php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../config/database.php';

try {
    // Verificar método
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception("Método no permitido");
    }

    // Verificar ID de propiedad
    if (!isset($_GET['id'])) {
        throw new Exception("ID de propiedad no proporcionado");
    }

    $propertyId = intval($_GET['id']);
    
    // Inicializar base de datos
    $database = new Database();
    $db = $database->getConnection();

    // Consulta principal para obtener datos de la propiedad
    $query = "
        SELECT 
            p.*,
            ot.name as operation_type,
            pt.name as property_type,
            pv.name as property_variant,
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
        WHERE p.id = :property_id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':property_id', $propertyId, PDO::PARAM_INT);
    $stmt->execute();

    $property = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$property) {
        throw new Exception("Propiedad no encontrada");
    }

    // Formatear datos
    $formattedData = [
        'operacion' => [
            'tipo' => $property['operation_type'],
            'id' => $property['operation_type_id']
        ],
        'inmueble' => [
            'tipo' => $property['property_type'],
            'id' => $property['property_type_id'],
            'variante' => $property['property_variant'],
            'variante_id' => $property['property_variant_id']
        ],
        'ubicacion' => [
            'direccion' => $property['address'],
            'estado' => [
                'id' => $property['state_id'],
                'nombre' => $property['state_name']
            ],
            'ciudad' => [
                'id' => $property['city_id'],
                'nombre' => $property['city_name']
            ],
            'colonia' => [
                'id' => $property['colony_id'],
                'nombre' => $property['colony_name']
            ],
            'coordenadas' => [
                'lat' => floatval($property['latitude']),
                'lng' => floatval($property['longitude'])
            ]
        ],
        'caracteristicas' => [
            'recamaras' => intval($property['bedrooms']),
            'banos' => intval($property['bathrooms']),
            'medio_bano' => intval($property['half_bathrooms']),
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
        'contenido' => [
            'titulo' => $property['title'],
            'descripcion' => $property['description']
        ],
        'metadata' => [
            'id' => intval($property['id']),
            'status' => $property['status'],
            'created_at' => $property['created_at'],
            'updated_at' => $property['updated_at']
        ]
    ];

    echo json_encode([
        'success' => true,
        'data' => $formattedData
    ]);

} catch (Exception $e) {
    error_log("Error en cargar_principales.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

function formatPrice($value) {
    return $value ? floatval($value) : 0;
}