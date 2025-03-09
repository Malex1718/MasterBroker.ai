<?php
// Habilitar CORS
header("Access-Control-Allow-Origin: https://masterbroker.ai"); 
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

date_default_timezone_set('America/Mexico_City');
ini_set('date.timezone', 'America/Mexico_City');

// Manejo de preflight request (OPTIONS):
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Iniciar sesión de PHP
session_start();

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

// Incluir la clase de base de datos
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

switch ($method) {
    case 'GET':
        // Obtener notas para un lead específico o detalles de una nota específica
        if (isset($_GET['lead_id'])) {
            $leadId = $_GET['lead_id'];
            
            try {
                $sql = "SELECT ln.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
                        FROM lead_notes ln
                        LEFT JOIN users u ON ln.user_id = u.id
                        WHERE ln.lead_id = :lead_id
                        ORDER BY ln.created_at DESC";
                        
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':lead_id' => $leadId]);
                $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

                sendJson([
                    "success" => true,
                    "notes" => $notes
                ]);
            } catch (Exception $e) {
                sendJson([
                    "success" => false,
                    "message" => "Error al obtener notas: " . $e->getMessage()
                ], 500);
            }
        } elseif (isset($_GET['note_id'])) {
            $noteId = $_GET['note_id'];
            
            try {
                $sql = "SELECT ln.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
                        FROM lead_notes ln
                        LEFT JOIN users u ON ln.user_id = u.id
                        WHERE ln.id = :note_id";
                        
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':note_id' => $noteId]);
                $note = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($note) {
                    sendJson([
                        "success" => true,
                        "note" => $note
                    ]);
                } else {
                    sendJson([
                        "success" => false,
                        "message" => "Nota no encontrada"
                    ], 404);
                }
            } catch (Exception $e) {
                sendJson([
                    "success" => false,
                    "message" => "Error al obtener nota: " . $e->getMessage()
                ], 500);
            }
        } else {
            sendJson([
                "success" => false,
                "message" => "Falta el parámetro lead_id o note_id"
            ], 400);
        }
        break;

    case 'POST':
        // Crear una nueva nota
        $postData = json_decode(file_get_contents("php://input"), true);
        if (!$postData || !isset($postData['lead_id']) || !isset($postData['content'])) {
            sendJson(["success" => false, "message" => "Datos incompletos"], 400);
        }

        try {
            $pdo->beginTransaction();

            $sql = "INSERT INTO lead_notes 
                    (lead_id, user_id, title, content, created_at)
                    VALUES
                    (:lead_id, :user_id, :title, :content, NOW())";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':lead_id' => $postData['lead_id'],
                ':user_id' => $_SESSION['user_id'],
                ':title' => $postData['title'] ?? null,
                ':content' => $postData['content']
            ]);

            $newId = $pdo->lastInsertId();

            // Actualizar la fecha de última actividad del lead
            $updateLeadSql = "UPDATE property_leads SET last_activity_date = NOW() WHERE id = :lead_id";
            $updateLeadStmt = $pdo->prepare($updateLeadSql);
            $updateLeadStmt->execute([':lead_id' => $postData['lead_id']]);

            $pdo->commit();

            sendJson([
                "success" => true,
                "message" => "Nota creada correctamente",
                "data" => [
                    "id" => $newId
                ]
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendJson(["success" => false, "message" => $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        // Actualizar una nota existente
        $putData = json_decode(file_get_contents("php://input"), true);
        if (!$putData || !isset($putData['id']) || !isset($putData['content'])) {
            sendJson(["success" => false, "message" => "Datos incompletos"], 400);
        }

        try {
            $pdo->beginTransaction();

            // Verificar si la nota existe y pertenece al usuario actual
            $checkSql = "SELECT * FROM lead_notes WHERE id = :id";
            $checkStmt = $pdo->prepare($checkSql);
            $checkStmt->execute([':id' => $putData['id']]);
            $note = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$note) {
                throw new Exception("Nota no encontrada");
            }

            // Solo permitir al creador o administradores editar
            $isAdmin = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin';
            if ($note['user_id'] != $_SESSION['user_id'] && !$isAdmin) {
                throw new Exception("No tienes permisos para editar esta nota");
            }

            $sql = "UPDATE lead_notes 
                    SET title = :title, 
                        content = :content, 
                        updated_at = NOW()
                    WHERE id = :id";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':id' => $putData['id'],
                ':title' => $putData['title'] ?? null,
                ':content' => $putData['content']
            ]);

            $pdo->commit();

            sendJson([
                "success" => true,
                "message" => "Nota actualizada correctamente"
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendJson(["success" => false, "message" => $e->getMessage()], 500);
        }
        break;

    case 'DELETE':
        // Eliminar una nota
        $deleteData = json_decode(file_get_contents("php://input"), true);
        if (!$deleteData || !isset($deleteData['id'])) {
            sendJson(["success" => false, "message" => "Falta el ID de la nota"], 400);
        }

        try {
            $pdo->beginTransaction();

            // Verificar si la nota existe y pertenece al usuario actual
            $checkSql = "SELECT * FROM lead_notes WHERE id = :id";
            $checkStmt = $pdo->prepare($checkSql);
            $checkStmt->execute([':id' => $deleteData['id']]);
            $note = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$note) {
                throw new Exception("Nota no encontrada");
            }

            // Solo permitir al creador o administradores eliminar
            $isAdmin = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin';
            if ($note['user_id'] != $_SESSION['user_id'] && !$isAdmin) {
                throw new Exception("No tienes permisos para eliminar esta nota");
            }

            $sql = "DELETE FROM lead_notes WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':id' => $deleteData['id']]);

            $pdo->commit();

            sendJson([
                "success" => true,
                "message" => "Nota eliminada correctamente"
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendJson(["success" => false, "message" => $e->getMessage()], 500);
        }
        break;

    default:
        sendJson(["success" => false, "message" => "Método no permitido"], 405);
}

$database->closeConnection();
?>