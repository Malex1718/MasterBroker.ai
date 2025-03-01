<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

require_once '../config/database.php';

class PropertyTrackingAPI {
    private $conn;
    private $viewer_hash;
    
    public function __construct($db) {
        $this->conn = $db;
        $this->viewer_hash = $this->generateViewerHash();
    }
    
    public function handleRequest() {
        try {
            if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
                return $this->sendResponse('success', 'Preflight OK');
            }

            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Método no permitido');
            }

            $inputData = file_get_contents('php://input');
            error_log("Received raw input: " . $inputData);

            $data = json_decode($inputData, true);
            if (!$data) {
                throw new Exception('Datos inválidos: ' . json_last_error_msg());
            }

            error_log("Decoded data: " . print_r($data, true));

            if (!isset($data['property_id'])) {
                throw new Exception('ID de propiedad requerido');
            }

            if (!isset($data['type']) || !in_array($data['type'], ['view', 'exposure'])) {
                throw new Exception('Tipo de tracking inválido');
            }

            switch ($data['type']) {
                case 'view':
                    return $this->trackView($data);
                case 'exposure':
                    return $this->trackExposure($data);
                default:
                    throw new Exception('Tipo de tracking no soportado');
            }
        } catch (Exception $e) {
            error_log("Error en PropertyTrackingAPI: " . $e->getMessage());
            return $this->sendResponse('error', $e->getMessage());
        }
    }

    private function trackView($data) {
        try {
            if (!$this->validateProperty($data['property_id'])) {
                throw new Exception('Propiedad no válida o inactiva');
            }

            $userId = $_SESSION['user_id'] ?? null;
            $viewerHash = $userId ? null : $this->viewer_hash;

            // Verificar vista existente
            $existingView = $this->getExistingView($data['property_id'], $userId, $viewerHash);

            if ($existingView) {
                $this->updateExistingView($existingView['id'], $data);
            } else {
                $this->insertNewView($data, $userId, $viewerHash);
            }

            $this->updateViewStats($data['property_id']);
            return $this->sendResponse('success', 'Vista registrada correctamente');

        } catch (Exception $e) {
            error_log("Error en trackView: " . $e->getMessage());
            throw new Exception('Error al registrar la vista');
        }
    }

    private function trackExposure($data) {
        try {
            if (!$this->validateProperty($data['property_id'])) {
                throw new Exception('Propiedad no válida o inactiva');
            }

            if (!$this->validatePaginationData($data)) {
                throw new Exception('Datos de paginación inválidos');
            }

            // Procesar los filtros de búsqueda
            error_log("Processing search filters: " . print_r($data['search_filters'] ?? [], true));

            $searchFilters = [];
            if (isset($data['search_filters'])) {
                // Si los filtros vienen como string JSON, decodificarlos
                if (is_string($data['search_filters'])) {
                    $searchFilters = json_decode($data['search_filters'], true) ?? [];
                } else {
                    $searchFilters = $data['search_filters'];
                }

                // Procesar y validar los filtros
                $processedFilters = [];
                
                // Procesar operation_type
                if (isset($searchFilters['operation_type'])) {
                    $processedFilters['operation_type'] = intval($searchFilters['operation_type']);
                }

                // Procesar property_variant
                if (isset($searchFilters['property_variant'])) {
                    if (is_array($searchFilters['property_variant'])) {
                        $processedFilters['property_variant'] = array_map('intval', $searchFilters['property_variant']);
                    } else {
                        $processedFilters['property_variant'] = intval($searchFilters['property_variant']);
                    }
                }

                // Procesar precios
                if (isset($searchFilters['price_min'])) {
                    $processedFilters['price_min'] = floatval($searchFilters['price_min']);
                }
                if (isset($searchFilters['price_max'])) {
                    $processedFilters['price_max'] = floatval($searchFilters['price_max']);
                }

                // Procesar superficie
                if (isset($searchFilters['surface_min'])) {
                    $processedFilters['surface_min'] = floatval($searchFilters['surface_min']);
                }
                if (isset($searchFilters['surface_max'])) {
                    $processedFilters['surface_max'] = floatval($searchFilters['surface_max']);
                }

                // Procesar habitaciones y baños
                if (isset($searchFilters['bedrooms'])) {
                    $processedFilters['bedrooms'] = intval($searchFilters['bedrooms']);
                }
                if (isset($searchFilters['bathrooms'])) {
                    $processedFilters['bathrooms'] = intval($searchFilters['bathrooms']);
                }

                $searchFilters = $processedFilters;
            }

            // Obtener información del usuario
            $userId = $_SESSION['user_id'] ?? null;
            $userInfo = $this->getUserInfo($userId);

            // Preparar datos de sesión
            $sessionData = [
                'viewer_hash' => $this->viewer_hash,
                'session_id' => session_id(),
                'device_type' => $this->detectDeviceType(),
                'platform' => $this->detectPlatform(),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'],
                'ip_address' => $_SERVER['REMOTE_ADDR'],
                'referrer' => $_SERVER['HTTP_REFERER'] ?? null,
                'applied_filters' => $searchFilters
            ];

            error_log("Final search filters: " . print_r($searchFilters, true));
            error_log("Session data: " . print_r($sessionData, true));

            // Insertar el registro de exposición
            $stmt = $this->conn->prepare("
                INSERT INTO property_exposure_logs (
                    property_id, search_query, search_filters,
                    page_number, position, total_results, logged_at,
                    user_id, user_role, user_email, session_data
                ) VALUES (
                    :property_id, :search_query, :search_filters,
                    :page_number, :position, :total_results, CURRENT_TIMESTAMP,
                    :user_id, :user_role, :user_email, :session_data
                )
            ");

            $params = [
                ':property_id' => $data['property_id'],
                ':search_query' => $this->sanitizeSearchQuery($data['search_query'] ?? ''),
                ':search_filters' => json_encode($searchFilters, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':page_number' => min(max(1, intval($data['page_number'] ?? 1)), 1000),
                ':position' => min(max(1, intval($data['position'] ?? 1)), 100),
                ':total_results' => min(max(0, intval($data['total_results'] ?? 0)), 10000),
                ':user_id' => $userInfo ? $userInfo['id'] : null,
                ':user_role' => $userInfo ? $userInfo['role_code'] : null,
                ':user_email' => $userInfo ? $userInfo['email'] : null,
                ':session_data' => json_encode($sessionData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ];

            error_log("SQL Parameters: " . print_r($params, true));

            $stmt->execute($params);

            return $this->sendResponse('success', 'Exposición registrada correctamente');
        } catch (Exception $e) {
            error_log("Error en trackExposure: " . $e->getMessage());
            throw new Exception('Error al registrar la exposición: ' . $e->getMessage());
        }
    }

    private function validateProperty($propertyId) {
        $stmt = $this->conn->prepare("
            SELECT id FROM properties 
            WHERE id = ? AND is_active = 1
        ");
        $stmt->execute([$propertyId]);
        return (bool)$stmt->fetch();
    }

    private function getExistingView($propertyId, $userId, $viewerHash) {
        $stmt = $this->conn->prepare("
            SELECT id, view_count 
            FROM property_views 
            WHERE property_id = ? 
            AND (
                (viewer_id = ? AND viewer_id IS NOT NULL) OR 
                (viewer_hash = ? AND viewer_hash IS NOT NULL)
            )
            AND viewed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY id DESC 
            LIMIT 1
        ");
        $stmt->execute([$propertyId, $userId, $viewerHash]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function updateExistingView($viewId, $data) {
        $stmt = $this->conn->prepare("
            UPDATE property_views 
            SET view_count = view_count + 1,
                last_viewed_at = CURRENT_TIMESTAMP,
                view_duration = COALESCE(:view_duration, view_duration),
                interaction_type = COALESCE(:interaction_type, interaction_type)
            WHERE id = :id
        ");
        
        return $stmt->execute([
            ':id' => $viewId,
            ':view_duration' => $data['view_duration'] ?? null,
            ':interaction_type' => $data['interaction_type'] ?? 'brief'
        ]);
    }

    private function insertNewView($data, $userId, $viewerHash) {
        $stmt = $this->conn->prepare("
            INSERT INTO property_views (
                property_id, viewer_id, viewer_hash, ip_address,
                user_agent, session_id, referrer, device_type,
                view_duration, interaction_type, is_authenticated,
                client_data, session_data
            ) VALUES (
                :property_id, :viewer_id, :viewer_hash, :ip_address,
                :user_agent, :session_id, :referrer, :device_type,
                :view_duration, :interaction_type, :is_authenticated,
                :client_data, :session_data
            )
        ");

        $clientData = [
            'screen_resolution' => $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? null,
            'language' => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null,
            'timezone' => $data['timezone'] ?? null,
            'platform' => $this->detectPlatform()
        ];

        $sessionData = [
            'origin' => $data['origin'] ?? null,
            'search_id' => $data['search_id'] ?? null,
            'referrer_page' => $data['referrer_page'] ?? null
        ];

        return $stmt->execute([
            ':property_id' => $data['property_id'],
            ':viewer_id' => $userId,
            ':viewer_hash' => $viewerHash,
            ':ip_address' => $_SERVER['REMOTE_ADDR'],
            ':user_agent' => $_SERVER['HTTP_USER_AGENT'],
            ':session_id' => session_id(),
            ':referrer' => $data['referrer'] ?? $_SERVER['HTTP_REFERER'] ?? null,
            ':device_type' => $this->detectDeviceType(),
            ':view_duration' => $data['view_duration'] ?? null,
            ':interaction_type' => $data['interaction_type'] ?? 'brief',
            ':is_authenticated' => $userId ? 1 : 0,
            ':client_data' => json_encode($clientData),
            ':session_data' => json_encode($sessionData)
        ]);
    }

    private function getUserInfo($userId) {
        if (!$userId) return null;

        $stmt = $this->conn->prepare("
            SELECT u.id, u.email, u.role_id, r.code as role_code
            FROM users u
            JOIN user_roles r ON u.role_id = r.id
            WHERE u.id = ?
        ");
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function validatePaginationData($data) {
        $pageNumber = intval($data['page_number'] ?? 1);
        $position = intval($data['position'] ?? 0);
        $totalResults = intval($data['total_results'] ?? 0);

        if ($pageNumber < 1 || $pageNumber > 1000) return false;
        if ($position < 1 || $position > 100) return false;
        if ($totalResults < 0 || $totalResults > 10000) return false;
        if ($position > $totalResults) return false;

        return true;
    }

    private function sanitizeSearchQuery($query) {
        $query = substr(trim($query), 0, 255);
        return preg_replace('/[^a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]/u', '', $query);
    }

    private function updateViewStats($propertyId) {
        try {
            $stmt = $this->conn->prepare("CALL update_property_view_stats(?)");
            $stmt->execute([$propertyId]);
        } catch (Exception $e) {
            error_log("Error en updateViewStats: " . $e->getMessage());
        }
    }

    private function detectDeviceType() {
        $userAgent = strtolower($_SERVER['HTTP_USER_AGENT']);
        
        if (preg_match('/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i', $userAgent)) {
            return 'tablet';
        }
        
        if (preg_match('/(up.browser|up.link|mmp|symbian|smartphone|midp|wap|phone|android|iemobile)/i', $userAgent)) {
            return 'mobile';
        }
        
        return 'desktop';
    }

    private function detectPlatform() {
        $userAgent = $_SERVER['HTTP_USER_AGENT'];
        
        if (preg_match('/linux/i', $userAgent)) return 'linux';
        if (preg_match('/macintosh|mac os x/i', $userAgent)) return 'mac';
        if (preg_match('/windows|win32/i', $userAgent)) return 'windows';
        if (preg_match('/android/i', $userAgent)) return 'android';
        if (preg_match('/iphone|ipad|ipod/i', $userAgent)) return 'ios';
        
        return 'unknown';
    }

    private function generateViewerHash() {
        $components = [
            $_SERVER['HTTP_USER_AGENT'] ?? '',
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''
        ];
        
        return hash('sha256', implode('|', $components));
    }

    private function processSearchFilters($searchFilters) {
        if (empty($searchFilters)) {
            return [];
        }
    
        // Si es string, intentar decodificar
        if (is_string($searchFilters)) {
            $decodedFilters = json_decode($searchFilters, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("Error decodificando filtros: " . json_last_error_msg());
                return [];
            }
            $searchFilters = $decodedFilters;
        }
    
        // Procesar y validar cada filtro
        $processedFilters = [];
        foreach ($searchFilters as $key => $value) {
            if (!empty($value)) {
                $processedFilters[$key] = $value;
            }
        }
    
        return $processedFilters;
    }

    private function sendResponse($status, $message, $data = null) {
        $response = [
            'status' => $status,
            'message' => $message
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        return $response;
    }
}

// Inicialización y manejo de la petición
try {
    if (!session_id()) {
        session_start();
    }
    
    // Habilitar el modo debug
    define('DEBUG_MODE', true);
    
    $database = new Database();
    $api = new PropertyTrackingAPI($database->getConnection());
    
    $result = $api->handleRequest();

    // Asegurarse de que no haya salida antes de los headers
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Error crítico en API: " . $e->getMessage());
    
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
        header('HTTP/1.1 500 Internal Server Error');
    }
    
    echo json_encode([
        'status' => 'error',
        'message' => 'Error interno del servidor',
        'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $e->getMessage() : null
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

function debug_log($message, $data = null) {
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log(sprintf(
            "[PropertyTrackingAPI] %s | Data: %s",
            $message,
            $data ? json_encode($data, JSON_UNESCAPED_UNICODE) : 'None'
        ));
    }
}
?>