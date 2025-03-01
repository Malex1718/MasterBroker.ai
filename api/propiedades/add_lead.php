<?php
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    // Validar datos requeridos
    $requiredFields = ['name', 'phone', 'property_id'];
    foreach ($requiredFields as $field) {
        if (empty($_POST[$field])) {
            throw new Exception("El campo {$field} es requerido");
        }
    }

    $db = new Database();
    $conn = $db->getConnection();

    // Validar que la propiedad existe
    $queryProperty = "
        SELECT p.id, u.mobile, u.phone, p.title, p.user_id 
        FROM properties p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = :property_id AND p.status = 'published'
    ";
    
    $stmtProperty = $conn->prepare($queryProperty);
    $stmtProperty->execute([':property_id' => $_POST['property_id']]);
    $propertyData = $stmtProperty->fetch(PDO::FETCH_ASSOC);

    if (!$propertyData) {
        throw new Exception("Propiedad no encontrada o no disponible");
    }

    // Iniciar transacción
    $conn->beginTransaction();

    try {
        // Insertar nuevo lead
        $query = "
            INSERT INTO property_leads (
                property_id,
                name,
                email,
                phone,
                country_code,
                source,
                contact_preference,
                status,
                message,
                created_at
            ) VALUES (
                :property_id,
                :name,
                :email,
                :phone,
                :country_code,
                :source,
                :contact_preference,
                'new',
                :message,
                NOW()
            )
        ";
        
        $stmt = $conn->prepare($query);
        $result = $stmt->execute([
            ':property_id' => $_POST['property_id'],
            ':name' => $_POST['name'],
            ':email' => $_POST['email'] ?? null,
            ':phone' => $_POST['phone'],
            ':country_code' => $_POST['country_code'] ?? '+52',
            ':source' => $_POST['source'] ?? 'web',
            ':contact_preference' => $_POST['contact_preference'] ?? $_POST['source'], // Usar source como preferencia por defecto
            ':message' => $_POST['message'] ?? null
        ]);

        if (!$result) {
            throw new Exception("Error al registrar el lead");
        }

        $leadId = $conn->lastInsertId();

        // Registrar actividad del lead
        $queryActivity = "
            INSERT INTO lead_activities (
                lead_id,
                user_id,
                activity_type,
                title,
                description,
                status,
                created_at
            ) VALUES (
                :lead_id,
                :user_id,
                :activity_type,
                :activity_title,
                :activity_description,
                'effective',
                NOW()
            )
        ";

        $stmtActivity = $conn->prepare($queryActivity);
        $resultActivity = $stmtActivity->execute([
            ':lead_id' => $leadId,
            ':user_id' => $propertyData['user_id'],
            ':activity_type' => $_POST['activity_type'] ?? 'first_contact',
            ':activity_title' => $_POST['activity_title'] ?? 'Solicitud de contacto telefónico',
            ':activity_description' => $_POST['activity_description'] ?? 'El usuario solicitó ser contactado por teléfono'
        ]);

        if (!$resultActivity) {
            throw new Exception("Error al registrar la actividad");
        }

        // Confirmar transacción
        $conn->commit();

        // Preparar respuesta
        echo json_encode([
            'status' => 'success',
            'message' => 'Lead creado correctamente',
            'data' => [
                'lead_id' => $leadId,
                'agent_phone' => $propertyData['mobile'] ?: $propertyData['phone'] ?: 'No disponible',
                'property_title' => $propertyData['title']
            ]
        ]);

    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $conn->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}

// Registrar log de la operación
$logMessage = date('Y-m-d H:i:s') . " - Lead creado - ID: " . ($leadId ?? 'error') . 
             " - Source: " . ($_POST['source'] ?? 'no definido') . 
             " - Property: " . ($_POST['property_id'] ?? 'no definido') . "\n";
error_log($logMessage, 3, __DIR__ . '/leads.log');
?>