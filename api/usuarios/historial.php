<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Configuración de errores y logging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/activity_history.log');

// Log inicial de headers y datos recibidos
$headers = getallheaders();
error_log("Headers recibidos: " . print_r($headers, true));

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
   http_response_code(200);
   exit();
}

// Obtener el ID de usuario del header de autorización
$authHeader = $headers['Authorization'] ?? '';
$userId = null;

if (preg_match('/Bearer\s+(\d+)/', $authHeader, $matches)) {
   $userId = $matches[1];
}

error_log("Auth Header: " . $authHeader);
error_log("USER ID extraído: " . print_r($userId, true));

require_once '../config/database.php';

class ActivityHistoryController {
   private $conn;
   private $userId;
   
   public function __construct($userId) {
       $this->userId = $userId;
       $database = new Database();
       $this->conn = $database->getConnection();
       $this->validateUser();
   }

   private function validateUser() {
       try {
           if (!$this->userId) {
               throw new Exception('Usuario no autenticado');
           }

           $query = "SELECT id FROM users 
                    WHERE id = :user_id 
                    AND is_active = 1";

           $stmt = $this->conn->prepare($query);
           $stmt->bindParam(":user_id", $this->userId);
           $stmt->execute();

           if ($stmt->rowCount() === 0) {
               throw new Exception('Usuario no encontrado o inactivo');
           }

           return true;
       } catch (PDOException $e) {
           error_log("Error en validación de usuario: " . $e->getMessage());
           throw new Exception('Error al validar usuario');
       }
   }

   public function getActivities($type = 'all', $page = 1, $limit = 10) {
    try {
        $offset = ($page - 1) * $limit;
        error_log("Obteniendo actividades - Type: $type, Page: $page, Limit: $limit");

        // Subconsultas para cada tipo de actividad
        $baseQuery = "
            WITH activity_data AS (
                SELECT
                    'view' as type,
                    pv.id,
                    NULL as reaction_type,
                    NULL as message,
                    NULL as folder,
                    CASE
                        WHEN pv.view_duration IS NULL THEN '0 segundos'
                        WHEN pv.view_duration < 60 THEN CONCAT(pv.view_duration, ' segundos')
                        WHEN pv.view_duration < 3600 THEN CONCAT(FLOOR(pv.view_duration/60), ' minutos')
                        ELSE CONCAT(FLOOR(pv.view_duration/3600), ' horas')
                    END as duration,
                    pv.viewed_at as date,
                    pv.property_id
                FROM property_views pv 
                WHERE pv.viewer_id = :user_id_view
                
                UNION ALL
                
                SELECT
                    'reaction' as type,
                    pr.id,
                    pr.reaction_type,
                    NULL as message,
                    NULL as folder,
                    NULL as duration,
                    pr.created_at as date,
                    pr.property_id
                FROM property_reactions pr
                WHERE pr.user_id = :user_id_reaction
                
                UNION ALL
                
                SELECT
                    'saved' as type,
                    sp.id,
                    NULL as reaction_type,
                    NULL as message,
                    sp.folder,
                    NULL as duration,
                    sp.created_at as date,
                    sp.property_id
                FROM saved_properties sp
                WHERE sp.user_id = :user_id_saved
                
                UNION ALL
                
                SELECT
                    'contact' as type,
                    pl.id,
                    NULL as reaction_type,
                    pl.message,
                    NULL as folder,
                    NULL as duration,
                    pl.created_at as date,
                    pl.property_id
                FROM property_leads pl
                WHERE pl.user_id = :user_id_lead
            )
            SELECT 
                ad.id,
                ad.type,
                ad.reaction_type as reactionType,
                ad.message,
                ad.folder as folderName,
                ad.duration,
                ad.date,
                p.title as propertyTitle,
                p.code as propertyCode,
                p.price,
                pi.file_path as thumbnail,
                COUNT(*) OVER() as total_records
            FROM activity_data ad
            JOIN properties p ON p.id = ad.property_id
            LEFT JOIN property_images pi ON p.id = pi.property_id AND pi.is_main = 1
            WHERE 1=1
        ";

        // Añadir filtros específicos según el tipo
        if ($type !== 'all') {
            if ($type === 'like' || $type === 'dislike') {
                $baseQuery .= " AND ad.type = 'reaction' AND ad.reaction_type = :reaction_type";
            } else {
                $baseQuery .= " AND ad.type = :activity_type";
            }
        }

        $baseQuery .= " ORDER BY ad.date DESC LIMIT :limit OFFSET :offset";

        error_log("Query: " . $baseQuery);
        
        $stmt = $this->conn->prepare($baseQuery);
        
        // Bind parameters básicos
        $stmt->bindValue(':user_id_view', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':user_id_reaction', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':user_id_saved', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':user_id_lead', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        // Bind parameters adicionales según el tipo de filtro
        if ($type !== 'all') {
            if ($type === 'like' || $type === 'dislike') {
                $stmt->bindValue(':reaction_type', $type, PDO::PARAM_STR);
            } else {
                $stmt->bindValue(':activity_type', $type, PDO::PARAM_STR);
            }
        }

        $stmt->execute();
        $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $totalRecords = $activities[0]['total_records'] ?? 0;

        foreach ($activities as &$activity) {
            unset($activity['total_records']);
        }

        error_log("Actividades encontradas: " . count($activities));

        return [
            'activities' => $activities,
            'pagination' => [
                'total' => (int)$totalRecords,
                'page' => (int)$page,
                'limit' => (int)$limit,
                'totalPages' => ceil($totalRecords / $limit)
            ]
        ];

    } catch (PDOException $e) {
        error_log("Error al obtener actividades: " . $e->getMessage());
        throw new Exception('Error al obtener el historial de actividades');
    }
}

   public function deleteActivity($activityId) {
    try {
        $this->conn->beginTransaction();
        error_log("Intentando eliminar actividad: $activityId");

        // Primero identificar el tipo de actividad y validar propiedad
        $checkQuery = "
            SELECT 
                CASE 
                    WHEN pv.id IS NOT NULL THEN 'view'
                    WHEN pr.id IS NOT NULL THEN 'reaction'
                    WHEN sp.id IS NOT NULL THEN 'saved'
                    WHEN pl.id IS NOT NULL THEN 'contact'
                END as activity_type,
                COALESCE(pv.id, pr.id, sp.id, pl.id) as real_id
            FROM (SELECT :aid as id) i
            LEFT JOIN property_views pv ON pv.id = i.id AND pv.viewer_id = :uid_view
            LEFT JOIN property_reactions pr ON pr.id = i.id AND pr.user_id = :uid_reaction
            LEFT JOIN saved_properties sp ON sp.id = i.id AND sp.user_id = :uid_saved
            LEFT JOIN property_leads pl ON pl.id = i.id AND pl.user_id = :uid_lead
        ";

        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bindValue(':aid', $activityId, PDO::PARAM_INT);
        $stmt->bindValue(':uid_view', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':uid_reaction', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':uid_saved', $this->userId, PDO::PARAM_INT);
        $stmt->bindValue(':uid_lead', $this->userId, PDO::PARAM_INT);
        $stmt->execute();

        $activity = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$activity || !$activity['activity_type']) {
            throw new Exception('No se encontró la actividad o no tienes permiso para eliminarla');
        }

        // Eliminar según el tipo
        $deleteQuery = match($activity['activity_type']) {
            'view' => "DELETE FROM property_views WHERE id = :id AND viewer_id = :user_id",
            'reaction' => "DELETE FROM property_reactions WHERE id = :id AND user_id = :user_id",
            'saved' => "DELETE FROM saved_properties WHERE id = :id AND user_id = :user_id",
            'contact' => "DELETE FROM property_leads WHERE id = :id AND user_id = :user_id",
            default => throw new Exception('Tipo de actividad no válido')
        };

        $stmt = $this->conn->prepare($deleteQuery);
        $stmt->bindValue(':id', $activity['real_id'], PDO::PARAM_INT);
        $stmt->bindValue(':user_id', $this->userId, PDO::PARAM_INT);
        $stmt->execute();

        $this->conn->commit();
        error_log("Actividad eliminada exitosamente");
        return true;

    } catch (PDOException $e) {
        $this->conn->rollBack();
        error_log("Error al eliminar actividad: " . $e->getMessage());
        throw new Exception('Error al eliminar la actividad');
    }
}
}

