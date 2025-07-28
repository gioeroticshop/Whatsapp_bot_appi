const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const path = require('path')

const authDir = path.join(__dirname, 'auth_info_baileys')

let sock
let isConnecting = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 50
const RECONNECT_DELAY = 5000 // 5 segundos
let keepAliveInterval

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const iniciarCliente = async () => {
  if (isConnecting) {
    console.log('Ya se está intentando conectar...')
    return
  }

  isConnecting = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
      keepAliveIntervalMs: 30000, // Keep alive cada 30 segundos
      connectTimeoutMs: 60000, // Timeout de conexión de 60 segundos
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        )
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          }
        }
        return message
      },
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      
      if (qr) {
        console.log('🔍 Escanea el código QR para conectar WhatsApp')
      }
      
      if (connection === 'close') {
        isConnecting = false
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        const statusCode = lastDisconnect?.error?.output?.statusCode
        
        console.log(`❌ Conexión cerrada. Código: ${statusCode}`)
        
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(`🔄 Reintentando conexión (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) en ${RECONNECT_DELAY/1000} segundos...`)
          
          // Limpiar el keep alive actual
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval)
          }
          
          await delay(RECONNECT_DELAY)
          iniciarCliente()
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log('🚪 Sesión cerrada. Necesita volver a autenticar.')
          // Eliminar archivos de autenticación para forzar nuevo QR
          try {
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true })
            }
          } catch (err) {
            console.error('Error eliminando archivos de auth:', err)
          }
          reconnectAttempts = 0
          await delay(2000)
          iniciarCliente()
        } else {
          console.log('❌ Máximo número de intentos de reconexión alcanzado')
        }
      } else if (connection === 'open') {
        console.log('✅ Conectado a WhatsApp exitosamente')
        reconnectAttempts = 0
        isConnecting = false
        
        // Iniciar keep alive
        iniciarKeepAlive()
      } else if (connection === 'connecting') {
        console.log('🔄 Conectando a WhatsApp...')
      }
    })

    // Manejar errores no capturados
    sock.ev.on('CB:call', (node) => {
      console.log('📞 Llamada recibida:', node)
    })

  } catch (error) {
    console.error('❌ Error al iniciar cliente:', error)
    isConnecting = false
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++
      console.log(`🔄 Reintentando después de error (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
      await delay(RECONNECT_DELAY)
      iniciarCliente()
    }
  }
}

const iniciarKeepAlive = () => {
  // Limpiar interval anterior si existe
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
  }
  
  // Keep alive cada 25 segundos
  keepAliveInterval = setInterval(async () => {
    try {
      if (sock && sock.ws && sock.ws.readyState === 1) {
        // Enviar ping para mantener conexión activa
        await sock.ping()
        console.log('💓 Keep alive enviado')
      }
    } catch (error) {
      console.log('⚠️ Error en keep alive:', error.message)
    }
  }, 25000)
}

const enviarMensaje = async (numero, mensaje) => {
  if (!sock || sock.ws?.readyState !== 1) {
    throw new Error('Cliente WhatsApp no está conectado. Estado: ' + (sock?.ws?.readyState || 'desconocido'))
  }
  
  try {
    const id = numero.includes('@s.whatsapp.net') ? numero : numero + '@s.whatsapp.net'
    await sock.sendMessage(id, { text: mensaje })
    console.log(`✅ Mensaje enviado a ${numero}`)
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error)
    throw error
  }
}

// Manejar cierre de aplicación
process.on('SIGINT', () => {
  console.log('🛑 Cerrando aplicación...')
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
  }
  if (sock) {
    sock.end()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('🛑 Aplicación terminada...')
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
  }
  if (sock) {
    sock.end()
  }
  process.exit(0)
})

module.exports = { iniciarCliente, enviarMensaje }
