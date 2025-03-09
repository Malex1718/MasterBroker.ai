<?php
// 1) Habilitar CORS
header("Access-Control-Allow-Origin: https://masterbroker.ai"); 
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

date_default_timezone_set('America/Mexico_City');
ini_set('date.timezone', 'America/Mexico_City');

// Manejo de preflight request (OPTIONS):
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2) Iniciar sesión de PHP
session_start();
error_log("Session data: " . print_r($_SESSION, true));

/**
 * Validación basada en $_SESSION 
 */
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Sesión no encontrada o expirada"
    ]);
    exit;
}

// 3) Incluir tu clase de base de datos
require_once __DIR__ . '/../../config/database.php';

$database = new Database();
try {
    $pdo = $database->getConnection();
    
    // Establecer el usuario actual como variable de sesión MySQL
    $stmt = $pdo->prepare("SET @current_user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error de conexión a la base de datos"
    ]);
    exit;
}

/**
 * Helper para respuestas JSON
 */
function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : null;

switch ($method) {
    case 'GET':
        if ($action === 'properties') {
            try {
                $sql = "SELECT id, title, code 
                        FROM properties
                        WHERE is_active = 1 
                        AND status != 'archived'
                        AND user_id = :user_id
                        ORDER BY created_at DESC";
                        
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':user_id' => $_SESSION['user_id']]);
                $properties = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJson([
                    "success" => true,
                    "data"    => $properties
                ]);
            } catch (Exception $e) {
                sendJson([
                    "success" => false,
                    "message" => "Error al obtener propiedades: " . $e->getMessage()
                ], 500);
            }
        } else {
            try {
                $sql = "SELECT 
                    pl.*, 
                    p.title as original_property_title,
                    CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
                    pl.score,
                    pl.temperature,
                    pl.interaction_score,
                    pl.quality_score,
                    pl.behavior_score,
                    pl.response_time_score,
                    pl.decay_factor,
                    pl.score_updated_at,
                    pl.behavior_signals,
                    (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'type', la.activity_type,
                                'date', la.created_at,
                                'description', la.description
                            )
                        )
                        FROM lead_activities la 
                        WHERE la.lead_id = pl.id 
                        ORDER BY la.created_at DESC 
                        LIMIT 5
                    ) as activities,
                    (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'date', lh.created_at,
                                'description', CONCAT('Cambio de estado a: ', lh.new_value)
                            )
                        )
                        FROM lead_history lh 
                        WHERE lh.lead_id = pl.id 
                        ORDER BY lh.created_at DESC 
                        LIMIT 5
                    ) as updates
                FROM property_leads pl
                LEFT JOIN properties p ON pl.property_id = p.id
                LEFT JOIN users u ON pl.assigned_to = u.id
                WHERE pl.deleted_by IS NULL ";  // Esta línea filtra los leads borrados
    
                $params = [];
                
                if (isset($_SESSION['user_role'])) {
                    switch ($_SESSION['user_role']) {
                        case 'admin':
                            break;
                        case 'agent':
                            $sql .= "AND (pl.assigned_to = :user_id 
                                    OR pl.user_id = :user_id_created)";
                            $params[':user_id'] = $_SESSION['user_id'];
                            $params[':user_id_created'] = $_SESSION['user_id'];
                            break;
                        default:
                            $sql .= "AND pl.user_id = :user_id";
                            $params[':user_id'] = $_SESSION['user_id'];
                    }
                } else {
                    $sql .= "AND pl.user_id = :user_id";
                    $params[':user_id'] = $_SESSION['user_id'];
                }

                $sql .= " GROUP BY pl.id, p.title, u.first_name, u.last_name
                        ORDER BY pl.created_at DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $leads = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJson([
                    "success" => true,
                    "data" => $leads
                ]);
            } catch (Exception $e) {
                sendJson([
                    "success" => false, 
                    "message" => $e->getMessage()
                ], 500);
            }
        }
    break;

    case 'POST':
        $postData = json_decode(file_get_contents("php://input"), true);
        if (!$postData) {
            sendJson(["success" => false, "message" => "Datos JSON inválidos"], 400);
        }

        try {
            $pdo->beginTransaction();

            if (!isset($_SESSION['user_id'])) {
                throw new Exception("Usuario no autenticado");
            }

            $sql = "INSERT INTO property_leads 
                    (property_id, user_id, name, email, phone, country_code, 
                     contact_preference, message, source, status, assigned_to, 
                     priority, urgency, created_at, 
                     property_title, property_description)
                    VALUES
                    (:property_id, :user_id, :name, :email, :phone, :country_code,
                     :contact_preference, :message, :source, :status, :assigned_to, 
                     :priority, :urgency, NOW(),
                     :property_title, :property_description)";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':property_id'         => $postData['property_id'] ?? null,
                ':user_id'             => $_SESSION['user_id'],
                ':name'                => $postData['name'] ?? null,
                ':email'               => $postData['email'] ?? null,
                ':phone'               => $postData['phone'] ?? null,
                ':country_code'        => $postData['country_code'] ?? '+52',
                ':contact_preference'  => $postData['contact_preference'] ?? 'email',
                ':message'             => $postData['message'] ?? null,
                ':source'              => $postData['source'] ?? 'web',
                ':status'              => $postData['status'] ?? 'nuevo',
                ':assigned_to'         => $postData['assigned_to'] ?? null,
                ':priority'            => $postData['priority'] ?? 'media',
                ':urgency'             => $postData['urgency'] ?? 'medium',
                ':property_title'      => $postData['property_title'] ?? null,
                ':property_description'=> $postData['property_description'] ?? null
            ]);

            $newId = $pdo->lastInsertId();

            $sqlHistory = "INSERT INTO lead_history 
                          (lead_id, user_id, action, field_name, new_value)
                          VALUES 
                          (:lead_id, :user_id, 'create', 'status', :status)";
            $stmtHistory = $pdo->prepare($sqlHistory);
            $stmtHistory->execute([
                ':lead_id' => $newId,
                ':user_id' => $_SESSION['user_id'],
                ':status' => $postData['status'] ?? 'nuevo'
            ]);

            $pdo->commit();

            sendJson([
                "success" => true,
                "data" => [
                    "id"     => $newId,
                    "status" => "Lead creado con éxito"
                ]
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendJson(["success" => false, "message" => $e->getMessage()], 500);
        }
        break;
        case 'PUT':
            try {
                if (!isset($_SESSION['user_id'])) {
                    throw new Exception("Sesión no válida");
                }
        
                $userId = $_SESSION['user_id'];
                
                $putData = json_decode(file_get_contents("php://input"), true);
                if (!$putData || !isset($putData['id'])) {
                    throw new Exception("Datos inválidos o falta ID del lead");
                }
        
                $leadId = $putData['id'];
                $newStatus = $putData['status'] ?? null;
                $subState = $putData['sub_state'] ?? null;
                $activityType = $putData['activity_type'] ?? null;
        
                // Iniciar transacción
                $pdo->beginTransaction();
        
                // Verificar existencia del lead y obtener su estado actual
                $checkSql = "SELECT l.*, COALESCE(l.assigned_to, l.user_id) as responsible_user,
                                   l.behavior_signals, l.score, l.temperature, l.status as current_status 
                            FROM property_leads l 
                            WHERE l.id = :lead_id";
                $checkStmt = $pdo->prepare($checkSql);
                $checkStmt->execute([':lead_id' => $leadId]);
                $leadInfo = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
                if (!$leadInfo) {
                    throw new Exception("Lead no encontrado");
                }
        
                // Array para almacenar los campos a actualizar
                $updateFields = [];
                $params = [':id' => $leadId];
        
                // Determinar tipo de actividad basado en el estado
                if ($newStatus && !$activityType) {
                    switch ($newStatus) {
                        case 'contacto':
                            $activityType = 'first_contact';
                            break;
                        case 'visita':
                            $activityType = 'visit';
                            break;
                        case 'negociacion':
                            $activityType = 'negotiation';
                            break;
                        default:
                            $activityType = 'documentation';
                    }
                }
        
                // Manejar verificación de email
                if (isset($putData['email_verified'])) {
                    $updateFields[] = "email_verified = :email_verified";
                    $params[':email_verified'] = $putData['email_verified'] ? 1 : 0;
                    
                    if ($putData['email_verified']) {
                        // Registrar actividad de verificación de email con título explícito
                        $sqlActivity = "INSERT INTO lead_activities 
                                      (lead_id, user_id, activity_type, title, description,
                                       status, created_at)
                                      VALUES 
                                      (:lead_id, :user_id, :activity_type, :title, :description,
                                       'effective', NOW())";
                        $stmtActivity = $pdo->prepare($sqlActivity);
                        $stmtActivity->execute([
                            ':lead_id' => $leadId,
                            ':user_id' => $userId,
                            ':activity_type' => 'prospection',
                            ':title' => $putData['title'] ?? 'Verificación de Email', // Valor por defecto si no viene título
                            ':description' => $putData['description'] ?? 'Email verificado'
                        ]);
                    }
                }
        
                // Manejar verificación de teléfono
                if (isset($putData['phone_verified'])) {
                    $updateFields[] = "phone_verified = :phone_verified";
                    $params[':phone_verified'] = $putData['phone_verified'] ? 1 : 0;
                    
                    if ($putData['phone_verified']) {
                        // Registrar actividad de verificación de teléfono con título explícito
                        $sqlActivity = "INSERT INTO lead_activities 
                                      (lead_id, user_id, activity_type, title, description,
                                       status, created_at)
                                      VALUES 
                                      (:lead_id, :user_id, :activity_type, :title, :description,
                                       'effective', NOW())";
                        $stmtActivity = $pdo->prepare($sqlActivity);
                        $stmtActivity->execute([
                            ':lead_id' => $leadId,
                            ':user_id' => $userId,
                            ':activity_type' => 'first_contact',
                            ':title' => $putData['title'] ?? 'Verificación de Teléfono', // Valor por defecto si no viene título
                            ':description' => $putData['description'] ?? 'Teléfono verificado'
                        ]);
                    }
                }
                
                // Actualizar el lead con el nuevo estado y sub-estado
                if ($newStatus) {
                    // Solo actualizar si el estado es diferente al actual
                    if ($leadInfo['current_status'] !== $newStatus) {
                        $updateFields[] = "status = :status";
                        $params[':status'] = $newStatus;
                        
                        if ($subState) {
                            $updateFields[] = "sub_state = :sub_state";
                            $params[':sub_state'] = $subState;
                        }
        
                        // Registrar una única actividad de cambio de estado
                        $sqlActivity = "INSERT INTO lead_activities 
                                      (lead_id, user_id, activity_type, title, description,
                                       status, sub_state, created_at)
                                      VALUES 
                                      (:lead_id, :user_id, :activity_type, :title, :description,
                                       'effective', :sub_state, NOW())";
                        $stmtActivity = $pdo->prepare($sqlActivity);
                        $stmtActivity->execute([
                            ':lead_id' => $leadId,
                            ':user_id' => $userId,
                            ':activity_type' => $activityType,
                            ':title' => 'Cambio de Estado',
                            ':description' => "Cambio de estado a: {$newStatus}",
                            ':sub_state' => $subState
                        ]);
                    }
                }
        
                // Registrar actividad adicional solo si no es un cambio de estado
                // y el tipo de actividad está definido
                if ($activityType && $activityType !== 'none' && !$newStatus) {
                    $sqlActivity = "INSERT INTO lead_activities
                                  (lead_id, user_id, activity_type, title, description,
                                   status, sub_state, created_at)
                                  VALUES
                                  (:lead_id, :user_id, :activity_type, :title, :description,
                                   'effective', :sub_state, NOW())";
        
                    $stmtActivity = $pdo->prepare($sqlActivity);
                    $resultActivity = $stmtActivity->execute([
                        ':lead_id' => $leadId,
                        ':user_id' => $userId,
                        ':activity_type' => $activityType,
                        ':title' => ucfirst($activityType),
                        ':description' => $putData['description'] ?? '',
                        ':sub_state' => $subState
                    ]);
        
                    if (!$resultActivity) {
                        throw new Exception("Error al registrar la actividad");
                    }
                }
        
                // Actualizar última actividad y timestamp
                $updateFields[] = "last_activity_date = NOW()";
                $updateFields[] = "updated_at = NOW()";
        
                // Ejecutar la actualización si hay campos para actualizar
                if (!empty($updateFields)) {
                    $sqlUpdate = "UPDATE property_leads 
                                 SET " . implode(", ", $updateFields) . "
                                 WHERE id = :id";
                    
                    $stmt = $pdo->prepare($sqlUpdate);
                    if (!$stmt->execute($params)) {
                        throw new Exception("Error al actualizar el lead");
                    }
                }
        
                // Recalcular todos los scores
                $interactionScore = calculateInteractionScore($leadId, $pdo);
                $qualityScore = calculateQualityScore($leadInfo);
                $behaviorScore = calculateBehaviorScore($leadInfo);
                $responseTimeScore = calculateResponseTimeScore($leadInfo, $pdo);
                $decayFactor = calculateDecayFactor($leadInfo['last_activity_date']);
                
                $totalScore = min(100, round(
                    ($interactionScore + $qualityScore + $behaviorScore + $responseTimeScore) * $decayFactor
                ));
                
                $temperature = determineTemperature($totalScore);
        
                // Actualizar scores en la base de datos
                $scoreSql = "UPDATE property_leads SET
                    score = :score,
                    temperature = :temperature,
                    interaction_score = :interaction_score,
                    quality_score = :quality_score,
                    behavior_score = :behavior_score,
                    response_time_score = :response_time_score,
                    decay_factor = :decay_factor,
                    score_updated_at = NOW(),
                    score_history = JSON_ARRAY_APPEND(
                        COALESCE(score_history, JSON_ARRAY()),
                        '$',
                        JSON_OBJECT(
                            'date', NOW(),
                            'old_score', :old_score,
                            'new_score', :new_score,
                            'old_temperature', :old_temperature,
                            'new_temperature', :new_temperature,
                            'trigger_type', :trigger_type
                        )
                    )
                    WHERE id = :lead_id";
        
                $stmtScore = $pdo->prepare($scoreSql);
                $stmtScore->execute([
                    ':lead_id' => $leadId,
                    ':score' => $totalScore,
                    ':temperature' => $temperature,
                    ':interaction_score' => $interactionScore,
                    ':quality_score' => $qualityScore,
                    ':behavior_score' => $behaviorScore,
                    ':response_time_score' => $responseTimeScore,
                    ':decay_factor' => $decayFactor,
                    ':old_score' => $leadInfo['score'],
                    ':new_score' => $totalScore,
                    ':old_temperature' => $leadInfo['temperature'],
                    ':new_temperature' => $temperature,
                    ':trigger_type' => $activityType ?? 'status_change'
                ]);
        
                $pdo->commit();
                
                sendJson([
                    "success" => true,
                    "message" => "Lead actualizado correctamente",
                    "data" => [
                        "id" => $leadId,
                        "status" => $newStatus,
                        "sub_state" => $subState,
                        "email_verified" => $params[':email_verified'] ?? null,
                        "phone_verified" => $params[':phone_verified'] ?? null,
                        "score" => $totalScore,
                        "temperature" => $temperature,
                        "last_activity" => date('Y-m-d H:i:s')
                    ]
                ]);
        
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log("Error en lead_manager.php: " . $e->getMessage());
                sendJson([
                    "success" => false,
                    "message" => "Error en la actualización: " . $e->getMessage()
                ], 500);
            }
        break;
    default:
        sendJson(["success" => false, "message" => "Método no permitido"], 405);
}

