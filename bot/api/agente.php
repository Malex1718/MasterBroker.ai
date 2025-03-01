<?php
// Prevenir cualquier salida antes de los headers
ob_start();

// Configuración inicial de errores
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Error handler personalizado
function jsonErrorHandler($errno, $errstr, $errfile, $errline) {
    $logger = new Logger(__DIR__ . '/debug_log.txt');
    $logger->log("PHP Error: [$errno] $errstr in $errfile on line $errline", 'ERROR');
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Internal Server Error',
        'debug_info' => [
            'error_type' => $errno,
            'error_message' => $errstr,
            'file' => basename($errfile),
            'line' => $errline
        ]
    ]);
    exit;
}
set_error_handler('jsonErrorHandler');

// Exception handler personalizado
function jsonExceptionHandler($e) {
    $logger = new Logger(__DIR__ . '/debug_log.txt');
    $logger->log("Uncaught Exception: " . $e->getMessage(), 'ERROR');
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'debug_info' => [
            'error_type' => get_class($e),
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ]
    ]);
    exit;
}
set_exception_handler('jsonExceptionHandler');

// Iniciar sesión
session_start();

// Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Incluir configuración de base de datos
require_once __DIR__ . '../../../api/config/database.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../'); // Ajusta esta ruta según donde esté tu .env
$dotenv->load();


class Logger {
    private $logFile;
    
    public function __construct($logFile) {
        $this->logFile = $logFile;
    }
    
    public function log($message, $type = 'INFO') {
        $timestamp = date('Y-m-d H:i:s');
        $formattedMessage = "[{$timestamp}] [{$type}] {$message}" . PHP_EOL;
        file_put_contents($this->logFile, $formattedMessage, FILE_APPEND);
    }
}

// Clase ConversationContext
class ConversationContext {
    public function setLastMentionedProperty($property) {
        $_SESSION['last_mentioned_property'] = $property;
        
        if (!isset($_SESSION['mentioned_properties'])) {
            $_SESSION['mentioned_properties'] = [];
        }
        
        if (!in_array($property['id'], array_column($_SESSION['mentioned_properties'], 'id'))) {
            $_SESSION['mentioned_properties'][] = $property;
            if (count($_SESSION['mentioned_properties']) > 5) {
                array_shift($_SESSION['mentioned_properties']);
            }
        }
    }
    
    public function getLastMentionedProperty() {
        return $_SESSION['last_mentioned_property'] ?? null;
    }
    
    public function setCurrentCity($city) {
        if ($_SESSION['current_city'] ?? null !== $city) {
            $_SESSION['mentioned_properties'] = [];
        }
        $_SESSION['current_city'] = $city;
    }
    
    public function getCurrentCity() {
        return $_SESSION['current_city'] ?? null;
    }
    
    public function getMentionedProperties() {
        return $_SESSION['mentioned_properties'] ?? [];
    }
    
    public function clear() {
        unset($_SESSION['last_mentioned_property']);
        unset($_SESSION['current_city']);
        unset($_SESSION['mentioned_properties']);
    }
}

// Clase PropertyDataHandler
class PropertyDataHandler {
    private $properties = [];
    private $propertyIndex = [];  // Para búsquedas rápidas
    private $cityStats = [];      // Estadísticas pre-calculadas por ciudad
    private $cityExtremes = [];   // Para almacenar propiedades más caras/baratas por ciudad
    private $logger;
    private $database;
    private $context;
    private $debugInfo = [];

    public function __construct($logger) {
        $this->logger = $logger;
        $this->database = new Database();
        $this->context = new ConversationContext();
        $this->loadProperties();
    }

