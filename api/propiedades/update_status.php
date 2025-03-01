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

if (!isset($data['property_id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Faltan parámetros requeridos'
    ]);
    exit;
}

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Validar que el estado sea válido
    $valid_statuses = ['draft', 'published', 'finished', 'archived'];
    if (!in_array($data['status'], $valid_statuses)) {
        throw new Exception('Estado no válido');
    }

    // Verificar que la propiedad pertenezca al usuario
    $stmt = $conn->prepare("
        SELECT p.id, p.status, p.finish_reason_id, p.finish_notes, p.finished_at,
               r.code as current_finish_reason
        FROM properties p
        LEFT JOIN property_finish_reasons r ON p.finish_reason_id = r.id
        WHERE p.id = ? AND p.user_id = ?
    ");
    $stmt->execute([$data['property_id'], $_SESSION['user_id']]);
    $property = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$property) {
        throw new Exception('Propiedad no encontrada o no autorizada');
    }

    // Validar las transiciones de estado permitidas
    $allowed_transitions = [
        'draft' => ['published', 'archived'],
        'published' => ['finished', 'archived'],
        'finished' => ['published', 'archived'],
        'archived' => ['published']
    ];

    if (!isset($allowed_transitions[$property['status']]) || 
        !in_array($data['status'], $allowed_transitions[$property['status']])) {
        throw new Exception('Transición de estado no permitida');
    }

    // Iniciar transacción
    $conn->beginTransaction();

    $updateFields = [
        'status' => $data['status'],
        'updated_at' => date('Y-m-d H:i:s'),
        'updated_by' => $_SESSION['user_id']
    ];

    if ($data['status'] === 'published') {
        // Si se está activando la propiedad, limpiamos los campos de finalización
        $updateFields['finish_reason_id'] = null;
        $updateFields['finish_notes'] = null;
        $updateFields['finished_at'] = null;
    } 
    // En el archivo update_status.php, modificamos la sección de validación de razón
    elseif ($data['status'] === 'finished' || $data['status'] === 'archived') {
        // Si está cambiando a archived y ya estaba finished, mantenemos la razón actual
        if ($data['status'] === 'archived' && $property['status'] === 'finished') {
            $updateFields['finish_reason_id'] = $property['finish_reason_id'];
            $updateFields['finish_notes'] = $property['finish_notes'];
            $updateFields['finished_at'] = $property['finished_at'];
        } else {
            // En cualquier otro caso, requerimos una nueva razón
            if (!isset($data['finish_reason'])) {
                throw new Exception('Se requiere una razón para finalizar o archivar la propiedad');
            }

            // Validar que la razón de finalización sea válida
            $stmt = $conn->prepare("SELECT id FROM property_finish_reasons WHERE code = ?");
            $stmt->execute([$data['finish_reason']]);
            $reason = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$reason) {
                throw new Exception('Razón de finalización no válida');
            }

            $updateFields['finish_reason_id'] = $reason['id'];
            $updateFields['finish_notes'] = $data['finish_notes'] ?? null;
            $updateFields['finished_at'] = date('Y-m-d H:i:s');
        }
    }
    // Construir la consulta de actualización dinámicamente
    $updateQuery = "UPDATE properties SET ";
    $updateParams = [];
    foreach ($updateFields as $field => $value) {
        $updateQuery .= "$field = ?, ";
        $updateParams[] = $value;
    }
    $updateQuery = rtrim($updateQuery, ', ');
    $updateQuery .= " WHERE id = ?";
    $updateParams[] = $data['property_id'];

    $stmt = $conn->prepare($updateQuery);
    $stmt->execute($updateParams);

    // Registrar en el historial
    $actionDetails = [
        'previous_status' => $property['status'],
        'new_status' => $data['status'],
        'timestamp' => date('Y-m-d H:i:s')
    ];

    // Agregar detalles de finalización al historial
    if ($data['status'] === 'finished' || $data['status'] === 'archived') {
        $actionDetails['finish_reason'] = $data['finish_reason'];
        $actionDetails['finish_notes'] = $data['finish_notes'] ?? null;
    } 
    elseif ($data['status'] === 'published' && $property['status'] === 'finished') {
        $actionDetails['previous_finish_reason'] = $property['current_finish_reason'];
        $actionDetails['action'] = 'reactivation';
    }

    $stmt = $conn->prepare("
        INSERT INTO property_history 
        (property_id, user_id, action_type, action_details)
        VALUES (?, ?, 'status_change', ?)
    ");
    
    $stmt->execute([
        $data['property_id'],
        $_SESSION['user_id'],
        json_encode($actionDetails)
    ]);

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'Estado actualizado correctamente'
    ]);

} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollBack();
    }
    error_log("Error en update_status.php: " . $e->getMessage());
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