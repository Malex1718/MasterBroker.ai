<?php
session_start();
require_once '../../config/database.php';
require_once '../../../vendor/autoload.php';

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
    
    if (!isset($data['visit_id']) || !isset($data['new_date'])) {
        throw new Exception('Datos incompletos para reprogramar visita');
    }
    
    $userId = $_SESSION['user_id'];
    $visitId = $data['visit_id'];
    $newDate = $data['new_date'];
    $reason = $data['reason'] ?? 'Reprogramada por el usuario';
    $duration = $data['duration'] ?? 60; // Duración en minutos
    
    // Verificar existencia y permisos
    $checkStmt = $db->prepare("
        SELECT v.*, m.google_event_id 
        FROM property_visits v
        LEFT JOIN visit_calendar_mappings m ON v.id = m.visit_id
        WHERE v.id = :visit_id AND (v.user_id = :user_id OR v.created_by = :user_id)
    ");
    
    $checkStmt->execute([':visit_id' => $visitId, ':user_id' => $userId]);
    $visit = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$visit) {
        throw new Exception('Visita no encontrada o sin permisos');
    }
    
    if ($visit['status'] !== 'programada') {
        throw new Exception('Solo las visitas programadas pueden reprogramarse');
    }
    
    // Calcular nueva hora de fin
    $endTime = date('Y-m-d H:i:s', strtotime($newDate . " +$duration minutes"));
    
    // Actualizar visita
    $updateStmt = $db->prepare("
        UPDATE property_visits 
        SET status = 'reprogramada',
            visit_date = :new_date,
            end_time = :end_time,
            description = CONCAT(description, '\n\nReprogramada: ', :reason),
            updated_at = NOW()
        WHERE id = :visit_id
    ");
    
    $updateStmt->execute([
        ':visit_id' => $visitId,
        ':new_date' => $newDate,
        ':end_time' => $endTime,
        ':reason' => $reason
    ]);
    
    // Actualizar en Google Calendar si existe
    $googleUpdated = false;
    
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
                // Obtener evento
                $event = $service->events->get('primary', $visit['google_event_id']);
                
                // Actualizar fechas
                $startDateTime = new Google_Service_Calendar_EventDateTime();
                $startDateTime->setDateTime((new DateTime($newDate))->format(DateTime::RFC3339));
                $startDateTime->setTimeZone('America/Mexico_City');
                $event->setStart($startDateTime);
                
                $endDateTime = new Google_Service_Calendar_EventDateTime();
                $endDateTime->setDateTime((new DateTime($endTime))->format(DateTime::RFC3339));
                $endDateTime->setTimeZone('America/Mexico_City');
                $event->setEnd($endDateTime);
                
                // Actualizar descripción y color
                $event->setDescription($event->getDescription() . "\n\nREPROGRAMADA: " . $reason);
                $event->setColorId('5'); // Amarillo
                
                // Actualizar evento
                $updatedEvent = $service->events->update('primary', $visit['google_event_id'], $event);
                
                // Actualizar mapeado
                $updateMapStmt = $db->prepare("
                    UPDATE visit_calendar_mappings
                    SET event_data = :event_data,
                        updated_at = NOW()
                    WHERE google_event_id = :google_event_id
                ");
                
                $updateMapStmt->execute([
                    ':event_data' => json_encode($updatedEvent),
                    ':google_event_id' => $visit['google_event_id']
                ]);
                
                $googleUpdated = true;
                
            } catch (Exception $e) {
                error_log("Error al actualizar evento en Google: " . $e->getMessage());
            }
        }
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_updated' => $googleUpdated,
        'message' => 'Visita reprogramada' . 
                   ($googleUpdated ? ' y actualizada en Google Calendar' : '')
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en reschedule_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al reprogramar visita: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}