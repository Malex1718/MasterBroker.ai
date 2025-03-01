<?php
// property_handler.php
require_once '../config/database.php';

class PropertyHandler {
    private $conn;
    private $database;

    public function __construct() {
        $this->database = new Database();
        $this->conn = $this->database->getConnection();
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
                    paf.*,
                    -- Información del usuario/dueño
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.phone,
                    u.mobile,
                    -- Información del perfil dependiendo del tipo de usuario
                    ur.name as user_role,
                    ur.code as user_role_code,
                    CASE 
                        WHEN rep.id IS NOT NULL THEN rep.business_name
                        ELSE CONCAT(u.first_name, ' ', u.last_name)
                    END as owner_name,
                    CASE 
                        WHEN rep.id IS NOT NULL THEN rep.company_logo
                        ELSE NULL
                    END as owner_logo,
                    -- Validación de maqueta digital
                    CASE 
                        WHEN p.digital_mockup_url IS NOT NULL 
                        AND p.digital_mockup_url != '' 
                        AND p.digital_mockup_url LIKE 'https://share.arcware.cloud/v1/%'
                        AND p.status = 'published'
                        AND p.is_active = 1
                        AND (p.expiration_date IS NULL OR p.expiration_date > NOW())
                        THEN true 
                        ELSE false 
                    END AS has_mockup
                FROM properties p
                LEFT JOIN property_types pt ON p.property_type_id = pt.id
                LEFT JOIN property_variants pv ON p.property_variant_id = pv.id
                LEFT JOIN operation_types ot ON p.operation_type_id = ot.id
                LEFT JOIN states s ON p.state_id = s.id
                LEFT JOIN cities c ON p.city_id = c.id
                LEFT JOIN colonies col ON p.colony_id = col.id
                LEFT JOIN property_additional_features paf ON p.id = paf.property_id
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN user_roles ur ON u.role_id = ur.id
                LEFT JOIN real_estate_profiles rep ON u.id = rep.user_id
                WHERE p.id = :propertyId";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':propertyId', $propertyId, PDO::PARAM_INT);
            $stmt->execute();
            
            $property = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($property) {
                // Organizar la información del propietario
                $property['owner'] = [
                    'name' => $property['owner_name'],
                    'email' => $property['email'],
                    'phone' => $property['phone'],
                    'mobile' => $property['mobile'],
                    'role' => [
                        'name' => $property['user_role'],
                        'code' => $property['user_role_code']
                    ],
                    'company' => [
                        'name' => $property['user_role_code'] === 'regular' ? null : $property['owner_name'],
                        'logo' => $property['owner_logo'] ? '/uploads/logos/' . $property['owner_logo'] : null
                    ]
                ];
    
                // Convertir has_mockup a booleano
                $property['has_mockup'] = (bool)$property['has_mockup'];
                
                // Si no hay maqueta válida, asegurarse de que la URL sea null
                if (!$property['has_mockup']) {
                    $property['digital_mockup_url'] = null;
                }
    
                // Remover campos redundantes
                unset(
                    $property['owner_name'],
                    $property['first_name'],
                    $property['last_name'],
                    $property['email'],
                    $property['phone'],
                    $property['mobile'],
                    $property['user_role'],
                    $property['user_role_code'],
                    $property['owner_logo']
                );
    
                $property['amenities'] = $this->getPropertyAmenities($propertyId);
                $property['images'] = $this->getPropertyImages($propertyId);
                $property['videos'] = $this->getPropertyVideos($propertyId);
            }
            
            return $property;
            
        } catch (PDOException $e) {
            error_log("Error getting property details: " . $e->getMessage());
            throw new Exception("Error al obtener los detalles de la propiedad");
        }
    }

    private function getPropertyAmenities($propertyId) {
        try {
            $query = "
                SELECT 
                    ac.name as category,
                    ac.id as category_id,
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', a.id,
                            'name', a.name
                        )
                    ) as amenities
                FROM property_amenities pa
                JOIN amenities a ON pa.amenity_id = a.id
                JOIN amenity_categories ac ON a.category_id = ac.id
                WHERE pa.property_id = :propertyId
                GROUP BY ac.id, ac.name
                ORDER BY ac.display_order";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':propertyId', $propertyId, PDO::PARAM_INT);
            $stmt->execute();
            
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($results as &$row) {
                $row['amenities'] = json_decode($row['amenities'], true);
            }
            
            return $results;
            
        } catch (PDOException $e) {
            error_log("Error getting property amenities: " . $e->getMessage());
            return [];
        }
    }

    private function getPropertyImages($propertyId) {
        try {
            $query = "
                SELECT 
                    id,
                    file_path,
                    is_main,
                    display_order,
                    width,
                    height
                FROM property_images
                WHERE property_id = :propertyId
                ORDER BY is_main DESC, display_order ASC";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':propertyId', $propertyId, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error getting property images: " . $e->getMessage());
            return [];
        }
    }

    private function getPropertyVideos($propertyId) {
        try {
            $query = "
                SELECT 
                    id,
                    youtube_url,
                    youtube_id,
                    display_order
                FROM property_videos
                WHERE property_id = :propertyId
                ORDER BY display_order ASC";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':propertyId', $propertyId, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error getting property videos: " . $e->getMessage());
            return [];
        }
    }

    public function updateProperty($propertyId, $data) {
        try {
            $this->conn->beginTransaction();

            // Actualizar datos básicos de la propiedad
            $query = "
                UPDATE properties 
                SET 
                    title = :title,
                    description = :description,
                    price = :price,
                    bedrooms = :bedrooms,
                    bathrooms = :bathrooms,
                    half_bathrooms = :half_bathrooms,
                    parking_spots = :parking_spots,
                    built_area = :built_area,
                    total_area = :total_area,
                    updated_at = NOW()
                WHERE id = :propertyId";
            
            $stmt = $this->conn->prepare($query);
            
            $stmt->bindParam(':title', $data['title']);
            $stmt->bindParam(':description', $data['description']);
            $stmt->bindParam(':price', $data['price']);
            $stmt->bindParam(':bedrooms', $data['bedrooms'], PDO::PARAM_INT);
            $stmt->bindParam(':bathrooms', $data['bathrooms'], PDO::PARAM_INT);
            $stmt->bindParam(':half_bathrooms', $data['half_bathrooms'], PDO::PARAM_INT);
            $stmt->bindParam(':parking_spots', $data['parking_spots'], PDO::PARAM_INT);
            $stmt->bindParam(':built_area', $data['built_area']);
            $stmt->bindParam(':total_area', $data['total_area']);
            $stmt->bindParam(':propertyId', $propertyId, PDO::PARAM_INT);
            
            $stmt->execute();

            // Actualizar características adicionales
            if (isset($data['additional_features'])) {
                $this->updateAdditionalFeatures($propertyId, $data['additional_features']);
            }

            // Actualizar amenidades si se proporcionaron
            if (isset($data['amenities'])) {
                $this->updateAmenities($propertyId, $data['amenities']);
            }

            $this->conn->commit();
            return true;

        } catch (PDOException $e) {
            $this->conn->rollBack();
            error_log("Error updating property: " . $e->getMessage());
            throw new Exception("Error al actualizar la propiedad");
        }
    }

    private function updateAdditionalFeatures($propertyId, $features) {
        $query = "
            INSERT INTO property_additional_features 
                (property_id, conservation_status, storage_units, closets, elevators, 
                depth_meters, front_meters, built_levels)
            VALUES 
                (:propertyId, :conservation_status, :storage_units, :closets, :elevators,
                :depth_meters, :front_meters, :built_levels)
            ON DUPLICATE KEY UPDATE
                conservation_status = VALUES(conservation_status),
                storage_units = VALUES(storage_units),
                closets = VALUES(closets),
                elevators = VALUES(elevators),
                depth_meters = VALUES(depth_meters),
                front_meters = VALUES(front_meters),
                built_levels = VALUES(built_levels)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':propertyId' => $propertyId,
            ':conservation_status' => $features['conservation_status'],
            ':storage_units' => $features['storage_units'],
            ':closets' => $features['closets'],
            ':elevators' => $features['elevators'],
            ':depth_meters' => $features['depth_meters'],
            ':front_meters' => $features['front_meters'],
            ':built_levels' => $features['built_levels']
        ]);
    }

    private function updateAmenities($propertyId, $amenityIds) {
        // Eliminar amenidades existentes
        $stmt = $this->conn->prepare("DELETE FROM property_amenities WHERE property_id = ?");
        $stmt->execute([$propertyId]);

        // Insertar nuevas amenidades
        $query = "INSERT INTO property_amenities (property_id, amenity_id) VALUES (?, ?)";
        $stmt = $this->conn->prepare($query);
        
        foreach ($amenityIds as $amenityId) {
            $stmt->execute([$propertyId, $amenityId]);
        }
    }
}

// API Endpoints
header('Content-Type: application/json');

try {
    $handler = new PropertyHandler();

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
        switch ($_GET['action']) {
            case 'getProperty':
                if (!isset($_GET['id'])) {
                    throw new Exception("ID de propiedad no proporcionado");
                }
                $property = $handler->getPropertyDetails($_GET['id']);
                echo json_encode(['success' => true, 'data' => $property]);
                break;
                
            default:
                throw new Exception("Acción no válida");
        }
    }
    else if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'updateProperty':
                if (!isset($_POST['id'])) {
                    throw new Exception("ID de propiedad no proporcionado");
                }
                $success = $handler->updateProperty($_POST['id'], $_POST);
                echo json_encode(['success' => true]);
                break;
                
            default:
                throw new Exception("Acción no válida");
        }
    }
    else {
        throw new Exception("Método no válido o acción no especificada");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}