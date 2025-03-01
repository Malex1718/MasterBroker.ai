<?php
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

    // Verificar propiedad
    $stmt = $conn->prepare("
        SELECT p.*, pts.total_score, pts.score_icon
        FROM properties p
        LEFT JOIN v_property_total_scores pts ON p.id = pts.id
        WHERE p.id = :property_id AND p.user_id = :user_id
    ");
    
    $stmt->execute([
        ':property_id' => $property_id,
        ':user_id' => $_SESSION['user_id']
    ]);

    $propertyData = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$propertyData) {
        throw new Exception('Propiedad no encontrada o sin acceso');
    }

    // Determinar rangos de fechas
    $endDate = date('Y-m-d H:i:s');
    switch($timeRange) {
        case '30d':
            $startDate = date('Y-m-d H:i:s', strtotime('-30 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-60 days'));
            $previousEndDate = $startDate;
            break;
        case '90d':
            $startDate = date('Y-m-d H:i:s', strtotime('-90 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-180 days'));
            $previousEndDate = $startDate;
            break;
        default: // 7d
            $startDate = date('Y-m-d H:i:s', strtotime('-7 days'));
            $previousStartDate = date('Y-m-d H:i:s', strtotime('-14 days'));
            $previousEndDate = $startDate;
            break;
    }

    // 1. Estadísticas de vistas
    $viewQuery = "
        SELECT 
            COUNT(*) as total_views,
            COUNT(DISTINCT CASE 
                WHEN viewer_hash IS NOT NULL THEN viewer_hash
                WHEN viewer_id IS NOT NULL THEN CONCAT('user_', viewer_id)
                ELSE CONCAT('ip_', ip_address)
            END) as unique_views,
            SUM(CASE WHEN is_authenticated = 1 THEN 1 ELSE 0 END) as registered_views,
            SUM(CASE WHEN is_authenticated = 0 THEN 1 ELSE 0 END) as anonymous_views,
            AVG(NULLIF(view_duration, 0)) as avg_duration,
            COUNT(CASE WHEN view_duration < 10 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as bounce_rate
        FROM property_views
        WHERE property_id = :property_id
        AND viewed_at BETWEEN :start_date AND :end_date
    ";

    $stmt = $conn->prepare($viewQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    $viewStats = $stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Estadísticas previas de vistas
    $stmt = $conn->prepare($viewQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $previousStartDate,
        ':end_date' => $previousEndDate
    ]);
    $previousViewStats = $stmt->fetch(PDO::FETCH_ASSOC);

    // 3. Estadísticas de leads
    $leadQuery = "
        SELECT 
            COUNT(*) as total_leads,
            SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
            SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_leads,
            SUM(CASE WHEN status = 'negotiating' THEN 1 ELSE 0 END) as negotiating_leads,
            SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) as won_leads
        FROM property_leads
        WHERE property_id = :property_id
        AND created_at BETWEEN :start_date AND :end_date
    ";

    $stmt = $conn->prepare($leadQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    $leadStats = $stmt->fetch(PDO::FETCH_ASSOC);

    // 4. Estadísticas previas de leads
    $stmt = $conn->prepare($leadQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $previousStartDate,
        ':end_date' => $previousEndDate
    ]);
    $previousLeadStats = $stmt->fetch(PDO::FETCH_ASSOC);

    // 5. Timeline
    $timelineQuery = "
        SELECT 
            DATE(v.viewed_at) as date,
            COUNT(*) as total_views,
            COUNT(DISTINCT CASE 
                WHEN v.viewer_hash IS NOT NULL THEN v.viewer_hash
                WHEN v.viewer_id IS NOT NULL THEN CONCAT('user_', v.viewer_id)
                ELSE CONCAT('ip_', v.ip_address)
            END) as unique_views,
            COUNT(DISTINCT l.id) as leads
        FROM property_views v
        LEFT JOIN property_leads l ON l.property_id = v.property_id 
            AND DATE(l.created_at) = DATE(v.viewed_at)
        WHERE v.property_id = :property_id
        AND v.viewed_at BETWEEN :start_date AND :end_date
        GROUP BY DATE(v.viewed_at)
        ORDER BY date ASC
    ";

    $stmt = $conn->prepare($timelineQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    $timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. Estadísticas de dispositivos
    $deviceQuery = "
        SELECT 
            COALESCE(device_type, 'unknown') as device_type,
            COUNT(DISTINCT CASE 
                WHEN viewer_hash IS NOT NULL THEN viewer_hash
                WHEN viewer_id IS NOT NULL THEN CONCAT('user_', viewer_id)
                ELSE CONCAT('ip_', ip_address)
            END) as unique_count,
            COUNT(*) as total_count
        FROM property_views
        WHERE property_id = :property_id
        AND viewed_at BETWEEN :start_date AND :end_date
        GROUP BY device_type
    ";

    $stmt = $conn->prepare($deviceQuery);
    $stmt->execute([
        ':property_id' => $property_id,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);
    
    $deviceStats = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $deviceStats[$row['device_type']] = [
            'total' => (int)$row['total_count'],
            'unique' => (int)$row['unique_count']
        ];
    }

    // 7. Comparativa de mercado simplificada
    $marketQuery = "
        SELECT 
            p.id,
            p.price,
            p.created_at,
            DATEDIFF(CURRENT_TIMESTAMP, p.publication_date) as days_on_market,
            (
                SELECT COUNT(DISTINCT pv2.id)
                FROM property_views pv2
                WHERE pv2.property_id = p.id
            ) as views_count,
            (
                SELECT AVG(p2.price)
                FROM properties p2
                WHERE p2.property_type_id = p.property_type_id
                AND p2.city_id = p.city_id
                AND p2.status = 'published'
                AND p2.publication_date >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
            ) as market_avg_price,
            (
                SELECT AVG(pvs2.total_views)
                FROM properties p2
                LEFT JOIN property_view_stats pvs2 ON p2.id = pvs2.property_id
                WHERE p2.property_type_id = p.property_type_id
                AND p2.city_id = p.city_id
                AND p2.status = 'published'
                AND p2.publication_date >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
            ) as market_avg_views
        FROM properties p
        WHERE p.id = :property_id
    ";

    $stmt = $conn->prepare($marketQuery);
    $stmt->execute([':property_id' => $property_id]);
    $marketStats = $stmt->fetch(PDO::FETCH_ASSOC);

    // Calcular métricas de comparación
    $market_comparison = [
        'exposure_percentile' => 0,
        'vs_area_avg' => 0,
        'price_comparison' => 0,
        'days_on_market' => $marketStats['days_on_market'] ?? 0,
        'market_avg_price' => $marketStats['market_avg_price'] ?? 0
    ];

    if ($marketStats) {
        if ($marketStats['market_avg_views'] > 0) {
            $market_comparison['exposure_percentile'] = round(($marketStats['views_count'] / $marketStats['market_avg_views']) * 100);
            $market_comparison['vs_area_avg'] = round((($marketStats['views_count'] - $marketStats['market_avg_views']) / $marketStats['market_avg_views']) * 100, 1);
        }
        
        if ($marketStats['market_avg_price'] > 0) {
            $market_comparison['price_comparison'] = round((($marketStats['price'] - $marketStats['market_avg_price']) / $marketStats['market_avg_price']) * 100, 1);
        }
    }

    function generateRecommendations($stats) {
        $recommendations = [];
        
        // Recomendaciones basadas en precio
        if ($stats['market_comparison']['price_comparison'] > 10) {
            $recommendations[] = [
                'type' => 'price',
                'icon' => 'chart.png',
                'message' => 'El precio está significativamente por encima del mercado en la zona, considere ajustarlo para mejorar la competitividad'
            ];
        }
    
        // Recomendaciones basadas en vistas y engagement
        if ($stats['engagement']['bounce_rate'] > 60) {
            $recommendations[] = [
                'type' => 'content',
                'icon' => 'image.png',
                'message' => 'La tasa de rebote es alta. Agregar más fotos del interior podría aumentar el engagement'
            ];
        }
    
        // Recomendaciones basadas en días en el mercado
        if ($stats['market_comparison']['days_on_market'] > 45) {
            $recommendations[] = [
                'type' => 'visibility',
                'icon' => 'clock.png',
                'message' => 'Actualizar la descripción y fotos podría renovar el interés en la propiedad'
            ];
        }
    
        // Recomendaciones basadas en dispositivos
        $mobileViews = $stats['engagement']['devices']['mobile']['unique'];
        $totalViews = array_sum(array_map(function($device) {
            return $device['unique'];
        }, $stats['engagement']['devices']));
        
        if ($totalViews > 0 && ($mobileViews / $totalViews) > 0.6) {
            $recommendations[] = [
                'type' => 'mobile',
                'icon' => 'mobile.png',
                'message' => 'La mayoría de las visitas son desde móvil, asegúrese de que las fotos se vean bien en pantallas pequeñas'
            ];
        }
    
        // Recomendaciones basadas en horarios de visita
        if (isset($stats['peak_hours'])) {
            $recommendations[] = [
                'type' => 'timing',
                'icon' => 'clock.png',
                'message' => "La mayoría de las visitas ocurren entre {$stats['peak_hours']}, programe actualizaciones en estos horarios"
            ];
        }
    
        return $recommendations;
    }
    

    // Preparar respuesta
    $response = [
        'views' => [
            'total' => (int)$viewStats['total_views'],
            'unique' => (int)$viewStats['unique_views'],
            'registered' => (int)$viewStats['registered_views'],
            'anonymous' => (int)$viewStats['anonymous_views'],
            'previous_total' => (int)$previousViewStats['total_views'],
            'previous_unique' => (int)$previousViewStats['unique_views']
        ],
        'engagement' => [
            'average_duration' => round($viewStats['avg_duration'] ?? 0),
            'bounce_rate' => round($viewStats['bounce_rate'] ?? 0, 1),
            'devices' => [
                'mobile' => $deviceStats['mobile'] ?? ['total' => 0, 'unique' => 0],
                'desktop' => $deviceStats['desktop'] ?? ['total' => 0, 'unique' => 0],
                'tablet' => $deviceStats['tablet'] ?? ['total' => 0, 'unique' => 0]
            ],
            'previous_average_duration' => round($previousViewStats['avg_duration'] ?? 0),
            'previous_bounce_rate' => round($previousViewStats['bounce_rate'] ?? 0, 1)
        ],
        'recommendations' => [ 
            generateRecommendations($response)
        ],
        'leads' => [
            'total' => (int)$leadStats['total_leads'],
            'new' => (int)$leadStats['new_leads'],
            'contacted' => (int)$leadStats['contacted_leads'],
            'negotiating' => (int)$leadStats['negotiating_leads'],
            'won' => (int)$leadStats['won_leads'],
            'previous_total' => (int)$previousLeadStats['total_leads']
        ],
        'conversion' => [
            'rate' => $viewStats['unique_views'] > 0 ? 
                round(($leadStats['total_leads'] / $viewStats['unique_views']) * 100, 2) : 0,
            'previous_rate' => $previousViewStats['unique_views'] > 0 ?
                round(($previousLeadStats['total_leads'] / $previousViewStats['unique_views']) * 100, 2) : 0
        ],
        'timeline' => array_map(function($day) {
            return [
                'date' => date('d/m', strtotime($day['date'])),
                'total_views' => (int)$day['total_views'],
                'unique_views' => (int)$day['unique_views'],
                'leads' => (int)$day['leads']
            ];
        }, $timeline),
        'market_comparison' => $market_comparison,
        'quality_score' => (int)$propertyData['total_score'],
        'score_icon' => $propertyData['score_icon']
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