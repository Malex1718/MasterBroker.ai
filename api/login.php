<?php
// api/login.php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../api/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Obtener datos
    $data = json_decode(file_get_contents("php://input"), true) ?? $_POST;

    // Validar datos requeridos
    if (empty($data['email']) || empty($data['password'])) {
        throw new Exception("Email y contraseña son requeridos");
    }

    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $password = $data['password'];

    // Buscar usuario con todos los datos necesarios
    $stmt = $db->prepare("
        SELECT 
            u.id,
            u.password,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.mobile,
            u.is_active,
            u.email_verified,
            ur.code as user_type,
            rep.business_name,
            rep.tax_id
        FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        LEFT JOIN real_estate_profiles rep ON u.id = rep.user_id
        WHERE u.email = ?
    ");
    
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password'])) {
        throw new Exception("Credenciales inválidas");
    }

    if (!$user['is_active']) {
        throw new Exception("Esta cuenta está desactivada");
    }

    // Registrar inicio de sesión exitoso
    $stmt = $db->prepare("
        INSERT INTO login_history (
            user_id,
            ip_address,
            user_agent,
            status
        ) VALUES (?, ?, ?, 'success')
    ");
    
    $stmt->execute([
        $user['id'],
        $_SERVER['REMOTE_ADDR'],
        $_SERVER['HTTP_USER_AGENT']
    ]);

    // Actualizar último login
    $stmt = $db->prepare("
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $stmt->execute([$user['id']]);

    // Iniciar sesión
    session_start();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_type'] = $user['user_type'];
    $_SESSION['user_name'] = $user['first_name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['session_created_at'] = time(); // Agregar esta línea

    ini_set('session.gc_maxlifetime', 7 * 60 * 60); // 7 horas en segundos
    session_set_cookie_params(7 * 60 * 60); // 7 horas en segundos

    // Preparar respuesta con todos los datos necesarios
    $userData = [
        "id" => $user['id'],
        "first_name" => $user['first_name'],
        "last_name" => $user['last_name'] ?? '',
        "email" => $user['email'],
        "phone" => $user['phone'] ?? '',
        "mobile" => $user['mobile'] ?? '',
        "user_type" => $user['user_type'],
        "business_name" => $user['business_name'] ?? '',
        "tax_id" => $user['tax_id'] ?? ''
    ];

    // Generar respuesta
    echo json_encode([
        "success" => true,
        "message" => "Login exitoso",
        "user" => $userData
    ]);

} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>