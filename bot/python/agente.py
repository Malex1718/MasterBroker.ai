from anthropic import Anthropic
import sounddevice as sd
import soundfile as sf
import requests
import numpy as np
import io
import time
import threading
import queue
from dotenv import load_dotenv
import os

load_dotenv()
from concurrent.futures import ThreadPoolExecutor

class VoiceAssistant:
    def __init__(self, anthropic_key, elevenlabs_key):
        self.anthropic = Anthropic(api_key=anthropic_key)
        self.elevenlabs_key = elevenlabs_key
        self.conversation_history = []
        self.audio_queue = queue.Queue()
        
        self.system_prompt = """
        Eres Maia, una asesora especializada en bienes raíces. Da siempre respuestas concisas y directas:

        REGLAS:
        - Máximo 1-2 oraciones por respuesta
        - Sin introducciones ni florituras
        - Enfócate solo en información inmobiliaria y financiera
        - No des consejos legales ni recomendaciones de inversión
        - Sugiere consultar profesionales para decisiones importantes

        ESPECIALIZACIÓN:
        1. Bienes Raíces:
           - Precios de mercado actualizados
           - Tendencias inmobiliarias
           - Características de propiedades
           - Zonas y ubicaciones
           - Trámites de compra/venta/renta
           - Créditos hipotecarios
           - Avalúos y valuación

        2. Finanzas Personales relacionadas con bienes raíces:
           - Capacidad de endeudamiento
           - Presupuesto para vivienda
           - Costos de mantenimiento
           - Impuestos inmobiliarios
           - ROI en inversiones inmobiliarias
           - Comparación entre rentar y comprar

        FORMATO DE RESPUESTAS:
        - Números siempre escritos en texto
        - Medidas: "metros cuadrados" completo
        - Moneda: "pesos mexicanos" completo
        - Porcentajes escritos en texto: "treinta por ciento"
        
        EJEMPLOS DE FORMATO:
        - "dos millones trescientos mil pesos mexicanos"
        - "ciento veinte metros cuadrados"
        - "treinta por ciento de enganche"

        COMPORTAMIENTO:
        - Mantén tus respuestas enfocadas solo en temas inmobiliarios y financieros
        - Si preguntan sobre otros temas, indica amablemente que eres especialista inmobiliaria y financiera
        - Sé precisa y profesional en tus respuestas
        - Utiliza términos del sector cuando sea apropiado
        - Verifica siempre el contexto financiero antes de hacer recomendaciones

        IMPORTANTE:
        - No des consejos legales específicos
        - No hagas recomendaciones de inversión específicas
        - Siempre sugiere consultar con profesionales para decisiones importantes
        - Mantén un tono profesional pero accesible
        """
        
        self.VOICE_ID = "rCmVtv8cYU60uhlsOo1M"  # Ana
        self.MODEL_ID = "eleven_turbo_v2_5"
        
        self.sample_rate = 44100
        self.audio_thread = threading.Thread(target=self._audio_player, daemon=True)
        self.audio_thread.start()
        self.executor = ThreadPoolExecutor(max_workers=2)
    
    def text_to_speech(self, text):
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.VOICE_ID}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.elevenlabs_key
        }
        
        data = {
            "text": text,
            "model_id": self.MODEL_ID,
            "voice_settings": {
                "stability": 0.71,
                "similarity_boost": 0.85,
                "style": 0.30,
                "use_speaker_boost": True
            }
        }
        
        try:
            response = requests.post(url, json=data, headers=headers)
            if response.status_code == 200:
                audio_data = io.BytesIO(response.content)
                with sf.SoundFile(audio_data, 'r') as audio_file:
                    audio_data = audio_file.read()
                    samplerate = audio_file.samplerate
                return audio_data, samplerate
            print(f"Error en ElevenLabs: {response.status_code}")
            return None
        except Exception as e:
            print(f"Error de voz: {str(e)}")
            return None
    
    def _audio_player(self):
        while True:
            try:
                audio_data = self.audio_queue.get()
                if audio_data is None:
                    break
                
                data, samplerate = audio_data
                sd.play(data, samplerate)
                sd.wait()
                
            except Exception as e:
                print(f"Error de reproducción: {str(e)}")
    
    def process_response(self, response_text):
        audio_data = self.text_to_speech(response_text)
        if audio_data:
            self.audio_queue.put(audio_data)
    
    def ask_question(self, question):
        try:
            if len(self.conversation_history) > 2:
                self.conversation_history = self.conversation_history[-2:]
            
            response = self.anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=self.system_prompt,
                messages=[
                    *self.conversation_history,
                    {
                        "role": "user",
                        "content": question
                    }
                ]
            )
            
            response_text = response.content[0].text
            self.conversation_history.append({
                "role": "assistant",
                "content": response_text
            })
            
            self.executor.submit(self.process_response, response_text)
            
            return response_text
            
        except Exception as e:
            return f"Error: {str(e)}"
    
    def cleanup(self):
        self.audio_queue.put(None)
        self.executor.shutdown()

def main():
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    
    assistant = VoiceAssistant(ANTHROPIC_API_KEY, ELEVENLABS_API_KEY)
    
    print("\n¡Hola! 👋 Soy Maia, tu asesora inmobiliaria y financiera.")
    print("Estoy aquí para ayudarte con temas de bienes raíces y finanzas relacionadas.")
    print("\nEscribe 'salir' para terminar.")
    
    try:
        while True:
            question = input("\n> ")
            if question.lower() == 'salir':
                break
            print(f"\n{assistant.ask_question(question)}")
    finally:
        assistant.cleanup()
        print("\n¡Hasta pronto! ✨")

if __name__ == "__main__":
    main()