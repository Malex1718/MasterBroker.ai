<?php
session_start();
require_once '../../../vendor/autoload.php';
require_once '../../config/database.php';

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
    
    // Verificar que se envió un archivo
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No se recibió ningún archivo válido');
    }
    
    $folderId = $_POST['folder_id'] ?? null;
    $leadId = $_POST['lead_id'] ?? null;
    $documentType = $_POST['document_type'] ?? 'Documento';
    
    if (!$folderId) {
        throw new Exception('ID de carpeta requerido');
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
    $client->setAccessToken([
        'access_token' => $tokenData['access_token'],
        'refresh_token' => $tokenData['refresh_token']
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
    
    // Preparar archivo
    $fileMetadata = new Google_Service_Drive_DriveFile([
        'name' => $_FILES['file']['name'],
        'parents' => [$folderId]
    ]);
    
    // Determinar MIME type
    $mimeType = $_FILES['file']['type'] ?: 'application/octet-stream';
    
    // Crear FileContent
    $content = file_get_contents($_FILES['file']['tmp_name']);
    $file = $service->files->create($fileMetadata, [
        'data' => $content,
        'mimeType' => $mimeType,
        'uploadType' => 'multipart',
        'fields' => 'id, name, webViewLink'
    ]);
    
    // Registrar el documento en la base de datos si hay lead_id
    if ($leadId) {
        $stmtSaveDoc = $db->prepare("INSERT INTO lead_documents 
                                     (lead_id, folder_id, document_id, document_name, document_url, document_type) 
                                     VALUES (:leadId, :folderId, :docId, :docName, :docUrl, :docType)");
        $stmtSaveDoc->execute([
            'leadId' => $leadId,
            'folderId' => $folderId,
            'docId' => $file->getId(),
            'docName' => $file->getName(),
            'docUrl' => $file->getWebViewLink(),
            'docType' => $documentType
        ]);
        
        // Registrar como actividad
        $stmtActivity = $db->prepare("INSERT INTO lead_activities 
                                     (lead_id, activity_type, description, created_by) 
                                     VALUES (:leadId, 'documento', :description, :userId)");
        $stmtActivity->execute([
            'leadId' => $leadId,
            'description' => "Documento subido: $documentType - " . $file->getName(),
            'userId' => $userId
        ]);
    }
    
    echo json_encode([
        'success' => true,
        'file' => [
            'id' => $file->getId(),
            'name' => $file->getName(),
            'url' => $file->getWebViewLink()
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Error al subir archivo a Drive: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al subir archivo: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}