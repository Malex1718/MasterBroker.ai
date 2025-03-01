
<?php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Consulta principal para obtener datos del usuario y su perfil
    $query = "SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.mobile,
        u.role_id,
        rep.business_name,
        rep.tax_id,
        rep.fiscal_condition_id,
        rep.company_logo,
        fc.name as fiscal_condition_name
    FROM users u
    LEFT JOIN real_estate_profiles rep ON u.id = rep.user_id
    LEFT JOIN fiscal_conditions fc ON rep.fiscal_condition_id = fc.id
    WHERE u.id = :userId";

    $stmt = $db->prepare($query);
    $stmt->execute(['userId' => $userId]);
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    // Si el usuario tiene un rol que requiere condición fiscal, obtener lista de opciones
    if (in_array($userData['role_id'], [2, 3, 4, 5])) {
        $fiscalQuery = "SELECT id, name, code FROM fiscal_conditions ORDER BY name";
        $stmt = $db->prepare($fiscalQuery);
        $stmt->execute();
        $fiscalConditions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $userData['fiscal_conditions'] = $fiscalConditions;
    }

    if ($userData) {
        echo json_encode([
            'success' => true,
            'data' => $userData
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Usuario no encontrado'
        ]);
    }

} catch (Exception $e) {
    error_log("Error en get_user_data.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al procesar la solicitud'
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}