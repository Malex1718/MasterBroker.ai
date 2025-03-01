<?php
// sync_specific_event.php
session_start();
require_once '../../../vendor/autoload.php';
require_once '../../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['schedule_id']) || !isset($data['slot_id'])) {
        throw new Exception('Datos incompletos');
    }
    
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Obtener datos del slot
    $slotQuery = "SELECT s.*, sch.day_of_week 
                 FROM schedule_slots s
                 JOIN user_schedules sch ON s.schedule_id = sch.id
                 WHERE s.id = :slotId 
                 AND sch.id = :scheduleId
                 AND sch.user_id = :userId";
    $slotStmt = $db->prepare($slotQuery);
    $slotStmt->execute([
        'slotId' => $data['slot_id'],
        'scheduleId' => $data['schedule_id'],
        'userId' => $userId
    ]);
    $slot = $slotStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$slot) {
        throw new Exception('Slot no encontrado');
    }
    
    // Obtener token de Google
    $tokenQuery = "SELECT access_token, refresh_token, expires_at 
                  FROM google_calendar_tokens 
                  WHERE user_id = :userId";
    $tokenStmt = $db->prepare($tokenQuery);
    $tokenStmt->execute(['userId' => $userId]);
    $tokenData = $tokenStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$tokenData) {
        throw new Exception('No hay conexión con Google Calendar');
    }
    
    // Configurar cliente de Google
    $client = getGoogleClient($tokenData);
    $service = new Google_Service_Calendar($client);
    
    // Verificar si existe un mapping para este slot
    $mappingQuery = "SELECT google_event_id 
                    FROM calendar_event_mappings 
                    WHERE user_id = :userId 
                    AND schedule_id = :scheduleId 
                    AND slot_id = :slotId";
    $mappingStmt = $db->prepare($mappingQuery);
    $mappingStmt->execute([
        'userId' => $userId,
        'scheduleId' => $data['schedule_id'],
        'slotId' => $data['slot_id']
    ]);
    $mapping = $mappingStmt->fetch(PDO::FETCH_ASSOC);
    
    // Preparar evento
    $event = new Google_Service_Calendar_Event([
        'summary' => 'Disponible para citas',
        'description' => $slot['description'] ?: 'Horario disponible para agendar citas',
        'start' => [
            'timeZone' => 'America/Mexico_City',
            'dateTime' => date('Y-m-d\TH:i:s', strtotime("next {$slot['day_of_week']} {$slot['start_time']}"))
        ],
        'end' => [
            'timeZone' => 'America/Mexico_City',
            'dateTime' => date('Y-m-d\TH:i:s', strtotime("next {$slot['day_of_week']} {$slot['end_time']}"))
        ],
        'recurrence' => ['RRULE:FREQ=WEEKLY'],
        'reminders' => [
            'useDefault' => false,
            'overrides' => [
                ['method' => 'popup', 'minutes' => 30]
            ]
        ]
    ]);
    
    // Si es un slot inactivo o no disponible y existía, eliminar
    if ($slot['slot_type'] !== 'available' && $mapping) {
        $service->events->delete('primary', $mapping['google_event_id']);
        
        $deleteMappingQuery = "DELETE FROM calendar_event_mappings 
                              WHERE user_id = :userId 
                              AND schedule_id = :scheduleId 
                              AND slot_id = :slotId";
        $db->prepare($deleteMappingQuery)->execute([
            'userId' => $userId,
            'scheduleId' => $data['schedule_id'],
            'slotId' => $data['slot_id']
        ]);
        
        echo json_encode([
            'success' => true,
            'action' => 'deleted',
            'message' => 'Evento eliminado correctamente'
        ]);
        exit;
    }
    
    // Si es disponible, actualizar o crear
    if ($slot['slot_type'] === 'available') {
        if ($mapping) {
            // Actualizar
            $updatedEvent = $service->events->update('primary', $mapping['google_event_id'], $event);
            echo json_encode([
                'success' => true,
                'action' => 'updated',
                'message' => 'Evento actualizado correctamente'
            ]);
        } else {
            // Crear nuevo
            $createdEvent = $service->events->insert('primary', $event);
            
            $insertMappingQuery = "INSERT INTO calendar_event_mappings 
                                  (user_id, schedule_id, slot_id, google_event_id) 
                                  VALUES (:userId, :scheduleId, :slotId, :eventId)";
            $db->prepare($insertMappingQuery)->execute([
                'userId' => $userId,
                'scheduleId' => $data['schedule_id'],
                'slotId' => $data['slot_id'],
                'eventId' => $createdEvent->getId()
            ]);
            
            echo json_encode([
                'success' => true,
                'action' => 'created',
                'message' => 'Evento creado correctamente'
            ]);
        }
    }

} catch (Exception $e) {
    error_log("Error en sync_specific_event.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al sincronizar evento: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}