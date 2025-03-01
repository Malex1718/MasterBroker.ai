const { useState, useEffect } = React;
const { createRoot } = ReactDOM;
const e = React.createElement;
const generateState = () => Math.random().toString(36).substring(7);

const openAuthWindow = (url) => {
    return window.open(
        url,
        'SocialAuth',
        'width=600,height=700,scrollbars=yes'
    );
};

const LoginModal = ({ platform, isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [authMethod, setAuthMethod] = useState(null);

        // Definimos platformConfigs dentro del componente
        const platformConfigs = {
            facebook: {
                name: 'Facebook',
                displayLetter: 'f',
                clientId: '1615416145731754',
                scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
                description: 'Conecta tu página de Facebook para gestionar tu presencia en la plataforma.',
                authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
                isAvailable: true
            },
            twitter: {
                name: 'X',
                icon: '/propuestas/assets/img/x-twitter.png',
                description: 'Próximamente: Conecta tu cuenta de X para programar y publicar contenido automáticamente.',
                isAvailable: false
            },
            instagram: {
                name: 'Instagram',
                icon: '/propuestas/assets/img/instagram.png',
                description: 'Próximamente: Vincula tu cuenta profesional de Instagram para administrar tu contenido.',
                isAvailable: false
            },
            linkedin: {
                name: 'LinkedIn',
                icon: '/propuestas/assets/img/linkedin.png',
                description: 'Próximamente: Conecta tu perfil empresarial de LinkedIn para gestionar tu presencia profesional.',
                isAvailable: false,
                comingSoon: true
            },
            tiktok: {
                name: 'TikTok',
                icon: '/propuestas/assets/img/tiktok.png',
                description: 'Próximamente: Conecta tu cuenta de TikTok para gestionar tu contenido y alcance.',
                isAvailable: false,
                comingSoon: true
            }
        };

    const generateState = () => Math.random().toString(36).substring(7);

    const openAuthWindow = (url) => {
        return window.open(
            url,
            'SocialAuth',
            'width=600,height=700,scrollbars=yes,centerscreen=yes'
        );
    };

    const setupAuthListener = (authWindow, state, method = null) => {
        const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'auth_callback') {
                const { code, returnedState } = event.data;

                if (returnedState !== state) {
                    throw new Error('Invalid state parameter');
                }

                try {
                    const response = await fetch('/api/auth/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            platform,
                            code,
                            method,
                            redirect_uri: `${window.location.origin}/auth/callback/${platform}`
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al obtener el token');
                    }

                    const data = await response.json();
                    localStorage.setItem(`${platform}_token`, data.access_token);
                    
                    if (platform === 'instagram' && method === 'facebook') {
                        const igAccountsResponse = await fetch('/api/auth/instagram/accounts', {
                            headers: {
                                'Authorization': `Bearer ${data.access_token}`
                            }
                        });

                        if (!igAccountsResponse.ok) {
                            throw new Error('Error al obtener cuentas de Instagram');
                        }

                        const igAccounts = await igAccountsResponse.json();
                        if (igAccounts.length === 0) {
                            throw new Error('No se encontraron cuentas profesionales de Instagram vinculadas');
                        }
                        data.account = igAccounts[0];
                    }

                    onSuccess({
                        platform,
                        profile: data.account || data.profile,
                        authMethod: method
                    });

                    authWindow.close();
                    window.removeEventListener('message', handleMessage);
                    onClose();

                } catch (err) {
                    setError(err.message || 'Error al procesar la autenticación');
                    console.error('Error en autenticación:', err);
                    authWindow.close();
                } finally {
                    setIsLoading(false);
                }
            }
        };

        window.addEventListener('message', handleMessage);
    };

    const handleFacebookAuth = async () => {
        setIsLoading(true);
        setError(null);
    
        try {
            window.FB.init({
                appId: '1615416145731754',
                cookie: true,
                xfbml: true,
                version: 'v18.0'
            });
    
            const loginResponse = await new Promise((resolve, reject) => {
                window.FB.login((response) => {
                    if (response.authResponse) {
                        resolve(response);
                    } else {
                        reject(new Error('Usuario canceló el login'));
                    }
                }, {
                    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic'
                });
            });
    
            const pagesResponse = await new Promise((resolve, reject) => {
                window.FB.api('/me/accounts', (response) => {
                    if (response && !response.error) {
                        resolve(response);
                    } else {
                        reject(new Error('Error al obtener páginas'));
                    }
                });
            });
    
            if (pagesResponse.data && pagesResponse.data.length > 0) {
                localStorage.setItem('facebook_access_token', loginResponse.authResponse.accessToken);
                localStorage.setItem('facebook_user_id', loginResponse.authResponse.userID);
                localStorage.setItem('facebook_pages', JSON.stringify(pagesResponse.data));
    
                onSuccess({
                    platform: 'facebook',
                    profile: {
                        id: loginResponse.authResponse.userID,
                        pages: pagesResponse.data
                    }
                });
    
                onClose();
            } else {
                throw new Error('No se encontraron páginas asociadas a esta cuenta');
            }
    
        } catch (err) {
            console.error('Error en auth de Facebook:', err);
            setError(err.message || 'Error al conectar con Facebook');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuth = async (method = null) => {
        if (!platformConfigs[platform].isAvailable) {
            setError('Esta plataforma estará disponible próximamente');
            return;
        }

        if (platform === 'facebook') {
            return handleFacebookAuth();
        }

        setIsLoading(true);
        setError(null);
        setAuthMethod(method);

        try {
            const state = generateState();
            localStorage.setItem('oauth_state', state);
            const redirectUri = `${window.location.origin}/auth/callback/${platform}`;
            let authUrl = new URL(platformConfigs[platform].authUrl);

            authUrl.searchParams.append('client_id', platformConfigs[platform].clientId);
            authUrl.searchParams.append('redirect_uri', redirectUri);
            authUrl.searchParams.append('state', state);
            authUrl.searchParams.append('scope', platformConfigs[platform].scopes.join(' '));
            authUrl.searchParams.append('response_type', 'code');

            if (platform === 'facebook' || (platform === 'instagram' && method === 'facebook')) {
                authUrl.searchParams.append('display', 'popup');
            }

            const authWindow = openAuthWindow(authUrl.toString());
            setupAuthListener(authWindow, state, method);

        } catch (err) {
            setError('Error al iniciar la autenticación');
            console.error('Error al iniciar auth:', err);
        }
    };

    if (!isOpen) return null;

    return e('div', {
        className: 'modal-overlay'
    },
        e('div', {
            className: 'modal-container'
        },
            // Header
            e('div', {
                className: 'modal-header'
            },
                e('div', {
                    className: 'modal-title'
                },
                    platform === 'instagram' && !authMethod ? (
                        e('h2', {
                            className: 'modal-heading'
                        }, 'Conectar con Instagram')
                    ) : (
                        [
                            e('div', {
                                key: 'icon',
                                className: `platform-icon platform-icon-${platform}`
                            },
                                platformConfigs[platform].icon ? (
                                    e('img', {
                                        src: platformConfigs[platform].icon,
                                        alt: platformConfigs[platform].name,
                                        className: 'platform-icon-image'
                                    })
                                ) : platformConfigs[platform].displayLetter ? (
                                    e('span', {
                                        className: 'platform-icon-letter'
                                    }, platformConfigs[platform].displayLetter)
                                ) : null
                            ),
                            e('h2', {
                                key: 'title',
                                className: 'modal-heading'
                            }, `Conectar con ${platformConfigs[platform].name}`)
                        ]
                    )
                ),
                e('button', {
                    onClick: onClose,
                    className: 'modal-close'
                },
                    e('svg', {
                        className: 'modal-close-icon',
                        viewBox: '0 0 20 20',
                        fill: 'currentColor'
                    },
                        e('path', {
                            fillRule: 'evenodd',
                            d: 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z',
                            clipRule: 'evenodd'
                        })
                    )
                )
            ),

            // Content
            e('div', {
                className: 'modal-content'
            },
                platform === 'instagram' && !authMethod ? (
                    // Instagram method selection view
                    e('div', { className: 'auth-methods' },
                        e('p', {
                            className: 'auth-description'
                        }, 'Selecciona cómo quieres conectar tu cuenta profesional de Instagram:'),
                        e('div', {
                            className: 'auth-buttons'
                        },
                            // Botón de Facebook
                            e('button', {
                                onClick: () => handleAuth('facebook'),
                                disabled: isLoading,
                                className: 'login-button login-button-facebook'
                            },
                                isLoading && authMethod === 'facebook' ? (
                                    e('div', { className: 'loading-container' },
                                        e('div', { className: 'loading-spinner' }),
                                        'Conectando...'
                                    )
                                ) : 'Continuar con Facebook'
                            ),
                            
                            // Separador
                            e('div', { className: 'divider-container' },
                                e('div', { className: 'divider-line' }),
                                e('span', { className: 'divider-text' }, 'O'),
                                e('div', { className: 'divider-line' })
                            ),
                            
                            // Botón de Instagram
                            e('button', {
                                onClick: () => handleAuth('instagram'),
                                disabled: isLoading,
                                className: 'login-button login-button-instagram'
                            },
                                isLoading && authMethod === 'instagram' ? (
                                    e('div', { className: 'loading-container' },
                                        e('div', { className: 'loading-spinner' }),
                                        'Conectando...'
                                    )
                                ) : 'Continuar con Instagram'
                            )
                        ),
                        e('p', {
                            className: 'auth-note'
                        }, 'Nota: Esta conexión solo funciona con cuentas profesionales de Instagram (empresas y creadores).')
                    )
                ) : (
                    // Regular platform view
                    e('div', { className: 'auth-content' },
                        e('p', {
                            className: 'auth-description'
                        }, platformConfigs[platform].description),
                        !platformConfigs[platform].isAvailable ? (
                            e('div', {
                                className: 'platform-unavailable'
                            },
                                e('p', { className: 'unavailable-message' }, 
                                    'Esta funcionalidad estará disponible próximamente'
                                )
                            )
                        ) : (
                            e('button', {
                                onClick: () => handleAuth(),
                                disabled: isLoading,
                                className: `login-button login-button-${platform}`
                            },
                                isLoading ? (
                                    e('div', { className: 'loading-container' },
                                        e('div', { className: 'loading-spinner' }),
                                        'Conectando...'
                                    )
                                ) : [
                                    platformConfigs[platform].icon && e('img', {
                                        key: 'icon',
                                        src: platformConfigs[platform].icon,
                                        alt: '',
                                        className: 'button-icon'
                                    }),
                                    `Continuar con ${platformConfigs[platform].name}`
                                ]
                            )
                        )
                    )
                ),

                // Error message
                error && e('div', {
                    className: 'error-message'
                },
                    e('svg', {
                        className: 'error-icon',
                        viewBox: '0 0 20 20',
                        fill: 'currentColor'
                    },
                        e('path', {
                            fillRule: 'evenodd',
                            d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z',
                            clipRule: 'evenodd'
                        })
                    ),
                    error
                )
            ),

            // Footer
            platformConfigs[platform].isAvailable && e('div', {
                className: 'modal-footer'
            },
                e('div', {
                    className: 'footer-content'
                },
                    e('p', { className: 'permissions-title' }, 'Al conectar tu cuenta, aceptas:'),
                    e('ul', {
                        className: 'permissions-list'
                    },
                        platformConfigs[platform].scopes?.map((scope, index) =>
                            e('li', {
                                key: index,
                                className: 'permission-item'
                            }, scope)
                        )
                    ),
                    e('p', {
                        className: 'footer-note'
                    }, 'Social Media Manager nunca publicará contenido sin tu autorización explícita.')
                )
            )
        )
    );
};   

const UnifiedMessaging = () => {
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedChat, setSelectedChat] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    const [conversations, setConversations] = useState([
        {
            id: 1,
            platform: 'instagram',
            user: {
                name: 'María García',
                avatar: null,
                username: '@mariagarcia',
                verified: true
            },
            lastMessage: 'Me interesa mucho #Madrid #RealEstate ✨',
            timestamp: '10:35',
            unread: 2,
            isOnline: true
        },
        {
            id: 2,
            platform: 'facebook',
            user: {
                name: 'Juan Pérez',
                avatar: null,
                username: 'Juan Pérez'
            },
            lastMessage: '¿Podrías decirme cuántos metros cuadrados tiene y si tiene terraza?',
            timestamp: '09:20',
            unread: 1,
            isOnline: false
        },
        {
            id: 3,
            platform: 'twitter',
            user: {
                name: 'Carlos Ruiz',
                avatar: null,
                username: '@cruiz'
            },
            lastMessage: 'Gracias por la información, lo revisaré 🙏',
            timestamp: 'Ayer',
            unread: 0,
            isOnline: false
        }
    ]);

    const [messages, setMessages] = useState([
        // Conversación de Instagram (ID: 1)
        {
            id: 101,
            conversationId: 1,
            sender: 'user',
            content: '¡Hola! Me encantó la propiedad en Madrid 🏠 ¿Podría tener más información sobre el precio?',
            timestamp: '2024-01-20T10:30:00',
            status: 'read'
        },
        {
            id: 102,
            conversationId: 1,
            sender: 'agent',
            content: '¡Hola María! Por supuesto, el precio de la propiedad es de 450.000$. Incluye plaza de garaje y trastero 🚗',
            timestamp: '2024-01-20T10:32:00',
            status: 'read'
        },
        {
            id: 103,
            conversationId: 1,
            sender: 'user',
            content: '¡Genial! ¿Sería posible concertar una visita para verla? Me interesa mucho #Madrid #RealEstate ✨',
            timestamp: '2024-01-20T10:35:00',
            status: 'read'
        },

        // Conversación de Facebook (ID: 2)
        {
            id: 201,
            conversationId: 2,
            sender: 'user',
            content: 'Buenos días, vi su anuncio sobre el piso en venta. ¿Cuál sería el precio final?',
            timestamp: '2024-01-20T09:15:00',
            status: 'read'
        },
        {
            id: 202,
            conversationId: 2,
            sender: 'agent',
            content: 'Buenos días Juan. El precio es de 450.000$, pero estamos abiertos a negociaciones. ¿Te gustaría conocer más detalles?',
            timestamp: '2024-01-20T09:17:00',
            status: 'read'
        },
        {
            id: 203,
            conversationId: 2,
            sender: 'user',
            content: '¿Podrías decirme cuántos metros cuadrados tiene y si tiene terraza?',
            timestamp: '2024-01-20T09:20:00',
            status: 'read'
        },
        {
            id: 204,
            conversationId: 2,
            sender: 'agent',
            content: 'El piso tiene 120m² y cuenta con una terraza de 15m² con vistas despejadas. Además, está recién reformado.',
            timestamp: '2024-01-20T09:22:00',
            status: 'sent'
        },

        // Conversación de Twitter/X (ID: 3)
        {
            id: 301,
            conversationId: 3,
            sender: 'user',
            content: 'Hey! 👋 Me interesa la propiedad que publicaron. ¿Sigue disponible?',
            timestamp: '2024-01-19T15:30:00',
            status: 'read'
        },
        {
            id: 302,
            conversationId: 3,
            sender: 'agent',
            content: '¡Hola Carlos! Sí, la propiedad sigue disponible. ¿Te gustaría programar una visita?',
            timestamp: '2024-01-19T15:35:00',
            status: 'read'
        },
        {
            id: 303,
            conversationId: 3,
            sender: 'user',
            content: 'Genial, ¿podrías enviarme más fotos del interior?',
            timestamp: '2024-01-19T15:40:00',
            status: 'read'
        },
        {
            id: 304,
            conversationId: 3,
            sender: 'agent',
            content: '¡Por supuesto! Te comparto un enlace con el tour virtual completo de la propiedad 🏠✨\nhttps://tour-virtual.ejemplo.com/propiedad-123',
            timestamp: '2024-01-19T15:45:00',
            status: 'read'
        },
        {
            id: 305,
            conversationId: 3,
            sender: 'user',
            content: 'Gracias por la información, lo revisaré 🙏',
            timestamp: '2024-01-19T15:50:00',
            status: 'read'
        }
    ]);

    useEffect(() => {
        setTimeout(() => {
            setIsLoading(false);
        }, 1500);
    }, []);

    const getPlatformIcon = (platform) => {
        const baseClasses = "w-6 h-6 flex items-center justify-center rounded-lg text-white";
    
        switch (platform) {
            case 'instagram':
                return e('div', {
                    className: `${baseClasses} platform-icon-instagram`
                },
                    e('img', {
                        src: '/propuestas/assets/img/instagram.png',
                        alt: 'Instagram',
                        className: 'w-4 h-4'
                    })
                );
            case 'facebook':
                return e('div', {
                    className: `${baseClasses} platform-icon-facebook`
                },
                    e('span', {
                        className: 'font-bold text-lg'
                    }, 'f')
                );
            case 'twitter':
                return e('div', {
                    className: `${baseClasses} platform-icon-twitter`
                },
                    e('img', {
                        src: '/propuestas/assets/img/x-twitter.png',
                        alt: 'X',
                        className: 'w-4 h-4'
                    })
                );
            case 'linkedin':
                return e('div', {
                    className: `${baseClasses} platform-icon-linkedin`
                },
                    e('img', {
                        src: '/propuestas/assets/img/linkedin.png',
                        alt: 'LinkedIn',
                        className: 'w-4 h-4'
                    })
                );
            default:
                return null;
        }
    };
    

    const getMessageStyle = (message, platform) => {
        if (message.sender === 'agent') {
            return {
                container: 'message-bubble-container agent',
                bubble: 'message-bubble agent'
            };
        }
    
        return {
            container: `message-bubble-container user`,
            bubble: `message-bubble ${platform}`
        };
    };

    const handleSendMessage = () => {
        if (!messageInput.trim() || !selectedChat) return;

        const newMessage = {
            id: Date.now(),
            conversationId: selectedChat,
            sender: 'agent',
            content: messageInput,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            status: 'sent'
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');

        setConversations(prev => prev.map(conv => 
            conv.id === selectedChat 
                ? { 
                    ...conv, 
                    lastMessage: messageInput, 
                    timestamp: 'Ahora' 
                }
                : conv
        ));
    };

    return e('div', { className: 'grid grid-cols-12 divide-x h-[calc(100vh-12rem)] bg-white rounded-lg border shadow' },
        // Panel de conversaciones
        e('div', { className: 'col-span-4 flex flex-col' },
            e('div', { className: 'p-4 border-b' },
                e('div', { className: 'flex gap-2' },
                    [
                        { id: 'all', label: 'Todos' },
                        { id: 'instagram', label: 'Instagram' },
                        { id: 'facebook', label: 'Facebook' },
                        { id: 'twitter', label: 'X' }
                    ].map(platform =>
                        e('button', {
                            key: platform.id,
                            onClick: () => setSelectedPlatform(platform.id),
                            className: `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                selectedPlatform === platform.id
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`
                        },
                            platform.id !== 'all' && getPlatformIcon(platform.id),
                            e('span', null, platform.label)
                        )
                    )
                )
            ),
            e('div', { className: 'flex-1 overflow-y-auto' },
                isLoading ? (
                    e('div', { className: 'p-4 space-y-4' },
                        [...Array(5)].map((_, i) =>
                            e('div', { key: i, className: 'animate-pulse flex gap-3' },
                                e('div', { className: 'w-12 h-12 bg-gray-200 rounded-full' }),
                                e('div', { className: 'flex-1 space-y-2' },
                                    e('div', { className: 'h-4 bg-gray-200 rounded w-3/4' }),
                                    e('div', { className: 'h-3 bg-gray-200 rounded w-1/2' })
                                )
                            )
                        )
                    )
                ) : conversations.length === 0 ? (
                    e('div', { className: 'text-center p-8' },
                        e('div', { className: 'mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4' },
                            e('svg', {
                                className: 'w-6 h-6 text-gray-400',
                                fill: 'none',
                                viewBox: '0 0 24 24',
                                stroke: 'currentColor'
                            },
                                e('path', {
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                    strokeWidth: 2,
                                    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                                })
                            )
                        ),
                        e('p', { className: 'text-gray-500 text-sm' },
                            'No hay mensajes para mostrar'
                        )
                    )
                ) : (
                    conversations
                        .filter(conv => selectedPlatform === 'all' || conv.platform === selectedPlatform)
                        .map(conversation =>
                            e('button', {
                                key: conversation.id,
                                onClick: () => setSelectedChat(conversation.id),
                                className: `w-full p-4 flex gap-3 hover:bg-gray-50 transition-colors ${
                                    selectedChat === conversation.id ? 'bg-blue-50' : ''
                                }`
                            },
                                e('div', { className: 'relative' },
                                    e('div', { 
                                        className: 'w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center'
                                    },
                                        conversation.user.avatar 
                                            ? e('img', {
                                                src: conversation.user.avatar,
                                                alt: conversation.user.name,
                                                className: 'w-full h-full rounded-full object-cover'
                                            })
                                            : e('span', {
                                                className: 'text-gray-500 font-medium text-lg'
                                            }, conversation.user.name.charAt(0))
                                    ),
                                    e('div', {
                                        className: 'absolute -bottom-1 -right-1'
                                    },
                                        getPlatformIcon(conversation.platform)
                                    ),
                                    conversation.isOnline && e('div', {
                                        className: 'absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white'
                                    })
                                ),
                                e('div', { className: 'flex-1 min-w-0 text-left' },
                                    e('div', { className: 'flex justify-between items-start' },
                                        e('h3', { 
                                            className: 'font-medium truncate'
                                        }, conversation.user.name),
                                        e('span', { 
                                            className: 'text-xs text-gray-500 whitespace-nowrap' 
                                        }, conversation.timestamp)
                                    ),
                                    e('p', { 
                                        className: 'text-sm text-gray-600 truncate mt-1' 
                                    }, conversation.lastMessage),
                                    conversation.unread > 0 && e('div', {
                                        className: 'mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
                                    }, `${conversation.unread} nuevo${conversation.unread !== 1 ? 's' : ''}`)
                                )
                            )
                        )
                )
            )
        ),

        // Área de chat
        e('div', { className: 'col-span-8 flex flex-col' },
            selectedChat ? (
                e(React.Fragment, null,
                    // Header del chat
                    e('div', { 
                        className: 'p-4 border-b flex items-center justify-between bg-white sticky top-0'
                    },
                        e('div', { className: 'flex items-center gap-3' },
                            e('div', { className: 'relative' },
                                e('div', { className: 'w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center' },
                                    e('span', { className: 'text-gray-500 font-medium' },
                                        conversations.find(c => c.id === selectedChat)?.user.name.charAt(0)
                                    )
                                ),
                                e('div', {
                                    className: 'absolute -bottom-1 -right-1'
                                },
                                    getPlatformIcon(conversations.find(c => c.id === selectedChat)?.platform)
                                )
                            ),
                            e('div', null,
                                e('h3', { className: 'font-medium' },
                                    conversations.find(c => c.id === selectedChat)?.user.name
                                ),
                                e('p', { className: 'text-sm text-gray-500 flex items-center gap-1' },
                                    conversations.find(c => c.id === selectedChat)?.user.username,
                                    conversations.find(c => c.id === selectedChat)?.isOnline && 
                                    e('span', { className: 'w-2 h-2 bg-green-400 rounded-full' })
                                )
                            )
                        ),
                        e('div', { className: 'flex items-center gap-2' },
                            ['phone', 'video', 'info'].map(action =>
                                e('button', {
                                    key: action,
                                    className: 'p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100'
                                },
                                    e('svg', {
                                        className: 'w-5 h-5',
                                        fill: 'none',
                                        viewBox: '0 0 24 24',
                                        stroke: 'currentColor'
                                    },
                                        action === 'phone' && e('path', {
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            strokeWidth: 2,
                                            d: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'
                                        }),
                                        action === 'video' && e('path', {
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            strokeWidth: 2,
                                            d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894 L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                                        }),
                                        action === 'info' && e('path', {
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            strokeWidth: 2,
                                            d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                        })
                                    )
                                )
                            )
                        )
                    ),

                    // Área de mensajes
                    e('div', {
                        className: 'flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 w-full'
                    },
                        messages
                            .filter(m => m.conversationId === selectedChat)
                            .map((message, index, array) => {
                                const platform = conversations.find(c => c.id === selectedChat)?.platform;
                                const styles = getMessageStyle(message, platform);
                                const showDate = index === 0 || 
                                    new Date(message.timestamp).toDateString() !== 
                                    new Date(array[index - 1].timestamp).toDateString();

                                return e('div', { key: message.id, className: 'space-y-2' },
                                    showDate && e('div', { 
                                        className: 'flex justify-center my-4'
                                    },
                                        e('span', {
                                            className: 'px-3 py-1 bg-white rounded-full text-xs text-gray-500'
                                        }, new Date(message.timestamp).toLocaleDateString())
                                    ),
                                    e('div', { className: styles.container },
                                        e('div', { className: styles.bubble },
                                            e('p', null, message.content),
                                            e('div', {
                                                className: 'flex items-center gap-2 mt-1 text-xs opacity-80'
                                            },
                                                e('span', null, 
                                                    new Date(message.timestamp).toLocaleTimeString('es-ES', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                ),
                                                message.sender === 'agent' && e('div', { 
                                                    className: 'flex items-center' 
                                                },
                                                    message.status === 'read' 
                                                        ? e('svg', {
                                                            className: 'w-4 h-4',
                                                            viewBox: '0 0 24 24',
                                                            fill: 'currentColor'
                                                        },
                                                            e('path', {
                                                                d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'
                                                            })
                                                        )
                                                        : e('svg', {
                                                            className: 'w-4 h-4',
                                                            fill: 'none',
                                                            viewBox: '0 0 24 24',
                                                            stroke: 'currentColor'
                                                        },
                                                            e('path', {
                                                                strokeLinecap: 'round',
                                                                strokeLinejoin: 'round',
                                                                strokeWidth: 2,
                                                                d: 'M5 13l4 4L19 7'
                                                            })
                                                        )
                                                )
                                            )
                                        )
                                    )
                                );
                            })
                    ),

                    // Área de entrada
                    e('div', {
                        className: 'p-4 border-t bg-white'
                    },
                        e('div', {
                            className: 'message-input-container'
                        },
                            e('div', { className: 'flex gap-2' },
                                ['image', 'emoji', 'attachment'].map(action =>
                                    e('button', {
                                        key: action,
                                        className: 'p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-white'
                                    },
                                        e('svg', {
                                            className: 'w-5 h-5',
                                            fill: 'none',
                                            viewBox: '0 0 24 24',
                                            stroke: 'currentColor'
                                        },
                                            action === 'image' && e('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: 2,
                                                d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                                            }),
                                            action === 'emoji' && e('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: 2,
                                                d: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                            }),
                                            action === 'attachment' && e('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: 2,
                                                d: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'
                                            })
                                        )
                                    )
                                )
                            ),
                            e('div', { className: 'flex-1 relative' },
                                e('textarea', {
                                    value: messageInput,
                                    onChange: (e) => setMessageInput(e.target.value),
                                    onKeyPress: (e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    },
                                    placeholder: 'Escribe un mensaje...',
                                    className: 'w-full resize-none rounded-lg bg-white border-0 px-4 py-3 focus:ring-2 focus:ring-blue-500 min-h-[44px]',
                                    rows: 1
                                })
                            ),
                            e('button', {
                                onClick: handleSendMessage,
                                disabled: !messageInput.trim(),
                                className: `p-3 rounded-lg ${
                                    messageInput.trim()
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`
                            },
                                e('svg', {
                                    className: 'w-5 h-5',
                                    fill: 'none',
                                    viewBox: '0 0 24 24',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: 2,
                                        d: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                                    })
                                )
                            )
                        )
                    )
                )
            ) : (
                // Estado sin chat seleccionado
                e('div', { className: 'flex-1 flex items-center justify-center p-8' },
                    e('div', { className: 'text-center' },
                        e('div', { 
                            className: 'mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'
                        },
                            e('svg', {
                                className: 'w-8 h-8 text-gray-400',
                                fill: 'none',
                                viewBox: '0 0 24 24',
                                stroke: 'currentColor'
                            },
                                e('path', {
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                    strokeWidth: 2,
                                    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                                })
                            )
                        ),
                        e('h3', { className: 'text-lg font-medium text-gray-900' },
                            'Selecciona una conversación'
                        ),
                        e('p', { className: 'mt-2 text-sm text-gray-500' },
                            'Escoge un chat de la lista para ver los mensajes'
                        )
                    )
                )
            )
        )
    );
};