// Funciones auxiliares para el cálculo del score
function calculateInteractionScore($leadId, $pdo) {
    // Log inicial
    error_log("Calculando score de interacción para lead ID: " . $leadId);

    $sql = "SELECT activity_type, COUNT(*) as count 
            FROM lead_activities 
            WHERE lead_id = :lead_id 
            GROUP BY activity_type";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':lead_id' => $leadId]);
    $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Log de actividades encontradas
    error_log("Actividades encontradas: " . json_encode($activities));

    $activityScores = [
        'first_contact' => 5,
        'visit' => 15,
        'negotiation' => 10,
        'documentation' => 5
    ];

    $score = 0;
    $scoreBreakdown = [];

    foreach ($activities as $activity) {
        $type = strtolower($activity['activity_type']);
        if (isset($activityScores[$type])) {
            $points = $activityScores[$type] * $activity['count'];
            $score += $points;
            
            // Registrar el desglose del puntaje
            $scoreBreakdown[] = [
                'type' => $type,
                'count' => $activity['count'],
                'points_per' => $activityScores[$type],
                'total_points' => $points
            ];
        }
    }

    // Log del desglose de puntuación
    error_log("Desglose de puntuación: " . json_encode($scoreBreakdown));
    error_log("Puntuación total antes del límite: " . $score);

    $finalScore = min(40, $score);
    error_log("Puntuación final después del límite: " . $finalScore);

    return $finalScore;
}

