<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

require_once '../config/database.php';

class PropertyAPI {
    private $conn;
    private $limit;
    private $page;
    private $offset;
    private $filters;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
        
        $this->limit = max(1, isset($_GET['limit']) ? (int)$_GET['limit'] : 9);
        $this->page = max(1, isset($_GET['page']) ? (int)$_GET['page'] : 1);
        $this->offset = ($this->page - 1) * $this->limit;
        
        $this->filters = $this->getFilters();
    }

    private function parseSearchKeywords($search) {
        $filters = [];
        $search = mb_strtolower(trim($search));
        
        // Patrones para características numéricas
        $patterns = [
            'baños?' => 'bathrooms',
            'recamaras?|recámaras?|habitaciones?|cuartos?' => 'bedrooms',
            'estacionamientos?|cocheras?' => 'parking_spots',
            'm2|metros?\s*cuadrados?|m²' => 'total_area',
            'años?' => 'age_years'
        ];

        foreach ($patterns as $palabras => $campo) {
            if (preg_match("/(\d+)\s*(?:$palabras)/i", $search, $matches)) {
                $filters[$campo] = (int)$matches[1];
            }
        }

        // Remover los términos encontrados del texto de búsqueda
        foreach ($patterns as $palabras => $campo) {
            $search = preg_replace("/\d+\s*(?:$palabras)/i", '', $search);
        }

        $filters['text'] = trim($search);
        return $filters;
    }

    private function getFilters() {
        $searchText = isset($_GET['search']) ? trim($_GET['search']) : '';
        $parsedSearch = $searchText ? $this->parseSearchKeywords($searchText) : ['text' => ''];

        // Procesar variantes de propiedad 
        $propertyVariants = isset($_GET['property_variant']) ? 
            array_filter(explode(',', $_GET['property_variant'])) : 
            null;

        return [
            'operation_type' => isset($_GET['operation_type']) ? $_GET['operation_type'] : null,
            'property_variant' => $propertyVariants,
            'min_price' => isset($_GET['min_price']) && is_numeric($_GET['min_price']) ? $_GET['min_price'] : null,
            'max_price' => isset($_GET['max_price']) && is_numeric($_GET['max_price']) ? $_GET['max_price'] : null,
            'search' => $parsedSearch['text'],
            'score_order' => isset($_GET['score_order']) ? $_GET['score_order'] : null,
            'bedrooms' => $parsedSearch['bedrooms'] ?? (isset($_GET['bedrooms']) ? $_GET['bedrooms'] : null),
            'bathrooms' => $parsedSearch['bathrooms'] ?? (isset($_GET['bathrooms']) ? $_GET['bathrooms'] : null),
            'parking_spots' => $parsedSearch['parking_spots'] ?? null,
            'surface_min' => isset($_GET['surface_min']) && is_numeric($_GET['surface_min']) ? $_GET['surface_min'] : null,
            'surface_max' => isset($_GET['surface_max']) && is_numeric($_GET['surface_max']) ? $_GET['surface_max'] : null,
            'total_area' => $parsedSearch['total_area'] ?? null,
            'age' => isset($_GET['age']) ? $_GET['age'] : null,
            'age_years' => $parsedSearch['age_years'] ?? null
        ];
    }

    public function getProperties() {
        try {
            $baseQuery = "
                SELECT DISTINCT p.id
                FROM properties p
                WHERE p.status = 'published' 
                AND p.is_active = 1
            ";

            $params = [];
            $conditions = [];

            // Filtros existentes
            if ($this->filters['operation_type']) {
                $conditions[] = "p.operation_type_id = ?";
                $params[] = $this->filters['operation_type'];
            }

            if (!empty($this->filters['property_variant'])) {
                $placeholders = str_repeat('?,', count($this->filters['property_variant']) - 1) . '?';
                $conditions[] = "p.property_variant_id IN ($placeholders)";
                $params = array_merge($params, $this->filters['property_variant']);
            }

            if ($this->filters['min_price']) {
                $conditions[] = "p.price >= ?";
                $params[] = $this->filters['min_price'];
            }

            if ($this->filters['max_price']) {
                $conditions[] = "p.price <= ?";
                $params[] = $this->filters['max_price'];
            }

            // Filtros extraídos del texto
            if ($this->filters['bedrooms']) {
                $conditions[] = "p.bedrooms = ?";
                $params[] = $this->filters['bedrooms'];
            }

            if ($this->filters['bathrooms']) {
                $conditions[] = "p.bathrooms = ?";
                $params[] = $this->filters['bathrooms'];
            }

            if ($this->filters['parking_spots']) {
                $conditions[] = "p.parking_spots = ?";
                $params[] = $this->filters['parking_spots'];
            }

            if ($this->filters['total_area']) {
                $conditions[] = "p.total_area = ?";
                $params[] = $this->filters['total_area'];
            }

            if ($this->filters['surface_min']) {
                $conditions[] = "p.total_area >= ?";
                $params[] = $this->filters['surface_min'];
            }

            if ($this->filters['surface_max']) {
                $conditions[] = "p.total_area <= ?";
                $params[] = $this->filters['surface_max'];
            }

            // Filtro de antigüedad
            if ($this->filters['age']) {
                switch($this->filters['age']) {
                    case 'under_construction':
                        $conditions[] = "p.age_type = 'under_construction'";
                        break;
                    case 'new':
                        $conditions[] = "p.age_type = 'new'";
                        break;
                    case 'up_to_5':
                        $conditions[] = "p.age_years <= 5 AND p.age_type = 'years'";
                        break;
                    case 'up_to_10':
                        $conditions[] = "p.age_years <= 10 AND p.age_type = 'years'";
                        break;
                    case 'up_to_20':
                        $conditions[] = "p.age_years <= 20 AND p.age_type = 'years'";
                        break;
                    case 'up_to_50':
                        $conditions[] = "p.age_years <= 50 AND p.age_type = 'years'";
                        break;
                    case 'more_than_50':
                        $conditions[] = "p.age_years > 50 AND p.age_type = 'years'";
                        break;
                }
            }

            // Búsqueda de texto
            if ($this->filters['search']) {
                $searchTerm = "%{$this->filters['search']}%";
                $conditions[] = "(
                    p.title LIKE ? OR 
                    p.description LIKE ? OR 
                    p.code LIKE ? OR
                    EXISTS (SELECT 1 FROM states s WHERE p.state_id = s.id AND s.name LIKE ?) OR
                    EXISTS (SELECT 1 FROM cities c WHERE p.city_id = c.id AND c.name LIKE ?) OR
                    EXISTS (SELECT 1 FROM colonies col WHERE p.colony_id = col.id AND col.name LIKE ?) OR
                    p.address LIKE ?
                )";
                $params = array_merge($params, array_fill(0, 7, $searchTerm));
            }

            // Añadir condiciones a la consulta base
            if (!empty($conditions)) {
                $baseQuery .= " AND " . implode(" AND ", $conditions);
            }

            // Obtener total de registros antes de aplicar paginación
            $countQuery = str_replace("SELECT DISTINCT p.id", "SELECT COUNT(DISTINCT p.id) as total", $baseQuery);
            $stmt = $this->conn->prepare($countQuery);
            $stmt->execute($params);
            $totalRecords = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Si no hay resultados, devolver respuesta vacía
            if ($totalRecords === 0) {
                return [
                    'status' => 'success',
                    'data' => [],
                    'pagination' => [
                        'current_page' => $this->page,
                        'from' => 0,
                        'to' => 0,
                        'per_page' => $this->limit,
                        'total' => 0,
                        'total_pages' => 0,
                        'count' => 0
                    ]
                ];
            }

            // Agregar ordenamiento y paginación
            $baseQuery .= " ORDER BY " . 
                ($this->filters['score_order'] === 'desc' ? 
                "(SELECT total_score FROM v_property_total_scores v WHERE v.id = p.id) DESC, " : "") . 
                "p.created_at DESC
                LIMIT ? OFFSET ?";

            $params[] = $this->limit;
            $params[] = $this->offset;

            // Obtener IDs de las propiedades
            $stmt = $this->conn->prepare($baseQuery);
            $stmt->execute($params);
            $propertyIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

            // Obtener detalles completos de las propiedades
            if (!empty($propertyIds)) {
                $detailsQuery = "
                    SELECT 
                        p.*,
                        pt.name as property_type_name,
                        ot.name as operation_type_name,
                        pv.name as variant_name,
                        (SELECT file_path FROM property_images WHERE property_id = p.id AND is_main = 1 LIMIT 1) as main_image,
                        s.name as state_name,
                        c.name as city_name,
                        col.name as colony_name,
                        u.first_name as owner_first_name,
                        u.last_name as owner_last_name,
                        u.id as owner_id,
                        rep.company_logo as owner_logo,
                        rep.business_name as owner_company_name,
                        vpts.total_score,
                        vpts.score_category,
                        vpts.score_icon,
                        pmc.image_count,
                        pmc.video_count,
                        CONCAT(
                            COALESCE(col.name, ''), 
                            CASE WHEN col.name IS NOT NULL THEN ', ' ELSE '' END,
                            COALESCE(c.name, ''),
                            CASE WHEN c.name IS NOT NULL THEN ', ' ELSE '' END,
                            COALESCE(s.name, '')
                        ) as location
                    FROM properties p
                    LEFT JOIN property_types pt ON p.property_type_id = pt.id
                    LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
                    LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
                    LEFT JOIN states s ON p.state_id = s.id
                    LEFT JOIN cities c ON p.city_id = c.id
                    LEFT JOIN colonies col ON p.colony_id = col.id
                    LEFT JOIN users u ON p.user_id = u.id
                    LEFT JOIN real_estate_profiles rep ON u.id = rep.user_id
                    LEFT JOIN v_property_total_scores vpts ON p.id = vpts.id
                    LEFT JOIN property_media_counts pmc ON p.id = pmc.property_id
                    WHERE p.id IN (" . implode(',', $propertyIds) . ")
                    ORDER BY FIELD(p.id, " . implode(',', $propertyIds) . ")";

                $stmt = $this->conn->prepare($detailsQuery);
                $stmt->execute();
                $properties = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $properties = [];
            }

            // Calcular paginación
            $totalPages = ceil($totalRecords / $this->limit);
            $from = ($this->page - 1) * $this->limit + 1;
            $count = count($properties);
            $to = $from + $count - 1;

            return [
                'status' => 'success',
                'data' => $this->formatProperties($properties),
                'pagination' => [
                    'current_page' => (int)$this->page,
                    'from' => $from,
                    'to' => $to,
                    'per_page' => (int)$this->limit,
                    'total' => $totalRecords,
                    'total_pages' => $totalPages,
                    'count' => $count
                ]
            ];

        } catch (Exception $e) {
            error_log("Error en PropertyAPI::getProperties: " . $e->getMessage());
            return [
                'status' => 'error',
                'message' => 'Error al obtener las propiedades: ' . $e->getMessage()
            ];
        }
    }

    private function formatProperties($properties) {
        return array_map(function($property) {
            // Formateo de precios y valores numéricos
            $property['price_formatted'] = number_format($property['price'], 2, '.', ',');
            $property['main_image'] = $property['main_image'] ?: '/assets/img/placeholder.jpg';

            $property['owner'] = [
                'id' => $property['owner_id'],
                'name' => trim($property['owner_first_name'] . ' ' . $property['owner_last_name']),
                'company' => [
                    'name' => $property['owner_company_name'],
                    'logo' => $property['owner_logo'] ? '/uploads/logos/' . $property['owner_logo'] : null
                ]
            ];
    
            // Limpiar campos que ya no necesitamos directamente
            unset(
                $property['owner_id'],
                $property['owner_first_name'],
                $property['owner_last_name'],
                $property['owner_logo'],
                $property['owner_company_name']
            );
            
            // Formateo de texto
            $property['description_short'] = mb_substr(strip_tags($property['description']), 0, 150) . 
                (mb_strlen($property['description']) > 150 ? '...' : '');
            $property['location_formatted'] = trim($property['location'], ', ');

            // Conversión de valores numéricos
            $numericFields = [
                'image_count', 'video_count', 'total_score', 'bedrooms', 
                'bathrooms', 'half_bathrooms', 'parking_spots'
            ];
            foreach ($numericFields as $field) {
                $property[$field] = isset($property[$field]) ? (int)$property[$field] : 0;
            }

            // Conversión de valores decimales
            $decimalFields = ['built_area', 'total_area', 'price', 'maintenance_fee'];
            foreach ($decimalFields as $field) {
                $property[$field] = isset($property[$field]) ? (float)$property[$field] : 0.0;
            }

            return $property;
        }, $properties);
    }
}

$api = new PropertyAPI();
echo json_encode($api->getProperties());