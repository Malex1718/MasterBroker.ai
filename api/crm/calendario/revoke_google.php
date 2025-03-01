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
    
    // Obtener el token actual
    $stmt = $db->prepare("SELECT access_token FROM google_calendar_tokens WHERE user_id = :userId");
    $stmt->execute([':userId' => $userId]);
    $token = $stmt->fetchColumn();

    if ($token) {
        // Revocar el token en Google
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://oauth2.googleapis.com/revoke?token=" . $token);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_exec($ch);
        curl_close($ch);

        // Eliminar el token de la base de datos
        $stmt = $db->prepare("DELETE FROM google_calendar_tokens WHERE user_id = :userId");
        $stmt->execute([':userId' => $userId]);
    }

    echo json_encode(['success' => true, 'message' => 'Token revocado correctamente']);

} catch (Exception $e) {
    error_log("Error en revoke_google.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al revocar el token: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}