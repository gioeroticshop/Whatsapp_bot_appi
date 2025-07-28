const express = require('express')
const router = express.Router()
const { enviarMensaje } = require('../whatsapp/client')

router.post('/enviar-mensaje', async (req, res) => {
  const { numero, mensaje } = req.body
  
  // Validación de datos
  if (!numero || !mensaje) {
    return res.status(400).json({ 
      success: false,
      error: 'Faltan datos requeridos (numero y mensaje)' 
    })
  }

  // Validar formato del número
  const numeroLimpio = numero.toString().replace(/[^\d]/g, '')
  if (numeroLimpio.length < 10) {
    return res.status(400).json({ 
      success: false,
      error: 'Número de teléfono inválido' 
    })
  }

  // Validar mensaje no esté vacío
  if (typeof mensaje !== 'string' || mensaje.trim().length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'El mensaje no puede estar vacío' 
    })
  }

  try {
    console.log(`📤 Intentando enviar mensaje a ${numero}`)
    await enviarMensaje(numeroLimpio, mensaje.trim())
    
    res.json({ 
      success: true,
      message: 'Mensaje enviado correctamente',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('❌ Error enviando mensaje:', err)
    
    // Determinar tipo de error
    let errorMessage = 'Error interno al enviar mensaje'
    let statusCode = 500
    
    if (err.message.includes('no está conectado')) {
      errorMessage = 'WhatsApp no está conectado. Intente nuevamente en unos momentos.'
      statusCode = 503
    } else if (err.message.includes('invalid')) {
      errorMessage = 'Número de teléfono inválido'
      statusCode = 400
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      timestamp: new Date().toISOString()
    })
  }
})

// Endpoint para verificar estado de WhatsApp
router.get('/estado', (req, res) => {
  res.json({
    success: true,
    estado: 'Servicio activo',
    timestamp: new Date().toISOString()
  })
})

// Endpoint para obtener estadísticas del sistema
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    }
  })
})

// Variable global para almacenar el QR actual
let currentQR = null

// Función para actualizar el QR (llamada desde client.js)
const setCurrentQR = (qr) => {
  currentQR = qr
}

// Endpoint para obtener el QR actual
router.get('/qr', (req, res) => {
  if (currentQR) {
    res.json({
      success: true,
      qr: currentQR,
      message: 'Escanea este QR con WhatsApp',
      timestamp: new Date().toISOString()
    })
  } else {
    res.json({
      success: false,
      message: 'No hay QR disponible. WhatsApp puede estar ya conectado o en proceso de conexión.',
      timestamp: new Date().toISOString()
    })
  }
})

// Endpoint para mostrar QR en HTML
router.get('/qr-html', (req, res) => {
  if (currentQR) {
    const QRCode = require('qrcode')
    QRCode.toDataURL(currentQR, (err, url) => {
      if (err) {
        res.status(500).send('Error generando QR visual')
        return
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    max-width: 400px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                img { 
                    max-width: 100%; 
                    height: auto;
                    border: 2px solid #25d366;
                    border-radius: 10px;
                }
                h1 { color: #25d366; }
                .instructions {
                    margin-top: 20px;
                    padding: 15px;
                    background: #e7f3ff;
                    border-radius: 5px;
                    font-size: 14px;
                }
                .refresh {
                    margin-top: 15px;
                }
                button {
                    background: #25d366;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                }
                button:hover {
                    background: #1da851;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📱 Conectar WhatsApp</h1>
                <img src="${url}" alt="QR Code para WhatsApp" />
                <div class="instructions">
                    <strong>Instrucciones:</strong><br>
                    1. Abre WhatsApp en tu teléfono<br>
                    2. Ve a Configuración → Dispositivos vinculados<br>
                    3. Toca "Vincular un dispositivo"<br>
                    4. Escanea este código QR
                </div>
                <div class="refresh">
                    <button onclick="location.reload()">🔄 Actualizar QR</button>
                </div>
                <p><small>Generado: ${new Date().toLocaleString()}</small></p>
            </div>
            <script>
                // Auto-refresh cada 30 segundos
                setTimeout(() => location.reload(), 30000);
            </script>
        </body>
        </html>
      `)
    })
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>WhatsApp Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  text-align: center; 
                  padding: 20px;
                  background: #f5f5f5;
              }
              .container {
                  max-width: 400px;
                  margin: 0 auto;
                  background: white;
                  padding: 30px;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .status {
                  font-size: 18px;
                  color: #25d366;
                  margin: 20px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>✅ WhatsApp Status</h1>
              <div class="status">
                  WhatsApp puede estar ya conectado o en proceso de conexión.
              </div>
              <p>No se requiere escanear QR en este momento.</p>
              <button onclick="location.reload()">🔄 Actualizar</button>
          </div>
          <script>
              setTimeout(() => location.reload(), 10000);
          </script>
      </body>
      </html>
    `)
  }
})

// Endpoint para limpiar sesión y generar nuevo QR
router.post('/nuevo-qr', (req, res) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const authDir = path.join(__dirname, '../whatsapp/auth_info_baileys')
    
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true })
      console.log('🗑️ Archivos de sesión eliminados')
    }
    
    // Limpiar QR actual
    currentQR = null
    
    res.json({
      success: true,
      message: 'Sesión limpiada. Reiniciando conexión para generar nuevo QR...',
      timestamp: new Date().toISOString()
    })
    
    // Reiniciar cliente después de responder
    setTimeout(() => {
      const { iniciarCliente } = require('../whatsapp/client')
      iniciarCliente()
    }, 1000)
    
  } catch (error) {
    console.error('❌ Error limpiando sesión:', error)
    res.status(500).json({
      success: false,
      error: 'Error al limpiar sesión',
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = { router, setCurrentQR }
