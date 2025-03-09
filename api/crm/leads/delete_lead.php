<?php
// Habilitar CORS
header("Access-Control-Allow-Origin: https://masterbroker.ai"); 
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

date_default_timezone_set('America/Mexico_City');
ini_set('date.timezone', 'America/Mexico_City');

// Manejo de preflight request (OPTIONS):
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Iniciar sesión de PHP
session_start();

/**
 * Validación basada en $_SESSION 
 */
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Sesión no encontrada o expirada"
    ]);
    exit;
}

// Incluir la clase de base de datos
require_once __DIR__ . '/../../config/database.php';

$database = new Database();
try {
    $pdo = $database->getConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error de conexión a la base de datos"
    ]);
    exit;
}

// Procesar solo solicitudes POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Método no permitido"
    ]);
    exit;
}

// Obtener los datos de la solicitud
$postData = json_decode(file_get_contents("php://input"), true);
if (!$postData || !isset($postData['lead_id'])) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Datos incompletos"
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    // Verificar si el lead existe
    $checkSql = "SELECT * FROM property_leads WHERE id = :lead_id";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([':lead_id' => $postData['lead_id']]);
    $lead = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$lead) {
        throw new Exception("Lead no encontrado");
    }

    // Verificar permisos: solo el creador, el agente asignado o un administrador pueden eliminar
    $isAdmin = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin';
    $isCreator = $lead['user_id'] == $_SESSION['user_id'];
    $isAssigned = $lead['assigned_to'] == $_SESSION['user_id'];

    if (!$isAdmin && !$isCreator && !$isAssigned) {
        throw new Exception("No tienes permisos para eliminar este lead");
    }

    // Realizar borrado lógico
    $updateSql = "UPDATE property_leads 
                 SET deleted_at = NOW(),
                     deleted_by = :deleted_by
                 WHERE id = :lead_id";
    
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        ':lead_id' => $postData['lead_id'],
        ':deleted_by' => $_SESSION['user_id']
    ]);

    // Registrar el motivo como una actividad
    if (isset($postData['reason']) && !empty($postData['reason'])) {
        $activitySql = "INSERT INTO lead_activities
                      (lead_id, user_id, activity_type, title, description, created_at)
                      VALUES
                      (:lead_id, :user_id, 'nota', 'Lead eliminado', :description, NOW())";
        
        $activityStmt = $pdo->prepare($activitySql);
        $activityStmt->execute([
            ':lead_id' => $postData['lead_id'],
            ':user_id' => $_SESSION['user_id'],
            ':description' => "Motivo de eliminación: " . $postData['reason']
        ]);
    }

    // Registrar en el historial
    $historySql = "INSERT INTO lead_history
                  (lead_id, user_id, action, field_name, old_value, new_value, created_at)
                  VALUES
                  (:lead_id, :user_id, 'delete', 'status', :old_status, 'deleted', NOW())";
    
    $historyStmt = $pdo->prepare($historySql);
    $historyStmt->execute([
        ':lead_id' => $postData['lead_id'],
        ':user_id' => $_SESSION['user_id'],
        ':old_status' => $lead['status']
    ]);

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Lead eliminado correctamente"
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error al eliminar el lead: " . $e->getMessage()
    ]);
}

$database->closeConnection();
?>