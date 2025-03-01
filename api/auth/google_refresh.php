<?php
session_start();
require_once '../../vendor/autoload.php';
require_once '../config/database.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../'); // Ajusta esta ruta según donde esté tu .env
$dotenv->load(); 

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Obtener el token actual
    $stmt = $db->prepare("SELECT access_token, refresh_token, expires_at FROM google_calendar_tokens WHERE user_id = :userId");
    $stmt->execute(['userId' => $userId]);
    $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tokenData || !$tokenData['refresh_token']) {
        throw new Exception('No hay refresh token guardado');
    }

    // Crear cliente y renovar token
    $client = new Google_Client();
    $client->setApplicationName('Master Broker Calendar');
    $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']); // Usar variable de entorno
    $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']); // Usar variable de entorno
    
    $client->setRefreshToken($tokenData['refresh_token']);
    
    // Intentar renovar el token
    $newToken = $client->fetchAccessTokenWithRefreshToken();
    
    if (isset($newToken['error'])) {
        throw new Exception('Error al renovar token: ' . $newToken['error_description']);
    }
    
    // Actualizar en la base de datos
    $expiresAt = date('Y-m-d H:i:s', time() + $newToken['expires_in']);
    
    $updateStmt = $db->prepare("UPDATE google_calendar_tokens 
                               SET access_token = :access_token, 
                                   expires_at = :expires_at 
                               WHERE user_id = :userId");
                               
    $updateStmt->execute([
        ':access_token' => $newToken['access_token'],
        ':expires_at' => $expiresAt,
        ':userId' => $userId
    ]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Token renovado correctamente',
        'expires_at' => $expiresAt
    ]);

} catch (Exception $e) {
    error_log("Error en google_refresh.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al renovar token: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}