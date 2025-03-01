<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

// Funciones auxiliares para convertir nombres a IDs o crear nuevos registros
function getOperationTypeId($db, $name) {
    $stmt = $db->prepare("SELECT id FROM operation_types WHERE name = ?");
    $stmt->execute([$name]);
    return $stmt->fetchColumn();
}

function getPropertyTypeId($db, $name) {
    $stmt = $db->prepare("SELECT id FROM property_types WHERE name = ?");
    $stmt->execute([$name]);
    return $stmt->fetchColumn();
}

function getPropertyVariantId($db, $name, $property_type_id) {
    $stmt = $db->prepare("SELECT id FROM property_variants WHERE name = ? AND property_type_id = ?");
    $stmt->execute([$name, $property_type_id]);
    return $stmt->fetchColumn();
}

function getStateId($db, $name) {
    $stmt = $db->prepare("SELECT id FROM states WHERE name = ?");
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();

    if (!$id) {
        $stmt = $db->prepare("INSERT INTO states (name) VALUES (?)");
        $stmt->execute([$name]);
        $id = $db->lastInsertId();
    }

    return $id;
}

function getCityId($db, $name, $state_id) {
    $stmt = $db->prepare("SELECT id FROM cities WHERE name = ? AND state_id = ?");
    $stmt->execute([$name, $state_id]);
    $id = $stmt->fetchColumn();

    if (!$id) {
        $stmt = $db->prepare("INSERT INTO cities (name, state_id) VALUES (?, ?)");
        $stmt->execute([$name, $state_id]);
        $id = $db->lastInsertId();
    }

    return $id;
}

function getColonyId($db, $name, $city_id) {
    $stmt = $db->prepare("SELECT id FROM colonies WHERE name = ? AND city_id = ?");
    $stmt->execute([$name, $city_id]);
    $id = $stmt->fetchColumn();

    if (!$id) {
        $stmt = $db->prepare("INSERT INTO colonies (name, city_id) VALUES (?, ?)");
        $stmt->execute([$name, $city_id]);
        $id = $db->lastInsertId();
    }

    return $id;
}

function registerPropertyHistory($db, $property_id, $user_id, $action_type) {
    $query = "INSERT INTO property_history (property_id, user_id, action_type, action_details) 
              VALUES (:property_id, :user_id, :action_type, :action_details)";
    
    $stmt = $db->prepare($query);
    
    $action_details = json_encode([
        'timestamp' => date('Y-m-d H:i:s'),
        'action' => $action_type
    ]);
    
    $stmt->bindParam(":property_id", $property_id, PDO::PARAM_INT);
    $stmt->bindParam(":user_id", $user_id, PDO::PARAM_INT);
    $stmt->bindParam(":action_type", $action_type, PDO::PARAM_STR);
    $stmt->bindParam(":action_details", $action_details, PDO::PARAM_STR);
    
    $stmt->execute();
}

// Función para validar y mapear el tipo de antigüedad
function validateAgeType($age_type) {
    $valid_types = ['new', 'years', 'under_construction'];
    return in_array($age_type, $valid_types) ? $age_type : 'new';
}

// Función para validar la precisión de ubicación
function validatePrecisionUbicacion($precision) {
    $valid_precision = ['exact', 'approximate', 'hidden'];
    return in_array($precision, $valid_precision) ? $precision : 'exact';
}

