<?php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['access_token'])) {
        throw new Exception('Token no proporcionado');
    }

    // Corregimos la consulta para usar los mismos parámetros tanto en INSERT como en UPDATE
    $stmt = $db->prepare("INSERT INTO google_calendar_tokens 
                        (user_id, access_token, refresh_token, expires_at, created_at) 
                        VALUES (:userId, :token, :refresh_token, :expires_at, NOW()) 
                        ON DUPLICATE KEY UPDATE 
                        access_token = VALUES(access_token),
                        refresh_token = VALUES(refresh_token),
                        expires_at = VALUES(expires_at),
                        created_at = NOW()");
    
    $expiresAt = isset($data['expires_in']) ? 
        date('Y-m-d H:i:s', time() + $data['expires_in']) : null;

    $stmt->execute([
        ':userId' => $userId,
        ':token' => $data['access_token'],
        ':refresh_token' => $data['refresh_token'] ?? null,
        ':expires_at' => $expiresAt
    ]);
    
    echo json_encode(['success' => true, 'message' => 'Token guardado correctamente']);

} catch (Exception $e) {
    error_log("Error en google_auth.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al procesar la solicitud: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}