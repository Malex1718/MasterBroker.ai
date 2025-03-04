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
    $cancelReason = $data['reason'] ?? 'Cancelada por el usuario';
    
    // Verificar existencia y permisos
    $checkStmt = $db->prepare("
        SELECT v.*, m.google_event_id 
        FROM property_visits v
        LEFT JOIN visit_calendar_mappings m ON v.id = m.visit_id
        WHERE v.id = :visit_id AND (v.user_id = :user_id1 OR v.created_by = :user_id2)
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
    
    if ($visit['status'] === 'cancelada') {
        $db->commit();
        echo json_encode([
            'success' => true,
            'visit_id' => $visitId,
            'message' => 'La visita ya estaba cancelada'
        ]);
        exit;
    }
    
    // Actualizar estado
    $updateStmt = $db->prepare("
        UPDATE property_visits 
        SET status = 'cancelada', 
            cancel_reason = :cancel_reason,
            updated_at = NOW()
        WHERE id = :visit_id
    ");
    
    $updateStmt->execute([
        ':visit_id' => $visitId,
        ':cancel_reason' => $cancelReason
    ]);
    
    // Cancelar en Google Calendar si existe
    $googleCancelled = false;
    
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
                
                // Actualizar o eliminar el registro del mapeo
                $deleteMapStmt = $db->prepare("
                    DELETE FROM visit_calendar_mappings
                    WHERE google_event_id = :google_event_id
                ");
                
                $deleteMapStmt->execute([
                    ':google_event_id' => $visit['google_event_id']
                ]);
                
                $googleCancelled = true;
                
            } catch (Exception $e) {
                error_log("Error al cancelar evento en Google: " . $e->getMessage());
            }
        }
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_cancelled' => $googleCancelled,
        'message' => 'Visita cancelada correctamente' . 
                    ($googleCancelled ? ' y eliminada de Google Calendar' : '')
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en cancel_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al cancelar visita: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}