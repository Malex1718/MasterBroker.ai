import discord
from discord.commands import Option
import asyncio

# Configuración
TOKEN = ''
CHANNEL_ID = 1329898725098782760
MIDJOURNEY_BOT_ID = 936929561302675456

# Configurar el bot con los intents necesarios
intents = discord.Intents.default()
intents.message_content = True
bot = discord.Bot(intents=intents)

# Variables globales para el contexto de interacción
last_interaction = None
channel = None

@bot.event
async def on_ready():
    global channel
    print(f'\n✅ Bot conectado como: {bot.user}')
    channel = bot.get_channel(CHANNEL_ID)
    
    if channel:
        print(f'📺 Canal conectado: {channel.name} en {channel.guild.name}')
        print('\n💡 Escribe tu prompt (o "salir" para terminar):')
        asyncio.create_task(console_input())
    else:
        print('❌ Error: No se pudo encontrar el canal')
        await bot.close()

async def console_input():
    global channel
    while True:
        try:
            prompt = await asyncio.get_event_loop().run_in_executor(None, input)
            
            if prompt.lower() == 'salir':
                print('👋 Cerrando el bot...')
                await bot.close()
                break
                
            if channel:
                try:
                    # Crear y enviar el slash command
                    interaction = await bot.http.create_interaction(
                        type=2,
                        application_id=MIDJOURNEY_BOT_ID,
                        guild_id=channel.guild.id,
                        channel_id=CHANNEL_ID,
                        data={
                            "name": "imagine",
                            "type": 1,
                            "options": [{
                                "name": "prompt",
                                "type": 3,
                                "value": prompt
                            }]
                        }
                    )
                    print("🎨 Prompt enviado a Midjourney - Esperando respuesta...")
                except Exception as e:
                    print(f"❌ Error al enviar comando: {e}")
            else:
                print("❌ Error: Canal no encontrado")
        except Exception as e:
            print(f"❌ Error general: {e}")

@bot.event
async def on_message(message):
    if message.author.id == MIDJOURNEY_BOT_ID:
        if message.attachments:
            print(f"\n🖼️ Imagen generada: {message.attachments[0].url}")
            print("\n💡 Escribe tu próximo prompt (o 'salir' para terminar):")
        elif "Waiting to start" in message.content:
            print("⏳ Midjourney está procesando tu prompt...")

# Ejecutar el bot
try:
    bot.run(TOKEN)
except Exception as e:
    print(f"❌ Error al iniciar el bot: {e}")