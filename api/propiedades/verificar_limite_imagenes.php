<?php
// api/propiedades/verificar_limite_imagenes.php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => false,
        'error' => 'Usuario no autenticado',
        'limite' => 0
    ]);
    exit;
}

$userId = $_SESSION['user_id'];
$propertyId = isset($_GET['id']) ? intval($_GET['id']) : 0;

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Verificar si el usuario es admin o desarrollador
    $roleQuery = "SELECT ur.code as role_code 
                  FROM users u 
                  JOIN user_roles ur ON u.role_id = ur.id 
                  WHERE u.id = :user_id";
    $roleStmt = $db->prepare($roleQuery);
    $roleStmt->bindParam(':user_id', $userId);
    $roleStmt->execute();
    $roleData = $roleStmt->fetch(PDO::FETCH_ASSOC);
    
    // Si es admin o developer, tiene límite alto
    if ($roleData && ($roleData['role_code'] === 'admin' || $roleData['role_code'] === 'dev')) {
        echo json_encode([
            'success' => true,
            'limite' => 50,
            'plan' => 'admin',
            'es_admin' => true
        ]);
        exit;
    }
    
    // Obtener el plan de suscripción del usuario
    $planQuery = "SELECT s.plan_type, s.billing_cycle 
                  FROM subscriptions s
                  WHERE s.user_id = :user_id 
                  AND s.status IN ('active', 'trialing')
                  ORDER BY s.id DESC LIMIT 1";
    $planStmt = $db->prepare($planQuery);
    $planStmt->bindParam(':user_id', $userId);
    $planStmt->execute();
    
    // Si no tiene suscripción activa
    if ($planStmt->rowCount() === 0) {
        echo json_encode([
            'success' => false,
            'error' => 'No hay suscripción activa',
            'limite' => 0
        ]);
        exit;
    }
    
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    
    // Obtener límite de imágenes según el plan
    $limiteQuery = "SELECT sfl.feature_limit 
                   FROM subscription_feature_limits sfl
                   WHERE sfl.plan_type = :plan_type
                   AND sfl.billing_cycle = :billing_cycle
                   AND sfl.feature_name = 'images_per_property'
                   AND sfl.is_active = 1";
    $limiteStmt = $db->prepare($limiteQuery);
    $limiteStmt->bindParam(':plan_type', $plan['plan_type']);
    $limiteStmt->bindParam(':billing_cycle', $plan['billing_cycle']);
    $limiteStmt->execute();
    
    // Si no hay límite definido, usar valores predeterminados según el plan
    $limite = 10; // Valor predeterminado para plan básico
    
    if ($limiteStmt->rowCount() > 0) {
        $limiteData = $limiteStmt->fetch(PDO::FETCH_ASSOC);
        $limite = $limiteData['feature_limit'];
    } else {
        // Asignar límites predeterminados si no hay configuración específica
        switch ($plan['plan_type']) {
            case 'premium':
                $limite = $plan['billing_cycle'] === 'annual' ? 35 : 30;
                break;
            case 'professional':
                $limite = $plan['billing_cycle'] === 'annual' ? 25 : 20;
                break;
            default: // basic
                $limite = $plan['billing_cycle'] === 'annual' ? 15 : 10;
        }
    }
    
    echo json_encode([
        'success' => true,
        'limite' => $limite,
        'plan' => $plan['plan_type'],
        'ciclo' => $plan['billing_cycle']
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Error al verificar límite de imágenes: ' . $e->getMessage(),
        'limite' => 0
    ]);
}
?>