<?php
// api/propiedades/publicar_propiedad.php

// Deshabilitar la salida de errores PHP como HTML
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Función para log de errores
function logError($message) {
    error_log("Error en publicar_propiedad.php: " . $message);
}

// Establecer headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Verificar método HTTP
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }

    // Obtener y validar datos de entrada
    $rawData = file_get_contents('php://input');
    if (!$rawData) {
        throw new Exception('No se recibieron datos');
    }

    // Log de datos recibidos
    logError("Datos recibidos: " . $rawData);

    // Decodificar JSON
    $requestData = json_decode($rawData, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Error al decodificar JSON: ' . json_last_error_msg());
    }

    // Validar campos requeridos
    if (!isset($requestData['property_id']) || !isset($requestData['status'])) {
        throw new Exception('Faltan campos requeridos: property_id y status son obligatorios');
    }

    // Validar valores
    $propertyId = filter_var($requestData['property_id'], FILTER_VALIDATE_INT);
    $status = filter_var($requestData['status'], FILTER_SANITIZE_STRING);

    if ($propertyId === false) {
        throw new Exception('ID de propiedad inválido');
    }

    if (!in_array($status, ['draft', 'published'])) {
        throw new Exception('Estado inválido');
    }

    // Incluir la configuración de la base de datos
    require_once '../config/database.php';

    // Crear conexión
    $database = new Database();
    $db = $database->getConnection();

    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Obtener el user_id primero
        $userQuery = "SELECT user_id FROM properties WHERE id = :property_id";
        $userStmt = $db->prepare($userQuery);
        $userStmt->execute([':property_id' => $propertyId]);
        
        $property = $userStmt->fetch(PDO::FETCH_ASSOC);
        if (!$property) {
            throw new Exception('Propiedad no encontrada');
        }
        
        $userId = $property['user_id'];

        // Actualizar la propiedad
        $updateQuery = "UPDATE properties 
            SET status = :status,
                updated_at = CURRENT_TIMESTAMP,
                publication_date = CASE 
                    WHEN :pub_status = 'published' THEN CURRENT_TIMESTAMP 
                    ELSE NULL 
                END
            WHERE id = :property_id";

        $params = [
            ':status' => $status,
            ':pub_status' => $status, // Parámetro adicional para el CASE
            ':property_id' => $propertyId
        ];

        logError("Query a ejecutar: " . $updateQuery);
        logError("Parámetros: " . print_r($params, true));

        $updateStmt = $db->prepare($updateQuery);
        $success = $updateStmt->execute($params);

        if (!$success) {
            throw new Exception('Error al actualizar la propiedad');
        }

        // Registrar en el historial
        $actionDetails = json_encode([
            'previous_status' => 'draft',
            'new_status' => $status,
            'timestamp' => date('Y-m-d H:i:s')
        ]);

        $historyQuery = "INSERT INTO property_history 
            (property_id, user_id, action_type, action_details) 
            VALUES (:prop_id, :user_id, :action_type, :action_details)";

        $historyStmt = $db->prepare($historyQuery);
        $historySuccess = $historyStmt->execute([
            ':prop_id' => $propertyId,
            ':user_id' => $userId,
            ':action_type' => 'status_change',
            ':action_details' => $actionDetails
        ]);

        if (!$historySuccess) {
            throw new Exception('Error al registrar el historial');
        }

        // Confirmar transacción
        $db->commit();

        // Enviar respuesta exitosa
        echo json_encode([
            'success' => true,
            'message' => $status === 'published' 
                ? 'Propiedad publicada exitosamente' 
                : 'Propiedad guardada como borrador',
            'property_id' => $propertyId
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

} catch (PDOException $e) {
    logError("Error de base de datos: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos',
        'error' => $e->getMessage()
    ]);
} catch (Exception $e) {
    logError("Error general: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}