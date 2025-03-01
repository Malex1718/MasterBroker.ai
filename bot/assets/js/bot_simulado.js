// Configuración de Tailwind para el bot
tailwind.config = {
    prefix: 'bot-',
    important: true,
    corePlugins: {
        preflight: false,
    }
};

const { useState, useRef, useEffect } = React;

// Utilidades de formateo de números
const NumberFormatter = {
    unidades: [
        '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
        'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
    ],
    decenas: [
        '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
    ],
    centenas: [
        '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
    ],
    
    numberToWords: (number) => {
        if (number === 0) return 'cero';
        if (number < 0) return 'menos ' + NumberFormatter.numberToWords(Math.abs(number));
        
        let words = '';
        
        // Miles de millones
        if (number >= 1000000000) {
            const billions = Math.floor(number / 1000000000);
            number %= 1000000000;
            if (billions === 1) {
                words += 'mil millones ';
            } else {
                words += NumberFormatter.numberToWords(billions) + ' mil millones ';
            }
        }
        
        // Millones
        if (number >= 1000000) {
            const millions = Math.floor(number / 1000000);
            number %= 1000000;
            if (millions === 1) {
                words += 'un millón ';
            } else {
                words += NumberFormatter.numberToWords(millions) + ' millones ';
            }
        }
        
        // Miles
        if (number >= 1000) {
            const thousands = Math.floor(number / 1000);
            number %= 1000;
            if (thousands === 1) {
                words += 'mil ';
            } else {
                words += NumberFormatter.numberToWords(thousands) + ' mil ';
            }
        }
        
        // Centenas
        if (number >= 100) {
            if (number === 100) {
                words += 'cien ';
            } else {
                const hundreds = Math.floor(number / 100);
                number %= 100;
                words += NumberFormatter.centenas[hundreds] + ' ';
            }
        }
        
        // Decenas y unidades
        if (number > 0) {
            if (number < 20) {
                words += NumberFormatter.unidades[number];
            } else {
                const tens = Math.floor(number / 10);
                const ones = number % 10;
                words += NumberFormatter.decenas[tens];
                if (ones > 0) {
                    if (tens === 2) {
                        words = words.slice(0, -1) + 'i';
                    }
                    words += ' y ' + NumberFormatter.unidades[ones];
                }
            }
        }
        
        return words.trim();
    },
    
    formatPrice: (price) => {
        const inWords = NumberFormatter.numberToWords(Math.floor(price));
        const formatted = new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            useGrouping: true
        }).format(price)
        .replace('MXN', '')
        .replace(/\s/g, '')
        .trim();
        return `${inWords} pesos ($${formatted} MXN)`;
    },
    
    formatArea: (area) => {
        const inWords = NumberFormatter.numberToWords(Math.floor(area));
        return `${inWords} metros cuadrados (${area} m²)`;
    }
};

