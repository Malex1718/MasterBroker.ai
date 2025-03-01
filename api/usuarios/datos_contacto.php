<?php
// api/usuarios/datos_contacto.php

require_once __DIR__ . '/../config/database.php';
header('Content-Type: application/json');

try {
    // Iniciar o reanudar la sesión
    session_start();
    
    // Verificar si el usuario está autenticado
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Usuario no autenticado');
    }

    $userId = $_SESSION['user_id'];
    $database = new Database();
    $conn = $database->getConnection();

    // Consulta base para obtener los datos del usuario
    $query = "
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.mobile,
            ur.code as role_code,
            CASE 
                WHEN rep.id IS NOT NULL THEN 'real_estate'
                ELSE 'regular'
            END as profile_type,
            rep.business_name,
            rep.company_logo,
            fc.name as fiscal_condition
        FROM users u
        JOIN user_roles ur ON u.role_id = ur.id
        LEFT JOIN real_estate_profiles rep ON u.id = rep.user_id
        LEFT JOIN fiscal_conditions fc ON rep.fiscal_condition_id = fc.id
        WHERE u.id = :user_id
        AND u.is_active = 1";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
    $stmt->execute();

    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$userData) {
        throw new Exception('Usuario no encontrado');
    }

    // Procesar la imagen del logo si existe
    if ($userData['company_logo']) {
        // Asegurarse de que la ruta sea accesible desde el frontend
        $userData['company_logo'] = '/uploads/logos/' . $userData['company_logo'];
    } else {
        // Imagen por defecto
        $userData['company_logo'] = '/assets/img/vendedor.png';
    }

    // Formatear números de teléfono
    if ($userData['phone']) {
        $userData['phone'] = formatPhoneNumber($userData['phone']);
    }
    if ($userData['mobile']) {
        $userData['mobile'] = formatPhoneNumber($userData['mobile']);
    }

    // Determinar el nombre a mostrar
    $userData['display_name'] = $userData['business_name'] ?? 
                               $userData['first_name'] . ' ' . $userData['last_name'];

    // Preparar respuesta
    $response = [
        'success' => true,
        'user' => [
            'id' => $userData['id'],
            'first_name' => $userData['first_name'],
            'last_name' => $userData['last_name'],
            'email' => $userData['email'],
            'phone' => $userData['phone'],
            'mobile' => $userData['mobile'],
            'role_code' => $userData['role_code'],
            'profile_type' => $userData['profile_type'],
            'business_name' => $userData['business_name'],
            'company_logo' => $userData['company_logo'],
            'fiscal_condition' => $userData['fiscal_condition'],
            'display_name' => $userData['display_name']
        ]
    ];

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

/**
 * Función auxiliar para formatear números de teléfono
 * @param string $number
 * @return string
 */
function formatPhoneNumber($number) {
    // Eliminar todos los caracteres no numéricos
    $number = preg_replace('/[^0-9]/', '', $number);
    
    // Si el número tiene 10 dígitos, formatear como (XXX) XXX-XXXX
    if (strlen($number) === 10) {
        return sprintf('(%s) %s-%s',
            substr($number, 0, 3),
            substr($number, 3, 3),
            substr($number, 6)
        );
    }
    
    return $number;
}

// Cerrar la conexión
$database = null;