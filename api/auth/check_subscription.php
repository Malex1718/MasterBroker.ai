<?php
// check_subscription.php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

// Verificar si el usuario está autenticado
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'error' => 'Usuario no autenticado', 
        'has_subscription' => false,
        'user_id' => null,
        'redirect' => '/inicio_sesion.html'
    ]);
    exit;
}

$userId = $_SESSION['user_id'];

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Consultar si el usuario tiene una suscripción activa
    $query = "SELECT COUNT(*) as subscription_count 
              FROM subscriptions 
              WHERE user_id = :user_id 
              AND status IN ('active', 'trialing')";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $hasSubscription = ($row['subscription_count'] > 0);
    
    // Agregar información de usuario para personalizar mensaje
    $userQuery = "SELECT first_name, last_name FROM users WHERE id = :user_id";
    $userStmt = $db->prepare($userQuery);
    $userStmt->bindParam(':user_id', $userId);
    $userStmt->execute();
    $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$hasSubscription) {
        // Si no tiene suscripción, enviar URL y datos para bloqueo agresivo
        echo json_encode([
            'has_subscription' => false,
            'user_id' => $userId,
            'user_name' => $userData['first_name'] ?? '',
            'redirect' => '/planes.html'
        ]);
    } else {
        echo json_encode([
            'has_subscription' => true,
            'user_id' => $userId,
            'user_name' => $userData['first_name'] ?? ''
        ]);
    }
    
} catch (Exception $e) {
    error_log("Error al verificar suscripción: " . $e->getMessage());
    echo json_encode([
        'error' => 'Error al verificar el estado de la suscripción', 
        'has_subscription' => false,
        'user_id' => $userId
    ]);
}
?>