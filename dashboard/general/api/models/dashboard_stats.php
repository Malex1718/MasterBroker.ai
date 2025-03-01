<?php
require_once '/dashboard/general/api/config/cors.php';
require_once '/dashboard/general/api/config/database.php';
require_once '/dashboard/general/api/models/DashboardStats.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    $dashboardStats = new DashboardStats($db);

    $response = [
        'user_stats' => $dashboardStats->getUserStats(),
        'property_stats' => $dashboardStats->getPropertyStats(),
        'lead_stats' => $dashboardStats->getLeadStats(),
        'recent_activity' => $dashboardStats->getRecentActivity()
    ];

    if ($response['user_stats'] === false || 
        $response['property_stats'] === false || 
        $response['lead_stats'] === false || 
        $response['recent_activity'] === false) {
        throw new Exception("Error al obtener los datos");
    }

    echo json_encode([
        'status' => 'success',
        'data' => $response
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error al cargar los datos del dashboard'
    ]);
}
?>