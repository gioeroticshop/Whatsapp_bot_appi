const express = require('express')
const bodyParser = require('body-parser')
const mensajeRoute = require('./routes/enviarMensaje')
const { iniciarCliente } = require('./whatsapp/client')

const app = express()
const PORT = process.env.PORT || 3000
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'TU_TOKEN_SEGURO'

app.use(bodyParser.json())

app.use((req, res, next) => {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(403).json({ error: 'No autorizado' })
  }
  next()
})

app.use('/', mensajeRoute)

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
  iniciarCliente()
})
