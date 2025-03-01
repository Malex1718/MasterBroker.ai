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
    
    // Construir actualización
    $updateFields = [];
    $params = [':visit_id' => $visitId];
    
    if (isset($data['status'])) {
        $updateFields[] = "status = :status";
        $params[':status'] = $data['status'];
        
        if ($data['status'] === 'cancelada' && isset($data['cancel_reason'])) {
            $updateFields[] = "cancel_reason = :cancel_reason";
            $params[':cancel_reason'] = $data['cancel_reason'];
        }
        
        if ($data['status'] === 'realizada' && isset($data['visit_notes'])) {
            $updateFields[] = "visit_notes = :visit_notes";
            $params[':visit_notes'] = $data['visit_notes'];
        }
    }
    
    if (isset($data['visit_date'])) {
        $updateFields[] = "visit_date = :visit_date";
        $params[':visit_date'] = $data['visit_date'];
        
        // Recalcular end_time
        $duration = isset($data['duration']) ? intval($data['duration']) : 
                  (strtotime($visit['end_time']) - strtotime($visit['visit_date'])) / 60;
        
        $endTime = date('Y-m-d H:i:s', strtotime($data['visit_date'] . " +$duration minutes"));
        $updateFields[] = "end_time = :end_time";
        $params[':end_time'] = $endTime;
    }
    
    if (isset($data['title'])) {
        $updateFields[] = "title = :title";
        $params[':title'] = $data['title'];
    }
    
    if (isset($data['description'])) {
        $updateFields[] = "description = :description";
        $params[':description'] = $data['description'];
    }
    
    if (empty($updateFields)) {
        throw new Exception('No hay datos para actualizar');
    }
    
    // Agregar timestamp de actualización
    $updateFields[] = "updated_at = NOW()";
    
    // Ejecutar actualización
    $updateSql = "UPDATE property_visits SET " . implode(", ", $updateFields) . " WHERE id = :visit_id";
    $updateStmt = $db->prepare($updateSql);
    $updateStmt->execute($params);
    
    // Sincronizar con Google si hay evento asociado
    $googleSynced = false;
    
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
                // Obtener evento existente
                $event = $service->events->get('primary', $visit['google_event_id']);
                
                // Actualizar campos según cambios en visita
                if (isset($data['status'])) {
                    if ($data['status'] === 'cancelada') {
                        $event->setStatus('cancelled');
                        if (isset($data['cancel_reason'])) {
                            $event->setDescription($event->getDescription() . "\n\nCANCELADO: " . $data['cancel_reason']);
                        }
                    } else if ($data['status'] === 'realizada') {
                        $notes = isset($data['visit_notes']) ? "\n\nNOTAS: " . $data['visit_notes'] : '';
                        $event->setDescription($event->getDescription() . "\n\nCOMPLETADA" . $notes);
                        $event->setColorId('10'); // Verde oscuro
                    } else if ($data['status'] === 'reprogramada') {
                        $event->setColorId('5'); // Amarillo
                    }
                }
                
                if (isset($params[':visit_date'])) {
                    $startDateTime = new Google_Service_Calendar_EventDateTime();
                    $startDateTime->setDateTime((new DateTime($params[':visit_date']))->format(DateTime::RFC3339));
                    $startDateTime->setTimeZone('America/Mexico_City');
                    $event->setStart($startDateTime);
                }
                
                if (isset($params[':end_time'])) {
                    $endDateTime = new Google_Service_Calendar_EventDateTime();
                    $endDateTime->setDateTime((new DateTime($params[':end_time']))->format(DateTime::RFC3339));
                    $endDateTime->setTimeZone('America/Mexico_City');
                    $event->setEnd($endDateTime);
                }
                
                if (isset($data['title'])) {
                    $event->setSummary($data['title']);
                }
                
                if (isset($data['description'])) {
                    $event->setDescription($data['description']);
                }
                
                // Guardar cambios en Google
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
                
                $googleSynced = true;
                
            } catch (Exception $e) {
                error_log("Error al actualizar evento en Google: " . $e->getMessage());
            }
        }
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_synced' => $googleSynced,
        'message' => 'Visita actualizada correctamente' . 
                    ($googleSynced ? ' y sincronizada con Google Calendar' : '')
    ]);
    
} catch (Exception $e) {
    if (isset($db)) $db->rollBack();
    error_log("Error en update_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al actualizar visita: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) $database->closeConnection();
}