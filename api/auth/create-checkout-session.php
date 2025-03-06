<?php
// Primero, captura todos los errores en un buffer
ob_start();

// Activa el reporte de errores
ini_set('display_errors', 0); // No mostrar errores en la salida
ini_set('log_errors', 1);     // Registrar errores en el log
error_reporting(E_ALL);       // Reportar todos los tipos de error

// Resto de headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Función para terminar limpiamente
function terminateWithError($message, $statusCode = 500) {
    ob_end_clean(); // Limpia cualquier salida previa
    http_response_code($statusCode);
    echo json_encode(["success" => false, "error" => $message]);
    exit();
}

try {
    // Cargar autoloader
    if (!file_exists('../../vendor/autoload.php')) {
        terminateWithError("autoload.php no encontrado");
    }
    require_once '../../vendor/autoload.php';

    // Cargar dependencias
    if (!file_exists('../config/database.php')) {
        terminateWithError("database.php no encontrado");
    }
    require_once '../config/database.php';
    
    if (!file_exists('../config/stripe.php')) {
        terminateWithError("stripe.php no encontrado");
    }
    $stripeConfig = require_once '../config/stripe.php';

    // Verificar método de solicitud
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        terminateWithError("Método no permitido", 405);
    }

    // Verificar sesión
    session_start();
    if (!isset($_SESSION['user_id'])) {
        terminateWithError("Debes iniciar sesión para continuar", 401);
    }

    // Inicializar Stripe
    \Stripe\Stripe::setApiKey($stripeConfig['secret_key']);
    
    // Obtener ID de usuario de la sesión
    $userId = $_SESSION['user_id'];
    
    // Obtener datos del cuerpo de la solicitud
    $rawInput = file_get_contents("php://input");
    if (empty($rawInput)) {
        terminateWithError("No se recibieron datos");
    }
    
    $data = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        terminateWithError("Error al decodificar JSON: " . json_last_error_msg());
    }
    
    // Verificar datos requeridos
    if (!isset($data['plan_id']) || !isset($data['price_id'])) {
        terminateWithError("Datos incompletos: " . json_encode($data));
    }
    
    $planId = $data['plan_id'];
    $priceId = $data['price_id'];
    
    // Log debugging info
    error_log("Received plan_id: $planId, price_id: $priceId");
    
    // Conexión a la base de datos
    try {
        $database = new Database();
        $pdo = $database->getConnection();
    } catch (Exception $e) {
        terminateWithError("Error de conexión a la base de datos: " . $e->getMessage());
    }
    
    // Verificar si el usuario ya tiene una suscripción
    try {
        $stmt = $pdo->prepare("SELECT * FROM subscriptions WHERE user_id = ?");
        $stmt->execute([$userId]);
        $existingSubscription = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        terminateWithError("Error al consultar suscripciones: " . $e->getMessage());
    }
    
    // Obtener datos del usuario
    try {
        $stmt = $pdo->prepare("SELECT email, first_name, last_name FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            terminateWithError("Usuario no encontrado");
        }
    } catch (Exception $e) {
        terminateWithError("Error al consultar usuario: " . $e->getMessage());
    }
    
    // Determinar propiedades del plan
    $planType = ($planId == '1' || $planId == '3') ? 'basic' : 'professional';
    $billingCycle = ($planId == '1' || $planId == '2') ? 'monthly' : 'annual';
    
    // Parámetros para crear la sesión de checkout
    $params = [
        'payment_method_types' => ['card'],
        'line_items' => [[
            'price' => $priceId,
            'quantity' => 1,
        ]],
        'mode' => 'subscription',
        'success_url' => $stripeConfig['success_url'] . '?session_id={CHECKOUT_SESSION_ID}',
        'cancel_url' => $stripeConfig['cancel_url'],
        'client_reference_id' => (string)$userId,
        'metadata' => [
            'user_id' => (string)$userId,
            'plan_type' => $planType,
            'billing_cycle' => $billingCycle
        ]
    ];
    
    // Si el usuario ya tiene una suscripción, usar su customer_id
    if ($existingSubscription && !empty($existingSubscription['stripe_customer_id'])) {
        $params['customer'] = $existingSubscription['stripe_customer_id'];
    } else {
        // Si no tiene, crear un nuevo cliente con los datos del usuario
        $params['customer_email'] = $user['email'];
    }
    
    // Crear sesión de checkout
    try {
        $session = \Stripe\Checkout\Session::create($params);
    } catch (\Stripe\Exception\ApiErrorException $e) {
        terminateWithError("Error de Stripe: " . $e->getMessage(), 400);
    }
    
    // Limpiar buffer y enviar respuesta exitosa
    ob_end_clean();
    echo json_encode([
        "success" => true,
        "sessionId" => $session->id
    ]);
    
} catch (\Stripe\Exception\ApiErrorException $e) {
    terminateWithError("Error de Stripe: " . $e->getMessage(), 400);
} catch (Exception $e) {
    error_log("Error en create-checkout-session.php: " . $e->getMessage());
    terminateWithError($e->getMessage());
}
?>