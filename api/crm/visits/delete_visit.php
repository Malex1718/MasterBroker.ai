<?php
session_start();
require_once '../../config/database.php';
require_once '../../../vendor/autoload.php';

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
    $db->beginTransaction();
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['visit_id'])) {
        throw new Exception('ID de visita no proporcionado');
    }
    
    $userId = $_SESSION['user_id'];
    $visitId = $data['visit_id'];
    
    // Verificar existencia y permisos
    $checkStmt = $db->prepare("
        SELECT v.*, m.google_event_id 
        FROM property_visits v
        LEFT JOIN visit_calendar_mappings m ON v.id = m.visit_id
        WHERE v.id = :visit_id AND (v.user_id = :user_id1 OR v.created_by = :user_id2)
        AND v.deleted_at IS NULL
    ");
    
    $checkStmt->execute([
        ':visit_id' => $visitId, 
        ':user_id1' => $userId,
        ':user_id2' => $userId
    ]);
    
    $visit = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$visit) {
        throw new Exception('Visita no encontrada o sin permisos');
    }
    
    // Verificar que la visita esté cancelada
    if ($visit['status'] !== 'cancelada' && $visit['status'] !== 'realizada') {
        throw new Exception('Solo las visitas canceladas o realizadas pueden eliminarse');
    }
    
    // Eliminar de Google Calendar si existe
    $googleDeleted = false;
    
    if ($visit['google_event_id']) {
        // Obtener tokens
        $tokenStmt = $db->prepare("
            SELECT access_token, refresh_token, expires_at 
            FROM google_calendar_tokens 
            WHERE user_id = :userId
        ");
        
        $tokenStmt->execute([':userId' => $userId]);
        $tokenData = $tokenStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($tokenData && $tokenData['refresh_token']) {
            // Configurar cliente Google
            $client = new Google_Client();
            $client->setApplicationName('Master Broker Calendar');
            $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']);
            $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']);
            
            $accessToken = [
                'access_token' => $tokenData['access_token'],
                'refresh_token' => $tokenData['refresh_token'],
                'expires_in' => strtotime($tokenData['expires_at']) - time()
            ];
            
            $client->setAccessToken($accessToken);
            
            // Renovar token si es necesario
            if ($client->isAccessTokenExpired()) {
                $client->fetchAccessTokenWithRefreshToken($tokenData['refresh_token']);
                $newToken = $client->getAccessToken();
                
                $updateToken = $db->prepare("
                    UPDATE google_calendar_tokens 
                    SET access_token = :access_token, 
                        expires_at = :expires_at 
                    WHERE user_id = :user_id
                ");
                
                $updateToken->execute([
                    ':access_token' => $newToken['access_token'],
                    ':expires_at' => date('Y-m-d H:i:s', time() + $newToken['expires_in']),
                    ':user_id' => $userId
                ]);
            }
            
            $service = new Google_Service_Calendar($client);
            
            try {
                // Eliminar evento de Google Calendar
                $service->events->delete('primary', $visit['google_event_id']);
                $googleDeleted = true;
                
                // Actualizar mapeo con deleted_at
                $updateMapStmt = $db->prepare("
                    UPDATE visit_calendar_mappings
                    SET deleted_at = NOW()
                    WHERE google_event_id = :google_event_id
                ");
                
                $updateMapStmt->execute([
                    ':google_event_id' => $visit['google_event_id']
                ]);
                
            } catch (Exception $e) {
                error_log("Error al eliminar evento en Google: " . $e->getMessage());
            }
        }
    }
    
    // Implementar borrado lógico en lugar de permanente
    $updateStmt = $db->prepare("
        UPDATE property_visits 
        SET deleted_at = NOW(), 
            deleted_by = :deleted_by,
            status = 'eliminada'
        WHERE id = :visit_id
    ");
    
    $updateStmt->execute([
        ':visit_id' => $visitId,
        ':deleted_by' => $userId
    ]);
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_deleted' => $googleDeleted,
        'message' => 'Visita eliminada' . 
                    ($googleDeleted ? ' y eliminada de Google Calendar' : '')
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en delete_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al eliminar visita: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}