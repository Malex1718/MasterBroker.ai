<?php
class Config {
    // Rutas base
    const API_PATH = __DIR__ . '/../../api';
    const ASSETS_PATH = __DIR__ . '/../../assets';
    const UPLOADS_PATH = __DIR__ . '/../../assets/uploads';
    
    // Configuración de la base de datos
    const DB_HOST = 'localhost';
    const DB_NAME = 'u383365684_vibien_master';
    const DB_USER = 'u383365684_root_vibien';
    const DB_PASS = 'Wasded-13';
    
    // URLs base
    const BASE_URL = 'https://tu-dominio.com';
    const API_URL = self::BASE_URL . '/api';
    
    // Configuración de entorno
    const ENVIRONMENT = 'development'; // development, production
    const DEBUG = true;
    
    // Configuración de archivos
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_IMAGES_PER_PROPERTY = 20;
    
    // Paths específicos para propiedades
    const PROPERTY_IMAGES_PATH = self::UPLOADS_PATH . '/properties/images';
    const PROPERTY_VIDEOS_PATH = self::UPLOADS_PATH . '/properties/videos';
    
    // Inicializar configuración
    public static function init() {
        // Configurar reportes de error según el entorno
        if (self::ENVIRONMENT === 'development') {
            error_reporting(E_ALL);
            ini_set('display_errors', 1);
        } else {
            error_reporting(0);
            ini_set('display_errors', 0);
        }

        // Configurar zona horaria
        date_default_timezone_set('America/Mexico_City');

        // Verificar y crear directorios necesarios
        self::createRequiredDirectories();
    }

    // Crear directorios necesarios
    private static function createRequiredDirectories() {
        $directories = [
            self::UPLOADS_PATH,
            self::PROPERTY_IMAGES_PATH,
            self::PROPERTY_VIDEOS_PATH
        ];

        foreach ($directories as $dir) {
            if (!file_exists($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }
}

// Inicializar configuración
Config::init();