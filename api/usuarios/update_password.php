<?php
// api/usuarios/update_password.php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    // Obtener y validar datos de entrada
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
 
    if (!$data) {
        throw new Exception('Datos inválidos');
    }

    if (empty($data['current_password']) || empty($data['new_password'])) {
        throw new Exception('Todos los campos son requeridos');
    }

    if (strlen($data['new_password']) < 6) {
        throw new Exception('La contraseña debe tener al menos 6 caracteres');
    }

    $userId = $_SESSION['user_id'];
    $currentPassword = $data['current_password'];
    $newPassword = $data['new_password'];

    // Conectar a la base de datos
    $database = new Database();
    $db = $database->getConnection();

    // Verificar la contraseña actual
    $query = "SELECT password FROM users WHERE id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception('Usuario no encontrado');
    }

    // Verificar que la contraseña actual sea correcta
    if (!password_verify($currentPassword, $user['password'])) {
        throw new Exception('La contraseña actual es incorrecta');
    }

    // Generar hash de la nueva contraseña
    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);

    // Actualizar la contraseña
    $updateQuery = "UPDATE users SET 
        password = :password,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = :userId";

    $stmt = $db->prepare($updateQuery);
    $result = $stmt->execute([
        'password' => $newPasswordHash,
        'userId' => $userId
    ]);

    if (!$result) {
        throw new Exception('Error al actualizar la contraseña');
    }

    // Registrar el cambio en el historial
    $logQuery = "INSERT INTO login_history 
        (user_id, ip_address, user_agent, status) 
        VALUES 
        (:userId, :ip, :userAgent, 'success')";

    $stmt = $db->prepare($logQuery);
    $stmt->execute([
        'userId' => $userId,
        'ip' => $_SERVER['REMOTE_ADDR'],
        'userAgent' => $_SERVER['HTTP_USER_AGENT']
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Contraseña actualizada correctamente'
    ]);

} catch (Exception $e) {
    error_log("Error en update_password.php: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}