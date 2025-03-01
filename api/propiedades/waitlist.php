<?php
// waitlist.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../api/config/database.php';

class WaitlistManager {
    private $conn;
    private $table = 'waitlist';

    public function __construct($db) {
        $this->conn = $db;
    }

    public function register($data) {
        try {
            // Verificar si el email ya existe
            $check_query = "SELECT COUNT(*) FROM " . $this->table . " WHERE email = :email";
            $check_stmt = $this->conn->prepare($check_query);
            $check_stmt->execute(['email' => $data['email']]);
            
            if ($check_stmt->fetchColumn() > 0) {
                return [
                    'success' => false,
                    'message' => 'Este email ya está registrado en la lista de espera'
                ];
            }

            // Preparar la consulta de inserción
            $query = "INSERT INTO " . $this->table . " 
                    (name, email, phone, user_type, status, registration_date, invite_token) 
                    VALUES 
                    (:name, :email, :phone, :user_type, 'pending', NOW(), UUID())";

            $stmt = $this->conn->prepare($query);

            // Sanitizar y vincular los valores
            $params = [
                'name' => strip_tags(trim($data['name'])),
                'email' => filter_var($data['email'], FILTER_SANITIZE_EMAIL),
                'phone' => isset($data['phone']) ? strip_tags(trim($data['phone'])) : '',
                'user_type' => strip_tags(trim($data['user_type']))
            ];

            // Ejecutar la consulta
            if ($stmt->execute($params)) {
                $id = $this->conn->lastInsertId();
                
                // Actualizar la posición
                $this->updatePositions();
                
                // Obtener la posición actual
                $position_query = "SELECT position FROM " . $this->table . " WHERE id = :id";
                $position_stmt = $this->conn->prepare($position_query);
                $position_stmt->execute(['id' => $id]);
                $position = $position_stmt->fetchColumn();

                return [
                    'success' => true,
                    'message' => '¡Registro exitoso!',
                    'data' => [
                        'id' => $id,
                        'position' => $position
                    ]
                ];
            }

            return [
                'success' => false,
                'message' => 'Error al registrar. Por favor, intenta nuevamente.'
            ];

        } catch (PDOException $e) {
            error_log("Error en registro de waitlist: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error en el servidor. Por favor, intenta más tarde.'
            ];
        }
    }

    private function updatePositions() {
        try {
            $this->conn->exec("SET @row_number = 0");
            $query = "UPDATE " . $this->table . " 
                     SET position = (@row_number:=@row_number + 1) 
                     WHERE status = 'pending' 
                     ORDER BY registration_date ASC";
            
            $this->conn->exec($query);
            return true;
        } catch (PDOException $e) {
            error_log("Error actualizando posiciones: " . $e->getMessage());
            return false;
        }
    }

    public function checkStatus($email) {
        try {
            $query = "SELECT position, status, registration_date 
                     FROM " . $this->table . " 
                     WHERE email = :email";
            
            $stmt = $this->conn->prepare($query);
            $stmt->execute(['email' => $email]);
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                return [
                    'success' => true,
                    'data' => $result
                ];
            }

            return [
                'success' => false,
                'message' => 'Email no encontrado en la lista de espera'
            ];
        } catch (PDOException $e) {
            error_log("Error verificando estado: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error verificando estado'
            ];
        }
    }
}

function validateRegistrationData($data) {
    // Verificar campos requeridos
    if (!isset($data['name']) || !isset($data['email']) || !isset($data['user_type'])) {
        return false;
    }

    // Validar email
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    // Validar tipo de usuario
    $valid_types = ['personal', 'business', 'developer'];
    if (!in_array($data['user_type'], $valid_types)) {
        return false;
    }

    // Validar longitud del nombre
    if (strlen($data['name']) < 2) {
        return false;
    }

    // Validar teléfono si está presente
    if (isset($data['phone']) && !empty($data['phone'])) {
        if (!preg_match('/^\d{10}$/', preg_replace('/\D/', '', $data['phone']))) {
            return false;
        }
    }

    return true;
}

// Inicializar la conexión a la base de datos
try {
    $database = new Database();
    $db = $database->getConnection();
    $waitlist = new WaitlistManager($db);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!validateRegistrationData($data)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Datos incompletos o inválidos'
            ]);
            exit;
        }

        $result = $waitlist->register($data);
        
        if ($result['success']) {
            http_response_code(201);
        } else {
            http_response_code(400);
        }
        
        echo json_encode($result);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (isset($_GET['email'])) {
            $result = $waitlist->checkStatus($_GET['email']);
        } else {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Se requiere un email para consultar el estado'
            ]);
            exit;
        }
        
        if ($result['success']) {
            http_response_code(200);
        } else {
            http_response_code(404);
        }
        
        echo json_encode($result);

    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Método no permitido'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en el servidor'
    ]);
    error_log("Error en waitlist: " . $e->getMessage());
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}
?>