const defaultPlatforms = [
    { 
        id: 'twitter', 
        name: 'X',
        icon: '/propuestas/assets/img/x-twitter.png',
        connected: false,
        account: null,
        type: null,
        bgColor: 'bg-black',
        hoverBg: 'hover:bg-gray-900'
    },
    { 
        id: 'facebook', 
        name: 'Facebook',
        displayLetter: 'f',
        connected: false,
        account: null,
        type: null,
        bgColor: 'bg-[#1877F2]',
        hoverBg: 'hover:bg-blue-600'
    },
    { 
        id: 'instagram', 
        name: 'Instagram',
        icon: '/propuestas/assets/img/instagram.png',
        connected: false,
        account: null,
        type: null,
        bgColor: 'bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500',
        hoverBg: 'hover:opacity-90'
    },
    { 
        id: 'linkedin', 
        name: 'LinkedIn',
        icon: '/propuestas/assets/img/linkedin.png',
        connected: false,
        account: null,
        type: null,
        bgColor: 'bg-[#0A66C2]',
        hoverBg: 'hover:bg-blue-700',
        comingSoon: true
    },
    { 
        id: 'tiktok', 
        name: 'TikTok',
        icon: '/propuestas/assets/img/tiktok.png',
        connected: false,
        account: null,
        type: null,
        bgColor: 'bg-black',
        hoverBg: 'hover:bg-gray-900',
        comingSoon: true
    }
];

