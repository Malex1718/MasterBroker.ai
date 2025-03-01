<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

require_once '../../api/config/database.php';

class PropertyDataFetcher {
    private $userId = 7;
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function getUserProperties() {
        try {
            $query = "
                SELECT 
                    p.id,
                    p.title,
                    p.description,
                    p.code,
                    p.status,
                    p.price,
                    pt.name as property_type,
                    ot.name as operation_type,
                    CONCAT(s.name, ', ', c.name) as location
                FROM properties p
                LEFT JOIN property_types pt ON p.property_type_id = pt.id
                LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
                LEFT JOIN states s ON p.state_id = s.id
                LEFT JOIN cities c ON p.city_id = c.id
                WHERE p.user_id = :user_id
                ORDER BY p.created_at DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->bindValue(':user_id', $this->userId, PDO::PARAM_INT);
            $stmt->execute();

            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Error fetching properties: " . $e->getMessage());
            return [];
        }
    }

    public function getPropertyDetails($propertyId) {
        try {
            $query = "
                SELECT 
                    p.*,
                    pt.name as property_type,
                    pv.name as property_variant,
                    ot.name as operation_type,
                    s.name as state_name,
                    c.name as city_name,
                    col.name as colony_name,
                    paf.conservation_status,
                    GROUP_CONCAT(DISTINCT a.name) as amenities,
                    p.description as property_description
                FROM properties p
                LEFT JOIN property_types pt ON p.property_type_id = pt.id
                LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
                LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
                LEFT JOIN states s ON p.state_id = s.id
                LEFT JOIN cities c ON p.city_id = c.id
                LEFT JOIN colonies col ON p.colony_id = col.id
                LEFT JOIN property_additional_features paf ON p.id = paf.property_id
                LEFT JOIN property_amenities pa ON p.id = pa.property_id
                LEFT JOIN amenities a ON pa.amenity_id = a.id
                WHERE p.id = :property_id AND p.user_id = :user_id
                GROUP BY p.id";

            $stmt = $this->conn->prepare($query);
            $stmt->bindValue(':property_id', $propertyId, PDO::PARAM_INT);
            $stmt->bindValue(':user_id', $this->userId, PDO::PARAM_INT);
            $stmt->execute();

            $property = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$property) {
                return null;
            }

            return [
                'raw_data' => $property,
                'processed_data' => [
                    'propertyType' => $property['property_type'] ?? 'casa',
                    'propertyFeatures' => $this->formatPropertyFeatures($property),
                    'location' => $this->formatLocation($property),
                    'price' => $this->formatPrice($property),
                    'description' => $property['property_description'] ?? ''  // Agregar descripción a los datos procesados
                ]
            ];
        } catch (Exception $e) {
            error_log("Error al obtener detalles de la propiedad: " . $e->getMessage());
            return null;
        }
    }

    private function formatPropertyFeatures($property) {
        $features = [];
        
        if (!empty($property['bedrooms'])) {
            $features[] = "{$property['bedrooms']} recámaras";
        }
        if (!empty($property['bathrooms'])) {
            $features[] = "{$property['bathrooms']} baños completos";
        }
        if (!empty($property['half_bathrooms'])) {
            $features[] = "{$property['half_bathrooms']} medios baños";
        }
        if (!empty($property['built_area'])) {
            $features[] = "{$property['built_area']} m² de construcción";
        }
        if (!empty($property['amenities'])) {
            $features[] = "Amenidades: " . $property['amenities'];
        }

        return implode(", ", $features);
    }

    private function formatLocation($property) {
        $location = array_filter([
            $property['colony_name'] ?? null,
            $property['city_name'] ?? null,
            $property['state_name'] ?? null
        ]);
        return implode(", ", $location);
    }

    private function formatPrice($property) {
        if (empty($property['price'])) return '';
        return '$' . number_format($property['price'], 2) . ' MXN';
    }
}

class PropertyDataProcessor {
    private $propertyData;
    private $translations;
    
    public function __construct($propertyData) {
        $this->propertyData = $propertyData;
        $this->translations = $this->loadTranslations();
    }
    
