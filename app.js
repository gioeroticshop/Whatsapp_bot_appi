const express = require('express')
const bodyParser = require('body-parser')
const mensajeRoute = require('./routes/enviarMensaje')
const { iniciarCliente } = require('./whatsapp/client')

const app = express()
const PORT = process.env.PORT || 3000
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'TU_TOKEN_SEGURO'

// Middleware para parsing
app.use(bodyParser.json())

// Middleware de autenticación
app.use((req, res, next) => {
  // Permitir endpoint de salud sin autenticación
  if (req.path === '/health') {
    return next()
  }
  
  const auth = req.headers.authorization
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(403).json({ error: 'No autorizado' })
  }
  next()
})

// Endpoint de salud para verificar que la app está funcionando
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Rutas principales
app.use('/', mensajeRoute)

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err)
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor' 
  })
})

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint no encontrado' 
  })
})

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
  console.log(`🔐 Usando token de autorización: ${AUTH_TOKEN.substring(0, 8)}...`)
  
  // Iniciar cliente WhatsApp
  iniciarCliente().catch(err => {
    console.error('❌ Error al iniciar cliente WhatsApp:', err)
  })
})

// Manejo graceful de cierre
process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor cerrado')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor cerrado')
    process.exit(0)
  })
})

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err)
  // No cerrar el proceso, solo logear
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason)
  // No cerrar el proceso, solo logear
})
