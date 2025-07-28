const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const path = require('path')

const authDir = path.join(__dirname, 'auth_info_baileys')

let sock
let isConnecting = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 100 // Aumentado
const RECONNECT_DELAY = 3000 // Reducido a 3 segundos
let keepAliveInterval
let connectionCheckInterval

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Asegurar que el directorio de auth existe
const ensureAuthDir = () => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
    console.log('📁 Directorio de autenticación creado')
  }
}

const iniciarCliente = async () => {
  if (isConnecting) {
    console.log('Ya se está intentando conectar...')
    return
  }

  isConnecting = true
  ensureAuthDir()

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['WhatsApp Web', 'Chrome', '4.0.0'],
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      // Configuraciones adicionales para mejor estabilidad
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      msgRetryCounterCache: new Map(),
      defaultQueryTimeoutMs: 60000,
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

    sock.ev.on('creds.update', (creds) => {
      console.log('💾 Guardando credenciales...')
      saveCreds()
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      
      if (qr) {
        console.log('🔍 Código QR generado - Escanea para conectar')
        // Actualizar QR en routes si existe la función
        try {
          const { setCurrentQR } = require('../routes/enviarMensaje')
          setCurrentQR(qr)
        } catch (err) {
          console.log('⚠️ No se pudo actualizar QR en routes')
        }
      }
      
      if (connection === 'close') {
        isConnecting = false
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const errorMsg = lastDisconnect?.error?.message || 'Error desconocido'
        
        console.log(`❌ Conexión cerrada. Código: ${statusCode}, Error: ${errorMsg}`)
        
        // Limpiar intervals
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
          keepAliveInterval = null
        }
        if (connectionCheckInterval) {
          clearInterval(connectionCheckInterval)
          connectionCheckInterval = null
        }
        
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(`🔄 Reintentando conexión (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) en ${RECONNECT_DELAY/1000}s...`)
          
          await delay(RECONNECT_DELAY)
          iniciarCliente()
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log('🚪 Sesión cerrada por logout. Limpiando archivos...')
          try {
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true })
            }
            ensureAuthDir()
          } catch (err) {
            console.error('Error eliminando archivos de auth:', err)
          }
          reconnectAttempts = 0
          await delay(2000)
          iniciarCliente()
        } else {
          console.log('❌ Máximo número de intentos alcanzado. Esperando 30s para reintentar...')
          setTimeout(() => {
            reconnectAttempts = 0
            iniciarCliente()
          }, 30000)
        }
      } else if (connection === 'open') {
        console.log('✅ ¡Conectado a WhatsApp exitosamente!')
        reconnectAttempts = 0
        isConnecting = false
        
        // Iniciar sistemas de mantenimiento
        iniciarKeepAlive()
        iniciarMonitoreoConexion()
        
        // Limpiar QR ya que estamos conectados
        try {
          const { setCurrentQR } = require('../routes/enviarMensaje')
          setCurrentQR(null)
        } catch (err) {
          // Ignorar si no existe
        }
      } else if (connection === 'connecting') {
        console.log('🔄 Conectando a WhatsApp...')
      }
    })

    // Manejar eventos adicionales
    sock.ev.on('CB:call', (node) => {
      console.log('📞 Llamada recibida (ignorada):', node.from)
    })

    sock.ev.on('messages.upsert', (messageUpdate) => {
      // Solo log para debug, no procesar mensajes
      console.log('📨 Mensaje recibido (ignorado)')
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
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
  }
  
  keepAliveInterval = setInterval(async () => {
    try {
      if (sock && sock.ws && sock.ws.readyState === 1) {
        await sock.ping()
        console.log('💓 Keep-alive enviado')
      } else {
        console.log('⚠️ Socket no disponible para keep-alive')
      }
    } catch (error) {
      console.log('⚠️ Error en keep-alive:', error.message)
    }
  }, 25000) // Cada 25 segundos
}

const iniciarMonitoreoConexion = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval)
  }
  
  connectionCheckInterval = setInterval(() => {
    if (!sock || sock.ws?.readyState !== 1) {
      console.log('🔍 Conexión perdida detectada, intentando reconectar...')
      if (!isConnecting) {
        iniciarCliente()
      }
    }
  }, 60000) // Cada minuto
}

const enviarMensaje = async (numero, mensaje) => {
  if (!sock || sock.ws?.readyState !== 1) {
    throw new Error('Cliente WhatsApp no está conectado. Estado: ' + (sock?.ws?.readyState || 'desconocido'))
  }
  
  try {
    const id = numero.includes('@s.whatsapp.net') ? numero : numero + '@s.whatsapp.net'
    
    // Verificar si el número existe antes de enviar
    const [exists] = await sock.onWhatsApp(id)
    if (!exists || !exists.exists) {
      throw new Error('El número no tiene WhatsApp')
    }
    
    await sock.sendMessage(id, { text: mensaje })
    console.log(`✅ Mensaje enviado a ${numero}`)
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error)
    throw error
  }
}

// Función para verificar estado de conexión
const obtenerEstadoConexion = () => {
  return {
    conectado: sock && sock.ws?.readyState === 1,
    estado: sock?.ws?.readyState || 'desconocido',
    intentosReconexion: reconnectAttempts,
    conectando: isConnecting
  }
}

// Manejar cierre de aplicación
const cerrarCliente = () => {
  console.log('🛑 Cerrando cliente WhatsApp...')
  
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
  
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval)
    connectionCheckInterval = null
  }
  
  if (sock) {
    try {
      sock.end()
    } catch (err) {
      console.log('Error cerrando socket:', err.message)
    }
  }
}

process.on('SIGINT', () => {
  cerrarCliente()
  process.exit(0)
})

process.on('SIGTERM', () => {
  cerrarCliente()
  process.exit(0)
})

module.exports = { 
  iniciarCliente, 
  enviarMensaje, 
  obtenerEstadoConexion,
  cerrarCliente 
}
