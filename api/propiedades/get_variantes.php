<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    $query = "SELECT pv.id, pv.property_type_id, pv.name 
              FROM property_variants pv 
              ORDER BY pv.property_type_id, pv.name";
              
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $variants = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($variants);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error al cargar las variantes: " . $e->getMessage()
    ]);
} finally {
    $database->closeConnection();
}