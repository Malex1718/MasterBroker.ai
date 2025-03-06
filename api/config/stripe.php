<?php
require_once '../../vendor/autoload.php';

// Cargar variables de entorno
try {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
    $dotenv->load();
} catch (Exception $e) {
    // Silenciar error si no se puede cargar .env
    error_log("Error cargando .env: " . $e->getMessage());
}

// Determinar si estamos en modo de prueba o producción
$isTestMode = ($_ENV['APP_ENV'] ?? 'test') === 'test';

// Configuración de Stripe
return [
    'publishable_key' => $isTestMode 
        ? ($_ENV['STRIPE_TEST_PUBLISHABLE_KEY'] ?? 'pk_test_51QwoDVCorMZEmsUnDz1rVqPRdpgHEM7bVLufMNzm8vg1ErwvzqN9VI0QtxB56ICHRuHpjNDGxCqqu0cwUtf4N2PH00Hj24DDNR') 
        : ($_ENV['STRIPE_LIVE_PUBLISHABLE_KEY'] ?? 'pk_live_51QwoDVCorMZEmsUnbvQBXt33HBIJJwD2hMOuVOk10fZrndb81XAacHdspzGOI6W36NULeH1PQgq9ffAQHCqXeObc00B4BQTbLU'),
    
    'secret_key' => $isTestMode 
        ? ($_ENV['STRIPE_TEST_SECRET_KEY'] ?? 'sk_test_51QwoDVCorMZEmsUnhxv2TG58DNVNZFNjQvJ6P9ZpwH3mgna3a719Tt2xzEqR7HS08PLjulXWYATgla5Qryw4wlqb00WN4hi5W2')
        : ($_ENV['STRIPE_LIVE_SECRET_KEY'] ?? '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'),
    
    'webhook_secret' => $isTestMode
        ? ($_ENV['STRIPE_TEST_WEBHOOK_SECRET'] ?? 'whsec_1518ZEZYWnIgRcVKIA4knuAtBmSOT8jd')
        : ($_ENV['STRIPE_LIVE_WEBHOOK_SECRET'] ?? 'whsec_TuClaveDeWebhookDeProduccion'),
    
    'success_url' => $_ENV['STRIPE_SUCCESS_URL'] ?? 'https://masterbroker.ai/dashboard/configuracion/subscripcion/success',
    'cancel_url' => $_ENV['STRIPE_CANCEL_URL'] ?? 'https://masterbroker.ai/dashboard/configuracion/subscripcion/cancel',
    
    'is_test_mode' => $isTestMode
];