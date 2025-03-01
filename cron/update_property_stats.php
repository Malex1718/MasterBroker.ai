<?php
// /cron/update_property_stats.php

require_once __DIR__ . '/../api/config/database.php';

class PropertyStatsUpdater {
    private $conn;
    private $logPath;
    
    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
        $this->logPath = __DIR__ . '/../logs/property_stats/';
        
        // Asegurar que existe el directorio de logs
        if (!file_exists($this->logPath)) {
            mkdir($this->logPath, 0755, true);
        }
    }
    
    public function updateStats() {
        $startTime = microtime(true);
        $logData = [
            'start_time' => date('Y-m-d H:i:s'),
            'updates' => [],
            'errors' => []
        ];

        try {
            // Primero obtenemos las propiedades que necesitan actualización
            $propertiesToUpdate = $this->getPropertiesToUpdate();
            $logData['properties_found'] = count($propertiesToUpdate);

            foreach ($propertiesToUpdate as $propertyId) {
                try {
                    $this->updatePropertyStats($propertyId);
                    $logData['updates'][] = [
                        'property_id' => $propertyId,
                        'status' => 'success',
                        'timestamp' => date('Y-m-d H:i:s')
                    ];
                } catch (Exception $e) {
                    $logData['errors'][] = [
                        'property_id' => $propertyId,
                        'error' => $e->getMessage(),
                        'timestamp' => date('Y-m-d H:i:s')
                    ];
                }
            }

            $logData['execution_time'] = round(microtime(true) - $startTime, 2);
            $logData['status'] = 'completed';
            
        } catch (Exception $e) {
            $logData['status'] = 'failed';
            $logData['main_error'] = $e->getMessage();
            $logData['execution_time'] = round(microtime(true) - $startTime, 2);
        }

        // Guardar log
        $this->saveLog($logData);

        return $logData;
    }

    private function getPropertiesToUpdate() {
        try {
            // Obtener propiedades con actividad reciente o que no se han actualizado en la última hora
            $query = "
                SELECT DISTINCT property_id 
                FROM property_views 
                WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                OR property_id IN (
                    SELECT property_id 
                    FROM property_view_stats 
                    WHERE last_updated <= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                )";

            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) {
            throw new Exception("Error obteniendo propiedades para actualizar: " . $e->getMessage());
        }
    }

    private function updatePropertyStats($propertyId) {
        try {
            $query = "
                INSERT INTO property_view_stats (
                    property_id,
                    total_views,
                    unique_views,
                    registered_views,
                    anonymous_views,
                    last_view_at,
                    average_view_duration,
                    last_updated
                )
                SELECT 
                    ?,
                    COUNT(*) as total_views,
                    COUNT(DISTINCT viewer_hash) as unique_views,
                    SUM(IF(is_authenticated = 1, 1, 0)) as registered_views,
                    SUM(IF(is_authenticated = 0, 1, 0)) as anonymous_views,
                    MAX(viewed_at) as last_view_at,
                    COALESCE(AVG(NULLIF(view_duration, 0)), 0) as average_view_duration,
                    NOW()
                FROM property_views
                WHERE property_id = ?
                ON DUPLICATE KEY UPDATE
                    total_views = VALUES(total_views),
                    unique_views = VALUES(unique_views),
                    registered_views = VALUES(registered_views),
                    anonymous_views = VALUES(anonymous_views),
                    last_view_at = VALUES(last_view_at),
                    average_view_duration = VALUES(average_view_duration),
                    last_updated = NOW()";

            $stmt = $this->conn->prepare($query);
            $stmt->execute([$propertyId, $propertyId]);

            return true;
        } catch (Exception $e) {
            throw new Exception("Error actualizando estadísticas para propiedad $propertyId: " . $e->getMessage());
        }
    }

    private function saveLog($logData) {
        $logFile = $this->logPath . 'stats_update_' . date('Y-m-d') . '.log';
        $logEntry = date('Y-m-d H:i:s') . ' - ' . json_encode($logData) . "\n";
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }
}

// Script de ejecución
try {
    $updater = new PropertyStatsUpdater();
    $result = $updater->updateStats();

    if (php_sapi_name() === 'cli') {
        // Si se ejecuta desde la línea de comandos
        echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
    } else {
        // Si se ejecuta desde web
        header('Content-Type: application/json');
        echo json_encode($result);
    }
} catch (Exception $e) {
    $error = [
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if (php_sapi_name() === 'cli') {
        echo json_encode($error, JSON_PRETTY_PRINT) . "\n";
    } else {
        header('Content-Type: application/json');
        echo json_encode($error);
    }
}