// Función para formatear el texto de Instagram
const formatInstagramText = (text, hashtags) => {
    if (!text) return [];
    
    // Función para formatear hashtags con el color azul típico de Instagram
    const formatHashtag = (tag) => e('span', {
        className: 'text-[#0095F6] hover:text-opacity-50 cursor-pointer inline-block'
    }, tag);

    // Función para detectar emojis
    const isEmoji = (str) => {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
        return emojiRegex.test(str);
    };

    // Procesamiento del texto línea por línea
    const lines = text.split('\n');
    const formattedContent = [];

    lines.forEach((line, lineIndex) => {
        if (line.trim() === '') {
            formattedContent.push(e('br', { key: `br-${lineIndex}` }));
            return;
        }

        // Procesamiento de caracteres manteniendo los espacios
        const processed = [];
        let currentToken = '';
        let isCurrentlyEmoji = false;

        [...line].forEach((char, charIndex) => {
            const isCurrentCharEmoji = isEmoji(char);
            
            // Si cambia el tipo de token (emoji/no-emoji) o es un espacio, procesar el token actual
            if (isCurrentCharEmoji !== isCurrentlyEmoji || char === ' ' || char === '#') {
                if (currentToken) {
                    if (currentToken.startsWith('#')) {
                        processed.push(formatHashtag(currentToken));
                    } else if (isCurrentlyEmoji) {
                        processed.push(e('span', { 
                            key: `emoji-${lineIndex}-${charIndex}`,
                            className: 'inline-block'
                        }, currentToken));
                    } else {
                        processed.push(currentToken);
                    }
                }
                
                if (char === ' ') {
                    processed.push(' ');
                    currentToken = '';
                } else if (char === '#') {
                    currentToken = '#';
                } else {
                    currentToken = char;
                }
                
                isCurrentlyEmoji = isCurrentCharEmoji;
            } else {
                currentToken += char;
            }
        });

        // Procesar el último token
        if (currentToken) {
            if (currentToken.startsWith('#')) {
                processed.push(formatHashtag(currentToken));
            } else if (isCurrentlyEmoji) {
                processed.push(e('span', { 
                    key: `emoji-${lineIndex}-last`,
                    className: 'inline-block'
                }, currentToken));
            } else {
                processed.push(currentToken);
            }
        }

        formattedContent.push(
            e('div', {
                key: `line-${lineIndex}`,
                className: 'leading-[1.2] mb-1'
            }, processed)
        );
    });

    return e('div', { 
        className: 'text-sm break-words'
    }, formattedContent);
};

