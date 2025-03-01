<?php
class Property {
    private $conn;
    private $table_name = "properties";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        try {
            // Iniciar transacción 
            $this->conn->beginTransaction();

            // Insertar propiedad principal
            $query = "INSERT INTO " . $this->table_name . "
                    (user_id, operation_type_id, property_type_id, property_variant_id,
                    address, state_id, city_id, colony_id, latitude, longitude,
                    bedrooms, bathrooms, half_bathrooms, parking_spots,
                    built_area, total_area, age_type, age_years,
                    price, maintenance_fee, title, description,
                    status, created_by)
                    VALUES
                    (:user_id, :operation_type_id, :property_type_id, :property_variant_id,
                    :address, :state_id, :city_id, :colony_id, :latitude, :longitude,
                    :bedrooms, :bathrooms, :half_bathrooms, :parking_spots,
                    :built_area, :total_area, :age_type, :age_years,
                    :price, :maintenance_fee, :title, :description,
                    :status, :created_by)";

            $stmt = $this->conn->prepare($query);

            // Obtener IDs relacionados
            $operation_type_id = $this->getOperationTypeId($data['operacion']);
            $property_type_id = $this->getPropertyTypeId($data['tipo_inmueble']);

            // Vincular valores
            $stmt->bindValue(":user_id", $data['usuario_id'], PDO::PARAM_INT);
            $stmt->bindValue(":operation_type_id", $operation_type_id, PDO::PARAM_INT);
            $stmt->bindValue(":property_type_id", $property_type_id, PDO::PARAM_INT);
            $stmt->bindValue(":property_variant_id", $data['variante'] ?? null, PDO::PARAM_INT);
            $stmt->bindValue(":address", $data['direccion'], PDO::PARAM_STR);
            $stmt->bindValue(":state_id", $data['estado'] ?? null, PDO::PARAM_INT);
            $stmt->bindValue(":city_id", $data['ciudad'] ?? null, PDO::PARAM_INT);
            $stmt->bindValue(":colony_id", $data['colonia'] ?? null, PDO::PARAM_INT);
            $stmt->bindValue(":latitude", $data['coordenadas']['lat'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":longitude", $data['coordenadas']['lng'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":bedrooms", $data['caracteristicas']['recamaras'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(":bathrooms", $data['caracteristicas']['banos'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(":half_bathrooms", $data['caracteristicas']['medioBano'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(":parking_spots", $data['caracteristicas']['estacionamientos'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(":built_area", $data['superficie']['construida'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":total_area", $data['superficie']['total'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":age_type", $data['antiguedad']['tipo'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":age_years", $data['antiguedad']['anos'] ?? null, PDO::PARAM_INT);
            $stmt->bindValue(":price", $data['precio']['monto'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":maintenance_fee", $data['precio']['mantenimiento'] ?? null, PDO::PARAM_STR);
            $stmt->bindValue(":title", $data['titulo'], PDO::PARAM_STR);
            $stmt->bindValue(":description", $data['descripcion'], PDO::PARAM_STR);
            $stmt->bindValue(":status", 'draft', PDO::PARAM_STR);
            $stmt->bindValue(":created_by", $data['usuario_id'], PDO::PARAM_INT);

            $stmt->execute();
            $property_id = $this->conn->lastInsertId();

            // Registrar en el historial
            $this->registerHistory($property_id, $data['usuario_id'], 'create');

            // Confirmar transacción
            $this->conn->commit();

            return [
                "success" => true,
                "message" => "Propiedad creada exitosamente",
                "propiedad_id" => $property_id
            ];

        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log("Error en Property::create: " . $e->getMessage());
            return [
                "success" => false,
                "message" => "Error al crear la propiedad: " . $e->getMessage()
            ];
        }
    }

    private function registerHistory($property_id, $user_id, $action_type) {
        $query = "INSERT INTO property_history 
                (property_id, user_id, action_type, action_details) 
                VALUES 
                (:property_id, :user_id, :action_type, :action_details)";
        
        $stmt = $this->conn->prepare($query);
        
        $action_details = json_encode([
            'timestamp' => date('Y-m-d H:i:s'),
            'action' => $action_type
        ]);
        
        $stmt->bindValue(":property_id", $property_id, PDO::PARAM_INT);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);
        $stmt->bindValue(":action_type", $action_type, PDO::PARAM_STR);
        $stmt->bindValue(":action_details", $action_details, PDO::PARAM_STR);
        
        $stmt->execute();
    }

    private function getOperationTypeId($operation_code) {
        $query = "SELECT id FROM operation_types WHERE name = :operation_code";
        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(":operation_code", $operation_code, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->fetchColumn();
    }

    private function getPropertyTypeId($property_type_code) {
        $query = "SELECT id FROM property_types WHERE name = :property_type_code";
        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(":property_type_code", $property_type_code, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->fetchColumn();
    }
}