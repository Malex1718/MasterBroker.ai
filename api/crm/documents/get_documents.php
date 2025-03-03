<?php
session_start();
require_once '../../../vendor/autoload.php';
require_once '../../config/database.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $userId = $_SESSION['user_id'];
    
    // Obtener el ID del lead de la URL
    $leadId = isset($_GET['lead_id']) ? (int)$_GET['lead_id'] : null;
    
    if (!$leadId) {
        throw new Exception('ID de lead requerido');
    }
    
    // Verificar si ya existe una carpeta para este lead
    $stmtFolder = $db->prepare("SELECT * FROM lead_document_folders WHERE lead_id = :leadId");
    $stmtFolder->execute(['leadId' => $leadId]);
    $folderData = $stmtFolder->fetch(PDO::FETCH_ASSOC);
    
    // Obtener documentos del lead
    $stmtDocs = $db->prepare("SELECT * FROM lead_documents WHERE lead_id = :leadId ORDER BY created_at DESC");
    $stmtDocs->execute(['leadId' => $leadId]);
    $documents = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'folder' => $folderData ?: null,
        'documents' => $documents ?: []
    ]);
    
} catch (Exception $e) {
    error_log("Error al listar documentos: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener documentos: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database)) {
        $database->closeConnection();
    }
}