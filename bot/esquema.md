flowchart TB
    subgraph Entrada[Inicio de Interacción]
        Start[Usuario Inicia Conversación] --> Welcome[Mensaje de Bienvenida]
        Welcome --> Intent{Análisis de Intención}
        Intent --> |Búsqueda| Search[Proceso de Búsqueda]
        Intent --> |Información| Info[Información General]
        Intent --> |Ayuda| Help[Asistencia]
    end

    subgraph Search[Proceso de Búsqueda]
        SearchType{Tipo de Búsqueda}
        SearchType --> |Guiada| Guided[Búsqueda Guiada]
        SearchType --> |Directa| Direct[Búsqueda Directa]

        Guided --> Budget[Preguntar Presupuesto]
        Budget --> Location[Preguntar Ubicación]
        Location --> PropType[Preguntar Tipo de Propiedad]
        PropType --> Features[Características Básicas]

        Direct --> NLP[Procesamiento de Lenguaje Natural]
        NLP --> ExtractInfo[Extraer Información Clave]
    end

    subgraph Process[Procesamiento]
        Features --> DataQuery[Consulta a Base de Datos]
        ExtractInfo --> DataQuery
        DataQuery --> Filter[Filtrado de Resultados]
        Filter --> Rank[Ordenamiento por Relevancia]
        Rank --> Validate[Validación de Resultados]
    end

    subgraph Present[Presentación]
        Validate --> Results[Mostrar Resultados]
        Results --> Options{Opciones Disponibles}
        
        Options --> Details[Ver Detalles]
        Options --> Contact[Contactar Agente]
        Options --> Save[Guardar Propiedad]
        Options --> Refine[Refinar Búsqueda]
        Options --> New[Nueva Búsqueda]
    end

    subgraph Actions[Acciones Secundarias]
        Details --> |Mostrar| FullInfo[Información Completa]
        Contact --> |Iniciar| LeadGen[Generación de Lead]
        Save --> |Guardar en| Favorites[Favoritos]
        Refine --> |Volver a| Filter
        New --> |Reiniciar| SearchType
    end

    subgraph Database[Base de Datos]
        Properties[(Tabla Properties)]
        Amenities[(Tabla Amenities)]
        Images[(Tabla Images)]
        Locations[(Tabla Locations)]
        
        Properties --> DataQuery
        Amenities --> DataQuery
        Images --> DataQuery
        Locations --> DataQuery
    end

    subgraph LeadSystem[Sistema de Leads]
        LeadGen --> CreateLead[Crear Lead]
        CreateLead --> NotifyAgent[Notificar Agente]
        CreateLead --> SaveContact[Guardar Contacto]
        NotifyAgent --> TrackLead[Seguimiento]
    end

    subgraph History[Historial]
        UserHistory[(Historial de Usuario)]
        SearchHistory[(Historial de Búsquedas)]
        
        Results --> |Guardar| SearchHistory
        Options --> |Registrar| UserHistory
    end