// Manejo principal de la solicitud
try {
    // Obtener y decodificar datos JSON
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data) {
        throw new Exception("Datos inválidos");
    }

    // Validar datos requeridos
    $required_fields = ['operacion', 'tipo_inmueble', 'variante', 'direccion', 'estado', 'ciudad', 'usuario_id'];
    foreach ($required_fields as $field) {
        if (empty($data[$field])) {
            throw new Exception("Campo requerido faltante: $field");
        }
    }

    // Validar y sanitizar campos específicos
    $data['precision_ubicacion'] = validatePrecisionUbicacion($data['precision_ubicacion'] ?? 'exact');
    $data['antiguedad']['tipo'] = validateAgeType($data['antiguedad']['tipo'] ?? 'new');

    // Iniciar conexión a la base de datos
    $database = new Database();
    $db = $database->getConnection();

    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Obtener IDs para las relaciones
        $operation_type_id = getOperationTypeId($db, $data['operacion']);
        $property_type_id = getPropertyTypeId($db, $data['tipo_inmueble']);
        $property_variant_id = getPropertyVariantId($db, $data['variante'], $property_type_id);

        if (!$operation_type_id || !$property_type_id || !$property_variant_id) {
            throw new Exception("Error al obtener los IDs de referencia");
        }

        // Obtener/crear IDs de ubicación
        $state_id = getStateId($db, $data['estado']);
        $city_id = getCityId($db, $data['ciudad'], $state_id);
        $colony_id = !empty($data['colonia']) ? getColonyId($db, $data['colonia'], $city_id) : null;

        // Preparar la consulta de inserción
        $query = "INSERT INTO properties (
            user_id, operation_type_id, property_type_id, property_variant_id,
            address, state_id, city_id, colony_id, latitude, longitude, precision_ubicacion,
            bedrooms, bathrooms, half_bathrooms, parking_spots,
            built_area, total_area, age_type, age_years,
            price, maintenance_fee, title, description,
            status, created_by
        ) VALUES (
            :user_id, :operation_type_id, :property_type_id, :property_variant_id,
            :address, :state_id, :city_id, :colony_id, :latitude, :longitude, :precision_ubicacion,
            :bedrooms, :bathrooms, :half_bathrooms, :parking_spots,
            :built_area, :total_area, :age_type, :age_years,
            :price, :maintenance_fee, :title, :description,
            :status, :created_by
        )";

        $stmt = $db->prepare($query);

        // Bindear todos los valores
        $stmt->bindParam(":user_id", $data['usuario_id'], PDO::PARAM_INT);
        $stmt->bindParam(":operation_type_id", $operation_type_id, PDO::PARAM_INT);
        $stmt->bindParam(":property_type_id", $property_type_id, PDO::PARAM_INT);
        $stmt->bindParam(":property_variant_id", $property_variant_id, PDO::PARAM_INT);
        $stmt->bindParam(":address", $data['direccion'], PDO::PARAM_STR);
        $stmt->bindParam(":state_id", $state_id, PDO::PARAM_INT);
        $stmt->bindParam(":city_id", $city_id, PDO::PARAM_INT);
        $stmt->bindParam(":colony_id", $colony_id, PDO::PARAM_INT);
        $stmt->bindParam(":latitude", $data['coordenadas']['lat'], PDO::PARAM_STR);
        $stmt->bindParam(":longitude", $data['coordenadas']['lng'], PDO::PARAM_STR);
        $stmt->bindParam(":precision_ubicacion", $data['precision_ubicacion'], PDO::PARAM_STR);
        $stmt->bindParam(":bedrooms", $data['caracteristicas']['recamaras'], PDO::PARAM_INT);
        $stmt->bindParam(":bathrooms", $data['caracteristicas']['banos'], PDO::PARAM_INT);
        $stmt->bindParam(":half_bathrooms", $data['caracteristicas']['mediobano'], PDO::PARAM_INT);
        $stmt->bindParam(":parking_spots", $data['caracteristicas']['estacionamientos'], PDO::PARAM_INT);
        $stmt->bindParam(":built_area", $data['superficie']['construida'], PDO::PARAM_STR);
        $stmt->bindParam(":total_area", $data['superficie']['total'], PDO::PARAM_STR);
        $stmt->bindParam(":age_type", $data['antiguedad']['tipo'], PDO::PARAM_STR);
        $stmt->bindParam(":age_years", $data['antiguedad']['anos'], PDO::PARAM_INT);
        $stmt->bindParam(":price", $data['precio']['monto'], PDO::PARAM_STR);
        $stmt->bindParam(":maintenance_fee", $data['precio']['mantenimiento'], PDO::PARAM_STR);
        $stmt->bindParam(":title", $data['titulo'], PDO::PARAM_STR);
        $stmt->bindParam(":description", $data['descripcion'], PDO::PARAM_STR);
        $stmt->bindParam(":status", $data['estado_publicacion'], PDO::PARAM_STR);
        $stmt->bindParam(":created_by", $data['usuario_id'], PDO::PARAM_INT);

        // Ejecutar la inserción
        $stmt->execute();
        $property_id = $db->lastInsertId();

        // Registrar en el historial
        registerPropertyHistory($db, $property_id, $data['usuario_id'], 'create');

        // Confirmar la transacción
        $db->commit();

        // Enviar respuesta exitosa
        echo json_encode([
            "success" => true,
            "message" => "Propiedad creada exitosamente",
            "propiedad_id" => $property_id
        ]);

    } catch (Exception $e) {
        // Si algo falla, revertir la transacción
        $db->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error en guardar.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Error al crear la propiedad: " . $e->getMessage()
    ]);
}
?>