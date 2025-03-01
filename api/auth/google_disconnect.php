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
    
    $stmt = $db->prepare("DELETE FROM google_calendar_tokens WHERE user_id = :userId");
    $stmt->execute(['userId' => $userId]);
    
    echo json_encode(['success' => true, 'message' => 'Cuenta desconectada correctamente']);

} catch (Exception $e) {
    error_log("Error en google_disconnect.php: " . $e->getMessage());
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