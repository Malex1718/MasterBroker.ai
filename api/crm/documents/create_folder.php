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
    $clientName = $data['client_name'] ?? '';
    $leadId = $data['lead_id'] ?? null;
    
    if (empty($clientName)) {
        throw new Exception('El nombre del cliente es requerido');
    }
    
    if ($leadId) {
        // Verificar si ya existe una carpeta para este lead
        // Quitamos la referencia a deleted_at ya que la columna no existe
        $checkStmt = $db->prepare("SELECT folder_id, folder_name, folder_url FROM lead_document_folders WHERE lead_id = :leadId");
        $checkStmt->execute(['leadId' => $leadId]);
        $existingFolder = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingFolder) {
            // Si ya existe una carpeta, devolver los datos existentes
            echo json_encode([
                'success' => true,
                'folder' => [
                    'id' => $existingFolder['folder_id'],
                    'name' => $existingFolder['folder_name'],
                    'url' => $existingFolder['folder_url']
                ],
                'message' => 'Ya existe una carpeta para este cliente'
            ]);
            exit;
        }
    }
    
    // Obtener token de acceso
    $stmt = $db->prepare("SELECT access_token, refresh_token FROM google_calendar_tokens WHERE user_id = :userId");
    $stmt->execute(['userId' => $userId]);
    $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$tokenData) {
        throw new Exception('No hay token de Google disponible');
    }
    
    // Configurar cliente de Google con todas las credenciales necesarias
    $client = new Google_Client();
    $client->setApplicationName('Master Broker CRM');
    $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']);
    $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']);
    $client->setRedirectUri($_ENV['GOOGLE_OAUTH_REDIRECT_URI'] ?? (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]/api/auth/oauth2callback.php");
    
    // Establecer los scopes necesarios
    $client->setScopes(['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive.file']);
    
    // Establecer el token de acceso
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
    
    // Metadatos de la carpeta
    $folderMetadata = new Google_Service_Drive_DriveFile([
        'name' => "Cliente - $clientName",
        'mimeType' => 'application/vnd.google-apps.folder'
    ]);
    
    // Crear la carpeta
    $folder = $service->files->create($folderMetadata, [
        'fields' => 'id, name, webViewLink'
    ]);
    
    // Si hay un lead_id, guardar la relación en la base de datos
    if ($leadId) {
        $stmtSaveFolder = $db->prepare("INSERT INTO lead_document_folders (lead_id, folder_id, folder_name, folder_url) 
                                       VALUES (:leadId, :folderId, :folderName, :folderUrl)
                                       ON DUPLICATE KEY UPDATE
                                       folder_id = VALUES(folder_id),
                                       folder_name = VALUES(folder_name),
                                       folder_url = VALUES(folder_url)");
        $stmtSaveFolder->execute([
            'leadId' => $leadId,
            'folderId' => $folder->getId(),
            'folderName' => $folder->getName(),
            'folderUrl' => $folder->getWebViewLink()
        ]);
    }
    
    echo json_encode([
        'success' => true,
        'folder' => [
            'id' => $folder->getId(),
            'name' => $folder->getName(),
            'url' => $folder->getWebViewLink()
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Error al crear carpeta en Drive: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al crear carpeta: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}