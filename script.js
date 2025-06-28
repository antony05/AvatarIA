document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN Y ELEMENTOS DEL DOM ---
    // ADVERTENCIA DE SEGURIDAD: Nunca expongas tu clave de API en el lado del cliente
    // para aplicaciones en producción. Usa un backend para protegerla.
    const API_KEY = 'TU_CLAVE_DE_API_DE_GEMINI_AQUI'; 
    const MODEL_ID = 'gemini-1.5-flash-latest';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`;

    const iframe = document.getElementById('avatar');
    const respuestaDiv = document.getElementById('respuesta');
    const talkButton = document.getElementById('talkButton');

    // --- 2. VARIABLES DE ESTADO ---
    let recognition;
    let isSpeaking = false;
    // NUEVO: Historial para mantener el contexto de la conversación
    let conversationHistory = [];

    // --- 3. INICIALIZACIÓN DE LA APLICACIÓN ---
    function initApp() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            respuestaDiv.textContent = "Tu navegador no soporta el reconocimiento de voz. Intenta con Chrome.";
            talkButton.disabled = true;
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = handleRecognitionResult;
        recognition.onerror = handleRecognitionError;
        recognition.onend = () => console.log('Reconocimiento de voz finalizado.');

        talkButton.addEventListener('click', toggleRecognition);
        window.addEventListener('message', handleIframeMessage);
    }

    // --- 4. MANEJO DEL AVATAR Y BIENVENIDA ---
    function handleIframeMessage(event) {
        if (event.data.source === 'readyplayerme' && event.data.eventName === 'v1.frame.ready') {
            console.log('El avatar está listo.');
            talkButton.disabled = false; // Habilitar el botón cuando el avatar cargue
            const welcomeMessage = "Hola, soy tu asistente virtual. Presiona el botón para hablar conmigo.";
            respuestaDiv.textContent = welcomeMessage;
            speakAndAnimate(welcomeMessage);
        }
    }
    
    // --- 5. LÓGICA DE RECONOCIMIENTO DE VOZ ---
    function toggleRecognition() {
        if (isSpeaking) return;
        respuestaDiv.textContent = "Escuchando...";
        talkButton.innerHTML = '<i>Escuchando...</i>';
        talkButton.disabled = true;
        recognition.start();
    }

    function handleRecognitionResult(event) {
        const textoUsuario = event.results[0][0].transcript;
        respuestaDiv.textContent = `Tú: "${textoUsuario}"`;
        processWithGemini(textoUsuario);
    }

    function handleRecognitionError(event) {
        console.error("Error en el reconocimiento de voz:", event.error);
        let errorMessage = "Ocurrió un error al reconocer la voz.";
        if (event.error === 'not-allowed') {
            errorMessage = "Permiso de micrófono denegado. Por favor, habilítalo en la configuración de tu navegador.";
        } else if (event.error === 'no-speech') {
            errorMessage = "No se detectó voz. Intenta de nuevo.";
        }
        respuestaDiv.textContent = errorMessage;
        resetUI();
    }

    // --- 6. CONEXIÓN CON LA API DE GEMINI ---
    async function processWithGemini(textoUsuario) {
        respuestaDiv.innerHTML = `<span class="spinner"></span> Pensando...`;
        
        conversationHistory.push({
            "role": "user",
            "parts": [{ "text": textoUsuario }]
        });

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "contents": conversationHistory,
                    "systemInstruction": {
                        "parts": [{ 
                            "text": "Eres un asistente virtual llamado Aura, integrado en un avatar 3D. Eres amigable, servicial y un poco futurista. Tus respuestas deben ser concisas y directas." 
                        }]
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0].content.parts[0].text) {
                 throw new Error("Respuesta inválida de la API.");
            }
            
            const textoRespuesta = data.candidates[0].content.parts[0].text;
            
            conversationHistory.push({
                "role": "model",
                "parts": [{ "text": textoRespuesta }]
            });
            
            respuestaDiv.textContent = textoRespuesta;
            speakAndAnimate(textoRespuesta);

        } catch (error) {
            console.error("Error al conectar con Gemini:", error);
            respuestaDiv.textContent = "Lo siento, hubo un problema de conexión. Revisa tu clave de API y la consola para más detalles.";
            resetUI();
        }
    }

    // --- 7. SÍNTESIS DE VOZ Y ANIMACIÓN DEL AVATAR ---
    function speakAndAnimate(text) {
        isSpeaking = true;
        talkButton.disabled = true;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';

        utterance.onstart = () => {
            iframe.contentWindow.postMessage({
                target: 'readyplayerme',
                type: 'v1.viseme.start',
                payload: { text: text }
            }, '*');
        };

        utterance.onend = () => {
            iframe.contentWindow.postMessage({
                target: 'readyplayerme',
                type: 'v1.viseme.stop'
            }, '*');
            isSpeaking = false;
            resetUI();
        };
        
        utterance.onerror = (e) => {
            console.error("Error en la síntesis de voz:", e);
            isSpeaking = false;
            resetUI();
        };

        window.speechSynthesis.speak(utterance);
    }

    // --- 8. FUNCIÓN UTILITARIA ---
    function resetUI() {
        talkButton.innerHTML = '🎤 Hablar';
        talkButton.disabled = false;
    }

    // --- Iniciar la aplicación ---
    initApp();
});
