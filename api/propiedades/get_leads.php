<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Habilitar reporte de errores
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/leads_error.log');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
} 

session_start();

// Log de inicio de solicitud
error_log("Nueva solicitud - Método: " . $_SERVER['REQUEST_METHOD']);
error_log("Session ID: " . session_id());
error_log("Usuario en sesión: " . ($_SESSION['user_id'] ?? 'No hay usuario'));

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    error_log("Error de autenticación: No hay usuario en sesión");
    echo json_encode([
        'status' => 'error',
        'message' => 'Usuario no autenticado',
        'debug' => [
            'session_data' => $_SESSION,
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
    exit();
}

require_once '../config/database.php';

class LeadsController {
    private $conn;
    private $userId;
    
    public function __construct($db, $userId) {
        $this->conn = $db;
        $this->userId = $userId;
        error_log("LeadsController inicializado - Usuario ID: " . $userId);
    }
    
    public function getLeads($filters = []) {
        try {
            error_log("Iniciando getLeads para usuario: " . $this->userId);
            error_log("Filtros recibidos: " . print_r($filters, true));

            // Consulta base
            $query = "
                SELECT 
                    pl.*,
                    p.title as property_title,
                    p.code as property_code,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name,
                    u.email as user_email,
                    u.phone as user_phone
                FROM property_leads pl
                JOIN properties p ON pl.property_id = p.id
                LEFT JOIN users u ON pl.user_id = u.id
                WHERE p.user_id = :user_id
            ";
            
            $params = [':user_id' => $this->userId];

            // Aplicar filtros solo si tienen valores válidos
            if (!empty($filters['source']) && $filters['source'] !== 'null') {
                $query .= " AND pl.source = :source";
                $params[':source'] = $filters['source'];
            }
            
            if (!empty($filters['status']) && $filters['status'] !== 'null') {
                $query .= " AND pl.status = :status";
                $params[':status'] = $filters['status'];
            }
            
            if (!empty($filters['search'])) {
                $query .= " AND (
                    pl.name LIKE :search OR 
                    pl.email LIKE :search OR 
                    pl.phone LIKE :search OR 
                    p.title LIKE :search OR
                    p.code LIKE :search
                )";
                $params[':search'] = "%{$filters['search']}%";
            }

            // Ordenamiento
            $orderBy = match($filters['order'] ?? 'recientes') {
                'destacados' => "pl.is_favorite DESC, pl.created_at DESC",
                'noleidos' => "pl.is_read ASC, pl.created_at DESC",
                default => "pl.created_at DESC"
            };
            
            $query .= " ORDER BY " . $orderBy;

            error_log("Query final: " . $query);
            error_log("Parámetros: " . print_r($params, true));

            // Ejecutar consulta principal
            $stmt = $this->conn->prepare($query);
            $stmt->execute($params);
            $leads = $stmt->fetchAll(PDO::FETCH_ASSOC);

            error_log("Leads encontrados: " . count($leads));

            // Obtener actividades para cada lead
            foreach ($leads as &$lead) {
                $lead['activities'] = $this->getLeadActivities($lead['id']);
            }

            return [
                'status' => 'success',
                'data' => $leads,
                'debug' => [
                    'count' => count($leads),
                    'filters' => $filters,
                    'user_id' => $this->userId,
                    'query' => $query,
                    'params' => $params,
                    'execution_time' => microtime(true) - $_SERVER["REQUEST_TIME_FLOAT"]
                ]
            ];

        } catch (Exception $e) {
            error_log("Error en getLeads: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw $e;
        }
    }

    private function getLeadActivities($leadId) {
        try {
            error_log("Obteniendo actividades para lead ID: " . $leadId);

            $query = "
                SELECT 
                    la.*,
                    u.first_name as user_name,
                    u.last_name as user_lastname
                FROM lead_activities la
                LEFT JOIN users u ON la.user_id = u.id
                WHERE la.lead_id = :lead_id
                ORDER BY la.created_at DESC
            ";
            
            $stmt = $this->conn->prepare($query);
            $stmt->execute([':lead_id' => $leadId]);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            error_log("Actividades encontradas: " . count($activities));
            return $activities;

        } catch (Exception $e) {
            error_log("Error al obtener actividades: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return [];
        }
    }

public function addActivity($data) {
    try {
        error_log("Iniciando addActivity con datos: " . print_r($data, true));

        $this->conn->beginTransaction();

            // Primera consulta: Insertar actividad
        $query = "
            INSERT INTO lead_activities (
                lead_id, user_id, activity_type,
                title, description, status,
                scheduled_at
            ) VALUES (
                :lead_id, :user_id, :activity_type,
                :title, :description, :status,
                COALESCE(:scheduled_at, NOW())
            )
        ";

        $stmt = $this->conn->prepare($query);
        $result = $stmt->execute([
            ':lead_id' => $data['lead_id'],
                ':user_id' => $this->userId, // Aseguramos que se use el user_id del constructor
            ':activity_type' => $data['activity_type'],
            ':title' => $data['title'],
            ':description' => $data['description'],
            ':status' => $data['status'],
            ':scheduled_at' => $data['scheduled_at'] ?? null
        ]);

        error_log("Resultado de inserción de actividad: " . ($result ? 'éxito' : 'fallo'));

            // Segunda consulta: Actualizar estado del lead
        if (!empty($data['lead_status'])) {
            $updateQuery = "
                UPDATE property_leads 
                SET 
                    status = :status,
                        user_id = :user_id,  -- Agregamos el user_id en la actualización
                    updated_at = NOW()
                WHERE id = :lead_id
            ";
            
            $updateStmt = $this->conn->prepare($updateQuery);
            $updateResult = $updateStmt->execute([
                ':status' => $data['lead_status'],
                    ':lead_id' => $data['lead_id'],
                    ':user_id' => $this->userId  // Agregamos el user_id en los parámetros
            ]);

            error_log("Resultado de actualización de estado: " . ($updateResult ? 'éxito' : 'fallo'));
        }

        $this->conn->commit();
        return [
            'status' => 'success', 
            'message' => 'Actividad agregada correctamente',
            'debug' => [
                'activity_added' => $result,
                'status_updated' => $updateResult ?? false,
                    'lead_id' => $data['lead_id'],
                    'user_id' => $this->userId  // Agregamos el user_id en el debug
            ]
        ];

    } catch (Exception $e) {
        $this->conn->rollBack();
        error_log("Error en addActivity: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw $e;
    }
}

// Dentro de LeadsController
public function toggleFavorite($leadId) {
    try {
        // Validar el ID del lead
        $leadId = filter_var($leadId, FILTER_VALIDATE_INT);
        if (!$leadId) {
            throw new Exception('ID de lead no válido');
        }

        // Primero verificar si el lead existe y pertenece al usuario
        $checkQuery = "
            SELECT 1 
            FROM property_leads pl
            JOIN properties p ON pl.property_id = p.id
            WHERE pl.id = :lead_id AND p.user_id = :user_id
        ";
        
        $checkStmt = $this->conn->prepare($checkQuery);
        $checkStmt->execute([
            ':lead_id' => $leadId,
            ':user_id' => $this->userId
        ]);

        if ($checkStmt->rowCount() === 0) {
            throw new Exception('Lead no encontrado o sin permisos para modificar');
        }

        // Realizar el toggle
        $query = "
            UPDATE property_leads 
            SET 
                is_favorite = NOT is_favorite,
                updated_at = NOW()
            WHERE id = :lead_id
        ";
        
        $stmt = $this->conn->prepare($query);
        $result = $stmt->execute([':lead_id' => $leadId]);

        if (!$result) {
            throw new Exception('Error al actualizar el estado de favorito');
        }

        // Obtener el nuevo estado
        $newStateQuery = "SELECT is_favorite FROM property_leads WHERE id = :lead_id";
        $newStateStmt = $this->conn->prepare($newStateQuery);
        $newStateStmt->execute([':lead_id' => $leadId]);
        $newState = $newStateStmt->fetchColumn();

        return [
            'status' => 'success',
            'message' => 'Estado de favorito actualizado correctamente',
            'is_favorite' => (bool)$newState
        ];

    } catch (Exception $e) {
        error_log("Error en toggleFavorite: " . $e->getMessage());
        throw $e;
    }
}

    public function deleteLead($leadId) {
        try {
            error_log("Iniciando deleteLead para lead ID: " . $leadId);

            $this->conn->beginTransaction();

            // Verificar permisos
            $checkQuery = "
                SELECT 1 
                FROM property_leads pl
                JOIN properties p ON pl.property_id = p.id
                WHERE pl.id = :lead_id 
                AND p.user_id = :user_id
            ";
            
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->execute([
                ':lead_id' => $leadId,
                ':user_id' => $this->userId
            ]);

            if ($checkStmt->rowCount() === 0) {
                error_log("Intento de eliminar lead sin autorización");
                throw new Exception('No autorizado para eliminar este lead');
            }

            // Eliminar actividades
            $deleteActivitiesQuery = "DELETE FROM lead_activities WHERE lead_id = :lead_id";
            $deleteActivitiesStmt = $this->conn->prepare($deleteActivitiesQuery);
            $activitiesResult = $deleteActivitiesStmt->execute([':lead_id' => $leadId]);

            error_log("Actividades eliminadas: " . $deleteActivitiesStmt->rowCount());

            // Eliminar el lead
            $deleteLeadQuery = "DELETE FROM property_leads WHERE id = :lead_id";
            $deleteLeadStmt = $this->conn->prepare($deleteLeadQuery);
            $leadResult = $deleteLeadStmt->execute([':lead_id' => $leadId]);

            error_log("Resultado de eliminación de lead: " . ($leadResult ? 'éxito' : 'fallo'));

            $this->conn->commit();
            return [
                'status' => 'success',
                'message' => 'Lead eliminado correctamente',
                'debug' => [
                    'activities_deleted' => $deleteActivitiesStmt->rowCount(),
                    'lead_deleted' => $deleteLeadStmt->rowCount()
                ]
            ];

        } catch (Exception $e) {
            $this->conn->rollBack();
            error_log("Error en deleteLead: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw $e;
        }
    }
}

// Procesar la solicitud
try {
    error_log("Iniciando procesamiento de solicitud");
    
    $db = new Database();
    $leadsController = new LeadsController($db->getConnection(), $_SESSION['user_id']);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        error_log("Procesando solicitud GET");
        // Obtener leads con mejor manejo de valores nulos
        $filters = [
            'source' => isset($_GET['source']) && $_GET['source'] !== 'null' ? $_GET['source'] : null,
            'status' => isset($_GET['status']) && $_GET['status'] !== 'null' ? $_GET['status'] : null,
            'search' => $_GET['search'] ?? '',
            'order' => $_GET['order'] ?? null
        ];
        
        $response = $leadsController->getLeads($filters);
    }
    else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        error_log("Procesando solicitud POST");
        $postData = json_decode(file_get_contents('php://input'), true);
        error_log("Datos POST recibidos: " . print_r($postData, true));
        
        if (isset($postData['action'])) {
            $response = match($postData['action']) {
                'add_activity' => $leadsController->addActivity($postData),
                'toggle_favorite' => $leadsController->toggleFavorite($postData['lead_id']),
                'delete_lead' => $leadsController->deleteLead($postData['lead_id']),
                default => throw new Exception('Acción no válida')
            };
        } else {
            throw new Exception('Acción no especificada');
        }
    }
    else {
        throw new Exception('Método no permitido');
    }
    
    error_log("Enviando respuesta: " . print_r($response, true));
    echo json_encode($response);

} catch (Exception $e) {
    error_log("Error en get_leads.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error al procesar la solicitud',
        'debug' => [
            'error' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
}
?>