// Componentes de previsualización para cada plataforma
const PreviewCards = {
    twitter: (post, mediaPreview) => e('div', {
        className: 'border border-gray-200 rounded-xl overflow-hidden bg-white'
    },
        // Header del tweet
        e('div', { className: 'flex items-center gap-3 p-4' },
            e('div', { className: 'w-12 h-12 rounded-full bg-gray-200' }),
            e('div', null,
                e('p', { className: 'font-bold' }, 'X'),
                e('p', { className: 'text-gray-500 text-sm' }, '@X')
            )
        ),
        // Contenido del tweet con link
        e('div', { className: 'px-4 pb-3' },
            e('p', { className: 'text-gray-900 whitespace-pre-wrap' }, post.content),
            post.url && e('div', {
                className: 'mt-2 border border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 cursor-pointer'
            },
                e('div', { className: 'p-3' },
                    e('p', { className: 'text-sm text-gray-600 break-all' }, post.url)
                )
            )
        ),
        // Imágenes
        mediaPreview && mediaPreview.length > 0 && e('div', {
            className: `grid gap-0.5 ${mediaPreview.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`
        },
            mediaPreview.map((file, index) => 
                e('div', {
                    key: index,
                    className: 'aspect-square'
                },
                    e('img', {
                        src: file.url,
                        alt: file.name,
                        className: 'w-full h-full object-cover'
                    })
                )
            )
        ),
        // Footer con acciones
        e('div', { className: 'grid grid-cols-4 py-2 border-t border-gray-200 text-gray-500 px-2' },
            e('div', { 
                className: 'flex items-center gap-1 hover:text-blue-500 group justify-center cursor-pointer'
            }, 
                e('img', {
                    src: '/propuestas/assets/img/comment.png',
                    alt: 'Reply',
                    className: 'w-4 h-4 opacity-75 group-hover:opacity-100 flex-shrink-0'
                }),
                e('span', { className: 'text-xs sm:text-sm truncate' }, '0')
            ),
            e('div', { 
                className: 'flex items-center gap-1 hover:text-green-500 group justify-center cursor-pointer'
            }, 
                e('img', {
                    src: '/propuestas/assets/img/retweet.png',
                    alt: 'Retweet',
                    className: 'w-4 h-4 opacity-75 group-hover:opacity-100 flex-shrink-0'
                }),
                e('span', { className: 'text-xs sm:text-sm truncate' }, '0')
            ),
            e('div', { 
                className: 'flex items-center gap-1 hover:text-red-500 group justify-center cursor-pointer'
            }, 
                e('img', {
                    src: '/propuestas/assets/img/heart.png',
                    alt: 'Like',
                    className: 'w-4 h-4 opacity-75 group-hover:opacity-100 flex-shrink-0'
                }),
                e('span', { className: 'text-xs sm:text-sm truncate' }, '0')
            ),
            e('div', { 
                className: 'flex items-center gap-1 hover:text-blue-500 group justify-center cursor-pointer'
            }, 
                e('img', {
                    src: '/propuestas/assets/img/ver-x.png',
                    alt: 'Ver',
                    className: 'w-4 h-4 opacity-75 group-hover:opacity-100 flex-shrink-0'
                }),
                e('span', { className: 'text-xs sm:text-sm truncate' }, '0')
            )
        )
    ),

    facebook: (post, mediaPreview) => e('div', {
        className: 'border border-gray-200 rounded-lg overflow-hidden bg-white'
    },
        // Header del post de Facebook
        e('div', { className: 'flex items-center gap-3 p-4' },
            e('div', { className: 'w-10 h-10 rounded-full bg-gray-200' }),
            e('div', { className: 'flex-1' },
                e('p', { className: 'font-semibold' }, 'Facebook'),
                e('div', { className: 'flex items-center gap-1 text-gray-500 text-xs font-medium' },
                    e('span', null, new Date().toLocaleDateString()),
                    e('span', null, '•'),
                    e('img', {
                        src: '/propuestas/assets/img/world.png',
                        alt: 'Público',
                        className: 'w-3 h-3'
                    })
                )
            ),
            e('div', { className: 'text-gray-600 cursor-pointer' }, '•••')
        ),
        // Contenido con link
        e('div', { className: 'px-4 pb-4' },
            e('p', { className: 'text-gray-900 whitespace-pre-wrap' }, post.content),
            post.url && e('div', {
                className: 'mt-2 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50'
            },
                e('div', { className: 'aspect-video bg-gray-100' }),
                e('div', { className: 'p-3' },
                    e('p', { className: 'font-medium' }, 'Vista previa del enlace'),
                    e('p', { className: 'text-sm text-gray-600 break-all mt-1' }, post.url)
                )
            )
        ),
        // Contenedor de imágenes
        mediaPreview && mediaPreview.length > 0 && e('div', {
            className: `border-t border-b border-gray-100 ${
                mediaPreview.length > 1 ? 'grid grid-cols-2 gap-1 p-1' : ''
            }`
        },
            mediaPreview.map((file, index) => 
                e('div', {
                    key: index,
                    className: mediaPreview.length === 1 ? 'max-h-96' : 'aspect-square'
                },
                    e('img', {
                        src: file.url,
                        alt: file.name,
                        className: 'w-full h-full object-cover'
                    })
                )
            )
        ),
        // Sección inferior del post (likes, comentarios y acciones)
        e('div', { className: 'px-4 py-2' },
            // Contador de reacciones y comentarios
            e('div', { className: 'flex items-center justify-between text-gray-500 text-xs sm:text-sm pb-2' },
                e('div', { className: 'flex items-center gap-1' },
                    e('img', {
                        src: '/propuestas/assets/img/circle-heart.png',
                        alt: 'Me gusta',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', null, '0')
                ),
                e('span', null, '0 comentarios')
            ),
            // Botones de acción
            e('div', { className: 'grid grid-cols-3 divide-x pt-1 border-t border-gray-200' },
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/like.png',
                        alt: 'Me gusta',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate text-xs sm:text-sm' }, 'Me gusta')
                ),
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/comment.png',
                        alt: 'Comentar',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate text-xs sm:text-sm' }, 'Comentar')
                ),
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/share-x.png',
                        alt: 'Compartir',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate text-xs sm:text-sm' }, 'Compartir')
                )
            )
        )
    ),

    instagram: (post, mediaPreview) => e('div', {
        className: 'border border-gray-200 bg-white max-w-lg mx-auto rounded-sm'
    },
        // Header
        e('div', { className: 'flex items-center gap-3 p-3 border-b border-gray-200' },
            e('div', { 
                className: 'w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 p-[2px]'
            },
                e('div', { 
                    className: 'w-full h-full rounded-full border-2 border-white bg-white overflow-hidden'
                },
                    e('div', { className: 'w-full h-full bg-gray-200' })
                )
            ),
            e('div', { className: 'flex-1' },
                e('p', { className: 'font-semibold text-sm' }, post.username || post.empresa || 'Instagram'),
                e('p', { className: 'text-xs text-gray-500' }, 'Instagram')
            ),
            e('div', { className: 'text-gray-600 px-2 cursor-pointer' },
                e('img', {
                    src: '/propuestas/assets/img/more.png',
                    alt: 'More options',
                    className: 'w-5 h-5'
                })
            )
        ),
        // Contenedor de imágenes
        mediaPreview && mediaPreview.length > 0 && e('div', {
            className: 'relative'
        },
            e('div', { className: 'aspect-square bg-black' },
                e('img', {
                    src: mediaPreview[0].url,
                    alt: mediaPreview[0].name,
                    className: 'w-full h-full object-cover'
                })
            ),
            mediaPreview.length > 1 && e('div', {
                className: 'absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1'
            },
                mediaPreview.map((_, index) => 
                    e('div', {
                        key: index,
                        className: `w-1.5 h-1.5 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-gray-300'}`
                    })
                )
            )
        ),
        // Barra de acciones
        e('div', { className: 'grid grid-cols-4 items-center px-2 py-1' },
            e('div', { className: 'col-span-3 flex items-center gap-4' },
                e('div', { className: 'hover:opacity-70 cursor-pointer' },
                    e('img', {
                        src: '/propuestas/assets/img/heart.png',
                        alt: 'Like',
                        className: 'w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
                    })
                ),
                e('div', { className: 'hover:opacity-70 cursor-pointer' },
                    e('img', {
                        src: '/propuestas/assets/img/comment.png',
                        alt: 'Comment',
                        className: 'w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
                    })
                ),
                e('div', { className: 'hover:opacity-70 cursor-pointer' },
                    e('img', {
                        src: '/propuestas/assets/img/share.png',
                        alt: 'Share',
                        className: 'w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
                    })
                )
            ),
            e('div', { className: 'justify-self-end hover:opacity-70 cursor-pointer' },
                e('img', {
                    src: '/propuestas/assets/img/save.png',
                    alt: 'Save',
                    className: 'w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0'
                })
            )
        ),
        // Contador de likes/views
        e('div', { className: 'px-3 pb-2' },
            e('p', { className: 'text-sm font-semibold' }, 
                post.views ? `${post.views.toLocaleString()} views` : '20,451 views'
            )
        ),
        e('div', { className: 'px-3 pb-3 overflow-hidden' },
            e('div', { className: 'text-sm leading-[18px] break-words' },
                e('span', { className: 'font-semibold mr-1' }, post.username || 'Instagram'),
                formatInstagramText(post.content)  // <- Usar la función de formateo
            ),
            post.url && e('div', { 
                className: 'mt-2 text-[#0095F6] cursor-pointer'
            }, '↗️ Link in bio')
        ),
        // Input de comentario
        e('div', { 
            className: 'px-3 py-2 border-t border-gray-200 flex items-center gap-2'
        },
            e('div', { className: 'text-xl hover:opacity-70 cursor-pointer' },
                e('img', {
                    src: '/propuestas/assets/img/emoji.png',
                    alt: 'Emoji',
                    className: 'w-5 h-5'
                })
            ),
            e('input', {
                type: 'text',
                placeholder: 'Add a comment...',
                className: 'flex-1 text-sm border-none outline-none placeholder:text-gray-500'
            }),
            e('button', { 
                className: 'text-[#0095F6] text-sm font-semibold hover:opacity-70 cursor-pointer'
            }, 'Post')
        )
    ),

    linkedin: (post, mediaPreview) => e('div', {
        className: 'border border-gray-200 rounded-lg overflow-hidden bg-white'
    },
        // Header
        e('div', { className: 'flex items-start gap-3 p-4' },
            e('div', { className: 'w-12 h-12 rounded-full bg-gray-200' }),
            e('div', { className: 'flex-1' },
                e('p', { className: 'font-semibold' }, 'LinkedIn'),
                e('p', { className: 'text-gray-500 text-sm' }, 'Empresa • Seguir'),
                e('div', { className: 'flex items-center gap-1 text-gray-500 text-xs mt-1' },
                    e('span', null, '1h'),
                    e('span', null, '•'),
                    e('img', {
                        src: '/propuestas/assets/img/world.png',
                        alt: 'Público',
                        className: 'w-3 h-3'
                    })
                )
            ),
            e('div', { className: 'text-gray-600 cursor-pointer' }, '•••')
        ),
        // Contenido con link
        e('div', { className: 'px-4 pb-4' },
            e('p', { className: 'text-gray-900 whitespace-pre-wrap' }, post.content),
            post.url && e('div', {
                className: 'mt-2 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50'
            },
                e('div', { className: 'p-3' },
                    e('p', { className: 'font-medium' }, 'Vista previa del enlace'),
                    e('p', { className: 'text-sm text-gray-600 break-all mt-1' }, post.url)
                )
            )
        ),
        // Imágenes
        mediaPreview && mediaPreview.length > 0 && e('div', {
            className: 'border-t border-gray-100'
        },
            mediaPreview.map((file, index) => 
                e('div', {
                    key: index,
                    className: 'aspect-video'
                },
                    e('img', {
                        src: file.url,
                        alt: file.name,
                        className: 'w-full h-full object-cover'
                    })
                )
            )
        ),
        // Footer
        e('div', { className: 'px-4 py-2' },
            // Contador de reacciones y comentarios
            e('div', { className: 'flex items-center gap-1 text-gray-500 text-xs sm:text-sm pb-2' },
                e('span', null, '0 reacciones'),
                e('span', null, '•'),
                e('span', null, '0 comentarios')
            ),
            // Botones de acción
            e('div', { className: 'grid grid-cols-3 divide-x pt-1 border-t border-gray-200 text-gray-600 text-xs sm:text-sm' },
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/like.png',
                        alt: 'Recomendar',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate' }, 'Recomendar')
                ),
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/comment.png',
                        alt: 'Comentar',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate' }, 'Comentar')
                ),
                e('div', { 
                    className: 'flex-1 px-1 py-0.5 hover:bg-gray-50 flex items-center justify-center gap-1 truncate cursor-pointer'
                }, 
                    e('img', {
                        src: '/propuestas/assets/img/share-x.png',
                        alt: 'Compartir',
                        className: 'w-4 h-4 flex-shrink-0'
                    }),
                    e('span', { className: 'truncate' }, 'Compartir')
                )
            )
        )
    )
};