    public function formatDallEPrompt() {
        $features = $this->getMainFeatures();
        $location = $this->getFormattedLocation();
        $description = $this->propertyData['property_description'] ?? '';
        
        $prompt = "Crea una fotografía profesional inmobiliaria con estas especificaciones:\n\n";
        
        // Agregar descripción si está disponible
        if (!empty($description)) {
            $prompt .= "Descripción de la propiedad: {$description}\n\n";
        }
        
        // Tipo de propiedad y características principales
        $prompt .= "Tipo de propiedad: {$features['property_type']}\n";
        if (!empty($features['built_area'])) {
            $prompt .= "Tamaño: {$features['built_area']}\n";
        }
        
        // Habitaciones y baños
        if (!empty($features['bedrooms']) || !empty($features['bathrooms'])) {
            $prompt .= "Distribución: ";
            if (!empty($features['bedrooms'])) {
                $prompt .= "{$features['bedrooms']} recámaras";
            }
            if (!empty($features['bathrooms'])) {
                $prompt .= (!empty($features['bedrooms']) ? ", " : "") . 
                          "{$features['bathrooms']} baños";
            }
            $prompt .= "\n";
        }
        
        // Ubicación
        if (!empty($location)) {
            $prompt .= "Ubicación: {$location}\n";
        }
        
        // Estilo y amenidades
        if (!empty($features['amenities'])) {
            $prompt .= "Características destacadas: {$features['amenities']}\n";
        }
        
        // Especificaciones de fotografía
        $prompt .= "\nEspecificaciones de fotografía:
- Usar iluminación natural y perspectiva gran angular
- Mostrar profundidad y amplitud
- Resaltar detalles arquitectónicos
- Cumplir con estándares de fotografía inmobiliaria profesional
- Crear una atmósfera acogedora y lujosa
- Enfocarse en características clave de venta
- Mantener una apariencia realista y profesional";
        
        return $prompt;
    }
    
    public function formatClaudePrompt($platform, $language = 'es') {
        $t = $this->translations[$language] ?? $this->translations['es'];
        $features = $this->getMainFeatures();
        $location = $this->getFormattedLocation();
        $price = $this->propertyData['price'] ?? '';
        $description = $this->propertyData['property_description'] ?? '';
        
        $platformSpecs = $this->getPlatformSpecs($platform);
        
        $prompt = "Crea una publicación inmobiliaria para {$platform} en español para esta propiedad:\n\n";
        
        // Agregar descripción si está disponible
        if (!empty($description)) {
            $prompt .= "Descripción de la Propiedad:\n{$description}\n\n";
        }
        
        $prompt .= "Detalles de la Propiedad:\n";
        $prompt .= "- Tipo: {$features['property_type']}\n";
        $prompt .= "- Características: {$this->formatFeatures($features)}\n";
        $prompt .= "- Ubicación: {$location}\n";
        $prompt .= "- Precio: {$price}\n\n";
        
        $prompt .= $this->buildPlatformSpecificInstructions($platform, $t, $platformSpecs);
        $prompt .= $this->buildStyleGuide($platform, $t);
        
        // Agregar instrucción para incorporar la descripción
        if (!empty($description)) {
            $prompt .= "\nPor favor, incorpora puntos clave de la descripción de la propiedad manteniendo el estilo y los requisitos de longitud de la plataforma.";
        }
        
        return $prompt;
    }
    
    private function getMainFeatures() {
        return [
            'property_type' => $this->propertyData['property_type'] ?? '',
            'built_area' => $this->propertyData['built_area'] ?? '',
            'bedrooms' => $this->propertyData['bedrooms'] ?? '',
            'bathrooms' => $this->propertyData['bathrooms'] ?? '',
            'amenities' => $this->propertyData['amenities'] ?? ''
        ];
    }
    
    private function getFormattedLocation() {
        $parts = array_filter([
            $this->propertyData['colony_name'] ?? null,
            $this->propertyData['city_name'] ?? null,
            $this->propertyData['state_name'] ?? null
        ]);
        return implode(", ", $parts);
    }
    
