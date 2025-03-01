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
    
    // Nuevos campos para visitas virtuales
    $isVirtual = isset($data['is_virtual']) ? (bool)$data['is_virtual'] : false;
    $meetLink = null;
    
    // Calcular hora de fin
    $endTime = date('Y-m-d H:i:s', strtotime($visitDate . " +$duration minutes"));
    
    // Verificar sincronización con Google Calendar
    $syncWithGoogle = isset($data['sync_with_google']) && $data['sync_with_google'];
    $createMeetLink = $isVirtual && isset($data['create_meet_link']) && $data['create_meet_link'];
    
    // Solo si se solicita crear solo un enlace de Meet (sin crear visita)
    if (isset($data['meet_link_only']) && $data['meet_link_only']) {
        // Lógica para solo generar un enlace de Meet
        if ($syncWithGoogle && $createMeetLink) {
            // Obtener tokens y generar meet link
            $meetLink = createGoogleMeetLink($db, $userId, $leadId, $visitDate, $endTime, $data);
            
            echo json_encode([
                'success' => true,
                'meet_link' => $meetLink,
                'message' => 'Enlace de Meet generado correctamente'
            ]);
            $db->commit();
            exit;
        } else {
            throw new Exception('Se requiere sincronización con Google y crear enlace de Meet');
        }
    }

    // Insertar la visita primero (antes de cualquier integración con Google)
    $stmt = $db->prepare("
        INSERT INTO property_visits (
            lead_id, property_id, user_id, visit_date, end_time, 
            title, description, status, created_by, is_virtual, meet_link
        ) VALUES (
            :lead_id, :property_id, :user_id, :visit_date, :end_time,
            :title, :description, :status, :created_by, :is_virtual, :meet_link
        )
    ");
    
    $stmt->execute([
        ':lead_id' => $leadId,
        ':property_id' => $propertyId,
        ':user_id' => $userId,
        ':visit_date' => $visitDate,
        ':end_time' => $endTime,
        ':title' => $data['title'] ?? ($isVirtual ? 'Visita virtual programada' : 'Visita programada'),
        ':description' => $data['description'] ?? null,
        ':status' => 'programada',
        ':created_by' => $userId,
        ':is_virtual' => $isVirtual ? 1 : 0,
        ':meet_link' => null // Inicialmente null, se actualizará después si es necesario
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
    
    // Variables para la respuesta
    $googleEventId = null;
    $googleEventUrl = null;
    $googleSynced = false;
    
    // Sincronizar con Google Calendar (para cualquier tipo de visita)
    if ($syncWithGoogle) {
        // Verificar si ya existe un mapeo para esta visita
        $checkMapping = $db->prepare("
            SELECT id FROM visit_calendar_mappings 
            WHERE visit_id = :visit_id
        ");
        $checkMapping->execute([':visit_id' => $visitId]);
        
        if (!$checkMapping->fetch()) {
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
                
                // Configuración común del evento
                $eventParams = [
                    'summary' => $isVirtual ? 'Visita Virtual: ' . $leadInfo['name'] : 'Visita: ' . $leadInfo['name'],
                    'location' => $isVirtual ? 'Reunión virtual - Google Meet' : $leadInfo['property_title'] . ' - ' . $leadInfo['property_address'],
                    'description' => ($isVirtual ? "Visita virtual programada" : "Visita programada") . 
                                    " con cliente: {$leadInfo['name']}\n".
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
                    'colorId' => $isVirtual ? '6' : '4', // Turquesa para virtuales, Verde para presenciales
                ];
                
                // Agregar conferencia para visitas virtuales con Meet
                if ($isVirtual && $createMeetLink) {
                    $eventParams['conferenceData'] = [
                        'createRequest' => [
                            'requestId' => uniqid() . "_" . time(),
                            'conferenceSolutionKey' => ['type' => 'hangoutsMeet']
                        ]
                    ];
                    
                    // Opciones para crear la videoconferencia
                    $optParams = [
                        'conferenceDataVersion' => 1,
                        'sendUpdates' => 'all'
                    ];
                } else {
                    $optParams = ['sendUpdates' => 'all'];
                }
                
                $event = new Google_Service_Calendar_Event($eventParams);
                
                // Crear el evento (con o sin Meet)
                $createdEvent = $service->events->insert('primary', $event, $optParams);
                
                // Extraer el enlace de Meet para visitas virtuales
                if ($isVirtual && $createMeetLink && 
                    isset($createdEvent->conferenceData) && 
                    isset($createdEvent->conferenceData->entryPoints)) {
                    foreach ($createdEvent->conferenceData->entryPoints as $entryPoint) {
                        if ($entryPoint->entryPointType === 'video') {
                            $meetLink = $entryPoint->uri;
                            break;
                        }
                    }
                    
                    // Actualizar la visita con el enlace de Meet
                    if ($meetLink) {
                        $updateVisit = $db->prepare("
                            UPDATE property_visits 
                            SET meet_link = :meet_link,
                                description = CONCAT(IFNULL(description, ''), '\n\nEnlace para la reunión virtual: ', :meet_link_desc)
                            WHERE id = :visit_id
                        ");
                        
                        $updateVisit->execute([
                            ':meet_link' => $meetLink,
                            ':meet_link_desc' => $meetLink,
                            ':visit_id' => $visitId
                        ]);
                    }
                }
                
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
                
                $googleEventId = $createdEvent->getId();
                $googleEventUrl = $createdEvent->getHtmlLink();
                $googleSynced = true;
            }
        }
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'visit_id' => $visitId,
        'google_synced' => $googleSynced,
        'google_event_id' => $googleEventId,
        'google_event_url' => $googleEventUrl,
        'meet_link' => $meetLink,
        'is_virtual' => $isVirtual,
        'message' => $googleSynced 
            ? ($isVirtual 
                ? ($meetLink ? 'Visita virtual creada con enlace de Google Meet' : 'Visita virtual creada y sincronizada con Google Calendar') 
                : 'Visita creada y sincronizada con Google Calendar')
            : ($isVirtual ? 'Visita virtual creada correctamente' : 'Visita creada correctamente')
    ]);
    
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

// Función para crear solo un enlace de Google Meet
function createGoogleMeetLink($db, $userId, $leadId, $visitDate, $endTime, $data) {
    // Obtener tokens de Google
    $stmtToken = $db->prepare("
        SELECT access_token, refresh_token, expires_at 
        FROM google_calendar_tokens 
        WHERE user_id = :userId
    ");
    
    $stmtToken->execute([':userId' => $userId]);
    $tokenData = $stmtToken->fetch(PDO::FETCH_ASSOC);
    
    if (!$tokenData || !$tokenData['refresh_token']) {
        throw new Exception('No se encontraron tokens de Google para crear la reunión virtual');
    }
    
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
    
    // Crear evento con videoconferencia habilitada
    $event = new Google_Service_Calendar_Event([
        'summary' => 'Visita Virtual: ' . $leadInfo['name'],
        'location' => 'Reunión virtual - Google Meet',
        'description' => "Visita virtual programada con cliente: {$leadInfo['name']}\n".
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
        'colorId' => '6', // Turquesa para reuniones virtuales
        'conferenceData' => [
            'createRequest' => [
                'requestId' => uniqid() . "_" . time(),
                'conferenceSolutionKey' => ['type' => 'hangoutsMeet']
            ]
        ]
    ]);
    
    // Configurar opciones para crear la videoconferencia
    $optParams = [
        'conferenceDataVersion' => 1,
        'sendUpdates' => 'all'
    ];
    
    // Crear el evento con Meet
    $createdEvent = $service->events->insert('primary', $event, $optParams);
    
    // Extraer el enlace de Meet
    $meetLink = null;
    if (isset($createdEvent->conferenceData) && 
        isset($createdEvent->conferenceData->entryPoints)) {
        foreach ($createdEvent->conferenceData->entryPoints as $entryPoint) {
            if ($entryPoint->entryPointType === 'video') {
                $meetLink = $entryPoint->uri;
                break;
            }
        }
    }
    
    if (!$meetLink) {
        throw new Exception('No se pudo generar el enlace de Google Meet');
    }
    
    return $meetLink;
}