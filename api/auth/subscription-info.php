<?php
// api/auth/subscription-info.php
header("Content-Type: application/json; charset=UTF-8");

// Activar reporte de errores para depuración
ini_set('display_errors', 0); // No mostrar errores en la salida
ini_set('log_errors', 1);     // Registrar errores en el log
error_reporting(E_ALL);       // Reportar todos los tipos de error

// Incluir dependencias
require_once '../config/database.php';
$stripeConfig = require_once '../config/stripe.php';
require_once '../../vendor/autoload.php';

// Verificar sesión
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'No autorizado. Por favor, inicia sesión.'
    ]);
    exit();
}

try {
    // Inicializar Stripe
    \Stripe\Stripe::setApiKey($stripeConfig['secret_key']);
    
    // Obtener ID de usuario de la sesión
    $userId = $_SESSION['user_id'];
    
    // Conexión a la base de datos usando la clase Database
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Verificar si la tabla subscriptions existe
    try {
        $stmt = $pdo->prepare("SHOW TABLES LIKE 'subscriptions'");
        $stmt->execute();
        $tableExists = $stmt->rowCount() > 0;
        
        if (!$tableExists) {
            // Crear la tabla si no existe
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `subscriptions` (
                  `id` int(11) NOT NULL AUTO_INCREMENT,
                  `user_id` int(11) NOT NULL,
                  `stripe_subscription_id` varchar(255) DEFAULT NULL,
                  `stripe_customer_id` varchar(255) DEFAULT NULL,
                  `plan_type` enum('basic','professional','premium') DEFAULT NULL,
                  `billing_cycle` enum('monthly','annual') DEFAULT NULL,
                  `status` varchar(50) DEFAULT NULL,
                  `current_period_start` timestamp NULL DEFAULT NULL,
                  `current_period_end` timestamp NULL DEFAULT NULL,
                  `started_at` timestamp NULL DEFAULT current_timestamp(),
                  `cancelled_at` timestamp NULL DEFAULT NULL,
                  `created_at` timestamp NULL DEFAULT current_timestamp(),
                  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `user_id` (`user_id`),
                  KEY `stripe_subscription_id` (`stripe_subscription_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        }
        
        // Verificar si la tabla subscription_invoices existe
        $stmt = $pdo->prepare("SHOW TABLES LIKE 'subscription_invoices'");
        $stmt->execute();
        $tableExists = $stmt->rowCount() > 0;
        
        if (!$tableExists) {
            // Crear la tabla si no existe
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `subscription_invoices` (
                  `id` int(11) NOT NULL AUTO_INCREMENT,
                  `subscription_id` int(11) NOT NULL,
                  `user_id` int(11) NOT NULL,
                  `stripe_invoice_id` varchar(255) NOT NULL,
                  `stripe_charge_id` varchar(255) DEFAULT NULL,
                  `amount` decimal(10,2) NOT NULL,
                  `currency` varchar(3) NOT NULL,
                  `status` varchar(50) NOT NULL,
                  `period_start` timestamp NULL DEFAULT NULL,
                  `period_end` timestamp NULL DEFAULT NULL,
                  `paid_at` timestamp NULL DEFAULT NULL,
                  `invoice_url` varchar(255) DEFAULT NULL,
                  `created_at` timestamp NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `stripe_invoice_id` (`stripe_invoice_id`),
                  KEY `user_id` (`user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        }
    } catch (Exception $e) {
        error_log("Error al verificar o crear tablas: " . $e->getMessage());
    }
    
    // Buscar información de suscripción del usuario
    $stmt = $pdo->prepare("
        SELECT * FROM subscriptions 
        WHERE user_id = ?
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Obtener facturas si hay una suscripción
    $invoices = [];
    if ($subscription) {
        $stmt = $pdo->prepare("
            SELECT * FROM subscription_invoices
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ");
        $stmt->execute([$userId]);
        $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Opcionalmente, obtener detalles actualizados de Stripe
        if ($subscription['stripe_subscription_id']) {
            try {
                $stripeSubscription = \Stripe\Subscription::retrieve($subscription['stripe_subscription_id']);
                
                // Actualizar estado si ha cambiado
                if ($stripeSubscription->status !== $subscription['status']) {
                    $stmt = $pdo->prepare("
                        UPDATE subscriptions 
                        SET status = ?, updated_at = NOW()
                        WHERE id = ?
                    ");
                    $stmt->execute([$stripeSubscription->status, $subscription['id']]);
                    $subscription['status'] = $stripeSubscription->status;
                }
            } catch (\Exception $e) {
                // Si hay un error con Stripe, usar datos locales
                error_log('Error al obtener suscripción de Stripe: ' . $e->getMessage());
            }
        }
    }
    
    // Preparar respuesta
    $response = [
        'success' => true,
        'is_test_mode' => $stripeConfig['is_test_mode'],
        'subscription' => $subscription,
        'invoices' => $invoices
    ];
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Error en subscription-info.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>