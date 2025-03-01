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
    
    if (!isset($data['visit_id'])) {
        throw new Exception('ID de visita no proporcionado');
    }
    
    $userId = $_SESSION['user_id'];
    $visitId = $data['visit_id'];
    $visitNotes = $data['notes'] ?? '';
    
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
        throw new Exception('Solo las visitas programadas pueden marcarse como realizadas');
    }
    
    // Actualizar estado
    $updateStmt = $db->prepare("
        UPDATE property_visits 
        SET status = 'realizada', 
            visit_notes = :visit_notes,
            updated_at = NOW()
        WHERE id = :visit_id
    ");
    
    $updateStmt->execute([
        ':visit_id' => $visitId,
        ':visit_notes' => $visitNotes
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
                
                // Marcar como completado
                $event->setColorId('10'); // Verde oscuro
                $event->setDescription($event->getDescription() . "\n\nVISITA REALIZADA: " . 
                                    date('Y-m-d H:i:s') . "\n\nNOTAS: " . $visitNotes);
                
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
    
    // Avanzar estado del lead a negociación si aplica
    if (isset($data['advance_lead']) && $data['advance_lead']) {
        $updateLeadStmt = $db->prepare("
            UPDATE property_leads
            SET status = 'negociacion',
                sub_state = 'en_seguimiento',
                updated_at = NOW()
            WHERE id = :lead_id
        ");
        
        $updateLeadStmt->execute([':lead_id' => $visit['lead_id']]);
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_updated' => $googleUpdated,
        'message' => 'Visita marcada como realizada' . 
                   ($googleUpdated ? ' y actualizada en Google Calendar' : '')
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en complete_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al marcar visita como realizada: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}