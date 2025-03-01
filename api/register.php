<?php
// api/register.php

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
    
    // Obtener y sanitizar datos del POST
    $data = json_decode(file_get_contents("php://input"), true) ?? $_POST;

    // Validaciones básicas
    $requiredFields = ['user_type', 'email', 'password', 'first_name', 'mobile'];
    foreach ($requiredFields as $field) {
        if (empty($data[$field])) {
            throw new Exception("El campo $field es requerido");
        }
    }

    // Sanitizar datos
    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $userType = htmlspecialchars(strip_tags($data['user_type']));
    $firstName = htmlspecialchars(strip_tags($data['first_name']));
    $lastName = htmlspecialchars(strip_tags($data['last_name'] ?? ''));
    $phone = htmlspecialchars(strip_tags($data['phone'] ?? ''));
    $mobile = htmlspecialchars(strip_tags($data['mobile']));
    $password = $data['password'];

    // Validar email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception("Email no válido");
    }

    // Validar longitud de contraseña
    if (strlen($password) < 6) {
        throw new Exception("La contraseña debe tener al menos 6 caracteres");
    }

    // Verificar si el email ya existe
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        throw new Exception("Este correo electrónico ya está registrado");
    }

    // Obtener el ID del rol
    $stmt = $db->prepare("SELECT id FROM user_roles WHERE code = ?");
    $stmt->execute([$userType]);
    $role = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$role) {
        throw new Exception("Tipo de usuario no válido");
    }

    // Iniciar transacción
    $db->beginTransaction();

    // Insertar usuario base
    $stmt = $db->prepare("
        INSERT INTO users (
            role_id, email, password, first_name, last_name,
            phone, mobile, terms_accepted, is_active,
            email_verified
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, true, true,
            false
        )
    ");

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt->execute([
        $role['id'],
        $email,
        $hashedPassword,
        $firstName,
        $lastName,
        $phone,
        $mobile
    ]);

    $userId = $db->lastInsertId();

    // Manejar perfiles específicos según el tipo de usuario
    if ($userType !== 'Regular') {
        // Datos adicionales para usuarios profesionales
        $businessName = htmlspecialchars(strip_tags($data['business_name'] ?? ''));
        $fiscalCondition = $data['fiscal_condition'] ?? '';
        $taxId = htmlspecialchars(strip_tags($data['tax_id'] ?? ''));

        if (empty($businessName) || empty($fiscalCondition) || empty($taxId)) {
            throw new Exception("Los campos de información fiscal son requeridos");
        }

        // Obtener ID de la condición fiscal
        $stmt = $db->prepare("SELECT id FROM fiscal_conditions WHERE code = ?");
        $stmt->execute([$fiscalCondition]);
        $fiscalConditionId = $stmt->fetch(PDO::FETCH_ASSOC)['id'] ?? null;

        if (!$fiscalConditionId) {
            throw new Exception("Condición fiscal no válida");
        }

        // Insertar perfil profesional
        $stmt = $db->prepare("
            INSERT INTO real_estate_profiles (
                user_id, business_name, fiscal_condition_id, tax_id
            ) VALUES (?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $userId,
            $businessName,
            $fiscalConditionId,
            $taxId
        ]);
    } else {
        // Crear perfil de usuario regular
        $stmt = $db->prepare("INSERT INTO regular_user_profiles (user_id) VALUES (?)");
        $stmt->execute([$userId]);
    }

    // Confirmar transacción
    $db->commit();
    
    // Respuesta exitosa
    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Usuario registrado exitosamente",
        "user" => [
            "id" => $userId,
            "first_name" => $firstName,
            "last_name" => $lastName,
            "email" => $email,
            "phone" => $phone,
            "mobile" => $mobile,
            "user_type" => $userType
        ]
    ]);

} catch (Exception $e) {
    // Revertir transacción en caso de error
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>