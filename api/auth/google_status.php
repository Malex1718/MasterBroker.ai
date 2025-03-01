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
    
    $stmt = $db->prepare("SELECT COUNT(*) as connected, 
                           refresh_token IS NOT NULL as has_refresh_token,
                           CASE WHEN expires_at > NOW() THEN true ELSE false END as token_valid 
                         FROM google_calendar_tokens 
                         WHERE user_id = :userId");
    $stmt->execute(['userId' => $userId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true, 
        'connected' => $result['connected'] > 0,
        'has_refresh_token' => (bool)$result['has_refresh_token'],
        'token_valid' => (bool)$result['token_valid']
    ]);

} catch (Exception $e) {
    error_log("Error en google_status.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al procesar la solicitud'
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}