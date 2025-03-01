<?php
session_start();
header('Content-Type: application/json');

// Simular un usuario autenticado para pruebas
if (!isset($_SESSION['user_id'])) {
    $_SESSION['user_id'] = 2; // ID del usuario de prueba
}

require_once '../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Consulta de prueba para verificar los leads
    $query = "
        SELECT 
            pl.*,
            p.title as property_title,
            p.code as property_code
        FROM property_leads pl
        JOIN properties p ON pl.property_id = p.id
        WHERE p.user_id = :user_id
        LIMIT 5
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->execute([':user_id' => $_SESSION['user_id']]);
    $leads = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Información de debug
    $debug = [
        'session' => $_SESSION,
        'request_method' => $_SERVER['REQUEST_METHOD'],
        'query_string' => $_SERVER['QUERY_STRING'],
        'leads_count' => count($leads),
        'first_lead' => $leads[0] ?? null,
        'database_connected' => true
    ];
    
    echo json_encode([
        'status' => 'success',
        'data' => $leads,
        'debug' => $debug
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'debug' => [
            'error_type' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
}
?>