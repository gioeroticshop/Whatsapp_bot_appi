const express = require('express')
const bodyParser = require('body-parser')
const { router: mensajeRoute } = require('./routes/enviarMensaje')
const { iniciarCliente } = require('./whatsapp/client')

const app = express()
const PORT = process.env.PORT || 3000
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'TU_TOKEN_SEGURO'

// Middleware para parsing
app.use(bodyParser.json())

// Endpoint de salud para verificar que la app está funcionando (SIN autenticación)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Dashboard principal (SIN autenticación para fácil acceso)
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { background: #25D366; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #1DA851; }
        .form-control { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 WhatsApp Bot Dashboard 🤖</h1>
            <p>Controla tu bot de WhatsApp</p>
        </div>
        
        <div class="card">
            <h3>🔧 Estado del Sistema</h3>
            <p id="server-status">Verificando...</p>
            <button class="btn" onclick="refreshStatus()">🔄 Actualizar</button>
            <button class="btn" onclick="viewQR()">📱 Ver QR</button>
        </div>
        
        <div class="card">
            <h3>💬 Enviar Mensaje</h3>
            <input type="text" id="phone-number" class="form-control" placeholder="Número (ej: 573001234567)">
            <textarea id="message-text" class="form-control" placeholder="Tu mensaje"></textarea>
            <button class="btn" onclick="sendMessage()">📤 Enviar</button>
            <div id="message-result"></div>
        </div>
        
        <div class="card">
            <h3>⚙️ Configuración</h3>
            <input type="text" id="api-url" class="form-control" value="https://vacun-whatsapp-service.onrender.com" placeholder="URL de la API">
            <input type="password" id="auth-token" class="form-control" placeholder="Token de autorización">
            <button class="btn" onclick="saveConfig()">💾 Guardar</button>
            <button class="btn" onclick="newQR()">🔄 Nuevo QR</button>
        </div>
    </div>

    <script>
        let config = { apiUrl: 'https://vacun-whatsapp-service.onrender.com', authToken: '' };
        
        function loadConfig() {
            const saved = localStorage.getItem('whatsapp-config');
            if (saved) {
                config = JSON.parse(saved);
                document.getElementById('api-url').value = config.apiUrl;
                document.getElementById('auth-token').value = config.authToken;
            }
        }
        
        function saveConfig() {
            config.apiUrl = document.getElementById('api-url').value;
            config.authToken = document.getElementById('auth-token').value;
            localStorage.setItem('whatsapp-config', JSON.stringify(config));
            alert('✅ Configuración guardada');
        }
        
        async function refreshStatus() {
            try {
                const response = await fetch(config.apiUrl + '/health');
                const data = await response.json();
                document.getElementById('server-status').innerHTML = '✅ Servidor: Conectado<br>⏰ Uptime: ' + Math.floor(data.uptime/3600) + 'h';
            } catch (e) {
                document.getElementById('server-status').innerHTML = '❌ Error de conexión';
            }
        }
        
        async function sendMessage() {
            const phone = document.getElementById('phone-number').value;
            const message = document.getElementById('message-text').value;
            const result = document.getElementById('message-result');
            
            if (!phone || !message || !config.authToken) {
                result.innerHTML = '<p style="color:red">❌ Completa todos los campos y configura el token</p>';
                return;
            }
            
            try {
                const response = await fetch(config.apiUrl + '/enviar-mensaje', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + config.authToken
                    },
                    body: JSON.stringify({ numero: phone, mensaje: message })
                });
                
                const data = await response.json();
                if (data.success) {
                    result.innerHTML = '<p style="color:green">✅ Mensaje enviado correctamente</p>';
                    document.getElementById('message-text').value = '';
                } else {
                    result.innerHTML = '<p style="color:red">❌ Error: ' + data.error + '</p>';
                }
            } catch (e) {
                result.innerHTML = '<p style="color:red">❌ Error de conexión</p>';
            }
        }
        
        function viewQR() {
            window.open(config.apiUrl + '/qr-html', '_blank');
        }
        
        async function newQR() {
            if (!config.authToken) {
                alert('❌ Configura el token primero');
                return;
            }
            
            try {
                await fetch(config.apiUrl + '/nuevo-qr', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + config.authToken }
                });
                alert('✅ Nuevo QR generado');
                setTimeout(() => viewQR(), 2000);
            } catch (e) {
                alert('❌ Error generando QR');
            }
        }
        
        window.onload = () => {
            loadConfig();
            refreshStatus();
        };
    </script>
</body>
</html>`)
})

// Middleware de autenticación (SOLO para rutas de API, NO para dashboard)
app.use((req, res, next) => {
  // Permitir endpoints públicos sin autenticación
  if (req.path === '/health' || req.path === '/' || req.path === '/qr-html') {
    return next()
  }
  
  const auth = req.headers.authorization
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(403).json({ error: 'No autorizado' })
  }
  next()
})

// Rutas principales (CON autenticación)
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
