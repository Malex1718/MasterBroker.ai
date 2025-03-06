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
        ? ($_ENV['STRIPE_TEST_PUBLISHABLE_KEY']) 
        : ($_ENV['STRIPE_LIVE_PUBLISHABLE_KEY']),
    
    'secret_key' => $isTestMode 
        ? ($_ENV['STRIPE_TEST_SECRET_KEY'])
        : ($_ENV['STRIPE_LIVE_SECRET_KEY']),
    
    'webhook_secret' => $isTestMode
        ? ($_ENV['STRIPE_TEST_WEBHOOK_SECRET'])
        : ($_ENV['STRIPE_LIVE_WEBHOOK_SECRET']),
    
    'success_url' => $_ENV['STRIPE_SUCCESS_URL'],
    'cancel_url' => $_ENV['STRIPE_CANCEL_URL'],
    
    'is_test_mode' => $isTestMode
];