    private function getPlatformSpecs($platform) {
        $platformSpecs = [
            'twitter' => [
                'maxChars' => 280,
                'maxHashtags' => 3,
                'style' => 'concise and impactful',
                'structure' => [
                    'maxParagraphs' => 1,
                    'maxEmojis' => 2,
                    'maxHashtags' => 3
                ],
                'recommendedMediaTypes' => ['photos', 'short videos', '360° tours'],
                'maxLength' => 280
            ],
            'facebook' => [
                'maxChars' => 400,
                'maxHashtags' => 3,
                'style' => 'detailed and informative',
                'structure' => [
                    'maxParagraphs' => 2,
                    'maxEmojis' => 2,
                    'maxHashtags' => 3
                ],
                'recommendedMediaTypes' => ['photo albums', 'virtual tours', 'long videos'],
                'maxLength' => 400
            ],
            'instagram' => [
                'maxChars' => 500,
                'maxHashtags' => 6,
                'style' => 'visual and engaging',
                'structure' => [
                    'maxParagraphs' => 3,
                    'maxEmojis' => 4,
                    'maxHashtags' => 6
                ],
                'recommendedMediaTypes' => ['high-quality photos', 'reels', 'stories'],
                'maxLength' => 500
            ],
            'linkedin' => [
                'maxChars' => 600,
                'maxHashtags' => 4,
                'style' => 'professional and analytical',
                'structure' => [
                    'maxParagraphs' => 3,
                    'maxEmojis' => 1,
                    'maxHashtags' => 4
                ],
                'recommendedMediaTypes' => ['professional photos', 'market data', 'documents'],
                'maxLength' => 600
            ]
        ];
    
        return $platformSpecs[$platform] ?? $platformSpecs['twitter'];
    }
    
    private function buildBasePrompt($t, $features, $location, $price) {
        return "Create a {$t['platform_style']} real estate post in {$t['language']} for this property:

Property Details:
- Type: {$features['property_type']}
- Features: {$this->formatFeatures($features)}
- Location: {$location}
- Price: {$price}

";
    }
    
    private function buildPlatformSpecificInstructions($platform, $t, $specs) {
        return "Format Requirements:
- Maximum length: {$specs['maxChars']} characters
- Hashtags: Up to {$specs['maxHashtags']} relevant real estate hashtags
- Style: {$specs['style']}
- Tone: Professional and persuasive
";
    }
    
    private function buildStyleGuide($platform, $t) {
        $guides = [
            'twitter' => "Enfatizar:
- Característica más atractiva
- Precio y ubicación
- Llamado a la acción claro
- Usar emojis estratégicamente",
            
            'facebook' => "Incluir:
- Descripción detallada de la propiedad
- Beneficios del vecindario
- Amenidades y características
- Información de contacto clara",
            
            'instagram' => "Resaltar:
- Elementos visuales
- Beneficios del estilo de vida
- Características premium
- Hashtags atractivos",
            
            'linkedin' => "Destacar:
- Potencial de inversión
- Análisis de mercado
- Especificaciones de la propiedad
- Oportunidades profesionales"
        ];
        
        return $guides[$platform] ?? $guides['twitter'];
    }
    
    private function formatFeatures($features) {
        return array_filter([
            $features['built_area'] ? "{$features['built_area']}m²" : null,
            $features['bedrooms'] ? "{$features['bedrooms']} bedrooms" : null,
            $features['bathrooms'] ? "{$features['bathrooms']} bathrooms" : null,
            $features['amenities']
        ]);
    }
    
    private function loadTranslations() {
        return [
            'es' => [
                'language' => 'español',
                'platform_style' => 'publicación inmobiliaria',
                // Add more Spanish translations
            ],
            'en' => [
                'language' => 'English',
                'platform_style' => 'real estate post',
                // Add more English translations
            ]
            // Add more languages as needed
        ];
    }
}

// API Configuration
$openai_key = '';
$claude_key = '';

// Request handling
$data = json_decode(file_get_contents('php://input'), true);
error_log('📥 Incoming request: ' . print_r($data, true));

// Property listing endpoint
if (isset($data['action']) && $data['action'] === 'list_properties') {
    $propertyFetcher = new PropertyDataFetcher();
    $properties = $propertyFetcher->getUserProperties();
    echo json_encode([
        'success' => true,
        'properties' => $properties
    ]);
    exit;
}

// Initialize property data if ID is provided
$propertyData = null;
if (isset($data['property_id'])) {
    $propertyFetcher = new PropertyDataFetcher();
    $propertyData = $propertyFetcher->getPropertyDetails($data['property_id']);
    
    if (!$propertyData) {
        echo json_encode([
            'success' => false,
            'error' => 'Property not found'
        ]);
        exit;
    }
}