// Procesador de texto
const TextProcessor = {
    processForVoice: (text) => {
        // Convertir números simples a palabras (para recámaras, baños, etc.)
        text = text.replace(/\b\d+\b(?=\s*(?:departamentos?|recámaras?|baños?|pisos?))/g, (match) => {
            return NumberFormatter.numberToWords(parseInt(match));
        });

        // Convertir precios a palabras
        text = text.replace(/\$\s*([\d,]+)\s*MXN/g, (match, numbers) => {
            const price = parseInt(numbers.replace(/,/g, ''));
            return NumberFormatter.numberToWords(price) + ' pesos';
        });

        // Convertir áreas a palabras
        text = text.replace(/(\d+(?:\.\d+)?)\s*m²/g, (match, number) => {
            return NumberFormatter.numberToWords(parseFloat(number)) + ' metros cuadrados';
        });

        // Reemplazar URLs con texto más amigable para voz
        text = text.replace(
            /https:\/\/masterbroker\.ai\/propiedad\.html\?id=\d+/g,
            'enlace a la propiedad'
        );

        return text;
    },

    formatForDisplay: (text) => {
        // Formatear precios para mostrar solo números
        text = text.replace(/(?:\w+(?:\s+\w+)*)\s+pesos/g, (match, numbers) => {
            const numericMatch = match.match(/(\d[\d,]*)/);
            return numericMatch ? `$${numericMatch[1]} MXN` : match;
        });

        // Formatear áreas para mostrar solo números
        text = text.replace(/(?:\w+(?:\s+\w+)*)\s+metros\s+cuadrados/g, (match, number) => {
            const numericMatch = match.match(/(\d+)/);
            return numericMatch ? `${numericMatch[1]} m²` : match;
        });

        // Convertir números escritos en palabras a dígitos para ciertos casos
        const wordPatterns = {
            'un': '1', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
            'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
            'diez': '10'
        };

        Object.entries(wordPatterns).forEach(([word, digit]) => {
            const regex = new RegExp(`\\b${word}\\s+(departamentos?|recámaras?|baños?|pisos?)\\b`, 'gi');
            text = text.replace(regex, `${digit} $1`);
        });

        return text;
    },

    process: (text, options = { forVoice: false, format: true, clean: true }) => {
        let processedText = text;

        // Limpiar el texto si se solicita
        if (options.clean) {
            processedText = TextProcessor.cleanText(processedText);
        }

        // Procesar para voz o formato de visualización
        if (options.forVoice) {
            processedText = TextProcessor.processForVoice(processedText);
        } else if (options.format) {
            processedText = TextProcessor.formatForDisplay(processedText);
        }

        return processedText;
    },

    cleanText: (text) => {
        // Eliminar espacios múltiples
        text = text.replace(/\s+/g, ' ');
        
        // Corregir espacios alrededor de signos de puntuación
        text = text.replace(/\s+([.,;!?])/g, '$1');
        text = text.replace(/([.,;!?])(\w)/g, '$1 $2');
        
        return text.trim();
    }
};

// Definición de iconos usando imágenes
const Icons = {
    Send: () => (
        <img 
            src="/assets/img/send.png" 
            alt="Enviar mensaje" 
            className="bot-w-5 bot-h-5 bot-object-contain" 
        />
    ),
    
    Building: () => (
        <img 
            src="/assets/img/building.png" 
            alt="Edificio" 
            className="bot-w-6 bot-h-6 bot-object-contain" 
        />
    ),
    
    Close: () => (
        <img 
            src="/assets/img/close.png" 
            alt="Cerrar" 
            className="bot-w-4 bot-h-4 bot-object-contain" 
        />
    ),
    
    Chat: () => (
        <img 
            src="/assets/img/chat.png" 
            alt="Chat" 
            className="bot-w-6 bot-h-6 bot-object-contain" 
        />
    ),
    
    Mic: ({ isListening }) => (
        <img 
            src="/assets/img/mic.png" 
            alt="Micrófono" 
            className={`bot-w-6 bot-h-6 bot-object-contain ${
                isListening ? 'bot-animate-pulse' : ''
            }`}
        />
    ),
    
    VoiceMode: () => (
        <img 
            src="/assets/img/voice-mode.png" 
            alt="Modo voz" 
            className="bot-w-6 bot-h-6 bot-object-contain" 
        />
    ),
    
    TextMode: () => (
        <img 
            src="/assets/img/text-mode.png" 
            alt="Modo texto" 
            className="bot-w-6 bot-h-6 bot-object-contain" 
        />
    ),

    ViewProperty: () => (
        <img 
            src="/assets/img/view-property.png" 
            alt="Ver propiedad" 
            className="bot-w-4 bot-h-4 bot-mr-2" 
        />
    )
};

// Componentes de la interfaz
const ModeToggle = ({ isVoiceMode, onToggle }) => (
    <button
        onClick={onToggle}
        className="bot-p-2 bot-hover:bg-white/10 bot-rounded-lg bot-transition-colors bot-text-white"
        title={isVoiceMode ? "Cambiar a modo texto" : "Cambiar a modo voz"}
    >
        {isVoiceMode ? <Icons.TextMode /> : <Icons.VoiceMode />}
    </button>
);

