<?php
class DashboardStats {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getUserStats() {
        try {
            $query = "SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_users,
                SUM(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as online_users
            FROM users";
            
            $stmt = $this->conn->query($query);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Calcular el crecimiento mensual
            $query = "SELECT 
                COUNT(*) as last_month 
                FROM users 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) 
                AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
            
            $stmt = $this->conn->query($query);
            $lastMonth = $stmt->fetch(PDO::FETCH_ASSOC)['last_month'];
            
            $result['monthly_growth'] = $lastMonth > 0 ? 
                (($result['new_users'] - $lastMonth) / $lastMonth) * 100 : 0;
            
            return $result;
        } catch(PDOException $e) {
            error_log("Error en getUserStats: " . $e->getMessage());
            return false;
        }
    }

    public function getPropertyStats() {
        try {
            $query = "SELECT 
                COUNT(*) as total_properties,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as active_properties,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_properties
            FROM properties";
            
            $stmt = $this->conn->query($query);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            // Obtener datos históricos para la gráfica
            $query = "SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as property_count,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status != 'published' THEN 1 ELSE 0 END) as inactive_count
            FROM properties
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC";
            
            $stmt = $this->conn->query($query);
            $historicalData = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $result['months'] = array_column($historicalData, 'month');
            $result['active'] = array_column($historicalData, 'active_count');
            $result['inactive'] = array_column($historicalData, 'inactive_count');
            
            return $result;
        } catch(PDOException $e) {
            error_log("Error en getPropertyStats: " . $e->getMessage());
            return false;
        }
    }

    public function getLeadStats() {
        try {
            $query = "SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_leads,
                SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) as converted_leads
            FROM property_leads";
            
            $stmt = $this->conn->query($query);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Calcular tasa de conversión
            $result['conversion_rate'] = $result['total_leads'] > 0 ? 
                ($result['converted_leads'] / $result['total_leads']) * 100 : 0;
            
            return $result;
        } catch(PDOException $e) {
            error_log("Error en getLeadStats: " . $e->getMessage());
            return false;
        }
    }

    public function getRecentActivity() {
        try {
            $query = "SELECT * FROM (
                SELECT 
                    'user' as type,
                    CONCAT('Nuevo usuario: ', first_name, ' ', last_name) as description,
                    created_at as date
                FROM users
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                
                UNION ALL
                
                SELECT 
                    'property' as type,
                    CONCAT('Nueva propiedad: ', title) as description,
                    created_at as date
                FROM properties
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                
                UNION ALL
                
                SELECT 
                    'lead' as type,
                    CONCAT('Nuevo lead generado para propiedad #', property_id) as description,
                    created_at as date
                FROM property_leads
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ) as activity
            ORDER BY date DESC
            LIMIT 5";
            
            $stmt = $this->conn->query($query);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Error en getRecentActivity: " . $e->getMessage());
            return false;
        }
    }
}
?>