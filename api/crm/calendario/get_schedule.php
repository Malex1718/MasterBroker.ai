<?php
session_start();
require_once '../../config/database.php';  // Ajustamos la ruta

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Añadimos logs para debug
    error_log("Usuario ID: " . $userId);

    // Obtener los horarios
    $scheduleQuery = "SELECT * FROM user_schedules WHERE user_id = :userId";
    $scheduleStmt = $db->prepare($scheduleQuery);
    $scheduleStmt->execute(['userId' => $userId]);
    $schedules = $scheduleStmt->fetchAll(PDO::FETCH_ASSOC);

    error_log("Horarios encontrados: " . count($schedules));

    // Inicializar estructura completa
    $result = [
        'weeklySchedule' => [
            'monday' => ['isActive' => false, 'slots' => []],
            'tuesday' => ['isActive' => false, 'slots' => []],
            'wednesday' => ['isActive' => false, 'slots' => []],
            'thursday' => ['isActive' => false, 'slots' => []],
            'friday' => ['isActive' => false, 'slots' => []],
            'saturday' => ['isActive' => false, 'slots' => []],
            'sunday' => ['isActive' => false, 'slots' => []]
        ],
        'isDraft' => false
    ];

    // Obtener los slots para cada horario
    foreach ($schedules as $schedule) {
        $slotsQuery = "SELECT * FROM schedule_slots WHERE schedule_id = :scheduleId ORDER BY start_time";
        $slotsStmt = $db->prepare($slotsQuery);
        $slotsStmt->execute(['scheduleId' => $schedule['id']]);
        $slots = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);

        $result['weeklySchedule'][$schedule['day_of_week']] = [
            'isActive' => (bool)$schedule['is_active'],
            'slots' => array_map(function($slot) {
                return [
                    'start' => substr($slot['start_time'], 0, 5),
                    'end' => substr($slot['end_time'], 0, 5),
                    'type' => $slot['slot_type'],
                    'description' => $slot['description']
                ];
            }, $slots)
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $result
    ]);

} catch (Exception $e) {
    error_log("Error en get_schedule.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener el horario: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}