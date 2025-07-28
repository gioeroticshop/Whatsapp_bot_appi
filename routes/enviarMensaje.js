const express = require('express')
const router = express.Router()
const { enviarMensaje } = require('../whatsapp/client')

router.post('/enviar-mensaje', async (req, res) => {
  const { numero, mensaje } = req.body
  if (!numero || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  try {
    await enviarMensaje(numero, mensaje)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
