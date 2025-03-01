import os
from pathlib import Path

def contar_lineas_codigo(ruta):
    """
    Cuenta las líneas de código para archivos PHP, JS, HTML, CSS y Python.
    
    Args:
        ruta (str): Ruta al directorio del proyecto
    
    Returns:
        dict: Estadísticas de líneas por extensión y totales
    """
    # Extensiones específicas a analizar
    extensiones = ['.php', '.js', '.html', '.htm', '.css', '.py']
    
    estadisticas = {
        'total_lineas': 0,
        'total_archivos': 0,
        'por_extension': {}
    }
    
    # Patrones de comentarios por extensión
    comentarios = {
        '.php': ['//', '#', '/*', '*/', '*'],
        '.js': ['//', '/*', '*/', '*'],
        '.html': ['<!--', '-->'],
        '.css': ['/*', '*/', '*'],
        '.py': ['#']
    }
    
    def es_comentario(linea, extension):
        for inicio in comentarios.get(extension, []):
            if linea.strip().startswith(inicio):
                return True
        return False
    
    def contar_lineas_archivo(archivo, extension):
        try:
            with open(archivo, 'r', encoding='utf-8') as f:
                lineas = []
                for linea in f:
                    linea = linea.strip()
                    if linea and not es_comentario(linea, extension):
                        lineas.append(linea)
                return len(lineas)
        except Exception as e:
            print(f"Error al leer {archivo}: {str(e)}")
            return 0
    
    for ruta_actual, _, archivos in os.walk(ruta):
        for archivo in archivos:
            extension = Path(archivo).suffix.lower()
            if extension in extensiones:
                ruta_completa = os.path.join(ruta_actual, archivo)
                
                if extension not in estadisticas['por_extension']:
                    estadisticas['por_extension'][extension] = {
                        'archivos': 0,
                        'lineas': 0
                    }
                
                num_lineas = contar_lineas_archivo(ruta_completa, extension)
                
                estadisticas['por_extension'][extension]['archivos'] += 1
                estadisticas['por_extension'][extension]['lineas'] += num_lineas
                estadisticas['total_lineas'] += num_lineas
                estadisticas['total_archivos'] += 1
    
    return estadisticas

if __name__ == "__main__":
    # Ruta del proyecto (usa el directorio actual por defecto)
    ruta_proyecto = "."
    
    print("\nAnalizando proyecto...")
    resultados = contar_lineas_codigo(ruta_proyecto)
    
    print("\n=== Estadísticas del Proyecto ===")
    print(f"Total de archivos: {resultados['total_archivos']}")
    print(f"Total de líneas de código: {resultados['total_lineas']}")
    print("\nDesglose por tipo de archivo:")
    
    # Ordenar las extensiones por número de líneas
    extensiones_ordenadas = sorted(
        resultados['por_extension'].items(),
        key=lambda x: x[1]['lineas'],
        reverse=True
    )
    
    for ext, datos in extensiones_ordenadas:
        print(f"\n{ext.upper()[1:]}:")  # Muestra la extensión sin el punto
        print(f"  Archivos: {datos['archivos']}")
        print(f"  Líneas de código: {datos['lineas']}")
        if datos['archivos'] > 0:
            promedio = datos['lineas'] / datos['archivos']
            print(f"  Promedio de líneas por archivo: {promedio:.1f}")