// Manejo principal de la solicitud
try {
   if (!$userId) {
       throw new Exception('Usuario no autenticado');
   }

   $controller = new ActivityHistoryController($userId);

   switch ($_SERVER['REQUEST_METHOD']) {
       case 'GET':
           $type = $_GET['type'] ?? 'all';
           $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
           $limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 10;

           $result = $controller->getActivities($type, $page, $limit);
           echo json_encode([
               'success' => true,
               'data' => $result['activities'],
               'pagination' => $result['pagination']
           ]);
           break;

       case 'DELETE':
           $input = json_decode(file_get_contents('php://input'), true);
           $activityId = $input['activity_id'] ?? null;

           if (!$activityId) {
               throw new Exception('ID de actividad requerido');
           }

           $controller->deleteActivity($activityId);
           echo json_encode([
               'success' => true,
               'message' => 'Actividad eliminada correctamente'
           ]);
           break;

       default:
           throw new Exception('Método no permitido');
   }

} catch (Exception $e) {
   $statusCode = 500;

   switch ($e->getMessage()) {
       case 'Usuario no autenticado':
       case 'Usuario no encontrado o inactivo':
           $statusCode = 401;
           break;
       case 'No se encontró la actividad o no tienes permiso para eliminarla':
           $statusCode = 403;
           break;
       case 'Método no permitido':
           $statusCode = 405;
           break;
   }

   http_response_code($statusCode);
   echo json_encode([
       'success' => false,
       'error' => $e->getMessage(),
       'debug' => [
           'timestamp' => date('Y-m-d H:i:s'),
           'request_method' => $_SERVER['REQUEST_METHOD'],
           'headers' => $headers,
           'auth_header' => $authHeader
       ]
   ]);

   error_log("Error en historial.php: " . $e->getMessage());
   error_log("Stack trace: " . $e->getTraceAsString());
}
?>