<?php
session_start();
require_once '../../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $db->beginTransaction();
    
    $userId = $_SESSION['user_id'];
    $data = json_decode(file_get_contents('php://input'), true);
    
    error_log("Datos recibidos: " . print_r($data, true));

    if (!isset($data['weeklySchedule'])) {
        throw new Exception('Datos inválidos');
    }

    // Eliminar horarios existentes
    $deleteScheduleQuery = "DELETE FROM user_schedules WHERE user_id = :userId";
    $deleteStmt = $db->prepare($deleteScheduleQuery);
    $deleteStmt->execute(['userId' => $userId]);

    // Insertar nuevos horarios
    foreach ($data['weeklySchedule'] as $day => $schedule) {
        if (!isset($schedule['isActive'])) {
            continue;
        }

        // Insertar horario del día
        $scheduleQuery = "INSERT INTO user_schedules (user_id, day_of_week, is_active) 
                         VALUES (:userId, :day, :isActive)";
        $scheduleStmt = $db->prepare($scheduleQuery);
        $scheduleStmt->execute([
            'userId' => $userId,
            'day' => $day,
            'isActive' => $schedule['isActive']
        ]);
        
        $scheduleId = $db->lastInsertId();

        // Insertar slots si el día está activo
        if ($schedule['isActive'] && !empty($schedule['slots'])) {
            $slotQuery = "INSERT INTO schedule_slots 
                         (schedule_id, start_time, end_time, slot_type, description) 
                         VALUES (:scheduleId, :start, :end, :type, :description)";
            $slotStmt = $db->prepare($slotQuery);

            foreach ($schedule['slots'] as $slot) {
                $slotStmt->execute([
                    'scheduleId' => $scheduleId,
                    'start' => $slot['start'],
                    'end' => $slot['end'],
                    'type' => $slot['type'],
                    'description' => $slot['description'] ?? null
                ]);
            }
        }
    }

    $db->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Horario guardado correctamente'
    ]);

} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en save_schedule.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al guardar el horario: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}