    private function loadProperties() {
        // Primero intentar cargar desde sesión por rendimiento
        if (isset($_SESSION['properties'])) {
            $this->properties = $_SESSION['properties'];
            $this->propertyIndex = $_SESSION['property_index'];
            $this->cityStats = $_SESSION['city_stats'];
            $this->cityExtremes = $_SESSION['city_extremes'];
            $this->logger->log("Propiedades cargadas desde sesión: " . count($this->properties));
            return;
        }

        try {
            $conn = $this->database->getConnection();
            $query = "
                SELECT 
                    p.id,
                    p.code,
                    p.title,
                    p.price,
                    p.bedrooms,
                    p.bathrooms,
                    p.half_bathrooms,
                    p.parking_spots,
                    p.built_area,
                    p.total_area,
                    p.status,
                    p.address,
                    pt.name as property_type,
                    pv.name as property_variant,
                    s.name as state_name,
                    c.name as city_name,
                    col.name as colony_name,
                    GROUP_CONCAT(DISTINCT a.name) as amenities,
                    paf.conservation_status,
                    paf.storage_units,
                    paf.closets,
                    paf.elevators,
                    paf.built_levels
                FROM properties p
                LEFT JOIN property_types pt ON p.property_type_id = pt.id
                LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
                LEFT JOIN states s ON p.state_id = s.id
                LEFT JOIN cities c ON p.city_id = c.id
                LEFT JOIN colonies col ON p.colony_id = col.id
                LEFT JOIN property_amenities pa ON p.id = pa.property_id
                LEFT JOIN amenities a ON pa.amenity_id = a.id
                LEFT JOIN property_additional_features paf ON p.id = paf.property_id
                WHERE p.status = 'published' AND p.is_active = 1
                GROUP BY p.id";

            $stmt = $conn->prepare($query);
            $stmt->execute();
            $basicProperties = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Procesar e indexar las propiedades
            foreach ($basicProperties as $prop) {
                $cityName = $prop['city_name'];
                
                // Índice para búsquedas rápidas
                $this->propertyIndex[$prop['id']] = count($this->properties);
                
                // Calcular estadísticas y extremos por ciudad
                if (!isset($this->cityStats[$cityName])) {
                    $this->cityStats[$cityName] = [
                        'count' => 0,
                        'min_price' => PHP_FLOAT_MAX,
                        'max_price' => 0,
                        'types' => []
                    ];
                    
                    // Inicializar extremos
                    $this->cityExtremes[$cityName] = [
                        'most_expensive' => null,
                        'least_expensive' => null
                    ];
                }
                
                $this->cityStats[$cityName]['count']++;
                
                // Actualizar precios mínimos y máximos
                if ($prop['price'] < $this->cityStats[$cityName]['min_price']) {
                    $this->cityStats[$cityName]['min_price'] = $prop['price'];
                    $this->cityExtremes[$cityName]['least_expensive'] = $prop;
                }
                if ($prop['price'] > $this->cityStats[$cityName]['max_price']) {
                    $this->cityStats[$cityName]['max_price'] = $prop['price'];
                    $this->cityExtremes[$cityName]['most_expensive'] = $prop;
                }
                
                $this->cityStats[$cityName]['types'][$prop['property_type']] = true;
                $this->properties[] = $prop;
            }

            // Guardar en sesión
            $_SESSION['properties'] = $this->properties;
            $_SESSION['property_index'] = $this->propertyIndex;
            $_SESSION['city_stats'] = $this->cityStats;
            $_SESSION['city_extremes'] = $this->cityExtremes;
            
            $this->logger->log("Propiedades cargadas desde base de datos: " . count($this->properties));
            
        } catch (PDOException $e) {
            $this->logger->log("Error cargando propiedades: " . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function getDetailedProperty($propertyId) {
        // Retornar desde cache si está disponible
        if (isset($this->propertyIndex[$propertyId])) {
            return $this->properties[$this->propertyIndex[$propertyId]];
        }

        // Si no, cargar desde la base de datos
        try {
            $conn = $this->database->getConnection();
            $query = "
                SELECT 
                    p.*,
                    pt.name as property_type,
                    pv.name as property_variant,
                    s.name as state_name,
                    c.name as city_name,
                    col.name as colony_name,
                    GROUP_CONCAT(DISTINCT a.name) as amenities
                FROM properties p
                LEFT JOIN property_types pt ON p.property_type_id = pt.id
                LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
                LEFT JOIN states s ON p.state_id = s.id
                LEFT JOIN cities c ON p.city_id = c.id
                LEFT JOIN colonies col ON p.colony_id = col.id
                LEFT JOIN property_amenities pa ON p.id = pa.property_id
                LEFT JOIN amenities a ON pa.amenity_id = a.id
                WHERE p.id = :id
                GROUP BY p.id";

            $stmt = $conn->prepare($query);
            $stmt->execute(['id' => $propertyId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            $this->logger->log("Error cargando propiedad detallada: " . $e->getMessage(), 'ERROR');
            return null;
        }
    }

    public function getCityExtremes($cityName = null) {
        if ($cityName) {
            return $this->cityExtremes[$cityName] ?? null;
        }
        return $this->cityExtremes;
    }

    public function searchPropertyByName($searchText) {
        $this->logger->log("Buscando propiedad por nombre: " . $searchText);
        
        // Normalizar el texto de búsqueda
        $normalizedSearch = $this->normalizeString($searchText);
        $currentCity = $this->getCurrentCity();
        $matches = [];
        
        foreach ($this->properties as $property) {
            // Solo buscar en la ciudad actual si está establecida
            if ($currentCity && $this->normalizeString($property['city_name']) !== $this->normalizeString($currentCity)) {
                continue;
            }
            
            $normalizedTitle = $this->normalizeString($property['title']);
            $similarityScore = 0;
            
            // Verificar coincidencia exacta
            if ($normalizedTitle === $normalizedSearch) {
                $similarityScore = 100;
            }
            // Verificar si el texto de búsqueda está contenido en el título
            elseif (strpos($normalizedTitle, $normalizedSearch) !== false) {
                $similarityScore = 90;
            }
            // Verificar palabras individuales
            else {
                $searchWords = explode(' ', $normalizedSearch);
                $titleWords = explode(' ', $normalizedTitle);
                
                foreach ($searchWords as $word) {
                    if (strlen($word) < 3) continue; // Ignorar palabras muy cortas
                    
                    foreach ($titleWords as $titleWord) {
                        if (strpos($titleWord, $word) !== false) {
                            $similarityScore += 30;
                        }
                    }
                }
            }
            
            // Si hay suficiente similitud, agregar a los resultados
            if ($similarityScore > 20) {
                $matches[] = [
                    'property' => $property,
                    'score' => $similarityScore
                ];
            }
        }
        
        // Ordenar por relevancia
        usort($matches, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        // Retornar solo las propiedades, sin los puntajes
        return array_map(function($match) {
            return $match['property'];
        }, $matches);
    }

    public function buildSystemPrompt() {
        $prompt = "Eres Maia, asesora inmobiliaria especializada. Reglas principales:\n";
        $prompt .= "- Usa solo la información proporcionada\n";
        $prompt .= "- Respuestas breves y precisas\n";
        $prompt .= "- Menciona siempre el ID al hablar de propiedades\n";
        $prompt .= "- Cuando alguien quiera agendar una visita o contactar a un asesor, debes:\n";
        $prompt .= "  * Indicar que las visitas se programan a través del formulario en la página de la propiedad\n";
        $prompt .= "  * Proporcionar el enlace directo: https://masterbroker.ai/propiedad.html?id=[ID]\n";
        $prompt .= "  * Mencionar que ahí encontrarán el formulario para contactar al asesor\n";
        $prompt .= "- Cuando pregunten por una propiedad específica por nombre:\n";
        $prompt .= "  * Buscar coincidencias aproximadas\n";
        $prompt .= "  * Si hay varias coincidencias, mostrar las más relevantes\n";
        $prompt .= "  * Siempre incluir el ID de la propiedad en la respuesta\n\n";

        $currentCity = $this->getCurrentCity();
        if (!$currentCity) {
            $prompt .= "CIUDADES DISPONIBLES:\n";
            foreach ($this->cityStats as $city => $stats) {
                $extremes = $this->cityExtremes[$city];
                $prompt .= sprintf(
                    "%s: %d props ($%s-$%s)\n",
                    $city,
                    $stats['count'],
                    number_format($stats['min_price']),
                    number_format($stats['max_price'])
                );
                if ($extremes['most_expensive']) {
                    $prompt .= sprintf("  Más cara: [ID:%d] %s ($%s)\n",
                        $extremes['most_expensive']['id'],
                        $extremes['most_expensive']['title'],
                        number_format($extremes['most_expensive']['price'])
                    );
                }
                if ($extremes['least_expensive']) {
                    $prompt .= sprintf("  Más económica: [ID:%d] %s ($%s)\n",
                        $extremes['least_expensive']['id'],
                        $extremes['least_expensive']['title'],
                        number_format($extremes['least_expensive']['price'])
                    );
                }
            }
        } else {
            $prompt .= $this->buildCurrentCityContext($currentCity);
        }

        // Agregar detalles de la última propiedad mencionada
        if ($lastPropId = $this->getLastMentionedPropertyId()) {
            $detailedProp = $this->getDetailedProperty($lastPropId);
            if ($detailedProp) {
                $prompt .= "\nDETALLES ÚLTIMA PROPIEDAD:\n";
                $prompt .= $this->formatDetailedProperty($detailedProp);
            }
        }

        // Agregar ejemplos de respuesta para visitas
        $prompt .= "\nEJEMPLOS DE RESPUESTA PARA VISITAS:\n";
        $prompt .= "- Cuando pidan agendar una visita: 'Con gusto te ayudo a programar una visita. Por favor, ingresa a la página de la propiedad [LINK] donde encontrarás un formulario de contacto. Un asesor se pondrá en contacto contigo para coordinar la visita.'\n";
        $prompt .= "- Para contacto con asesor: 'Para ponerte en contacto con un asesor, por favor visita la página de la propiedad [LINK] y completa el formulario de contacto. Un asesor especializado te atenderá a la brevedad.'\n";

        return $prompt;
    }

    

    private function buildCurrentCityContext($city) {
        $cityProperties = array_filter($this->properties, function($prop) use ($city) {
            return $this->normalizeString($prop['city_name']) === $this->normalizeString($city);
        });
        
        if (empty($cityProperties)) {
            return "\nNo hay propiedades disponibles en $city.";
        }
        
        $context = "\nPROPIEDADES EN {$city}:\n";
        
        // Obtener estadísticas básicas
        $stats = $this->cityStats[$city];
        $context .= sprintf("Total: %d propiedades\n", $stats['count']);
        $context .= sprintf("Rango de precios: $%s - $%s\n",
            number_format($stats['min_price']),
            number_format($stats['max_price'])
        );
        
        // Añadir información de propiedades extremas
        if (isset($this->cityExtremes[$city])) {
            $extremes = $this->cityExtremes[$city];
            if ($extremes['most_expensive']) {
                $context .= sprintf("Propiedad más cara: [ID:%d] %s - $%s\n",
                    $extremes['most_expensive']['id'],
                    $extremes['most_expensive']['title'],
                    number_format($extremes['most_expensive']['price'])
                );
            }
            if ($extremes['least_expensive']) {
                $context .= sprintf("Propiedad más económica: [ID:%d] %s - $%s\n",
                    $extremes['least_expensive']['id'],
                    $extremes['least_expensive']['title'],
                    number_format($extremes['least_expensive']['price'])
                );
            }
        }
        
        // Mostrar tipos de propiedades disponibles
        $types = array_keys($stats['types']);
        $context .= "Tipos disponibles: " . implode(", ", $types) . "\n\n";
        
        // Mostrar algunas propiedades de ejemplo
        $sampleProperties = array_slice($cityProperties, 0, 5);
        foreach ($sampleProperties as $property) {
            $context .= $this->formatProperty($property);
        }
        
        return $context;
    }

    public function formatProperty($property) {
        return sprintf(
            "[ID:%d] %s - $%s - %d rec/%d baños - %dm²\n",
            $property['id'],
            $property['title'],
            number_format($property['price']),
            $property['bedrooms'],
            $property['bathrooms'],
            $property['built_area']
        );
    }

    public function formatDetailedProperty($prop) {
        $details = sprintf(
            "ID:%d\nTítulo: %s\nPrecio: $%s\nTipo: %s\n",
            $prop['id'],
            $prop['title'],
            number_format($prop['price']),
            $prop['property_type']
        );
        
        if ($prop['address']) {
            $details .= "Ubicación: " . $prop['address'] . "\n";
        }
        
        $details .= sprintf(
            "Características: %d recámaras, %d baños, %d m²\n",
            $prop['bedrooms'],
            $prop['bathrooms'],
            $prop['built_area']
        );
        
        if ($prop['amenities']) {
            $details .= "Amenidades: " . $prop['amenities'] . "\n";
        }
        
        $details .= sprintf(
            "\nPara agendar una visita o contactar a un asesor: https://masterbroker.ai/propiedad.html?id=%d\n",
            $prop['id']
        );
        
        return $details;
    }

    public function getLastMentionedPropertyId() {
        $lastProperty = $this->context->getLastMentionedProperty();
        return $lastProperty ? $lastProperty['id'] : null;
    }

    public function getPropertiesInCity($cityName, $limit = 5) {
        $cityProperties = array_filter($this->properties, function($prop) use ($cityName) {
            return $this->normalizeString($prop['city_name']) === $this->normalizeString($cityName);
        });
        
        return array_slice($cityProperties, 0, $limit);
    }

    public function getCurrentCity() {
        return $this->context->getCurrentCity();
    }

    public function setCurrentCity($city) {
        $this->context->setCurrentCity($city);
        $this->logger->log("Ciudad actual establecida: " . $city);
    }

    public function setLastMentionedProperty($property) {
        $this->context->setLastMentionedProperty($property);
        $this->logger->log("Última propiedad mencionada actualizada: " . $property['title']);
    }

    public function getLastMentionedProperty() {
        return $this->context->getLastMentionedProperty();
    }

    public function findPropertyById($id) {
        if (isset($this->propertyIndex[$id])) {
            return $this->properties[$this->propertyIndex[$id]];
        }
        return null;
    }

    public function findPropertyByTitle($title) {
        $normalizedSearchTitle = $this->normalizeString($title);
        foreach ($this->properties as $property) {
            if (stripos($this->normalizeString($property['title']), $normalizedSearchTitle) !== false) {
                return $property;
            }
        }
        return null;
    }

    private function normalizeString($string) {
        $unwanted_array = array(
            'Š'=>'S', 'š'=>'s', 'Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A', 'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C', 'È'=>'E', 'É'=>'E',
            'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I', 'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O', 'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', 'Ù'=>'U',
            'Ú'=>'U', 'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss', 'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c',
            'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o',
            'ö'=>'o', 'ø'=>'o', 'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y'
        );
        return strtr(strtolower($string), $unwanted_array);
    }

    public function getDebugInfo() {
        return [
            'total_properties' => count($this->properties),
            'cities_count' => count($this->cityStats),
            'current_city' => $this->getCurrentCity(),
            'last_property' => $this->getLastMentionedPropertyId()
        ];
    }
}

class AssistantAPI {
    private $anthropic_key;
    private $elevenlabs_key;
    private $VOICE_ID = "rCmVtv8cYU60uhlsOo1M";
    private $MODEL_ID = "eleven_turbo_v2_5";
    private $propertyHandler;
    private $logger;
    private $debugInfo = [];
    
    public function __construct($anthropic_key, $elevenlabs_key) {
        $this->logger = new Logger(__DIR__ . '/debug_log.txt');
        $this->anthropic_key = $anthropic_key;
        $this->elevenlabs_key = $elevenlabs_key;
        $this->propertyHandler = new PropertyDataHandler($this->logger);
        
        if (!isset($_SESSION['conversation_history'])) {
            $_SESSION['conversation_history'] = [];
        }
    }
    
    private function addDebugInfo($key, $value) {
        $this->debugInfo[$key] = $value;
    }

    private function validateResponse($response) {
        $this->logger->log("Validando respuesta de Claude API");
        
        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->log("Error decodificando JSON: " . json_last_error_msg(), 'ERROR');
            $this->addDebugInfo('json_decode_error', json_last_error_msg());
            $this->logger->log("Respuesta recibida (primeros 1000 caracteres): " . 
                substr($response, 0, 1000), 'ERROR');
            throw new Exception("Respuesta inválida de la API");
        }
        
        return $decoded;
    }

    private function extractCityFromMessage($message) {
        $cities = array_unique(array_map(function($prop) {
            return $prop['city_name'];
        }, $_SESSION['properties']));
        
        // Usando el método normalizeString directamente
        $normalizedMessage = $this->normalizeString($message);
        
        foreach ($cities as $city) {
            $normalizedCity = $this->normalizeString($city);
            if (stripos($normalizedMessage, $normalizedCity) !== false) {
                $this->addDebugInfo('city_detected', $city);
                return $city;
            }
        }
        return null;
    }

    private function normalizeString($string) {
        $unwanted_array = array(
            'Š'=>'S', 'š'=>'s', 'Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A', 'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C', 'È'=>'E', 'É'=>'E',
            'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I', 'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O', 'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', 'Ù'=>'U',
            'Ú'=>'U', 'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss', 'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c',
            'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o',
            'ö'=>'o', 'ø'=>'o', 'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y'
        );
        return strtr(strtolower($string), $unwanted_array);
    }
    
    private function extractPropertyContext($message, $response) {
        $this->logger->log("Analizando contexto de propiedad en respuesta");
        
        if (preg_match('/ID:(\d+)/', $response, $matches)) {
            if ($property = $this->propertyHandler->findPropertyById($matches[1])) {
                $this->propertyHandler->setLastMentionedProperty($property);
                $this->addDebugInfo('property_found_by_id', $matches[1]);
                return;
            }
        }

        if (preg_match('/propiedad\.html\?id=(\d+)/', $response, $matches)) {
            if ($property = $this->propertyHandler->findPropertyById($matches[1])) {
                $this->propertyHandler->setLastMentionedProperty($property);
                $this->addDebugInfo('property_found_by_url', $matches[1]);
                return;
            }
        }
    }
    
    public function processMessage($message, $requireAudio = true) {
        try {
            $this->logger->log("Procesando mensaje: " . $message);
            $this->addDebugInfo('input_message', $message);
            
            $maxRetries = 3;
            $baseWaitTime = 2;
            $attempt = 0;
            $response_text = null;
            
            while ($attempt < $maxRetries && $response_text === null) {
                try {
                    // Manejo de solicitudes de URL
                    if (stripos($message, 'url') !== false || 
                        stripos($message, 'enlace') !== false || 
                        stripos($message, 'link') !== false) {
                        if ($lastProperty = $this->propertyHandler->getLastMentionedProperty()) {
                            $response_text = "Por supuesto, aquí tienes el enlace directo a la propiedad {$lastProperty['title']}: https://masterbroker.ai/propiedad.html?id={$lastProperty['id']} ¿Te gustaría saber más detalles sobre esta propiedad?";
                            $this->addDebugInfo('url_response_generated', true);
                            $this->extractPropertyContext($message, $response_text);
                            break;
                        } else {
                            $response_text = "No has mencionado ninguna propiedad recientemente. ¿Te gustaría que te muestre las propiedades disponibles?";
                            break;
                        }
                    }
    
                    // Búsqueda de propiedad por nombre
                    if (preg_match('/(información|detalles|saber|conocer).*(?:sobre|acerca de|de)\s+.*(?:propiedad|inmueble|departamento|casa)\s+(.*?)(?:\?|$|\.|,)/i', $message, $matches) || 
                        preg_match('/(?:propiedad|inmueble|departamento|casa)\s+(.*?)(?:\?|$|\.|,)/i', $message, $matches)) {
                        
                        $searchName = trim($matches[count($matches) - 1]);
                        if ($searchName) {
                            $properties = $this->propertyHandler->searchPropertyByName($searchName);
                            
                            // Dentro del processMessage en AssistantAPI, en la sección de búsqueda por nombre
                            if (!empty($properties)) {
                                if (count($properties) === 1) {
                                    // Una sola coincidencia, mostrar detalles completos
                                    $property = $properties[0];
                                    $this->propertyHandler->setLastMentionedProperty($property);
                                    $response_text = "He encontrado la propiedad que buscas. Aquí están los detalles:\n\n";
                                    $response_text .= $this->propertyHandler->formatProperty($property); // <-- Corregido aquí
                                    $this->extractPropertyContext($message, $response_text);
                                    break;
                                } else {
                                    // Múltiples coincidencias, mostrar lista resumida
                                    $response_text = "He encontrado " . count($properties) . " propiedades similares:\n\n";
                                    foreach (array_slice($properties, 0, 3) as $property) {
                                        $this->propertyHandler->setLastMentionedProperty($property);
                                        $response_text .= $this->propertyHandler->formatProperty($property);
                                    }
                                    if (count($properties) > 3) {
                                        $response_text .= "\n¿Te gustaría ver más opciones o conocer más detalles de alguna de estas propiedades?";
                                    }
                                    $this->extractPropertyContext($message, $response_text);
                                    break;
                                }
                            }
                        }
                    }
    
                    // Detección y establecimiento de ciudad
                    if ($city = $this->extractCityFromMessage($message)) {
                        $this->propertyHandler->setCurrentCity($city);
                    }
                    
                    // Generación del prompt del sistema y llamada a la API
                    $systemPrompt = $this->propertyHandler->buildSystemPrompt();
                    $this->addDebugInfo('system_prompt', $systemPrompt);
                    
                    $data = [
                        'model' => 'claude-3-5-sonnet-20241022',
                        'max_tokens' => 1024,
                        'system' => $systemPrompt,
                        'messages' => array_merge(
                            $_SESSION['conversation_history'],
                            [['role' => 'user', 'content' => $message]]
                        )
                    ];
                    
                    // Llamada a la API de Claude
                    $ch = curl_init('https://api.anthropic.com/v1/messages');
                    curl_setopt_array($ch, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_POST => true,
                        CURLOPT_POSTFIELDS => json_encode($data),
                        CURLOPT_HTTPHEADER => [
                            'Content-Type: application/json',
                            'anthropic-version: 2023-06-01',
                            'x-api-key: ' . $this->anthropic_key
                        ],
                        CURLOPT_SSL_VERIFYPEER => false
                    ]);
                    
                    $response = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    // Manejo de rate limiting
                    if ($httpCode === 429) {
                        $waitTime = $baseWaitTime * pow(2, $attempt);
                        $this->logger->log("Rate limit alcanzado. Esperando {$waitTime} segundos.");
                        sleep($waitTime);
                        $attempt++;
                        continue;
                    }
                    
                    // Verificación de respuesta HTTP
                    if ($httpCode !== 200) {
                        throw new Exception("Error HTTP en Claude API: " . $httpCode);
                    }
                    
                    // Validación y procesamiento de la respuesta
                    $result = $this->validateResponse($response);
                    
                    if (!isset($result['content'][0]['text'])) {
                        throw new Exception("Formato de respuesta inválido");
                    }
                    
                    $response_text = $result['content'][0]['text'];
                    $this->extractPropertyContext($message, $response_text);
                    
                } catch (Exception $e) {
                    if ($attempt >= $maxRetries - 1) {
                        throw $e;
                    }
                    $attempt++;
                    sleep($baseWaitTime * pow(2, $attempt));
                }
            }
            
            // Actualización del historial de conversación
            $_SESSION['conversation_history'][] = [
                "role" => "user",
                "content" => $message
            ];
            
            $_SESSION['conversation_history'][] = [
                "role" => "assistant",
                "content" => $response_text
            ];
            
            // Mantener solo las últimas 10 interacciones
            if (count($_SESSION['conversation_history']) > 10) {
                $_SESSION['conversation_history'] = array_slice($_SESSION['conversation_history'], -10);
            }
            
            // Generación de audio si se requiere
            $audio_base64 = null;
            if ($requireAudio) {
                try {
                    $audio_base64 = $this->generateVoice($response_text);
                } catch (Exception $e) {
                    $this->logger->log("Error generando audio: " . $e->getMessage(), 'WARNING');
                }
            }
            
            // Retorno de la respuesta
            return [
                'success' => true,
                'text' => $response_text,
                'audio' => $audio_base64,
                'debug' => [
                    'attempts' => $attempt + 1,
                    'last_property' => $this->propertyHandler->getLastMentionedProperty() ? 
                        $this->propertyHandler->getLastMentionedProperty()['id'] : null,
                    'debug_info' => $this->debugInfo
                ]
            ];
            
        } catch (Exception $e) {
            $this->logger->log("Error procesando mensaje: " . $e->getMessage(), 'ERROR');
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'debug' => $this->debugInfo
            ];
        }
    }
    
    private function generateVoice($text) {
        $url = "https://api.elevenlabs.io/v1/text-to-speech/{$this->VOICE_ID}/stream";
        
        $data = [
            "text" => $text,
            "model_id" => $this->MODEL_ID,
            "voice_settings" => [
                "stability" => 0.71,
                "similarity_boost" => 0.85,
                "style" => 0.30,
                "use_speaker_boost" => true
            ]
        ];
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Accept: audio/mpeg',
                'Content-Type: application/json',
                'xi-api-key: ' . $this->elevenlabs_key
            ],
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception('Error de conexión con ElevenLabs API: ' . $error);
        }
        
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Error en la API de ElevenLabs');
        }
        
        return base64_encode($response);
    }
}

// Endpoint principal
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['message'])) {
        throw new Exception('Mensaje no proporcionado');
    }
    
    $ANTHROPIC_API_KEY = $_ENV['ANTHROPIC_API_KEY'];
    $ELEVENLABS_API_KEY = $_ENV['ELEVENLABS_API_KEY'];
    
    $assistant = new AssistantAPI($ANTHROPIC_API_KEY, $ELEVENLABS_API_KEY);
    $result = $assistant->processMessage(
        $data['message'],
        isset($data['requireAudio']) ? $data['requireAudio'] : true
    );
    
    echo json_encode($result);
    
} catch (Exception $e) {
    $logger = new Logger(__DIR__ . '/debug_log.txt');
    $logger->log("Error en el endpoint: " . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}