<?php
// get_property_limits.php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'error' => 'Usuario no autenticado',
        'total_properties' => 0,
        'limit' => 0,
        'remaining' => 0
    ]);
    exit;
}

$userId = $_SESSION['user_id'];

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
    
    // Si es admin o developer, tiene límite ilimitado
    if ($roleData && ($roleData['role_code'] === 'admin' || $roleData['role_code'] === 'dev')) {
        echo json_encode([
            'total_properties' => (int)$db->query("SELECT COUNT(*) FROM properties WHERE user_id = $userId AND status != 'archived'")->fetchColumn(),
            'limit' => "∞",
            'remaining' => "∞"
        ]);
        exit;
    }
    
    // Obtener el número de propiedades del usuario
    $propQuery = "SELECT COUNT(*) as total_properties FROM properties 
                 WHERE user_id = :user_id AND status != 'archived'";
    $propStmt = $db->prepare($propQuery);
    $propStmt->bindParam(':user_id', $userId);
    $propStmt->execute();
    $propCount = $propStmt->fetch(PDO::FETCH_ASSOC);
    $totalProperties = $propCount['total_properties'];
    
    // Obtener el límite de propiedades según su plan
    $limitQuery = "SELECT sp.properties_limit 
                  FROM subscriptions s
                  JOIN subscription_plans sp ON s.plan_type = sp.plan_type AND s.billing_cycle = sp.billing_cycle
                  WHERE s.user_id = :user_id AND s.status = 'active'
                  ORDER BY sp.properties_limit DESC
                  LIMIT 1";
    $limitStmt = $db->prepare($limitQuery);
    $limitStmt->bindParam(':user_id', $userId);
    $limitStmt->execute();
    
    // Si no tiene suscripción activa, el límite es 0
    $propertyLimit = 0;
    
    if ($limitStmt->rowCount() > 0) {
        $limitData = $limitStmt->fetch(PDO::FETCH_ASSOC);
        $propertyLimit = $limitData['properties_limit'];
        
        // Si el valor es -1, significa ilimitado
        if ($propertyLimit == -1) {
            $propertyLimit = "∞"; // Símbolo de infinito
            $remaining = "∞";
        } else {
            $remaining = max(0, $propertyLimit - $totalProperties);
        }
    } else {
        $remaining = 0;
    }
    
    echo json_encode([
        'total_properties' => $totalProperties,
        'limit' => $propertyLimit,
        'remaining' => $remaining
    ]);
    
} catch (Exception $e) {
    error_log("Error al obtener límites de propiedades: " . $e->getMessage());
    echo json_encode([
        'error' => 'Error al obtener información de límites',
        'total_properties' => 0,
        'limit' => 0,
        'remaining' => 0
    ]);
}
?>