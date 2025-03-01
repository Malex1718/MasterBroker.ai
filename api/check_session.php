<?php
// api/check_session.php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

session_start();

// Verificar si hay una sesión activa
if (isset($_SESSION['user_id'])) {
    // Verificar si la sesión ha expirado (7 horas)
    $sessionTimeout = 7 * 60 * 60; // 7 horas en segundos
    $currentTime = time();
    
    // Si existe la variable de tiempo de creación de la sesión
    if (isset($_SESSION['session_created_at'])) {
        if ($currentTime - $_SESSION['session_created_at'] > $sessionTimeout) {
            // La sesión ha expirado, destruirla
            session_unset();
            session_destroy();
            echo json_encode([
                "success" => false,
                "message" => "Sesión expirada",
                "is_active" => false
            ]);
            exit();
        }
    } else {
        // Si no existe la variable, la creamos ahora
        $_SESSION['session_created_at'] = $currentTime;
    }
    
    echo json_encode([
        "success" => true,
        "message" => "Sesión activa",
        "is_active" => true,
        "user_id" => $_SESSION['user_id'],
        "user_type" => $_SESSION['user_type'] ?? '',
        "expires_in" => ($_SESSION['session_created_at'] + $sessionTimeout) - $currentTime
    ]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "No hay sesión activa",
        "is_active" => false
    ]);
}
?>