// DALL-E image generation endpoint
if (isset($data['action']) && $data['action'] === 'generate_image') {
    if (!$propertyData) {
        echo json_encode([
            'success' => false,
            'error' => 'Property data required for image generation'
        ]);
        exit;
    }
    
    $processor = new PropertyDataProcessor($propertyData['raw_data']);
    $prompt = $processor->formatDallEPrompt();
    
    $ch = curl_init('https://api.openai.com/v1/images/generations');
    
    $postData = [
        'model' => 'dall-e-3',
        'prompt' => $prompt,
        'n' => 1,
        'size' => '1024x1024',
       'quality' => 'hd',
        'response_format' => 'url'
    ];
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($postData),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $openai_key
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        echo json_encode([
            'success' => false,
            'error' => 'Connection error: ' . curl_error($ch)
        ]);
        exit;
    }
    
    curl_close($ch);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        echo json_encode([
            'success' => true,
            'image_url' => $result['data'][0]['url']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'DALL-E API error: ' . $response
        ]);
    }
    exit;
}

// Claude text generation endpoint
if (isset($data['platform'])) {
    if (!$propertyData) {
        echo json_encode([
            'success' => false,
            'error' => 'Property data required for text generation'
        ]);
        exit;
    }

    $processor = new PropertyDataProcessor($propertyData['raw_data']);
    $prompt = $processor->formatClaudePrompt(
        $data['platform'],
        $data['language'] ?? 'es'
    );

    $url = 'https://api.anthropic.com/v1/messages';
    
    $postData = [
        'model' => 'claude-3-5-sonnet-20241022',
        'max_tokens' => 1024,
        'temperature' => 0.7,
        'messages' => [
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ]
    ];

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($postData),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . $claude_key,
            'anthropic-version: 2023-06-01'
        ]
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    error_log('🌐 Claude Response - Code: ' . $httpCode . ' Response: ' . $response);

    if (curl_errno($ch)) {
        error_log('❌ CURL Error in Claude: ' . curl_error($ch));
        echo json_encode([
            'success' => false,
            'error' => 'Connection error: ' . curl_error($ch)
        ]);
        exit;
    }

    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        
        // Extraer las especificaciones de la plataforma para metadata
        $platformSpecs = [
            'twitter' => [
                'maxLength' => 280,
                'structure' => [
                    'maxParagraphs' => 1,
                    'maxEmojis' => 2,
                    'maxHashtags' => 3
                ],
                'recommendedMediaTypes' => ['photos', 'short videos', '360° tours']
            ],
            'facebook' => [
                'maxLength' => 400,
                'structure' => [
                    'maxParagraphs' => 2,
                    'maxEmojis' => 2,
                    'maxHashtags' => 3
                ],
                'recommendedMediaTypes' => ['photo albums', 'virtual tours', 'long videos']
            ],
            'instagram' => [
                'maxLength' => 500,
                'structure' => [
                    'maxParagraphs' => 3,
                    'maxEmojis' => 4,
                    'maxHashtags' => 6
                ],
                'recommendedMediaTypes' => ['high-quality photos', 'reels', 'stories']
            ],
            'linkedin' => [
                'maxLength' => 600,
                'structure' => [
                    'maxParagraphs' => 3,
                    'maxEmojis' => 1,
                    'maxHashtags' => 4
                ],
                'recommendedMediaTypes' => ['professional photos', 'market data', 'documents']
            ]
        ];

        $platformMetadata = $platformSpecs[$data['platform']] ?? $platformSpecs['twitter'];

        echo json_encode([
            'success' => true,
            'copy' => $result['content'][0]['text'],
            'platform' => $data['platform'],
            'metadata' => [
                'maxLength' => $platformMetadata['maxLength'],
                'structure' => $platformMetadata['structure'],
                'recommendedMediaTypes' => $platformMetadata['recommendedMediaTypes']
            ],
            'property_info' => [
                'type' => $propertyData['processed_data']['propertyType'],
                'features' => $propertyData['processed_data']['propertyFeatures'],
                'location' => $propertyData['processed_data']['location'],
                'price' => $propertyData['processed_data']['price']
            ]
        ]);
    } else {
        error_log('❌ Error in Claude API: ' . $response);
        echo json_encode([
            'success' => false,
            'error' => 'API Error: ' . $response
        ]);
    }
    exit;
}

// Default response for invalid requests
echo json_encode([
    'success' => false,
    'error' => 'Invalid request. Please specify a valid action or platform.'
]);