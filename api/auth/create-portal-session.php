<?php
header('Content-Type: application/json');

// Incluir dependencias
require_once '../config/database.php';
$stripeConfig = require_once '../config/stripe.php';
require_once '../../vendor/autoload.php';

// Inicializar Stripe
\Stripe\Stripe::setApiKey($stripeConfig['secret_key']);

// Verificar sesión
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Debes iniciar sesión para continuar']);
    exit();
}

try {
    $userId = $_SESSION['user_id'];
    
    // Crear conexión a la base de datos usando la clase Database
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Buscar el ID de cliente de Stripe para este usuario
    $stmt = $pdo->prepare("SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?");
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$subscription || empty($subscription['stripe_customer_id'])) {
        http_response_code(404);
        echo json_encode(['error' => 'No tienes una suscripción activa']);
        exit();
    }
    
    // Crear sesión del portal
    $session = \Stripe\BillingPortal\Session::create([
        'customer' => $subscription['stripe_customer_id'],
        'return_url' => 'https://masterbroker.ai/dashboard/configuracion/suscripcion',
    ]);
    
    echo json_encode(['url' => $session->url]);
    
} catch (Exception $e) {
    error_log("Error en create-portal-session.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>