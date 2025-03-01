<?php
class ValidationUtils {
    public static function validatePropertyData($data) {
        $errors = [];

        // Validar campos requeridos
        $requiredFields = [
            'usuario_id' => 'ID de usuario',
            'operacion' => 'Tipo de operación',
            'tipo_inmueble' => 'Tipo de inmueble',
            'direccion' => 'Dirección',
            'titulo' => 'Título',
            'descripcion' => 'Descripción'
        ];

        foreach ($requiredFields as $field => $label) {
            if (!isset($data[$field]) || empty($data[$field])) {
                $errors[] = "El campo {$label} es requerido";
            }
        }

        // Validar campos numéricos
        if (isset($data['precio'])) {
            if (!isset($data['precio']['monto']) || !is_numeric($data['precio']['monto'])) {
                $errors[] = "El precio debe ser un valor numérico válido";
            }
            if (isset($data['precio']['mantenimiento']) && !is_numeric($data['precio']['mantenimiento'])) {
                $errors[] = "El mantenimiento debe ser un valor numérico válido";
            }
        }

        // Validar superficie
        if (isset($data['superficie'])) {
            if (isset($data['superficie']['construida']) && !is_numeric($data['superficie']['construida'])) {
                $errors[] = "La superficie construida debe ser un valor numérico";
            }
            if (isset($data['superficie']['total']) && !is_numeric($data['superficie']['total'])) {
                $errors[] = "La superficie total debe ser un valor numérico";
            }
        }

        // Validar características
        if (isset($data['caracteristicas'])) {
            $caracteristicas = ['recamaras', 'banos', 'medioBano', 'estacionamientos'];
            foreach ($caracteristicas as $caract) {
                if (isset($data['caracteristicas'][$caract]) && !is_numeric($data['caracteristicas'][$caract])) {
                    $errors[] = "El valor de {$caract} debe ser numérico";
                }
            }
        }

        // Validar coordenadas
        if (isset($data['coordenadas'])) {
            if (!isset($data['coordenadas']['lat']) || !is_numeric($data['coordenadas']['lat'])) {
                $errors[] = "La latitud debe ser un valor numérico válido";
            }
            if (!isset($data['coordenadas']['lng']) || !is_numeric($data['coordenadas']['lng'])) {
                $errors[] = "La longitud debe ser un valor numérico válido";
            }
        }

        return [
            'isValid' => empty($errors),
            'errors' => $errors
        ];
    }

    public static function sanitizeString($str) {
        return filter_var(trim($str), FILTER_SANITIZE_STRING);
    }

    public static function sanitizeInt($int) {
        return filter_var($int, FILTER_VALIDATE_INT);
    }

    public static function sanitizeFloat($float) {
        return filter_var($float, FILTER_VALIDATE_FLOAT);
    }
}