function calculateQualityScore($lead) {
    $score = 0;
    if ($lead['name'] && $lead['email'] && $lead['phone']) $score += 5;
    if ($lead['phone_verified']) $score += 5;
    if ($lead['email_verified']) $score += 5;
    if ($lead['property_id']) $score += 10;
    return min(25, $score);
}

function calculateBehaviorScore($lead) {
    $score = 0;
    $signals = json_decode($lead['behavior_signals'] ?? '[]', true);
    $signalScores = [
        'multiple_inquiries' => 5,
        'specific_questions' => 5,
        'price_discussion' => 5,
        'document_request' => 10,
        'urgency_signals' => 15
    ];
    foreach ($signals as $signal) {
        if (isset($signalScores[$signal])) {
            $score += $signalScores[$signal];
        }
    }
    return min(15, $score);
}

function calculateResponseTimeScore($lead, $pdo) {
    $sql = "SELECT MIN(created_at) as first_response 
            FROM lead_activities 
            WHERE lead_id = ? 
            AND activity_type IN ('first_contact', 'call', 'email', 'message')";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$lead['id']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$result['first_response']) return 0;
    
    $firstResponse = strtotime($result['first_response']);
    $created = strtotime($lead['created_at']);
    $hours = ($firstResponse - $created) / 3600;
    
    if ($hours <= 1) return 20;
    if ($hours <= 4) return 15;
    if ($hours <= 24) return 10;
    if ($hours <= 48) return 5;
    return 0;
}