const VoiceInput = ({ onVoiceInput, disabled, autoStart = false }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            recognitionRef.current = new webkitSpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'es-ES';

            recognitionRef.current.onresult = (event) => {
                const text = event.results[0][0].transcript;
                onVoiceInput(text);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Error en reconocimiento de voz:', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [onVoiceInput]);

    const startListening = () => {
        if (disabled || !recognitionRef.current) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (error) {
            console.error('Error al iniciar reconocimiento de voz:', error);
        }
    };

    useEffect(() => {
        if (autoStart && !disabled && !isListening) {
            const timer = setTimeout(startListening, 1000);
            return () => clearTimeout(timer);
        }
    }, [autoStart, disabled]);

    const toggleListening = () => {
        if (disabled) return;
        
        if (isListening) {
            recognitionRef.current?.abort();
            setIsListening(false);
        } else {
            startListening();
        }
    };

    if (!('webkitSpeechRecognition' in window)) {
        return null;
    }

    return (
        <button
            onClick={toggleListening}
            disabled={disabled}
            className={`bot-p-4 bot-rounded-xl bot-transition-all bot-shadow-lg ${
                isListening 
                    ? 'bot-bg-red-500 bot-text-white bot-scale-110' 
                    : 'bot-bg-blue-600 bot-text-white bot-hover:bg-blue-700'
            } bot-disabled:opacity-50 bot-disabled:cursor-not-allowed`}
            aria-label={isListening ? 'Detener grabación' : 'Iniciar grabación'}
        >
            <Icons.Mic isListening={isListening} />
        </button>
    );
};

const SoundWaves = ({ isPlaying }) => (
    <div className={`bot-absolute bot-bottom-[72px] bot-left-0 bot-right-0 bot-bg-blue-600 bot-text-white bot-py-3 bot-flex bot-justify-center bot-items-center bot-transition-all bot-duration-300 bot-min-h-[48px] bot-z-10 ${
        isPlaying ? 'bot-opacity-100 bot-translate-y-0' : 'bot-opacity-0 bot-translate-y-2 bot-pointer-events-none'
    }`}>
        <div className="bot-flex bot-items-center bot-space-x-2">
            <span className="bot-text-sm bot-font-medium">Maia está hablando</span>
            <div className="bot-flex bot-items-center bot-space-x-1">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="bot-w-0.5 bot-bg-white bot-rounded-full bot-transform bot-transition-all bot-duration-75 bot-animate-soundwave"
                        style={{
                            animationDelay: `${i * 0.1}s`,
                            height: isPlaying ? '16px' : '4px'
                        }}
                    />
                ))}
            </div>
        </div>
    </div>
);

const formatMessageText = (text) => {
    // Primero limpiamos las referencias [ID:X]
    text = text.replace(/\s*\[ID:\d+\]\s*/g, ' ');
    
    // Expresión regular para URLs con espacios permitidos
    const propertyUrlRegex = /https?:\/\/masterbroker\s*\.\s*ai\/propiedad\s*\.\s*html\s*\?\s*id=\s*(\d+)/g;
    
    if (!propertyUrlRegex.test(text)) {
        return <p className="bot-text-sm bot-md:text-base bot-leading-relaxed">{text}</p>;
    }

    const parts = [];
    let lastIndex = 0;
    let match;

    // Resetear el índice de la expresión regular
    propertyUrlRegex.lastIndex = 0;

    // Procesar el texto y convertir las URLs en botones
    while ((match = propertyUrlRegex.exec(text)) !== null) {
        // Agregar el texto antes del match como un párrafo separado
        if (match.index > lastIndex) {
            parts.push(
                <p key={`text-${lastIndex}`} className="bot-text-sm bot-md:text-base bot-leading-relaxed bot-mb-3">
                    {text.slice(lastIndex, match.index)}
                </p>
            );
        }

        // Extraer el ID de la propiedad
        const propertyId = match[1];
        
        // Construir la URL limpia
        const cleanUrl = `https://masterbroker.ai/propiedad.html?id=${propertyId}`;
        
        // Agregar el botón de link en su propio contenedor
        parts.push(
            <div key={`button-${match.index}`} className="bot-mb-3">
                <a
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bot-inline-flex bot-items-center bot-px-4 bot-py-2 bot-bg-blue-600 bot-text-white bot-rounded-lg bot-hover:bg-blue-700 bot-transition-colors"
                >
                    <Icons.ViewProperty />
                    Ver propiedad
                </a>
            </div>
        );

        lastIndex = match.index + match[0].length;
    }

    // Agregar el texto restante después del último match como párrafo separado
    if (lastIndex < text.length) {
        parts.push(
            <p key={`text-final`} className="bot-text-sm bot-md:text-base bot-leading-relaxed">
                {text.slice(lastIndex)}
            </p>
        );
    }

    return <div>{parts}</div>;
};

