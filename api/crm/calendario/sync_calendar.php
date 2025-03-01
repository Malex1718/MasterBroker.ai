<?php
session_start();
require_once '../../../vendor/autoload.php';
require_once '../../config/database.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../'); // Ajusta esta ruta según donde esté tu .env
$dotenv->load();

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

function getGoogleClient($tokenData) {
    $client = new Google_Client();
    $client->setApplicationName('Master Broker Calendar');
    $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']); // Usar variable de entorno
    $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']); // Usar variable de entorno
    
    // Configurar ambos tokens desde el principio
    $accessToken = [
        'access_token' => $tokenData['access_token'],
        'refresh_token' => $tokenData['refresh_token'],
        'expires_in' => strtotime($tokenData['expires_at']) - time()
    ];
    
    $client->setAccessToken($accessToken);
    
    // Si el token ha expirado, renovarlo y actualizar en la base de datos
    if ($client->isAccessTokenExpired()) {
        try {
            $client->fetchAccessTokenWithRefreshToken($tokenData['refresh_token']);
            $newToken = $client->getAccessToken();
            
            // Actualizar token en la base de datos
            $db = (new Database())->getConnection();
            $stmt = $db->prepare("UPDATE google_calendar_tokens 
                                  SET access_token = :access_token, 
                                      expires_at = :expires_at 
                                  WHERE user_id = :user_id");
                                  
            $expiresAt = date('Y-m-d H:i:s', time() + $newToken['expires_in']);
            
            $stmt->execute([
                ':access_token' => $newToken['access_token'],
                ':expires_at' => $expiresAt,
                ':user_id' => $_SESSION['user_id']
            ]);
            
        } catch (Exception $e) {
            throw new Exception('Error al renovar token: ' . $e->getMessage());
        }
    }
    
    return $client;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Obtener el token de Google con más información
    $tokenQuery = "SELECT access_token, refresh_token, expires_at FROM google_calendar_tokens WHERE user_id = :userId";
    $tokenStmt = $db->prepare($tokenQuery);
    $tokenStmt->execute(['userId' => $userId]);
    $tokenData = $tokenStmt->fetch(PDO::FETCH_ASSOC);

    if (!$tokenData || !$tokenData['refresh_token']) {
        throw new Exception('No hay token completo de Google Calendar. Se requiere volver a conectar la cuenta.');
    }

    // Configurar cliente de Google con los tokens completos
    $client = getGoogleClient($tokenData);
    $service = new Google_Service_Calendar($client);
    
    // Verificar que no haya errores de autenticación antes de continuar
    try {
        // Prueba simple para verificar autenticación - obtener calendarios
        $calendarList = $service->calendarList->listCalendarList(['maxResults' => 1]);
    } catch (Google_Service_Exception $e) {
        $errors = json_decode($e->getMessage(), true);
        $errorReason = $errors['error']['errors'][0]['reason'] ?? 'unknown_error';
        
        if (in_array($errorReason, ['authError', 'invalid_grant', 'unauthorized'])) {
            throw new Exception('Error de autenticación con Google. Se requiere volver a conectar la cuenta.');
        }
        throw $e; // Si es otro tipo de error, lo propagamos
    }

    // Obtener horarios del usuario
    $scheduleQuery = "SELECT * FROM user_schedules WHERE user_id = :userId";
    $scheduleStmt = $db->prepare($scheduleQuery);
    $scheduleStmt->execute(['userId' => $userId]);
    $schedules = $scheduleStmt->fetchAll(PDO::FETCH_ASSOC);

    $activeSlotIds = []; // Para rastrear slots activos

    // Crear/actualizar eventos de disponibilidad
    foreach ($schedules as $schedule) {
        if (!$schedule['is_active']) continue;

        // Obtener slots del día
        $slotsQuery = "SELECT * FROM schedule_slots WHERE schedule_id = :scheduleId";
        $slotsStmt = $db->prepare($slotsQuery);
        $slotsStmt->execute(['scheduleId' => $schedule['id']]);
        $slots = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($slots as $slot) {
            if ($slot['slot_type'] !== 'available') continue;
            
            // Agregar a lista de slots activos
            $activeSlotIds[] = [
                'schedule_id' => $schedule['id'],
                'slot_id' => $slot['id']
            ];

            // Verificar si ya existe un evento para este slot
            $existingEventQuery = "SELECT google_event_id FROM calendar_event_mappings 
                                WHERE user_id = :userId 
                                AND schedule_id = :scheduleId 
                                AND slot_id = :slotId";
            $existingEventStmt = $db->prepare($existingEventQuery);
            $existingEventStmt->execute([
                'userId' => $userId,
                'scheduleId' => $schedule['id'],
                'slotId' => $slot['id']
            ]);
            $existingEvent = $existingEventStmt->fetch(PDO::FETCH_ASSOC);

            // Preparar el evento
            $event = new Google_Service_Calendar_Event([
                'summary' => 'Disponible para citas',
                'description' => $slot['description'] ?: 'Horario disponible para agendar citas',
                'start' => [
                    'timeZone' => 'America/Mexico_City',
                    'dateTime' => date('Y-m-d\TH:i:s', strtotime("next {$schedule['day_of_week']} {$slot['start_time']}"))
                ],
                'end' => [
                    'timeZone' => 'America/Mexico_City',
                    'dateTime' => date('Y-m-d\TH:i:s', strtotime("next {$schedule['day_of_week']} {$slot['end_time']}"))
                ],
                'recurrence' => ['RRULE:FREQ=WEEKLY'],
                'reminders' => [
                    'useDefault' => false,
                    'overrides' => [
                        ['method' => 'popup', 'minutes' => 30]
                    ]
                ]
            ]);

            if ($existingEvent) {
                // Actualizar evento existente
                try {
                    $updatedEvent = $service->events->update('primary', $existingEvent['google_event_id'], $event);
                    
                    // Actualizar timestamp en la tabla de mapeo
                    $updateMappingQuery = "UPDATE calendar_event_mappings 
                                        SET updated_at = NOW() 
                                        WHERE user_id = :userId 
                                        AND schedule_id = :scheduleId 
                                        AND slot_id = :slotId";
                    $db->prepare($updateMappingQuery)->execute([
                        'userId' => $userId,
                        'scheduleId' => $schedule['id'],
                        'slotId' => $slot['id']
                    ]);
                } catch (Exception $e) {
                    // Si el evento fue eliminado en Google Calendar, creamos uno nuevo
                    if (strpos($e->getMessage(), 'Resource has been deleted') !== false) {
                        $createdEvent = $service->events->insert('primary', $event);
                        
                        // Actualizar el ID en la tabla de mapeo
                        $updateMappingQuery = "UPDATE calendar_event_mappings 
                                            SET google_event_id = :eventId, updated_at = NOW() 
                                            WHERE user_id = :userId 
                                            AND schedule_id = :scheduleId 
                                            AND slot_id = :slotId";
                        $db->prepare($updateMappingQuery)->execute([
                            'eventId' => $createdEvent->getId(),
                            'userId' => $userId,
                            'scheduleId' => $schedule['id'],
                            'slotId' => $slot['id']
                        ]);
                    } else {
                        throw $e;
                    }
                }
            } else {
                // Crear nuevo evento
                $createdEvent = $service->events->insert('primary', $event);
                
                // Guardar mapeo en la base de datos
                $insertMappingQuery = "INSERT INTO calendar_event_mappings 
                                    (user_id, schedule_id, slot_id, google_event_id) 
                                    VALUES (:userId, :scheduleId, :slotId, :eventId)";
                $db->prepare($insertMappingQuery)->execute([
                    'userId' => $userId,
                    'scheduleId' => $schedule['id'],
                    'slotId' => $slot['id'],
                    'eventId' => $createdEvent->getId()
                ]);
            }
        }
    }

    // Eliminar eventos obsoletos
    // Obtener todos los mappings de este usuario
    $mappingsQuery = "SELECT google_event_id, schedule_id, slot_id 
                    FROM calendar_event_mappings 
                    WHERE user_id = :userId";
    $mappingsStmt = $db->prepare($mappingsQuery);
    $mappingsStmt->execute(['userId' => $userId]);
    $allMappings = $mappingsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Eliminar eventos que ya no están activos
    foreach ($allMappings as $mapping) {
        $isActive = false;
        foreach ($activeSlotIds as $activeSlot) {
            if ($mapping['schedule_id'] == $activeSlot['schedule_id'] && 
                $mapping['slot_id'] == $activeSlot['slot_id']) {
                $isActive = true;
                break;
            }
        }
        
        if (!$isActive) {
            try {
                // Eliminar el evento de Google Calendar
                $service->events->delete('primary', $mapping['google_event_id']);
                
                // Eliminar el mapping de la base de datos
                $deleteMappingQuery = "DELETE FROM calendar_event_mappings 
                                    WHERE user_id = :userId 
                                    AND google_event_id = :eventId";
                $db->prepare($deleteMappingQuery)->execute([
                    'userId' => $userId,
                    'eventId' => $mapping['google_event_id']
                ]);
            } catch (Exception $e) {
                // Si el evento ya no existe en Google Calendar, solo eliminamos el mapping
                if (strpos($e->getMessage(), 'Resource has been deleted') !== false) {
                    $deleteMappingQuery = "DELETE FROM calendar_event_mappings 
                                        WHERE user_id = :userId 
                                        AND google_event_id = :eventId";
                    $db->prepare($deleteMappingQuery)->execute([
                        'userId' => $userId,
                        'eventId' => $mapping['google_event_id']
                    ]);
                } else {
                    throw $e;
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Horarios sincronizados con Google Calendar',
        'stats' => [
            'active_slots' => count($activeSlotIds),
            'synced_events' => count($activeSlotIds),
            'removed_events' => count($allMappings) - count($activeSlotIds)
        ]
    ]);

} catch (Exception $e) {
    error_log("Error en sync_calendar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al sincronizar con Google Calendar: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}