function updateBehaviorSignals($leadId, $pdo) {
    // 1. Obtener el número de consultas en las últimas 24 horas
    $sql = "SELECT COUNT(*) as inquiry_count 
            FROM lead_activities 
            WHERE lead_id = :lead_id 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND activity_type IN ('first_contact', 'message', 'email')";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':lead_id' => $leadId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 2. Obtener las señales actuales
    $sqlCurrent = "SELECT behavior_signals FROM property_leads WHERE id = :lead_id";
    $stmtCurrent = $pdo->prepare($sqlCurrent);
    $stmtCurrent->execute([':lead_id' => $leadId]);
    $currentSignals = $stmtCurrent->fetch(PDO::FETCH_ASSOC);
    
    $signals = json_decode($currentSignals['behavior_signals'] ?? '[]', true);
    
    // 3. Si hay más de 3 consultas en 24 horas, añadir la señal
    if ($result['inquiry_count'] >= 3) {
        if (!in_array('multiple_inquiries', $signals)) {
            $signals[] = 'multiple_inquiries';
            
            // 4. Actualizar las señales en la base de datos
            $sqlUpdate = "UPDATE property_leads 
                         SET behavior_signals = :signals 
                         WHERE id = :lead_id";
            
            $stmtUpdate = $pdo->prepare($sqlUpdate);
            $stmtUpdate->execute([
                ':lead_id' => $leadId,
                ':signals' => json_encode($signals)
            ]);
            
            // Log para debugging
            error_log("Señal 'multiple_inquiries' añadida para lead ID: $leadId");
            error_log("Número de consultas en 24h: " . $result['inquiry_count']);
        }
    }
    
    return $signals;
}

function calculateDecayFactor($lastActivityDate) {
    if (!$lastActivityDate) return 0.5;
    
    $days = (time() - strtotime($lastActivityDate)) / (24 * 3600);
    
    if ($days <= 7) return 1.0;
    if ($days <= 15) return 0.9;
    if ($days <= 30) return 0.7;
    return 0.5;
}

function determineTemperature($score) {
    if ($score >= 80) return 'hot';
    if ($score >= 60) return 'warm';
    if ($score >= 40) return 'lukewarm';
    if ($score >= 20) return 'cool';
    return 'cold';
}

$database->closeConnection();
?>