const Message = ({ message }) => {
    const processedText = message.type === 'bot' 
        ? TextProcessor.process(message.text, { 
            forVoice: false, 
            format: true, 
            clean: true 
          })
        : message.text;

    return (
        <div className={`bot-flex ${message.type === 'user' ? 'bot-justify-end' : 'bot-justify-start'} bot-mb-4`}>
            <div className={`bot-max-w-[80%] bot-rounded-2xl bot-px-6 bot-py-3 bot-shadow-lg ${
                message.type === 'user' 
                    ? 'bot-bg-blue-600 bot-text-white' 
                    : 'bot-bg-white bot-text-gray-800 bot-border bot-border-gray-200'
            }`}>
                {formatMessageText(processedText)}
            </div>
        </div>
    );
};

const TypingIndicator = () => (
    <div className="bot-flex bot-justify-start bot-mb-4">
        <div className="bot-bg-white bot-border bot-border-gray-200 bot-rounded-2xl bot-px-4 bot-py-2 bot-shadow-lg">
            <div className="bot-flex bot-space-x-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bot-w-2 bot-h-2 bot-bg-blue-600 bot-rounded-full bot-animate-bounce" 
                         style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
            </div>
        </div>
    </div>
);

function BotInterface({ onClose, isFirstOpen }) {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [shouldStartListening, setShouldStartListening] = useState(false);
    const messagesEndRef = useRef(null);
    const audioRef = useRef(new Audio());
    const chatContainerRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            const chat = chatContainerRef.current;
            const isScrolledToBottom = chat.scrollHeight - chat.clientHeight <= chat.scrollTop + 100;
            
            if (isScrolledToBottom) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }
    };

    const playAudio = async (base64Audio) => {
        try {
            if (audioRef.current.src) {
                URL.revokeObjectURL(audioRef.current.src);
            }
            const audioBlob = await fetch(`data:audio/mpeg;base64,${base64Audio}`).then(r => r.blob());
            const audioUrl = URL.createObjectURL(audioBlob);
            audioRef.current.src = audioUrl;
            setIsPlaying(true);
            await audioRef.current.play();
            audioRef.current.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
                if (isVoiceMode) {
                    setShouldStartListening(true);
                }
            };
        } catch (error) {
            console.error('Error reproduciendo audio:', error);
            setIsPlaying(false);
        }
    };

    const sendMessage = async (message) => {
        try {
            const messageHistory = messages.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));

            const response = await fetch('/bot/api/agente.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    history: messageHistory,
                    requireAudio: isVoiceMode
                })
            });

            if (!response.ok) {
                throw new Error('Error en la comunicación con el servidor');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Error procesando el mensaje');
            }

            const processedText = TextProcessor.process(data.text, {
                forVoice: isVoiceMode,
                format: !isVoiceMode,
                clean: true
            });

            if (data.audio && isVoiceMode) {
                await playAudio(data.audio);
            }

            return processedText;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    };

    const handleSend = async (messageText = inputValue) => {
        if (!messageText.trim() || isLoading || isPlaying) return;

        setIsLoading(true);
        setShouldStartListening(false);
        const userMessage = { type: 'user', text: messageText };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        try {
            const botResponse = await sendMessage(messageText);
            setMessages(prev => [...prev, { 
                type: 'bot', 
                text: botResponse 
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { 
                type: 'bot', 
                text: 'Lo siento, ha ocurrido un error. ¿Podrías intentarlo de nuevo?' 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVoiceInput = (text) => {
        setInputValue(text);
        handleSend(text);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isPlaying) {
            e.preventDefault();
            handleSend();
        }
    };

    useEffect(() => {
        scrollToBottom();
        
        if (isFirstOpen) {
            setIsLoading(true);
            sendMessage('Hola')
                .then(response => {
                    setMessages([{ type: 'bot', text: response }]);
                })
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }

        return () => {
            if (audioRef.current.src) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, [isFirstOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="bot-flex bot-flex-col bot-w-full bot-h-full bot-bg-white">
            {/* Header */}
            <div className="bot-bg-gradient-to-r bot-from-blue-600 bot-to-blue-700 bot-text-white bot-px-6 bot-py-5 bot-shadow-md">
                <div className="bot-flex bot-items-center bot-justify-between">
                    <div className="bot-flex bot-items-center bot-space-x-4">
                        <div className="bot-flex bot-items-center">
                            <div className="bot-p-2.5 bot-bg-white/10 bot-rounded-xl bot-backdrop-blur-sm">
                                <Icons.Building />
                            </div>
                            <div className="bot-ml-4">
                                <h1 className="bot-text-2xl bot-font-bold bot-tracking-tight">Maia</h1>
                                <p className="bot-text-sm bot-text-white/80">Asistente Inmobiliario</p>
                            </div>
                        </div>
                    </div>
                    <div className="bot-flex bot-items-center bot-space-x-2">
                        <ModeToggle 
                            isVoiceMode={isVoiceMode} 
                            onToggle={() => setIsVoiceMode(!isVoiceMode)} 
                        />
                        <button 
                            onClick={onClose}
                            className="bot-p-2 bot-hover:bg-white/10 bot-rounded-lg bot-transition-colors"
                            aria-label="Cerrar chat"
                        >
                            <Icons.Close />
                        </button>
                    </div>
                </div>
            </div>

            {/* Área de mensajes */}
            <div 
                ref={chatContainerRef}
                className="bot-flex-1 bot-overflow-y-auto bot-px-6 bot-py-6 bot-bg-gray-50"
            >
                {messages.map((message, index) => (
                    <Message key={index} message={message} />
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            {/* Área de input */}
            <div className="bot-relative bot-mt-auto bot-bg-white">
                <SoundWaves isPlaying={isPlaying} />
                <div className="bot-border-t bot-border-gray-200 bot-px-6 bot-py-4">
                    {!isVoiceMode ? (
                        <div className="bot-flex bot-space-x-4">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Escribe tu mensaje aquí..."
                                className="bot-flex-1 bot-px-4 bot-py-2 bot-bg-gray-100 bot-border-0 bot-rounded-xl focus:bot-ring-2 focus:bot-ring-blue-500 bot-text-gray-800"
                                disabled={isLoading || isPlaying}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={isLoading || isPlaying || !inputValue.trim()}
                                className="bot-p-3 bot-bg-blue-600 bot-text-white bot-rounded-xl bot-hover:bg-blue-700 bot-transition-colors bot-disabled:opacity-50"
                            >
                                <Icons.Send />
                            </button>
                        </div>
                    ) : (
                        <div className="bot-flex bot-justify-center">
                            <VoiceInput 
                                onVoiceInput={handleVoiceInput}
                                disabled={isLoading || isPlaying}
                                autoStart={shouldStartListening}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
  
function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [isFirstOpen, setIsFirstOpen] = useState(false);

    const handleOpen = () => {
        if (!isOpen) {
            if (!hasOpened) {
                setIsFirstOpen(true);
                setHasOpened(true);
            } else {
                setIsFirstOpen(false);
            }
            setIsOpen(true);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setIsFirstOpen(false);
    };

    return (
        <div className="bot-container">
            <div className="bot-wrapper bot-fixed md:bot-bottom-6 md:bot-right-6 bot-bottom-0 bot-right-0">
                <div className={`bot-transition-all bot-duration-300 bot-transform ${
                    isOpen 
                        ? 'bot-scale-100 bot-opacity-100 md:bot-w-[400px] md:bot-h-[600px] bot-w-full bot-h-full bot-fixed bot-top-0 bot-left-0 md:bot-relative md:bot-top-auto md:bot-left-auto' 
                        : 'bot-scale-95 bot-opacity-0 bot-pointer-events-none bot-w-0 bot-h-0'
                }`}>
                    <div className="bot-bg-white bot-rounded-2xl bot-shadow-xl bot-overflow-hidden bot-h-full bot-w-full">
                        {isOpen && (
                            <BotInterface 
                                onClose={handleClose} 
                                isFirstOpen={isFirstOpen} 
                            />
                        )}
                    </div>
                </div>
                
                {!isOpen && (
                    <button 
                        onClick={handleOpen}
                        className="bot-fixed bot-bottom-6 bot-right-6 bot-p-4 bot-bg-blue-600 bot-text-white bot-rounded-full bot-hover:bg-blue-700 bot-transition-all bot-duration-300 bot-shadow-lg bot-hover:shadow-xl bot-transform bot-hover:scale-110"
                        aria-label="Abrir chat"
                    >
                        <Icons.Chat />
                    </button>
                )}
            </div>
        </div>
    );
}

// Inicializar la aplicación
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ChatWidget />);