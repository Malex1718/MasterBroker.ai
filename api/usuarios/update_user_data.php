<?php
// api/usuarios/update_user_data.php

session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

// Función para validar el request
function validateRequest($data) {
    if (empty($data['first_name'])) {
        throw new Exception('El nombre es requerido');
    }
}

// Función para obtener el perfil actual del usuario
function getCurrentProfile($db, $userId) {
    $query = "SELECT r.*, u.role_id 
              FROM users u 
              LEFT JOIN real_estate_profiles r ON u.id = r.user_id 
              WHERE u.id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

try {
    // Verificar autenticación
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('No autorizado');
    }

    // Obtener y decodificar datos
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Datos inválidos: ' . json_last_error_msg());
    }

    // Validar request
    validateRequest($data);

    // Inicializar conexión
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];

    // Iniciar transacción
    $db->beginTransaction();

    try {
        // Actualizar datos básicos del usuario
        $updateUserQuery = "UPDATE users SET 
            first_name = :firstName,
            last_name = :lastName,
            phone = :phone,
            mobile = :mobile,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = :userId";

        $stmt = $db->prepare($updateUserQuery);
        $userUpdateResult = $stmt->execute([
            'firstName' => $data['first_name'],
            'lastName' => $data['last_name'] ?? '',
            'phone' => $data['phone'] ?? null,
            'mobile' => $data['mobile'] ?? null,
            'userId' => $userId
        ]);

        if (!$userUpdateResult) {
            throw new Exception('Error al actualizar datos de usuario');
        }

        // Obtener información actual del usuario
        $currentProfile = getCurrentProfile($db, $userId);

        // Si es un rol que requiere perfil inmobiliario
        if (in_array($currentProfile['role_id'], [2, 3, 4, 5])) {
            if ($currentProfile) {
                // Actualizar perfil existente
                $updateProfileQuery = "UPDATE real_estate_profiles SET 
                    business_name = :businessName,
                    tax_id = :taxId,
                    updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = :userId";

                $stmt = $db->prepare($updateProfileQuery);
                $profileUpdateResult = $stmt->execute([
                    'businessName' => $data['business_name'] ?? null,
                    'taxId' => $data['tax_id'] ?? null,
                    'userId' => $userId
                ]);

                if (!$profileUpdateResult) {
                    throw new Exception('Error al actualizar perfil inmobiliario');
                }
            } else {
                // Insertar nuevo perfil
                $insertProfileQuery = "INSERT INTO real_estate_profiles 
                    (user_id, business_name, tax_id, fiscal_condition_id) 
                    VALUES (:userId, :businessName, :taxId, :fiscalConditionId)";

                // Determinar condición fiscal basada en el rol
                $fiscalConditionId = match($currentProfile['role_id']) {
                    2 => 1, // CURP para particulares
                    3, 4 => 2, // RFC Persona Moral para inmobiliarias y constructoras
                    5 => 3, // RFC Persona Física para corredores
                    default => 1
                };

                $stmt = $db->prepare($insertProfileQuery);
                $profileInsertResult = $stmt->execute([
                    'userId' => $userId,
                    'businessName' => $data['business_name'] ?? null,
                    'taxId' => $data['tax_id'] ?? null,
                    'fiscalConditionId' => $fiscalConditionId
                ]);

                if (!$profileInsertResult) {
                    throw new Exception('Error al crear perfil inmobiliario');
                }
            }
        }

        // Confirmar transacción
        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Datos actualizados correctamente'
        ]);

    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error en update_user_data.php: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}