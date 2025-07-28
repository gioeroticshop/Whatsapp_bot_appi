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

module.exports = router
