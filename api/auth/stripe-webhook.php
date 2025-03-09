<?php
// api/auth/stripe-webhook.php
// Tomar el payload raw antes de que PHP lo procese
$payload = @file_get_contents('php://input');

// Incluir dependencias
require_once '../config/database.php';
$stripeConfig = require_once '../config/stripe.php';
require_once '../../vendor/autoload.php';

// Inicializar Stripe
\Stripe\Stripe::setApiKey($stripeConfig['secret_key']);

// Verificar la firma del webhook
$sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

try {
    $event = \Stripe\Webhook::constructEvent(
        $payload, 
        $sig_header, 
        $stripeConfig['webhook_secret']
    );
    
    // Conexión a la base de datos
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Verificar que existan las tablas necesarias
    createTablesIfNotExist($pdo);
    
    // Guardar el evento en la base de datos para referencia
    saveEvent($event, $pdo);
    
    // Procesar según el tipo de evento
    switch ($event->type) {
        case 'checkout.session.completed':
            handleCheckoutCompleted($event->data->object, $pdo);
            break;
            
        case 'customer.subscription.created':
            handleNewSubscription($event->data->object, $pdo);
            break;
            
        case 'customer.subscription.updated':
            handleSubscriptionUpdate($event->data->object, $pdo);
            break;
            
        case 'customer.subscription.deleted':
            handleSubscriptionCancellation($event->data->object, $pdo);
            break;
            
        case 'invoice.payment_succeeded':
            handleInvoicePayment($event->data->object, $pdo);
            break;
            
        case 'invoice.payment_failed':
            handleInvoiceFailure($event->data->object, $pdo);
            break;
    }
    
    // Respuesta exitosa
    http_response_code(200);
    echo json_encode(['status' => 'success']);
    
} catch (\UnexpectedValueException $e) {
    // Payload inválido
    http_response_code(400);
    echo json_encode(['error' => 'Payload inválido']);
    exit();
} catch (\Stripe\Exception\SignatureVerificationException $e) {
    // Firma inválida
    http_response_code(400);
    echo json_encode(['error' => 'Firma inválida']);
    exit();
} catch (Exception $e) {
    // Error general
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit();
}

function webhook_log($message) {
    error_log($message);
}

