<?php
session_start();
require_once '../../../vendor/autoload.php';
require_once '../../config/database.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../');
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
    
    // Obtener datos de la solicitud
    $data = json_decode(file_get_contents('php://input'), true);
    $documentId = $data['document_id'] ?? null;
    $leadId = $data['lead_id'] ?? null;
    
    if (!$documentId) {
        throw new Exception('ID de documento requerido');
    }
    
    // Obtener token de acceso
    $stmt = $db->prepare("SELECT access_token, refresh_token FROM google_calendar_tokens WHERE user_id = :userId");
    $stmt->execute(['userId' => $userId]);
    $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$tokenData) {
        throw new Exception('No hay token de Google disponible');
    }
    
    // Configurar cliente de Google
    $client = new Google_Client();
    $client->setApplicationName('Master Broker CRM');
    $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']);
    $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']);
    $client->setRedirectUri($_ENV['GOOGLE_OAUTH_REDIRECT_URI'] ?? (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]/api/auth/oauth2callback.php");
    $client->setScopes(['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive.file']);
    
    $client->setAccessToken([
        'access_token' => $tokenData['access_token'],
        'refresh_token' => $tokenData['refresh_token'] ?? null
    ]);
    
    // Si el token expiró, renovarlo
    if ($client->isAccessTokenExpired()) {
        $client->fetchAccessTokenWithRefreshToken($tokenData['refresh_token']);
        $newToken = $client->getAccessToken();
        
        // Guardar el nuevo token
        $updateStmt = $db->prepare("UPDATE google_calendar_tokens SET access_token = :token, expires_at = :expires WHERE user_id = :userId");
        $updateStmt->execute([
            'token' => $newToken['access_token'],
            'expires' => date('Y-m-d H:i:s', time() + $newToken['expires_in']),
            'userId' => $userId
        ]);
    }
    
    // Crear servicio de Drive
    $service = new Google_Service_Drive($client);
    
    // Eliminar el archivo de Google Drive
    $service->files->delete($documentId);
    
    // Eliminar el registro de la base de datos
    $stmtDelete = $db->prepare("DELETE FROM lead_documents WHERE document_id = :documentId AND lead_id = :leadId");
    $stmtDelete->execute([
        'documentId' => $documentId,
        'leadId' => $leadId
    ]);
    
    // Registrar la eliminación como actividad
    $stmtActivity = $db->prepare("INSERT INTO lead_activities 
                                 (lead_id, activity_type, description, created_by) 
                                 VALUES (:leadId, 'documento', :description, :userId)");
    $stmtActivity->execute([
        'leadId' => $leadId,
        'description' => "Documento eliminado: " . $documentId,
        'userId' => $userId
    ]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Documento eliminado correctamente'
    ]);
    
} catch (Exception $e) {
    error_log("Error al eliminar documento de Drive: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al eliminar documento: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}