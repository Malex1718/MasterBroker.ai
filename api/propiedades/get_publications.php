<?php
// api/propiedades/get_property_stats.php

require_once '../config/database.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
    exit;
}

try {
    $property_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $timeRange = isset($_GET['range']) ? $_GET['range'] : '7d';
    
    if (!$property_id) {
        throw new Exception('ID de propiedad requerido');
    }

    $db = new Database();
    $conn = $db->getConnection();

    // Determinar el rango de fechas
    $endDate = date('Y-m-d H:i:s');
    switch($timeRange) {
        case '30d':
            $startDate = date('Y-m-d H:i:s', strtotime('-30 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-60 days'));
            break;
        case '90d':
            $startDate = date('Y-m-d H:i:s', strtotime('-90 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-180 days'));
            break;
        default: // 7d
            $startDate = date('Y-m-d H:i:s', strtotime('-7 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-14 days'));
            break;
    }

    // Primero verificamos el acceso
    $stmt = $conn->prepare("
        SELECT id 
        FROM properties 
        WHERE id = :property_id AND user_id = :user_id
    ");
    
    $stmt->execute([
        ':property_id' => $property_id,
        ':user_id' => $_SESSION['user_id']
    ]);

    if (!$stmt->fetch()) {
        throw new Exception('Propiedad no encontrada o sin acceso');
    }

    // Estadísticas básicas
    $stmt = $conn->prepare("
        SELECT 
            COALESCE(pvs.total_views, 0) as total_views,
            COALESCE(pvs.unique_views, 0) as unique_views,
            COALESCE(pvs.registered_views, 0) as registered_views,
            COALESCE(pvs.anonymous_views, 0) as anonymous_views,
            COALESCE(pts.total_score, 0) as quality_score,
            COUNT(pl.id) as total_leads
        FROM properties p
        LEFT JOIN property_view_stats pvs ON p.id = pvs.property_id
        LEFT JOIN v_property_total_scores pts ON p.id = pts.id
        LEFT JOIN property_leads pl ON p.id = pl.property_id
            AND pl.created_at BETWEEN :start_date AND :end_date
        WHERE p.id = :property_id
        GROUP BY p.id, pvs.total_views, pvs.unique_views, pvs.registered_views, 
                 pvs.anonymous_views, pts.total_score
    ");

    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    // Timeline de vistas (últimos días)
    $stmt = $conn->prepare("
        SELECT 
            DATE(viewed_at) as date,
            COUNT(*) as views
        FROM property_views
        WHERE property_id = :property_id
        AND viewed_at BETWEEN :start_date AND :end_date
        GROUP BY DATE(viewed_at)
        ORDER BY date ASC
    ");

    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    
    $timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Preparar la respuesta
    $response = [
        'views' => [
            'total' => (int)$stats['total_views'],
            'unique' => (int)$stats['unique_views'],
            'registered' => (int)$stats['registered_views'],
            'anonymous' => (int)$stats['anonymous_views']
        ],
        'leads' => [
            'total' => (int)$stats['total_leads'],
            'new' => 0,
            'contacted' => 0,
            'negotiating' => 0,
            'won' => 0
        ],
        'conversion' => [
            'rate' => $stats['total_views'] > 0 ? 
                round(($stats['total_leads'] / $stats['total_views']) * 100, 2) : 0
        ],
        'quality_score' => (int)$stats['quality_score'],
        'views_timeline' => $timeline,
        'comparative' => [
            'exposure_percentile' => 0,
            'days_on_market' => 0,
            'vs_area_avg' => 0
        ]
    ];

    echo json_encode([
        'status' => 'success',
        'data' => $response
    ]);

} catch (Exception $e) {
    error_log("Error en get_property_stats.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($db)) {
        $db->closeConnection();
    }
}