function SocialMediaDashboard() {
    const [showNewPostForm, setShowNewPostForm] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [activeSection, setActiveSection] = useState('scheduled');
    const [showMessages, setShowMessages] = useState(false);

    // Estados para configuraciones
    const [userSettings, setUserSettings] = useState({
        notifications: {
            enabled: true,
            publishReminders: true,
            errorAlerts: true,
            maiaRecommendations: true
        },
        autoPosting: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        theme: 'light',
        defaultPlatforms: ['instagram', 'facebook'],
        privacySettings: {
            activityVisibility: 'team',
            allowAnalytics: true
        }
    });

    // Vista principal con calendario/lista
    const MainView = () => {
        const shouldShowCalendar = activeSection === 'scheduled' || activeSection === 'published';
        
        const handleNavigation = (section) => {
            setActiveSection(section);
            setShowNewPostForm(false);
            setShowSettings(false);
            setShowMessages(section === 'messages');
        };
    
        return e('div', { className: 'min-h-screen bg-gray-50' },
            e('div', { className: 'bg-white border-b sticky top-0 z-10' },
                e('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
                    e('div', { className: 'flex justify-between items-center h-16' },
                        // Contenedor del título con botón de retorno
                        e('div', { className: 'flex items-center gap-3' },
                            showMessages && e('button', {
                                onClick: () => handleNavigation('scheduled'),
                                className: 'p-2 -ml-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100'
                            },
                                e('svg', {
                                    className: 'w-5 h-5',
                                    fill: 'none',
                                    viewBox: '0 0 24 24',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: 2,
                                        d: 'M15 19l-7-7 7-7'
                                    })
                                )
                            ),
                            e('h1', { className: 'text-xl font-bold' }, 
                                showMessages ? 'Mensajes' : 'Social Media Manager'
                            )
                        ),
                        e('div', { className: 'flex items-center gap-4' },
                            // Botón de mensajes
                            !showMessages && e('button', {
                                onClick: () => handleNavigation('messages'),
                                className: 'relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100'
                            },
                                e('svg', {
                                    className: 'w-6 h-6',
                                    fill: 'none',
                                    viewBox: '0 0 24 24',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: '2',
                                        d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                                    })
                                ),
                                // Indicador de mensajes no leídos
                                e('span', {
                                    className: 'absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-xs text-white font-medium flex items-center justify-center'
                                }, '3')
                            ),
                            // Botón de nueva publicación
                            e('button', {
                                onClick: () => setShowNewPostForm(true),
                                className: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700'
                            },
                                e('svg', {
                                    className: 'w-5 h-5',
                                    fill: 'none',
                                    viewBox: '0 0 24 24',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: '2',
                                        d: 'M12 4v16m8-8H4'
                                    })
                                ),
                                'Nueva publicación'
                            ),
                            // Botón de ajustes
                            e('button', {
                                onClick: () => setShowSettings(true),
                                className: 'p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100'
                            },
                                e('svg', {
                                    className: 'w-5 h-5',
                                    fill: 'none',
                                    viewBox: '0 0 24 24',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: '2',
                                        d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                                    }),
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: '2',
                                        d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                                    })
                                )
                            )
                        )
                    ),
                    // Pestañas de navegación (no se muestran en la vista de mensajes)
                    !showMessages && e('div', { className: 'flex space-x-8 mt-4 -mb-px' },
                        [
                            { id: 'scheduled', label: 'Programadas' },
                            { id: 'published', label: 'Publicadas' },
                            { id: 'drafts', label: 'Borradores' }
                        ].map(tab =>
                            e('button', {
                                key: tab.id,
                                onClick: () => handleNavigation(tab.id),
                                className: `group inline-flex items-center pb-4 px-1 border-b-2 font-medium text-sm
                                    ${activeSection === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                            }, tab.label)
                        )
                    )
                )
            ),
            // Contenido principal
            e('main', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' },
                showMessages
                    ? e(UnifiedMessaging)
                    : shouldShowCalendar
                        ? CalendarView()
                        : ListView()
            )
        );
    };

    const SettingsView = () => {
        const [activeSettingsSection, setActiveSettingsSection] = useState('preferences');
        const [selectedLoginPlatform, setSelectedLoginPlatform] = useState(null);
        const [availablePlatforms, setAvailablePlatforms] = useState(defaultPlatforms);
        const [connectedPlatforms, setConnectedPlatforms] = useState(
            availablePlatforms.filter(p => p.connected).map(p => p.id)
        );
    
        const handleLoginSuccess = (platform) => {
            setAvailablePlatforms(prev => 
                prev.map(p => p.id === platform ? { ...p, connected: true } : p)
            );
            setConnectedPlatforms(prev => [...prev, platform]);
            setSelectedLoginPlatform(null);
        };
    
        const handleDisconnect = (platform) => {
            setAvailablePlatforms(prev =>
                prev.map(p => p.id === platform ? { 
                    ...p, 
                    connected: false, 
                    account: null, 
                    type: null 
                } : p)
            );
            setConnectedPlatforms(prev => prev.filter(p => p !== platform));
        };
        
        // Función para obtener zonas horarias
        const getTimezones = () => {
            const timezones = Intl.supportedValuesOf('timeZone');
            
            return timezones.map(tz => {
                const date = new Date();
                const formatter = new Intl.DateTimeFormat('es-ES', {
                    timeZone: tz,
                    timeZoneName: 'short',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const offset = formatter.format(date).split(' ')[1];
                const city = tz.split('/').pop().replace(/_/g, ' ');
                
                return {
                    value: tz,
                    label: `${offset} ${city}`
                };
            }).sort((a, b) => {
                const offsetA = a.label.match(/[+-]\d+/)?.[0] || 0;
                const offsetB = b.label.match(/[+-]\d+/)?.[0] || 0;
                return parseInt(offsetA) - parseInt(offsetB);
            });
        };
    
        // Definición de las secciones de configuración
        const settingsSections = [
            { 
                id: 'preferences', 
                name: 'Preferencias', 
                icon: 'M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3'
            },
            { 
                id: 'notifications', 
                name: 'Notificaciones', 
                icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'
            },
            { 
                id: 'scheduling', 
                name: 'Programación', 
                icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
            },
            { 
                id: 'platforms', 
                name: 'Redes Sociales', 
                icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244'
            },
            { 
                id: 'appearance', 
                name: 'Apariencia', 
                icon: 'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z'
            },
            { 
                id: 'privacy', 
                name: 'Privacidad', 
                icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
            }
        ];
    
        // Renderizado del contenido de las secciones
        const renderSettingsContent = () => {
            switch (activeSettingsSection) {
                case 'preferences':
                    return e('div', { className: 'space-y-6' },
                        e('div', null,
                            e('h3', { className: 'text-lg font-medium' }, 'Preferencias generales'),
                            e('div', { className: 'mt-4 space-y-4' },
                                e('div', null,
                                    e('label', { className: 'block text-sm font-medium text-gray-700' },
                                        'Zona horaria para publicaciones'
                                    ),
                                    e('select', {
                                        value: userSettings.timezone,
                                        onChange: (e) => setUserSettings(prev => ({
                                            ...prev,
                                            timezone: e.target.value
                                        })),
                                        className: 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2'
                                    },
                                        getTimezones().map(tz =>
                                            e('option', {
                                                key: tz.value,
                                                value: tz.value
                                            }, tz.label)
                                        )
                                    )
                                ),
                                e('div', { className: 'flex items-center justify-between p-4 border rounded-lg' },
                                    e('div', null,
                                        e('h4', { className: 'font-medium' }, 'Publicación automática'),
                                        e('p', { className: 'text-sm text-gray-500' }, 
                                            'Publicar automáticamente en el horario programado'
                                        )
                                    ),
                                    e('button', {
                                        onClick: () => setUserSettings(prev => ({
                                            ...prev,
                                            autoPosting: !prev.autoPosting
                                        })),
                                        className: `relative inline-flex h-6 w-11 items-center rounded-full ${
                                            userSettings.autoPosting ? 'bg-blue-600' : 'bg-gray-200'
                                        }`
                                    },
                                        e('span', {
                                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                userSettings.autoPosting ? 'translate-x-6' : 'translate-x-1'
                                            }`
                                        })
                                    )
                                )
                            )
                        )
                    );
    
                case 'notifications':
                    return e('div', { className: 'space-y-6' },
                        e('div', null,
                            e('div', { className: 'flex items-center justify-between' },
                                e('h3', { className: 'text-lg font-medium' }, 'Notificaciones'),
                                e('button', {
                                    onClick: () => setUserSettings(prev => ({
                                        ...prev,
                                        notifications: {
                                            ...prev.notifications,
                                            enabled: !prev.notifications.enabled
                                        }
                                    })),
                                    className: `relative inline-flex h-6 w-11 items-center rounded-full ${
                                        userSettings.notifications.enabled ? 'bg-blue-600' : 'bg-gray-200'
                                    }`
                                },
                                    e('span', {
                                        className: `inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            userSettings.notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`
                                    })
                                )
                            ),
                            e('div', { className: 'mt-6 space-y-4' },
                                [
                                    {
                                        id: 'publishReminders',
                                        title: 'Recordatorios de publicación',
                                        description: 'Recibe alertas antes de que se publique tu contenido programado'
                                    },
                                    {
                                        id: 'errorAlerts',
                                        title: 'Errores de publicación',
                                        description: 'Notificaciones si hay problemas al publicar tu contenido'
                                    },
                                    {
                                        id: 'maiaRecommendations',
                                        title: 'Sugerencias de MAIA',
                                        description: 'Recibe consejos para optimizar tu contenido'
                                    }
                                ].map(setting => 
                                    e('div', {
                                        key: setting.id,
                                        className: 'flex items-center justify-between p-4 border rounded-lg'
                                    },
                                        e('div', null,
                                            e('h4', { className: 'font-medium' }, setting.title),
                                            e('p', { className: 'text-sm text-gray-500' }, setting.description)
                                        ),
                                        e('input', {
                                            type: 'checkbox',
                                            checked: userSettings.notifications[setting.id],
                                            onChange: () => setUserSettings(prev => ({
                                                ...prev,
                                                notifications: {
                                                    ...prev.notifications,
                                                    [setting.id]: !prev.notifications[setting.id]
                                                }
                                            })),
                                            className: 'h-4 w-4 rounded border-gray-300'
                                        })
                                    )
                                )
                            )
                        )
                    );
    
                case 'platforms':
                    return e('div', { className: 'space-y-8' },
                        // Panel principal
                        e('div', null,
                            e('h3', { className: 'text-lg font-medium' }, 'Redes sociales conectadas'),
                            e('p', { className: 'mt-1 text-sm text-gray-500' }, 
                                'Gestiona las conexiones con tus redes sociales'
                            ),
                            e('div', { className: 'mt-4 space-y-4' },
                                availablePlatforms.map(platform => 
                                    e('div', {
                                        key: platform.id,
                                        className: `platform-settings-card ${platform.comingSoon ? 'coming-soon' : ''}`
                                    },
                                        e('div', { className: 'platform-info' },
                                            e('div', {
                                                className: `platform-settings-icon platform-settings-${platform.id} flex items-center justify-center`
                                            },
                                                platform.displayLetter ? 
                                                e('span', {
                                                    className: 'text-white font-bold text-2xl'
                                                }, platform.displayLetter) :
                                                e('img', {
                                                    src: platform.icon,
                                                    alt: platform.name,
                                                    className: 'w-5 h-5 object-contain brightness-0 invert'
                                                })
                                            ),
                                            e('div', null,
                                                e('h4', { className: 'font-medium' }, platform.name),
                                                platform.connected ? (
                                                    e('div', { className: 'text-sm' },
                                                        e('p', { className: 'text-gray-900' }, platform.account),
                                                        e('p', { className: 'text-gray-500' }, platform.type)
                                                    )
                                                ) : (
                                                    e('p', { className: 'text-sm text-gray-500' }, 
                                                        platform.comingSoon ? 'Próximamente disponible' : 'No conectado'
                                                    )
                                                )
                                            )
                                        ),
                                        !platform.comingSoon && e('button', {
                                            onClick: () => setSelectedLoginPlatform(platform.id),
                                            className: 'platform-action-btn platform-connect-btn'
                                        }, 'Conectar')
                                    )
                                )
                            )
                        ),
                        // Modal de inicio de sesión
                        selectedLoginPlatform && e(LoginModal, {
                            platform: selectedLoginPlatform,
                            isOpen: !!selectedLoginPlatform,
                            onClose: () => setSelectedLoginPlatform(null),
                            onSuccess: handleLoginSuccess
                        })
                    );
                
                case 'appearance':
                    return e('div', { className: 'space-y-6' },
                        e('div', null,
                            e('h3', { className: 'text-lg font-medium' }, 'Apariencia'),
                            e('div', { className: 'mt-4' },
                                e('div', { className: 'space-y-4' },
                                    e('label', { className: 'block text-sm font-medium text-gray-700' }, 'Tema'),
                                    e('div', { className: 'grid grid-cols-3 gap-4' },
                                        ['light', 'dark', 'system'].map((themeOption) => 
                                            e('button', {
                                                key: themeOption,  // <-- Aquí está el error, estaba usando theme en lugar de themeOption
                                                onClick: () => setUserSettings(prev => ({
                                                    ...prev,
                                                    theme: themeOption
                                                })),
                                                className: `p-4 border rounded-lg text-center ${
                                                    userSettings.theme === themeOption 
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                                        : 'border-gray-200 hover:bg-gray-50'
                                                }`
                                            },
                                                e('span', { className: 'block font-medium capitalize' },
                                                    themeOption === 'light' ? 'Claro' :
                                                    themeOption === 'dark' ? 'Oscuro' :
                                                    'Sistema'
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    );
    
                case 'privacy':
                    return e('div', { className: 'space-y-6' },
                        e('div', null,
                            e('h3', { className: 'text-lg font-medium' }, 'Privacidad'),
                            e('div', { className: 'mt-4 space-y-4' },
                                e('div', { className: 'p-4 border rounded-lg' },
                                    e('h4', { className: 'font-medium' }, 'Visibilidad de la actividad'),
                                    e('p', { className: 'mt-1 text-sm text-gray-500' }, 
                                        'Configura quién puede ver tu actividad en el Social Media Manager'
                                    ),
                                    e('select', {
                                        value: userSettings.privacySettings.activityVisibility,
                                        onChange: (e) => setUserSettings(prev => ({
                                            ...prev,
                                            privacySettings: {
                                                ...prev.privacySettings,
                                                activityVisibility: e.target.value
                                            }
                                        })),
                                        className: 'mt-3 block w-full rounded-md border border-gray-300 px-3 py-2'
                                    },
                                        e('option', { value: 'only_me' }, 'Solo yo'),
                                        e('option', { value: 'team' }, 'Mi equipo'),
                                        e('option', { value: 'all' }, 'Todos')
                                    )
                                ),
                                e('div', { className: 'p-4 border rounded-lg' },
                                    e('h4', { className: 'font-medium' }, 'Datos de análisis'),
                                    e('p', { className: 'mt-1 text-sm text-gray-500' }, 
                                        'Permite que MAIA analice tu contenido para brindarte mejores recomendaciones'
                                    ),
                                    e('div', { className: 'mt-3' },
                                        e('label', { className: 'flex items-center' },
                                            e('input', {
                                                type: 'checkbox',
                                                checked: userSettings.privacySettings.allowAnalytics,
                                                onChange: () => setUserSettings(prev => ({
                                                    ...prev,
                                                    privacySettings: {
                                                        ...prev.privacySettings,
                                                        allowAnalytics: !prev.privacySettings.allowAnalytics
                                                    }
                                                })),
                                                className: 'h-4 w-4 rounded border-gray-300'
                                            }),
                                            e('span', { className: 'ml-2 text-sm text-gray-600' }, 
                                                'Permitir análisis de contenido'
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    );
    
                    default:
                        return e('div', { className: 'text-center py-12' },
                            e('h3', { className: 'text-lg font-medium text-gray-900' }, 
                                'Sección en desarrollo'
                            ),
                            e('p', { className: 'mt-2 text-sm text-gray-500' },
                                'Esta sección estará disponible próximamente'
                            )
                        );
                }
            };
    
        // Renderizado del componente principal
        return e('div', { 
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto'
        },
            e('div', { 
                className: 'bg-white rounded-lg shadow-xl w-full max-w-6xl m-4'
            },
                e('div', { 
                    className: 'flex h-[calc(100vh-8rem)] max-h-[800px]'
                },
                    // Panel lateral
                    e('div', { className: 'w-64 border-r bg-gray-50 p-6' },
                        e('div', { className: 'flex items-center justify-between mb-6' },
                            e('h2', { className: 'text-xl font-bold' }, 'Ajustes'),
                            e('button', {
                                onClick: () => setShowSettings(false),
                                className: 'text-gray-400 hover:text-gray-600'
                            },
                                e('svg', {
                                    className: 'w-5 h-5',
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor'
                                },
                                    e('path', {
                                        strokeLinecap: 'round',
                                        strokeLinejoin: 'round',
                                        strokeWidth: '2',
                                        d: 'M6 18L18 6M6 6l12 12'
                                    })
                                )
                            )
                        ),
                        // Navegación
                        e('nav', { className: 'space-y-1' },
                            settingsSections.map(section => 
                                e('button', {
                                    key: section.id,
                                    onClick: () => setActiveSettingsSection(section.id),
                                    className: `w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg ${
                                        activeSettingsSection === section.id
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`
                                },
                                    e('svg', {
                                        className: 'w-5 h-5',
                                        fill: 'none',
                                        viewBox: '0 0 24 24',
                                        stroke: 'currentColor',
                                        strokeWidth: '2'
                                    },
                                        e('path', {
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            d: section.icon
                                        })
                                    ),
                                    section.name
                                )
                            )
                        )
                    ),
                    // Contenido principal
                    e('div', { className: 'flex-1 p-6 overflow-y-auto' },
                        renderSettingsContent()
                    )
                )
            )
        );
    };
    
    // Renderizado condicional entre las diferentes vistas
    return e('div', null,
        showNewPostForm
            ? e('div', { className: 'relative' },
                e('button', {
                    onClick: () => setShowNewPostForm(false),
                    className: 'fixed top-4 left-4 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50'
                },
                    e('svg', {
                        className: 'w-6 h-6',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: '2'
                    },
                        e('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            d: 'M15 19l-7-7 7-7'
                        })
                    )
                ),
                e(SocialMediaManager)
            )
            : showSettings
                ? e(SettingsView)
                : e(MainView)
    );
}

function SocialMediaManager() {
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState({
        content: {},
        scheduledDate: '',
        scheduledTime: '',
        platforms: [],
        status: 'draft',
        media: [],
        url: '',
        contentLanguage: 'es'
    });

    const [isGeneratingText, setIsGeneratingText] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [mediaPreview, setMediaPreview] = useState([]);
    const [selectedPublishOption, setSelectedPublishOption] = useState(null);
    const [properties, setProperties] = useState([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState(true);

    useEffect(() => {
        // Cargar propiedades al montar el componente
        const fetchProperties = async () => {
            try {
                const response = await fetch('https://masterbroker.ai/propuestas/api/generate_copy.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'list_properties'
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    setProperties(data.properties);
                }
            } catch (error) {
                console.error('Error al cargar propiedades:', error);
            } finally {
                setIsLoadingProperties(false);
            }
        };
        
        fetchProperties();
    }, []);    

    // Opciones de idioma
    const availableContentLanguages = [
        { id: 'es', name: 'Español 🇪🇸' },
        { id: 'en', name: 'English 🇺🇸' },
        { id: 'fr', name: 'Français 🇫🇷' },
        { id: 'de', name: 'Deutsch 🇩🇪' },
        { id: 'pt', name: 'Português 🇵🇹' },
        { id: 'it', name: 'Italiano 🇮🇹' }
    ];

    const availablePlatforms = [
        { 
            id: 'twitter', 
            icon: e('img', {
                src: '/propuestas/assets/img/x-twitter.png',
                className: 'w-5 h-5',
            })
        },
        { id: 'facebook', name: 'Facebook', icon: null },
        { 
            id: 'instagram', 
            name: 'Instagram', 
            icon: e('img', {
                src: '/propuestas/assets/img/instagram.png',
                className: 'w-5 h-5',
            }),
        },
        // { 
        //     id: 'linkedin', 
        //     name: 'Linked',
        //     icon: e('img', {
        //         src: '/propuestas/assets/img/linkedin.png',
        //         className: 'w-5 h-5',
        //     })
        // },
    ];

    const isValidUrl = (string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleMediaChange = (event) => {
        const files = Array.from(event.target.files);
        const previews = files.map(file => ({
            name: file.name,
            type: file.type,
            size: (file.size / 1024 / 1024).toFixed(2),
            url: URL.createObjectURL(file)
        }));
        
        setMediaPreview(previews);
        setNewPost(prev => ({
            ...prev,
            media: [...prev.media, ...files]
        }));
    };

    const removeMedia = (index) => {
        setMediaPreview(prev => prev.filter((_, i) => i !== index));
        setNewPost(prev => ({
            ...prev,
            media: prev.media.filter((_, i) => i !== index)
        }));
    };

    const handlePlatformChange = (platformId) => {
        setNewPost(prev => {
            const platforms = prev.platforms.includes(platformId)
                ? prev.platforms.filter(p => p !== platformId)
                : [...prev.platforms, platformId];
            
            const content = { ...prev.content };
            if (!platforms.includes(platformId)) {
                delete content[platformId];
            }
            
            return {
                ...prev,
                platforms,
                content
            };
        });
    };

    const handlePublish = (publishType) => {
        if (newPost.platforms.length === 0) {
            alert('Selecciona al menos una plataforma');
            return;
        }
    
        if (publishType === 'scheduled' && (!newPost.scheduledDate || !newPost.scheduledTime)) {
            alert('Selecciona una fecha y hora para programar la publicación');
            return;
        }

        newPost.platforms.forEach(platform => {
            if (newPost.content[platform]) {
                setPosts(prev => [...prev, {
                    ...newPost,
                    id: Date.now() + Math.random(),
                    platform,
                    content: newPost.content[platform],
                    url: newPost.url,
                    status: publishType,
                    publishedAt: publishType === 'published' ? new Date().toISOString() : null
                }]);
            }
        });

        setSelectedPublishOption(null);
        setNewPost({
            content: {},
            scheduledDate: '',
            scheduledTime: '',
            platforms: [],
            status: 'draft',
            media: [],
            url: '',
            contentLanguage: 'es'
        });
        setMediaPreview([]);
    };

    const generateWithMaia = async () => {
        if (newPost.platforms.length === 0) {
            setAiSuggestion('Por favor, selecciona al menos una plataforma 🎯');
            return;
        }
    
        if (!selectedPropertyId) {
            setAiSuggestion('Por favor, selecciona una propiedad 🏠');
            return;
        }
    
        setIsGeneratingText(true);
        setAiSuggestion('');
        
        try {
            const results = {};
            
            for (const platform of newPost.platforms) {
                const requestBody = {
                    platform,
                    property_id: selectedPropertyId,
                    language: newPost.contentLanguage,
                    format: {
                        // Asegura información crítica en los primeros 30 caracteres
                        first_line: {
                            include: ['property_type', 'location', 'price', 'rooms'],
                            max_length: 30,
                            format: 'emoji_type_location_price_rooms'
                        },
                        // Lista de características específicas
                        details: {
                            required: [
                                'square_meters',
                                'floor_number',
                                'parking_spots',
                                'amenities',
                                'location_references',
                                'security'
                            ],
                            format: 'bullet_points' // Formato de lista con viñetas
                        },
                        // Sin texto promocional o de relleno
                        style: {
                            concise: true,
                            no_filler: true,
                            specific_only: true
                        },
                        hashtags: {
                            max: 3,
                            relevant_only: true,
                            include_location: true
                        }
                    }
                };
                
                const response = await fetch('https://masterbroker.ai/propuestas/api/generate_copy.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
    
                const data = await response.json();
                
                if (data.success) {
                    results[platform] = data.copy;
                }
            }
    
            setNewPost(prev => ({
                ...prev,
                content: {
                    ...prev.content,
                    ...results
                }
            }));
    
            setAiSuggestion('¡Contenido generado con éxito! 🎯');
        } catch (error) {
            console.error('Error en generateWithMaia:', error);
            setAiSuggestion('Error de conexión. Por favor verifica tu conexión a internet.');
        } finally {
            setIsGeneratingText(false);
        }
    };

const generateImage = async () => {
    if (!selectedPropertyId) {
        setAiSuggestion('Por favor, selecciona una propiedad 🏠');
        return;
    }

    setIsGeneratingImage(true);
    try {
        const response = await fetch('https://masterbroker.ai/propuestas/api/generate_copy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'generate_image',
                property_id: selectedPropertyId
            })
        });

        const data = await response.json();
        
        if (data.success && data.image_url) {
            const newFilePreview = {
                name: 'dall-e-generated.png',
                type: 'image/png',
                size: '0',
                url: data.image_url
            };
            
            setMediaPreview(prev => [...prev, newFilePreview]);
            setNewPost(prev => ({
                ...prev,
                media: [...prev.media, newFilePreview]
            }));
            
            setAiSuggestion('¡Imagen generada con éxito! 🎨');
        } else {
            throw new Error(data.error || 'Error al generar la imagen');
        }
    } catch (error) {
        console.error('Error al generar imagen:', error);
        setAiSuggestion('Error al generar la imagen. Por favor, intenta de nuevo.');
    } finally {
        setIsGeneratingImage(false);
    }
};

    const autoResizeTextArea = (element) => {
        if (element) {
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight) + 'px';
        }
    };

    return e('div', { className: 'min-h-screen bg-gray-50' },
        // Header
        e('div', { className: 'bg-white border-b sticky top-0 z-10' },
            e('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
                e('div', { className: 'flex justify-between items-center h-16' },
                    e('h1', { className: 'text-xl font-bold' }, 'Nueva Publicación')
                )
            )
        ),

        // Contenido principal
        e('form', { 
            className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
        },
            e('div', { className: 'space-y-6' },
                // Sección de idioma
                e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                    e('h2', { className: 'text-lg font-medium mb-4' }, 'Idioma del contenido'),
                    e('div', { className: 'flex flex-wrap gap-2' },
                        availableContentLanguages.map(lang => 
                            e('button', {
                                key: lang.id,
                                type: 'button',
                                className: `px-4 py-2 rounded-lg border transition-colors ${
                                    newPost.contentLanguage === lang.id
                                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`,
                                onClick: () => setNewPost(prev => ({ ...prev, contentLanguage: lang.id }))
                            }, lang.name)
                        )
                    )
                ),

                // Sección de plataformas
                e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                    e('h2', { className: 'text-lg font-medium mb-4' }, 'Plataformas'),
                    e('div', { className: 'flex flex-wrap gap-2' },
                        availablePlatforms.map(platform => 
                            e('button', {
                                key: platform.id,
                                type: 'button',
                                className: `flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                                    platform.id === 'twitter' 
                                        ? 'btn-platform-twitter'
                                        : platform.id === 'facebook'
                                            ? 'btn-platform-facebook'
                                            : platform.id === 'instagram'
                                                ? 'btn-platform-instagram'
                                                : platform.id === 'linkedin'
                                                    ? 'btn-platform-linkedin'
                                                    : (newPost.platforms.includes(platform.id)
                                                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                        : 'bg-white border-gray-300 hover:bg-gray-50')
                                }`,
                                onClick: () => handlePlatformChange(platform.id)
                            },
                                platform.id === 'linkedin' ? platform.name : platform.icon && e('span', null, platform.icon),
                                platform.id === 'linkedin' ? platform.icon : platform.name
                            )
                        )
                    )
                ),

                e('div', { className: 'mb-6' },
                    e('label', { 
                        className: 'block text-sm font-medium text-gray-700 mb-2'
                    }, 'Seleccionar propiedad'),
                    isLoadingProperties ? (
                        e('div', { 
                            className: 'animate-pulse bg-gray-100 h-10 rounded-lg'
                        })
                    ) : properties.length === 0 ? (
                        e('div', { 
                            className: 'text-sm text-gray-500 p-3 border rounded-lg bg-gray-50'
                        }, 'No hay propiedades disponibles')
                    ) : (
                        e('select', {
                            value: selectedPropertyId || '',
                            onChange: (e) => setSelectedPropertyId(e.target.value),
                            className: 'w-full p-3 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        },
                            e('option', { value: '' }, 'Selecciona una propiedad'),
                            properties.map(property => 
                                e('option', { 
                                    key: property.id, 
                                    value: property.id 
                                }, 
                                    `${property.title || 'Sin título'} - ${property.location || 'Sin ubicación'}`
                                )
                            )
                        )
                    ),
                    selectedPropertyId && e('div', {
                        className: 'mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg'
                    },
                        e('p', { className: 'text-sm text-blue-700' },
                            'Se utilizará la información de esta propiedad para generar contenido personalizado'
                        )
                    )
                ),

                // Sección de IA
                e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                    e('div', { className: 'flex items-center gap-3 mb-4' },
                        e('h2', { className: 'text-lg font-medium' }, 'Herramientas de IA'),
                        e('span', {
                            className: 'px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full'
                        }, 'MAIA')
                    ),
                    e('p', { className: 'text-gray-600 mb-6' }, 
                        'Utiliza nuestras herramientas de IA para generar contenido y recursos visuales optimizados.'
                    ),
                    e('div', { className: 'space-y-4' },
                        // Botón de generación de texto
                        e('button', {
                            type: 'button',
                            className: `w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-200 ${
                                newPost.platforms.length === 0 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : isGeneratingText
                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`,
                            onClick: generateWithMaia,
                            disabled: isGeneratingText || newPost.platforms.length === 0
                        },
                            isGeneratingText ? (
                                e('div', { className: 'flex items-center gap-2' },
                                    e('svg', {
                                        className: 'animate-spin h-5 w-5',
                                        fill: 'none',
                                        viewBox: '0 0 24 24'
                                    },
                                        e('circle', {
                                            className: 'opacity-25',
                                            cx: '12',
                                            cy: '12',
                                            r: '10',
                                            stroke: 'currentColor',
                                            strokeWidth: '4'
                                        }),
                                        e('path', {
                                            className: 'opacity-75',
                                            fill: 'currentColor',
                                            d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                        })
                                    ),
                                    'MAIA está escribiendo...'
                                )
                            ) : (
                                e('span', { className: 'flex items-center gap-2' },
                                    e('svg', {
                                        className: 'w-5 h-5',
                                        fill: 'none',
                                        stroke: 'currentColor',
                                        viewBox: '0 0 24 24'
                                    },
                                        e('path', {
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            strokeWidth: 2,
                                            d: 'M13 10V3L4 14h7v7l9-11h-7z'
                                        })
                                    ),
                                    'Generar contenido con IA'
                                )
                            )
                        ),
                        // Separador
                        e('div', { className: 'relative' },
                            e('div', { className: 'absolute inset-0 flex items-center' },
                                e('div', { className: 'w-full border-t border-gray-200' })
                            ),
                            e('div', { className: 'relative flex justify-center text-sm' },
                                e('span', { className: 'px-2 bg-white text-gray-500' }, 'o')
                            )
                        ),
                        // Botón de generación de imágenes
                        e('div', { className: 'relative group' },
                            e('button', {
                                type: 'button',
                                onClick: generateImage,
                                className: `w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-200 ${
                                    newPost.platforms.length === 0 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : isGeneratingImage
                                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`,
                                disabled: isGeneratingImage || newPost.platforms.length === 0
                            },
                                isGeneratingImage ? (
                                    e('div', { className: 'flex items-center gap-2' },
                                        e('svg', {
                                            className: 'animate-spin h-5 w-5',
                                            fill: 'none',
                                            viewBox: '0 0 24 24'
                                        },
                                            e('circle', {
                                                className: 'opacity-25',
                                                cx: '12',
                                                cy: '12',
                                                r: '10',
                                                stroke: 'currentColor',
                                                strokeWidth: '4'
                                            }),
                                            e('path', {
                                                className: 'opacity-75',
                                                fill: 'currentColor',
                                                d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                            })
                                        ),
                                        'Generando imagen...'
                                    )
                                ) : (
                                    e('span', { className: 'flex items-center gap-2' },
                                        e('svg', {
                                            className: 'w-5 h-5',
                                            fill: 'none',
                                            stroke: 'currentColor',
                                            viewBox: '0 0 24 24'
                                        },
                                            e('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: 2,
                                                d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                                            })
                                        ),
                                        'Generar imágenes con IA'
                                    )
                                )
                            )
                        ),
                        // Mensajes de estado
                        newPost.platforms.length === 0 && e('p', { 
                            className: 'text-sm text-gray-500 text-center' 
                        }, 'Selecciona al menos una plataforma para usar el asistente'),
                        aiSuggestion && e('div', { className: 'ai-bubble' },
                            e('div', { className: 'flex items-start gap-2' },
                                e('span', { className: 'font-semibold' }, 'MAIA: '),
                                e('span', null, aiSuggestion)
                            )
                        )
                    )
                ),

                // Secciones de plataformas seleccionadas
                newPost.platforms.length > 0 && e('div', { className: 'space-y-6' },
                    newPost.platforms.map(platform => 
                        e('div', { 
                            key: platform, 
                            className: 'bg-white rounded-lg border shadow p-6'
                        },
                            e('div', { 
                                className: `platform-header platform-header-${platform} rounded-lg mb-4`
                            },
                                e('span', null, 
                                    availablePlatforms.find(p => p.id === platform)?.icon
                                ),
                                e('span', { className: 'font-semibold' }, 
                                    availablePlatforms.find(p => p.id === platform)?.name || platform
                                )
                            ),
                            e('div', { className: 'grid md:grid-cols-2 gap-6' },
                                // Editor
                                e('div', { className: 'space-y-4' },
                                    e('label', { className: 'block font-medium' },
                                        `Contenido para ${platform}`
                                    ),
                                    e('textarea', {
                                        className: 'w-full min-h-[128px] p-3 border rounded-lg resize-none',
                                        placeholder: `¿Qué quieres publicar en ${platform}?`,
                                        value: newPost.content[platform] || '',
                                        onChange: (e) => {
                                            autoResizeTextArea(e.target);
                                            setNewPost(prev => ({
                                                ...prev,
                                                content: {
                                                    ...prev.content,
                                                    [platform]: e.target.value
                                                }
                                            }));
                                        },
                                        ref: (textarea) => {
                                            if (textarea) {
                                                autoResizeTextArea(textarea);
                                            }
                                        }
                                    })
                                ),
                                // Previsualización
                                e('div', { className: 'bg-gray-50 p-4 rounded-lg' },
                                    e('p', { className: 'text-sm text-gray-600 mb-2' }, 
                                        'Previsualización'
                                    ),
                                    PreviewCards[platform]({ 
                                        content: newPost.content[platform] || '',
                                        platform,
                                        scheduledDate: newPost.scheduledDate,
                                        scheduledTime: newPost.scheduledTime,
                                        url: newPost.url
                                    }, mediaPreview)
                                )
                            )
                        )
                    )
                ),

                // Nueva sección de URL
                e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                    e('h2', { className: 'text-lg font-medium mb-4' }, 'URL del enlace'),
                    e('div', { className: 'space-y-4' },
                        e('div', { className: 'flex gap-3' },
                            e('div', { className: 'flex-1' },
                                e('input', {
                                    type: 'url',
                                    placeholder: 'https://ejemplo.com',
                                    value: newPost.url || '',
                                    onChange: (e) => setNewPost(prev => ({ ...prev, url: e.target.value })),
                                    className: 'w-full p-3 border rounded-lg'
                                })
                            ),
                            newPost.url && e('button', {
                                type: 'button',
                                onClick: () => setNewPost(prev => ({ ...prev, url: '' })),
                                className: 'px-3 py-2 text-gray-500 hover:text-gray-700'
                            },
                                e('svg', { 
                                    className: 'w-5 h-5', 
                                    fill: 'none', 
                                    viewBox: '0 0 24 24', 
                                    stroke: 'currentColor'
                                },
                                    e('path', { 
                                        strokeLinecap: 'round', 
                                        strokeLinejoin: 'round', 
                                        strokeWidth: 2, 
                                        d: 'M6 18L18 6M6 6l12 12' 
                                    })
                                )
                            )
                        ),
                        newPost.url && !isValidUrl(newPost.url) && e('p', { 
                            className: 'text-red-500 text-sm' 
                        }, 'Por favor, introduce una URL válida'),
                        newPost.url && isValidUrl(newPost.url) && e('div', { 
                            className: 'flex items-center gap-2 text-sm text-green-600' 
                        },
                            e('svg', { 
                                className: 'w-5 h-5', 
                                fill: 'none', 
                                viewBox: '0 0 24 24', 
                                stroke: 'currentColor'
                            },
                                e('path', { 
                                    strokeLinecap: 'round', 
                                    strokeLinejoin: 'round', 
                                    strokeWidth: 2, 
                                    d: 'M5 13l4 4L19 7' 
                                })
                            ),
                            e('span', null, 'URL válida')
                        )
                    )
                ),

                e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                    e('h2', { className: 'text-lg font-medium mb-4' }, 'Contenido multimedia'),
                    e('div', { className: 'space-y-4' },
                        // Área principal de subida
                        e('div', { 
                            className: 'relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors'
                        },
                            e('label', { 
                                className: 'block cursor-pointer'
                            },
                                e('div', { className: 'space-y-3' },
                                    // Icono
                                    e('div', { className: 'mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center' },
                                        e('svg', {
                                            className: 'w-6 h-6 text-blue-600',
                                            fill: 'none',
                                            viewBox: '0 0 24 24',
                                            stroke: 'currentColor'
                                        },
                                            e('path', {
                                                strokeLinecap: 'round',
                                                strokeLinejoin: 'round',
                                                strokeWidth: 2,
                                                d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                                            })
                                        )
                                    ),
                                    // Texto principal
                                    e('div', { className: 'space-y-1' },
                                        e('p', { className: 'text-sm font-medium text-gray-900' },
                                            'Arrastra y suelta tus archivos aquí o ',
                                            e('span', { className: 'text-blue-600' }, 'examina')
                                        ),
                                        e('p', { className: 'text-xs text-gray-500' },
                                            'Soporta imágenes y videos. Máximo 10MB por archivo.'
                                        )
                                    )
                                ),
                                e('input', {
                                    type: 'file',
                                    multiple: true,
                                    className: 'hidden',
                                    onChange: handleMediaChange,
                                    accept: 'image/*,video/*'
                                })
                            )
                        ),

                        // Previsualización de archivos
                        mediaPreview.length > 0 && e('div', { className: 'space-y-3' },
                            // Contador de archivos
                            e('div', { className: 'flex items-center justify-between text-sm text-gray-500' },
                                e('span', null, `${mediaPreview.length} archivo${mediaPreview.length !== 1 ? 's' : ''} seleccionado${mediaPreview.length !== 1 ? 's' : ''}`),
                                mediaPreview.length > 0 && e('button', {
                                    type: 'button',
                                    onClick: () => {
                                        setMediaPreview([]);
                                        setNewPost(prev => ({ ...prev, media: [] }));
                                    },
                                    className: 'text-red-600 hover:text-red-700'
                                }, 'Eliminar todo')
                            ),
                            // Grid de previsualizaciones
                            e('div', { 
                                className: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                            },
                                mediaPreview.map((file, index) => 
                                    e('div', { 
                                        key: index,
                                        className: 'group relative aspect-square bg-gray-100 rounded-lg overflow-hidden'
                                    },
                                        // Previsualización del archivo
                                        file.type.startsWith('image/') 
                                            ? e('img', {
                                                src: file.url,
                                                alt: file.name,
                                                className: 'w-full h-full object-cover'
                                            })
                                            : e('div', {
                                                className: 'w-full h-full flex flex-col items-center justify-center p-4'
                                            },
                                                e('svg', {
                                                    className: 'w-8 h-8 text-gray-400 mb-2',
                                                    fill: 'none',
                                                    viewBox: '0 0 24 24',
                                                    stroke: 'currentColor'
                                                },
                                                    e('path', {
                                                        strokeLinecap: 'round',
                                                        strokeLinejoin: 'round',
                                                        strokeWidth: 2,
                                                        d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                                                    })
                                                ),
                                                e('span', { className: 'text-xs text-gray-500 text-center' }, 'Video')
                                            ),
                                        // Overlay con información y botones
                                        e('div', {
                                            className: 'absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3'
                                        },
                                            e('button', {
                                                onClick: () => removeMedia(index),
                                                className: 'self-end p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white'
                                            },
                                                e('svg', {
                                                    className: 'w-4 h-4',
                                                    viewBox: '0 0 24 24',
                                                    fill: 'none',
                                                    stroke: 'currentColor'
                                                },
                                                    e('path', {
                                                        strokeLinecap: 'round',
                                                        strokeLinejoin: 'round',
                                                        strokeWidth: 2,
                                                        d: 'M6 18L18 6M6 6l12 12'
                                                    })
                                                )
                                            ),
                                            e('div', { className: 'text-white text-xs' },
                                                e('p', { className: 'font-medium truncate' }, file.name),
                                                e('p', null, `${file.size} MB`)
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                ),

            // Reemplazar la sección de opciones de publicación con esto:
            e('div', { className: 'bg-white rounded-lg border shadow p-6' },
                e('h2', { className: 'text-lg font-medium mb-4' }, 'Opciones de publicación'),
                e('div', { className: 'space-y-4' },
                    // Panel de programación (solo visible cuando se selecciona "scheduled")
                    selectedPublishOption === 'scheduled' && e('div', { 
                        className: `transition-all duration-200 ${
                            newPost.platforms.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'
                        }`
                    },
                        e('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-6' },
                            e('div', null,
                                e('label', { className: 'block font-medium mb-2' }, 'Fecha'),
                                e('input', {
                                    type: 'date',
                                    className: 'w-full p-3 border rounded-lg',
                                    value: newPost.scheduledDate,
                                    onChange: (e) => setNewPost({...newPost, scheduledDate: e.target.value})
                                })
                            ),
                            e('div', null,
                                e('label', { className: 'block font-medium mb-2' }, 'Hora'),
                                e('input', {
                                    type: 'time',
                                    className: 'w-full p-3 border rounded-lg',
                                    value: newPost.scheduledTime,
                                    onChange: (e) => setNewPost({...newPost, scheduledTime: e.target.value})
                                })
                            )
                        )
                    ),
                    // Botones de acción
                    e('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                        e('button', {
                            type: 'button',
                            className: `p-4 rounded-lg border transition-all duration-200 flex flex-col items-center gap-2 ${
                                newPost.platforms.length === 0 
                                    ? 'opacity-50 cursor-not-allowed border-gray-200' 
                                    : selectedPublishOption === 'draft'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                            }`,
                            onClick: () => {
                                setSelectedPublishOption('draft');
                            },
                            disabled: newPost.platforms.length === 0
                        },
                            e('svg', { 
                                className: `w-6 h-6 ${selectedPublishOption === 'draft' ? 'text-blue-600' : 'text-gray-600'}`, 
                                fill: 'none', 
                                viewBox: '0 0 24 24', 
                                stroke: 'currentColor' 
                            },
                                e('path', { 
                                    strokeLinecap: 'round', 
                                    strokeLinejoin: 'round', 
                                    strokeWidth: '2', 
                                    d: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' 
                                })
                            ),
                            e('span', { 
                                className: `font-medium ${selectedPublishOption === 'draft' ? 'text-blue-600' : ''}` 
                            }, 'Guardar borrador'),
                            e('span', { className: 'text-sm text-gray-500' }, 'Guardar para editar más tarde')
                        ),
                        e('button', {
                            type: 'button',
                            className: `p-4 rounded-lg transition-all duration-200 flex flex-col items-center gap-2 ${
                                newPost.platforms.length === 0 
                                    ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                                    : selectedPublishOption === 'published'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                            }`,
                            onClick: () => {
                                setSelectedPublishOption('published');
                            },
                            disabled: newPost.platforms.length === 0
                        },
                            e('svg', { 
                                className: 'w-6 h-6', 
                                fill: 'none', 
                                viewBox: '0 0 24 24', 
                                stroke: 'currentColor' 
                            },
                                e('path', { 
                                    strokeLinecap: 'round', 
                                    strokeLinejoin: 'round', 
                                    strokeWidth: '2', 
                                    d: 'M5 13l4 4L19 7' 
                                })
                            ),
                            e('span', { className: 'font-medium' }, 'Publicar ahora'),
                            e('span', { className: 'text-sm opacity-90' }, 'Publicar inmediatamente')
                        ),
                        e('button', {
                            type: 'button',
                            className: `p-4 rounded-lg border transition-all duration-200 flex flex-col items-center gap-2 ${
                                newPost.platforms.length === 0 
                                    ? 'opacity-50 cursor-not-allowed border-gray-200' 
                                    : selectedPublishOption === 'scheduled'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                            }`,
                            onClick: () => {
                                setSelectedPublishOption('scheduled');
                            },
                            disabled: newPost.platforms.length === 0
                        },
                            e('svg', { 
                                className: `w-6 h-6 ${selectedPublishOption === 'scheduled' ? 'text-blue-600' : 'text-gray-600'}`, 
                                fill: 'none', 
                                viewBox: '0 0 24 24', 
                                stroke: 'currentColor' 
                            },
                                e('path', { 
                                    strokeLinecap: 'round', 
                                    strokeLinejoin: 'round', 
                                    strokeWidth: '2', 
                                    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' 
                                })
                            ),
                            e('span', { 
                                className: `font-medium ${selectedPublishOption === 'scheduled' ? 'text-blue-600' : ''}` 
                            }, 'Programar'),
                            e('span', { className: 'text-sm' }, 
                                selectedPublishOption === 'scheduled' && newPost.scheduledDate && newPost.scheduledTime 
                                    ? new Date(`${newPost.scheduledDate}T${newPost.scheduledTime}`).toLocaleString('es-ES', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                    })
                                    : 'Selecciona fecha y hora'
                            )
                        )
                    ),
                    // Botón de acción final
                    selectedPublishOption && e('div', { className: 'mt-6' },
                        e('button', {
                            type: 'button',
                            onClick: () => handlePublish(selectedPublishOption),
                            disabled: selectedPublishOption === 'scheduled' && (!newPost.scheduledDate || !newPost.scheduledTime),
                            className: `w-full p-3 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors
                                ${(selectedPublishOption === 'scheduled' && (!newPost.scheduledDate || !newPost.scheduledTime))
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                }`
                        },
                            selectedPublishOption === 'draft' ? 'Guardar como borrador' :
                            selectedPublishOption === 'published' ? 'Publicar ahora' :
                            'Programar publicación'
                        )
                    )
                )
            )
        )
    )
);
}

const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Función para obtener el primer día del mes
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    };
    
    // Función para obtener el último día del mes
    const getLastDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    };

    // Función para obtener todos los días que se mostrarán en el calendario
    const getDaysInMonth = () => {
        const firstDay = getFirstDayOfMonth(currentDate);
        const lastDay = getLastDayOfMonth(currentDate);
        const days = [];
        
        // Obtener el primer día de la semana (0 = domingo, 1 = lunes, etc.)
        const firstDayWeekday = firstDay.getDay();
        // Ajustar para que la semana empiece en lunes (0 = lunes)
        const adjustedFirstDayWeekday = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;
        
        // Añadir días del mes anterior
        const prevMonth = new Date(currentDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const prevMonthLastDay = getLastDayOfMonth(prevMonth).getDate();
        
        for (let i = adjustedFirstDayWeekday - 1; i >= 0; i--) {
            days.push({
                date: prevMonthLastDay - i,
                isCurrentMonth: false,
                fullDate: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonthLastDay - i)
            });
        }
        
        // Añadir días del mes actual
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: i,
                isCurrentMonth: true,
                isToday: i === new Date().getDate() && 
                         currentDate.getMonth() === new Date().getMonth() &&
                         currentDate.getFullYear() === new Date().getFullYear(),
                fullDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
            });
        }
        
        // Añadir días del mes siguiente
        const remainingDays = 42 - days.length; // 42 = 6 semanas * 7 días
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: i,
                isCurrentMonth: false,
                fullDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i)
            });
        }
        
        return days;
    };

    const formatMonth = (date) => {
        return date.toLocaleDateString('es-ES', { 
            month: 'long',
            year: 'numeric'
        }).replace(/^\w/, (c) => c.toUpperCase());
    };

    return e('div', { className: 'bg-white rounded-lg border shadow' },
        // Header del calendario
        e('div', { className: 'p-6 border-b' },
            e('div', { className: 'flex justify-between items-center' },
                e('div', { className: 'flex items-center gap-4' },
                    e('button', {
                        onClick: () => {
                            const newDate = new Date(currentDate);
                            newDate.setMonth(newDate.getMonth() - 1);
                            setCurrentDate(newDate);
                        },
                        className: 'p-2 hover:bg-gray-100 rounded-full'
                    },
                        e('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                            e('path', { d: 'M15 19l-7-7 7-7' })
                        )
                    ),
                    e('h2', { className: 'text-lg font-medium capitalize' },
                        formatMonth(currentDate)
                    ),
                    e('button', {
                        onClick: () => {
                            const newDate = new Date(currentDate);
                            newDate.setMonth(newDate.getMonth() + 1);
                            setCurrentDate(newDate);
                        },
                        className: 'p-2 hover:bg-gray-100 rounded-full'
                    },
                        e('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                            e('path', { d: 'M9 5l7 7-7 7' })
                        )
                    )
                ),
                e('button', {
                    onClick: () => setCurrentDate(new Date()),
                    className: 'px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100'
                }, 'Hoy')
            )
        ),
        // Cabecera de días de la semana
        e('div', { className: 'grid grid-cols-7 border-b' },
            ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day =>
                e('div', { 
                    key: day, 
                    className: 'py-4 text-sm font-medium text-center'
                }, day)
            )
        ),
        // Grid de días
        e('div', { className: 'grid grid-cols-7' },
            getDaysInMonth().map((day, index) =>
                e('div', { 
                    key: index,
                    className: `calendar-cell p-2 border-b border-r relative hover:bg-gray-50 ${
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    }`
                },
                    e('span', {
                        className: `inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                            day.isToday
                                ? 'bg-blue-600 text-white'
                                : day.isCurrentMonth
                                    ? 'text-gray-900'
                                    : 'text-gray-400'
                        }`
                    }, day.date)
                )
            )
        )
    );
};