// Función para crear las tablas si no existen
function createTablesIfNotExist($pdo) {
    // Tabla de eventos de Stripe
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `stripe_events` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `stripe_event_id` varchar(255) NOT NULL,
            `event_type` varchar(100) NOT NULL,
            `event_data` LONGTEXT NOT NULL,
            `processed` tinyint(1) DEFAULT 0,
            `created_at` timestamp NULL DEFAULT current_timestamp(),
            PRIMARY KEY (`id`),
            UNIQUE KEY `stripe_event_id` (`stripe_event_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    
    // Tabla de suscripciones
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `subscriptions` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `user_id` int(11) NOT NULL,
            `stripe_subscription_id` varchar(255) NOT NULL,
            `stripe_customer_id` varchar(255) NOT NULL,
            `plan_type` enum('basic','professional','premium') NOT NULL,
            `billing_cycle` enum('monthly','annual') NOT NULL,
            `status` varchar(50) NOT NULL,
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
    
    // Tabla de facturas
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
            UNIQUE KEY `stripe_invoice_id` (`stripe_invoice_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    
    // Tabla de cambios de suscripción
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `subscription_changes` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `user_id` int(11) NOT NULL,
            `old_plan_type` varchar(50) NOT NULL,
            `new_plan_type` varchar(50) NOT NULL,
            `old_billing_cycle` varchar(50) NOT NULL,
            `new_billing_cycle` varchar(50) NOT NULL,
            `changed_at` timestamp NULL DEFAULT current_timestamp(),
            PRIMARY KEY (`id`),
            KEY `user_id` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
}

// Función para guardar el evento
function saveEvent($event, $pdo) {
    $stmt = $pdo->prepare("
        INSERT INTO stripe_events 
        (stripe_event_id, event_type, event_data) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        event_type = VALUES(event_type),
        event_data = VALUES(event_data)
    ");
    
    $stmt->execute([
        $event->id,
        $event->type,
        json_encode($event)
    ]);
}

// Función para manejar el evento checkout.session.completed
function handleCheckoutCompleted($session, $pdo) {
    // Verificar si tenemos la información necesaria
    if (!isset($session->subscription) || !isset($session->client_reference_id) || !isset($session->customer)) {
        error_log("Información incompleta en checkout.session.completed");
        return;
    }
    
    $subscriptionId = $session->subscription;
    $userId = $session->client_reference_id;
    $customerId = $session->customer;
    
    try {
        // Obtener detalles completos de la suscripción
        $subscription = \Stripe\Subscription::retrieve($subscriptionId);
        
        // Determinar el tipo de plan y ciclo
        $planType = 'basic'; // Valor predeterminado
        $billingCycle = 'monthly'; // Valor predeterminado
        
        // Intentar obtener el tipo de plan desde los metadatos
        if (isset($session->metadata->plan_type)) {
            $planType = $session->metadata->plan_type;
        }
        
        // Intentar obtener el ciclo de facturación desde los metadatos
        if (isset($session->metadata->billing_cycle)) {
            $billingCycle = $session->metadata->billing_cycle;
        }
        
        // Si no hay metadatos, intentar determinarlo por el precio
        if (!isset($session->metadata->plan_type) || !isset($session->metadata->billing_cycle)) {
            $priceId = $subscription->items->data[0]->price->id;
            $planType = determinePlanType($priceId);
            $billingCycle = determineBillingCycle($priceId);
        }
        
        // Guardar o actualizar la suscripción
        $stmt = $pdo->prepare("
            INSERT INTO subscriptions 
            (user_id, stripe_subscription_id, stripe_customer_id, plan_type, 
             billing_cycle, status, current_period_start, current_period_end) 
            VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
            ON DUPLICATE KEY UPDATE 
            stripe_customer_id = VALUES(stripe_customer_id),
            stripe_subscription_id = VALUES(stripe_subscription_id),
            plan_type = VALUES(plan_type),
            billing_cycle = VALUES(billing_cycle),
            status = VALUES(status),
            current_period_start = VALUES(current_period_start),
            current_period_end = VALUES(current_period_end)
        ");
        
        $stmt->execute([
            $userId, 
            $subscriptionId,
            $customerId,
            $planType,
            $billingCycle,
            $subscription->status,
            $subscription->current_period_start,
            $subscription->current_period_end
        ]);
        
        // Actualizar límites del usuario según el plan
        updateUserLimits($userId, $planType, $pdo);
        
    } catch (Exception $e) {
        error_log('Error al procesar checkout.session.completed: ' . $e->getMessage());
    }
}

// Función para manejar una nueva suscripción
function handleNewSubscription($subscription, $pdo) {
    try {
        // Intentamos encontrar el user_id a través de los metadatos o buscando en otras tablas
        $userId = null;
        
        // Primero, intentar encontrar en metadatos
        if (isset($subscription->metadata->user_id)) {
            $userId = $subscription->metadata->user_id;
        }
        
        // Si no está en los metadatos, buscar por customer_id en suscripciones existentes
        if (!$userId) {
            $stmt = $pdo->prepare("
                SELECT user_id FROM subscriptions 
                WHERE stripe_customer_id = ? 
                LIMIT 1
            ");
            $stmt->execute([$subscription->customer]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                $userId = $result['user_id'];
            }
        }
        
        // Si aún no lo encontramos, buscar en la tabla de usuarios
        if (!$userId) {
            $stmt = $pdo->prepare("
                SELECT id FROM users 
                WHERE stripe_customer_id = ? 
                LIMIT 1
            ");
            $stmt->execute([$subscription->customer]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                $userId = $result['id'];
            }
        }
        
        if (!$userId) {
            error_log("No se pudo determinar el user_id para la suscripción: " . $subscription->id);
            return;
        }
        
        // Determinar el tipo de plan y ciclo
        $priceId = $subscription->items->data[0]->price->id;
        $planType = determinePlanType($priceId);
        $billingCycle = determineBillingCycle($priceId);
        
        // Insertar o actualizar la suscripción
        $stmt = $pdo->prepare("
            INSERT INTO subscriptions 
            (user_id, stripe_subscription_id, stripe_customer_id, plan_type, 
             billing_cycle, status, current_period_start, current_period_end) 
            VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
            ON DUPLICATE KEY UPDATE 
            stripe_customer_id = VALUES(stripe_customer_id),
            stripe_subscription_id = VALUES(stripe_subscription_id),
            plan_type = VALUES(plan_type),
            billing_cycle = VALUES(billing_cycle),
            status = VALUES(status),
            current_period_start = VALUES(current_period_start),
            current_period_end = VALUES(current_period_end)
        ");
        
        $stmt->execute([
            $userId, 
            $subscription->id,
            $subscription->customer,
            $planType,
            $billingCycle,
            $subscription->status,
            $subscription->current_period_start,
            $subscription->current_period_end
        ]);
        
        // Actualizar límites del usuario según el plan
        updateUserLimits($userId, $planType, $pdo);
        
    } catch (Exception $e) {
        error_log('Error al procesar nueva suscripción: ' . $e->getMessage());
    }
}

// Función para manejar la cancelación de suscripciones
function handleSubscriptionCancellation($subscription, $pdo) {
    try {
        // Buscar la suscripción en nuestra base de datos
        $stmt = $pdo->prepare("
            SELECT * FROM subscriptions 
            WHERE stripe_subscription_id = ?
        ");
        $stmt->execute([$subscription->id]);
        $localSub = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$localSub) {
            error_log("No se encontró la suscripción local para cancelar: " . $subscription->id);
            return;
        }
        
        // Actualizar el estado de la suscripción y registrar la fecha de cancelación
        $stmt = $pdo->prepare("
            UPDATE subscriptions 
            SET status = ?,
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        ");
        
        $stmt->execute([
            $subscription->status, // Normalmente 'canceled'
            $localSub['id']
        ]);
        
        // Opcionalmente, si quieres volver al plan gratuito o actualizar algún otro límite
        // cuando la suscripción es cancelada, puedes hacerlo aquí
        updateUserLimits($localSub['user_id'], 'free', $pdo);
        
    } catch (Exception $e) {
        error_log('Error al procesar cancelación de suscripción: ' . $e->getMessage());
    }
}

// Función para manejar actualizaciones de suscripción
function handleSubscriptionUpdate($subscription, $pdo) {
    try {
        // Obtener el ID de precio directamente
        $priceId = $subscription->items->data[0]->price->id;
        
        // Encontrar la suscripción en la base de datos
        $stmt = $pdo->prepare("SELECT * FROM subscriptions WHERE stripe_subscription_id = ?");
        $stmt->execute([$subscription->id]);
        $localSub = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$localSub) {
            return;
        }
        
        // Mapeo directo de planes
        $planMap = [
            'price_1QzVfYCorMZEmsUnOLzbG1IF' => 'basic',        // básico mensual
            'price_1QzWEtCorMZEmsUncToobQdL' => 'professional', // profesional mensual
            'price_1QzWbuCorMZEmsUnDY7sg1zN' => 'basic',        // básico anual
            'price_1QzWedCorMZEmsUn4TmudeJi' => 'professional'  // profesional anual
        ];
        
        // Determinar tipo de plan directamente
        if (isset($planMap[$priceId])) {
            $newPlanType = $planMap[$priceId];
        } else {
            $newPlanType = 'basic'; // default
        }
        
        // Determinar ciclo de facturación
        $billingCycle = $subscription->items->data[0]->plan->interval == 'year' ? 'annual' : 'monthly';
        
        // Actualizar la base de datos directamente con los valores determinados
        $stmt = $pdo->prepare("
            UPDATE subscriptions 
            SET status = ?,
                plan_type = ?,
                billing_cycle = ?,
                current_period_start = FROM_UNIXTIME(?),
                current_period_end = FROM_UNIXTIME(?),
                updated_at = NOW()
            WHERE id = ?
        ");
        
        $stmt->execute([
            $subscription->status,
            $newPlanType,
            $billingCycle,
            $subscription->current_period_start,
            $subscription->current_period_end,
            $localSub['id']
        ]);
        
        // Actualizar límites del usuario
        updateUserLimits($localSub['user_id'], $newPlanType, $pdo);
        
    } catch (Exception $e) {
        error_log('Error al procesar actualización de suscripción: ' . $e->getMessage());
    }
}

// Función para manejar pagos de facturas
function handleInvoicePayment($invoice, $pdo) {
    if (!isset($invoice->subscription)) {
        return; // No es una factura de suscripción
    }
    
    try {
        // Buscar la suscripción en nuestra base de datos
        $stmt = $pdo->prepare("
            SELECT * FROM subscriptions 
            WHERE stripe_subscription_id = ?
        ");
        $stmt->execute([$invoice->subscription]);
        $localSub = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$localSub) {
            error_log("No se encontró la suscripción local para la factura: " . $invoice->subscription);
            return;
        }
        
        // Registrar la factura
        $stmt = $pdo->prepare("
            INSERT INTO subscription_invoices
            (subscription_id, user_id, stripe_invoice_id, stripe_charge_id,
             amount, currency, status, period_start, period_end, paid_at, invoice_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?)
            ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            paid_at = VALUES(paid_at),
            stripe_charge_id = VALUES(stripe_charge_id)
        ");
        
        $amount = $invoice->amount_paid / 100; // Convertir de centavos a unidades
        $paidAt = $invoice->status === 'paid' ? date('Y-m-d H:i:s') : null;
        
        $stmt->execute([
            $localSub['id'],
            $localSub['user_id'],
            $invoice->id,
            $invoice->charge ?? null,
            $amount,
            strtoupper($invoice->currency),
            $invoice->status,
            $invoice->period_start,
            $invoice->period_end,
            $paidAt,
            $invoice->hosted_invoice_url ?? null
        ]);
        
    } catch (Exception $e) {
        error_log('Error al procesar pago de factura: ' . $e->getMessage());
    }
}

// Función para manejar fallos de facturas
function handleInvoiceFailure($invoice, $pdo) {
    if (!isset($invoice->subscription)) {
        return; // No es una factura de suscripción
    }
    
    try {
        // Actualizar el estado de la factura a fallido
        handleInvoicePayment($invoice, $pdo);
        
        // Buscar la suscripción asociada
        $stmt = $pdo->prepare("
            SELECT * FROM subscriptions 
            WHERE stripe_subscription_id = ?
        ");
        $stmt->execute([$invoice->subscription]);
        $localSub = $stmt->fetch(PDO::FETCH_ASSOC);
        
    } catch (Exception $e) {
        error_log('Error al procesar fallo de factura: ' . $e->getMessage());
    }
}

// Función para determinar tipo de plan basado en ID de precio
function determinePlanType($priceId) {
    // Mapeo directo y explícito
    $planMap = [
        'price_1QygdpCorMZEmsUn1Dm4jm6z' => 'basic',        // básico mensual
        'price_1Qygi3CorMZEmsUnqDmcZh8b' => 'professional', // profesional mensual
        'price_1QyzAwCorMZEmsUneNSQSpSL' => 'basic',        // básico anual
        'price_1QyzCKCorMZEmsUnm9KFOuBa' => 'professional'  // profesional anual
    ];
    
    // Verificación directa del precio
    if (isset($planMap[$priceId])) {
        return $planMap[$priceId];
    }
    
    return 'basic'; // Default a básico si no se encuentra
}

// Función para determinar ciclo de facturación basado en ID de precio
function determineBillingCycle($priceId) {
    // Mapeo para entorno de prueba
    $testBillingCycles = [
        'price_1QzVfYCorMZEmsUnOLzbG1IF' => 'monthly', // 1: básico mensual
        'price_1QzWEtCorMZEmsUncToobQdL' => 'monthly', // 2: profesional mensual
        'price_1QzWbuCorMZEmsUnDY7sg1zN' => 'annual',  // 3: básico anual
        'price_1QzWedCorMZEmsUn4TmudeJi' => 'annual'   // 4: profesional anual
    ];
    
    // Mapeo para entorno de producción
    $prodBillingCycles = [
        'price_1QygdpCorMZEmsUn1Dm4jm6z' => 'basic',        // básico mensual
        'price_1Qygi3CorMZEmsUnqDmcZh8b' => 'professional', // profesional mensual
        'price_1QyzAwCorMZEmsUneNSQSpSL' => 'basic',        // básico anual
        'price_1QyzCKCorMZEmsUnm9KFOuBa' => 'professional'  // profesional anual
    ];
    
    // Determinar qué conjunto de mapeos usar
    $isTestMode = (isset($GLOBALS['stripeConfig']['livemode']) && $GLOBALS['stripeConfig']['livemode'] === false);
    $billingCycles = $isTestMode ? $testBillingCycles : $prodBillingCycles;
    
    // Verificar si el ID existe en el mapeo
    if (isset($billingCycles[$priceId])) {
        return $billingCycles[$priceId];
    } else {
        // Intentar inferir del intervalo del plan si está disponible
        if (isset($GLOBALS['current_plan_interval']) && $GLOBALS['current_plan_interval'] === 'year') {
            return 'annual';
        }
        
        return 'monthly'; // Default a mensual si no se encuentra
    }
}

// Función para actualizar límites del usuario según el plan
function updateUserLimits($userId, $planType, $pdo) {
    try {
        // Definir límites según el plan
        $planLimits = [
            'basic' => [
                'properties_limit' => 5,
                'tokens_limit' => 10000
            ],
            'professional' => [
                'properties_limit' => 15,
                'tokens_limit' => 20000
            ],
            'premium' => [
                'properties_limit' => 25,
                'tokens_limit' => 40000
            ],
            'unlimited' => [
                'properties_limit' => 'Ilimitado',
                'tokens_limit' => 'Ilimitado'
            ]
        ];
        
        $limits = $planLimits[$planType] ?? $planLimits['basic'];
        
        // Comprobar si los campos existen en la tabla de usuarios
        $stmt = $pdo->prepare("SHOW COLUMNS FROM users LIKE 'properties_limit'");
        $stmt->execute();
        $hasPropertiesLimit = $stmt->rowCount() > 0;
        
        $stmt = $pdo->prepare("SHOW COLUMNS FROM users LIKE 'tokens_limit'");
        $stmt->execute();
        $hasTokensLimit = $stmt->rowCount() > 0;
        
        // Crear SQL de actualización según los campos existentes
        $sql = "UPDATE users SET ";
        $params = [];
        
        if ($hasPropertiesLimit) {
            $sql .= "properties_limit = ?";
            $params[] = $limits['properties_limit'];
        }
        
        if ($hasTokensLimit) {
            if ($hasPropertiesLimit) $sql .= ", ";
            $sql .= "tokens_limit = ?";
            $params[] = $limits['tokens_limit'];
        }
        
        if (empty($params)) {
            // Si no hay campos para actualizar, salir
            return;
        }
        
        $sql .= " WHERE id = ?";
        $params[] = $userId;
        
        // Ejecutar la actualización
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
    } catch (Exception $e) {
        error_log('Error al actualizar límites de usuario: ' . $e->getMessage());
    }
}

// Función para registrar cambios de suscripción
function logSubscriptionChange($userId, $oldPlanType, $newPlanType, $oldBillingCycle, $newBillingCycle, $pdo) {
    try {
        // Registrar el cambio
        $stmt = $pdo->prepare("
            INSERT INTO subscription_changes
            (user_id, old_plan_type, new_plan_type, old_billing_cycle, new_billing_cycle)
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $userId,
            $oldPlanType,
            $newPlanType,
            $oldBillingCycle,
            $newBillingCycle
        ]);
    } catch (Exception $e) {
        error_log('Error al registrar cambio de suscripción: ' . $e->getMessage());
    }
}