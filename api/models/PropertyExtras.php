<?php
// api/models/PropertyExtras.php

class PropertyExtras {
    private $conn;
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function getPropertyAmenities($propertyId) {
        $query = "
            SELECT a.id, a.name, a.category_id,
                   LOWER(REPLACE(REPLACE(a.name, ' ', '_'), 'á', 'a')) as code
            FROM property_amenities pa
            JOIN amenities a ON pa.amenity_id = a.id
            WHERE pa.property_id = ?";
            
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $propertyId);
        $stmt->execute();
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }
    
    public function getAdditionalFeatures($propertyId) {
        $query = "
            SELECT conservation_status,
                   storage_units,
                   closets,
                   elevators,
                   depth_meters,
                   front_meters,
                   built_levels
            FROM property_additional_features
            WHERE property_id = ?";
            
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $propertyId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc();
    }
    
    public function saveAmenities($propertyId, $amenities) {
        // Eliminar amenities existentes
        $deleteQuery = "DELETE FROM property_amenities WHERE property_id = ?";
        $stmt = $this->conn->prepare($deleteQuery);
        $stmt->bind_param('i', $propertyId);
        $stmt->execute();
        
        // Insertar nuevos amenities
        if (!empty($amenities)) {
            $insertQuery = "INSERT INTO property_amenities (property_id, amenity_id) 
                           SELECT ?, id 
                           FROM amenities 
                           WHERE LOWER(REPLACE(REPLACE(name, ' ', '_'), 'á', 'a')) = ?";
            $stmt = $this->conn->prepare($insertQuery);
            
            foreach ($amenities as $amenityCode) {
                $stmt->bind_param('is', $propertyId, $amenityCode);
                $stmt->execute();
            }
        }
        
        return true;
    }
    
    public function saveAdditionalFeatures($propertyId, $features) {
        // Verificar si existen características
        $checkQuery = "SELECT 1 FROM property_additional_features WHERE property_id = ?";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param('i', $propertyId);
        $stmt->execute();
        $exists = $stmt->get_result()->num_rows > 0;
        
        if ($exists) {
            $query = "
                UPDATE property_additional_features 
                SET conservation_status = ?,
                    storage_units = ?,
                    closets = ?,
                    elevators = ?,
                    depth_meters = ?,
                    front_meters = ?,
                    built_levels = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE property_id = ?";
        } else {
            $query = "
                INSERT INTO property_additional_features (
                    property_id,
                    conservation_status,
                    storage_units,
                    closets,
                    elevators,
                    depth_meters,
                    front_meters,
                    built_levels
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        }
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param(
            $exists ? 'siiiddii' : 'isiiiiii',
            $exists ? $features['conservation_status'] : $propertyId,
            $exists ? $features['storage_units'] : $features['conservation_status'],
            $exists ? $features['closets'] : $features['storage_units'],
            $exists ? $features['elevators'] : $features['closets'],
            $exists ? $features['depth_meters'] : $features['elevators'],
            $exists ? $features['front_meters'] : $features['depth_meters'],
            $exists ? $features['built_levels'] : $features['front_meters'],
            $exists ? $propertyId : $features['built_levels']
        );
        
        return $stmt->execute();
    }
    
    public function logChange($propertyId, $userId, $details) {
        $query = "
            INSERT INTO property_history (
                property_id,
                user_id,
                action_type,
                action_details
            ) VALUES (?, ?, 'update', ?)";
            
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('iis', $propertyId, $userId, $details);
        return $stmt->execute();
    }
}