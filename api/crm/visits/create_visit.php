<?php
session_start();
require_once '../../config/database.php';
require_once '../../../vendor/autoload.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../');
$dotenv->load();

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $db->beginTransaction();
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validar datos requeridos
    if (!isset($data['lead_id']) || !isset($data['visit_date']) || !isset($data['duration'])) {
        throw new Exception('Datos incompletos para crear visita');
    }
    
    $userId = $_SESSION['user_id'];
    $leadId = $data['lead_id'];
    $propertyId = $data['property_id'] ?? null;
    $visitDate = $data['visit_date'];
    $duration = intval($data['duration']);
    
    // Calcular hora de fin
    $endTime = date('Y-m-d H:i:s', strtotime($visitDate . " +$duration minutes"));
    
    // Insertar la visita
    $stmt = $db->prepare("
        INSERT INTO property_visits (
            lead_id, property_id, user_id, visit_date, end_time, 
            title, description, status, created_by
        ) VALUES (
            :lead_id, :property_id, :user_id, :visit_date, :end_time,
            :title, :description, :status, :created_by
        )
    ");
    
    $stmt->execute([
        ':lead_id' => $leadId,
        ':property_id' => $propertyId,
        ':user_id' => $userId,
        ':visit_date' => $visitDate,
        ':end_time' => $endTime,
        ':title' => $data['title'] ?? 'Visita programada',
        ':description' => $data['description'] ?? null,
        ':status' => 'programada',
        ':created_by' => $userId
    ]);
    
    $visitId = $db->lastInsertId();
    
    // Actualizar el lead a estado "visita"
    $updateLead = $db->prepare("
        UPDATE property_leads 
        SET status = 'visita', 
            sub_state = 'programada',
            updated_at = NOW()
        WHERE id = :lead_id
    ");
    
    $updateLead->execute([':lead_id' => $leadId]);
    
    // Verificar sincronización con Google Calendar
    $syncWithGoogle = isset($data['sync_with_google']) && $data['sync_with_google'];
    
    if ($syncWithGoogle) {
        // Obtener tokens de Google
        $stmtToken = $db->prepare("
            SELECT access_token, refresh_token, expires_at 
            FROM google_calendar_tokens 
            WHERE user_id = :userId
        ");
        
        $stmtToken->execute([':userId' => $userId]);
        $tokenData = $stmtToken->fetch(PDO::FETCH_ASSOC);
        
        if ($tokenData && $tokenData['refresh_token']) {
            // Configurar cliente de Google
            $client = new Google_Client();
            $client->setApplicationName('Master Broker Calendar');
            $client->setClientId($_ENV['GOOGLE_OAUTH_CLIENT_ID']);
            $client->setClientSecret($_ENV['GOOGLE_OAUTH_CLIENT_SECRET']);
            
            // Configurar tokens
            $accessToken = [
                'access_token' => $tokenData['access_token'],
                'refresh_token' => $tokenData['refresh_token'],
                'expires_in' => strtotime($tokenData['expires_at']) - time()
            ];
            
            $client->setAccessToken($accessToken);
            
            // Renovar token si ha expirado
            if ($client->isAccessTokenExpired()) {
                $client->fetchAccessTokenWithRefreshToken($tokenData['refresh_token']);
                $newToken = $client->getAccessToken();
                
                $expiresAt = date('Y-m-d H:i:s', time() + $newToken['expires_in']);
                
                $updateToken = $db->prepare("
                    UPDATE google_calendar_tokens 
                    SET access_token = :access_token, 
                        expires_at = :expires_at 
                    WHERE user_id = :user_id
                ");
                
                $updateToken->execute([
                    ':access_token' => $newToken['access_token'],
                    ':expires_at' => $expiresAt,
                    ':user_id' => $userId
                ]);
            }
            
            $service = new Google_Service_Calendar($client);
            
            // Obtener información del lead
            $stmtLead = $db->prepare("
                SELECT l.name, l.email, l.phone,
                       COALESCE(p.title, l.property_title) as property_title,
                       COALESCE(p.address, 'No especificada') as property_address
                FROM property_leads l
                LEFT JOIN properties p ON l.property_id = p.id
                WHERE l.id = :leadId
            ");
            
            $stmtLead->execute([':leadId' => $leadId]);
            $leadInfo = $stmtLead->fetch(PDO::FETCH_ASSOC);
            
            // Crear evento
            $event = new Google_Service_Calendar_Event([
                'summary' => 'Visita: ' . $leadInfo['name'],
                'location' => $leadInfo['property_title'] . ' - ' . $leadInfo['property_address'],
                'description' => "Visita programada con cliente: {$leadInfo['name']}\n".
                                "Teléfono: {$leadInfo['phone']}\n".
                                "Email: {$leadInfo['email']}\n\n".
                                ($data['description'] ?? ''),
                'start' => [
                    'dateTime' => (new DateTime($visitDate))->format(DateTime::RFC3339),
                    'timeZone' => 'America/Mexico_City',
                ],
                'end' => [
                    'dateTime' => (new DateTime($endTime))->format(DateTime::RFC3339),
                    'timeZone' => 'America/Mexico_City',
                ],
                'reminders' => [
                    'useDefault' => false,
                    'overrides' => [
                        ['method' => 'popup', 'minutes' => 30],
                        ['method' => 'email', 'minutes' => 60]
                    ]
                ],
                'colorId' => '4', // Verde
            ]);
            
            $createdEvent = $service->events->insert('primary', $event);
            
            // Guardar mapeo
            $mapStmt = $db->prepare("
                INSERT INTO visit_calendar_mappings (
                    user_id, lead_id, visit_id, google_event_id, event_url, event_data
                ) VALUES (
                    :user_id, :lead_id, :visit_id, :google_event_id, :event_url, :event_data
                )
            ");
            
            $mapStmt->execute([
                ':user_id' => $userId,
                ':lead_id' => $leadId,
                ':visit_id' => $visitId,
                ':google_event_id' => $createdEvent->getId(),
                ':event_url' => $createdEvent->getHtmlLink(),
                ':event_data' => json_encode($createdEvent)
            ]);
            
            $db->commit();
            
            echo json_encode([
                'success' => true,
                'visit_id' => $visitId,
                'google_synced' => true,
                'google_event_id' => $createdEvent->getId(),
                'google_event_url' => $createdEvent->getHtmlLink(),
                'message' => 'Visita creada y sincronizada con Google Calendar'
            ]);
        } else {
            // No hay tokens de Google
            $db->commit();
            echo json_encode([
                'success' => true,
                'visit_id' => $visitId,
                'google_synced' => false,
                'message' => 'Visita creada pero no se pudo sincronizar con Google Calendar'
            ]);
        }
    } else {
        // Sin sincronización
        $db->commit();
        echo json_encode([
            'success' => true,
            'visit_id' => $visitId,
            'google_synced' => false,
            'message' => 'Visita creada correctamente'
        ]);
    }
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    error_log("Error en create_visit.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al crear visita: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}