<?php
// api/usuarios/upload_logo.php
session_start();
require_once '../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {
    // Verificar si se recibió el archivo
    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No se recibió el archivo correctamente');
    }

    $file = $_FILES['logo'];
    $userId = $_SESSION['user_id'];

    // Validar el tipo de archivo
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $fileInfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($fileInfo, $file['tmp_name']);
    finfo_close($fileInfo);

    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG, GIF y WebP');
    }

    // Validar tamaño (máximo 2MB)
    $maxSize = 2 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        throw new Exception('El archivo excede el tamaño máximo permitido (2MB)');
    }

    // Crear directorio de logos si no existe
    // Ruta absoluta al directorio de uploads
    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/logos/';
    
    // Verificar y crear el directorio si no existe
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            error_log("Error al crear directorio: " . $uploadDir);
            throw new Exception('Error al crear el directorio de logos');
        }
    }

    // Asegurarse de que el directorio tenga permisos correctos
    if (!is_writable($uploadDir)) {
        chmod($uploadDir, 0755);
        if (!is_writable($uploadDir)) {
            error_log("El directorio no tiene permisos de escritura: " . $uploadDir);
            throw new Exception('Error de permisos en el directorio de logos');
        }
    }

    // Generar nombre único para el archivo
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $newFileName = 'logo_' . uniqid() . '.' . $extension;
    $targetPath = $uploadDir . $newFileName;

    // Conectar a la base de datos
    $database = new Database();
    $db = $database->getConnection();

    // Comenzar transacción
    $db->beginTransaction();

    try {
        // Obtener el logo anterior
        $query = "SELECT company_logo FROM real_estate_profiles WHERE user_id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$userId]);
        $oldLogo = $stmt->fetchColumn();

        // Intentar mover el archivo subido
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            error_log("Error al mover archivo: " . $file['tmp_name'] . " a " . $targetPath);
            throw new Exception('Error al guardar el archivo');
        }

        // Verificar que el archivo se movió correctamente
        if (!file_exists($targetPath)) {
            throw new Exception('Error al verificar el archivo guardado');
        }

        // Actualizar la base de datos
        $updateQuery = "UPDATE real_estate_profiles 
                       SET company_logo = ?, 
                           updated_at = CURRENT_TIMESTAMP 
                       WHERE user_id = ?";
        
        $stmt = $db->prepare($updateQuery);
        if (!$stmt->execute([$newFileName, $userId])) {
            // Si falla la actualización, eliminar el archivo subido
            @unlink($targetPath);
            throw new Exception('Error al actualizar la base de datos');
        }

        // Si todo fue exitoso, eliminar el logo anterior
        if ($oldLogo && file_exists($uploadDir . $oldLogo)) {
            @unlink($uploadDir . $oldLogo);
        }

        // Confirmar transacción
        $db->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Logo actualizado correctamente',
            'logoUrl' => '/uploads/logos/' . $newFileName
        ]);

    } catch (Exception $e) {
        // Revertir los cambios en la base de datos
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        
        // Limpiar cualquier archivo subido en caso de error
        if (file_exists($targetPath)) {
            @unlink($targetPath);
        }
        
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error en upload_logo.php: " . $e->getMessage());
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