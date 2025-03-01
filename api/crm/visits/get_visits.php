<?php
session_start();
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
    
    // Construir consulta con filtros
    // Modificamos este bloque para usar nombre de parámetros únicos
    $params = [':user_id1' => $userId, ':user_id2' => $userId];
    $whereConditions = ["(v.user_id = :user_id1 OR v.created_by = :user_id2)"];
    
    // Filtros por lead
    if (isset($_GET['lead_id'])) {
        $whereConditions[] = "v.lead_id = :lead_id";
        $params[':lead_id'] = $_GET['lead_id'];
    }
    
    // Filtros por fecha
    if (isset($_GET['start_date'])) {
        $whereConditions[] = "v.visit_date >= :start_date";
        $params[':start_date'] = $_GET['start_date'];
    }
    
    if (isset($_GET['end_date'])) {
        $whereConditions[] = "v.visit_date <= :end_date";
        $params[':end_date'] = $_GET['end_date'];
    }
    
    // Filtro por estado
    if (isset($_GET['status'])) {
        $whereConditions[] = "v.status = :status";
        $params[':status'] = $_GET['status'];
    }
    
    // Visitas pendientes
    if (isset($_GET['pending']) && $_GET['pending'] === 'true') {
        $whereConditions[] = "v.visit_date >= NOW() AND v.status = 'programada'";
    }
    
    // Filtro para registros eliminados lógicamente
    if (!isset($_GET['include_deleted']) || $_GET['include_deleted'] !== 'true') {
        $whereConditions[] = "v.deleted_at IS NULL";
    }
    
    // Consulta
    $sql = "
        SELECT v.*, 
               l.name as lead_name, l.email as lead_email, l.phone as lead_phone,
               p.title as property_title,
               u.first_name as agent_first_name, u.last_name as agent_last_name,
               m.google_event_id, m.event_url
        FROM property_visits v
        LEFT JOIN property_leads l ON v.lead_id = l.id
        LEFT JOIN properties p ON v.property_id = p.id
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN visit_calendar_mappings m ON v.id = m.visit_id
        WHERE " . implode(" AND ", $whereConditions) . "
        ORDER BY v.visit_date DESC
    ";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    $visits = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'count' => count($visits),
        'data' => $visits
    ]);
    
} catch (Exception $e) {
    error_log("Error en get_visits.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener visitas: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}