const ListView = () => {
    return e('div', { className: 'space-y-4' },
        // Controles de filtro
        e('div', { className: 'bg-white p-4 rounded-lg border shadow' },
            e('div', { className: 'flex gap-2' },
                e('select', { className: 'border rounded-lg px-3 py-2 text-sm' },
                    e('option', null, 'Más recientes'),
                    e('option', null, 'Más antiguos')
                ),
                e('select', { className: 'border rounded-lg px-3 py-2 text-sm' },
                    e('option', null, 'Todas las plataformas'),
                    e('option', null, 'Instagram'),
                    e('option', null, 'Facebook'),
                    e('option', null, 'Twitter'),
                    e('option', null, 'LinkedIn')
                )
            )
        ),
        // Estado vacío
        e('div', { className: 'text-center py-12 bg-white rounded-lg border shadow' },
            e('div', { className: 'w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4' },
                e('svg', { 
                    className: 'w-8 h-8 text-gray-400', 
                    fill: 'none', 
                    viewBox: '0 0 24 24', 
                    stroke: 'currentColor', 
                    strokeWidth: '2' 
                },
                    e('path', { 
                        strokeLinecap: 'round', 
                        strokeLinejoin: 'round', 
                        d: 'M12 6v6m0 0v6m0-6h6m-6 0H6' 
                    })
                )
            ),
            e('h3', { className: 'text-lg font-medium text-gray-900' }, 'No hay borradores'),
            e('p', { className: 'mt-1 text-sm text-gray-500' }, 
                'Los borradores que guardes aparecerán aquí'
            )
        )
    );
};

// Renderizar la aplicación
const root = createRoot(document.getElementById('root'));
root.render(e(SocialMediaDashboard));   