const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const { useSingleFileAuthState } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const path = require('path')

const authFile = path.join(__dirname, 'session.json')
const { state, saveState } = useSingleFileAuthState(authFile)

let sock

const iniciarCliente = async () => {
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveState)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Conexión cerrada, reconectando...', shouldReconnect)
      if (shouldReconnect) {
        iniciarCliente()
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp')
    }
  })
}

const enviarMensaje = async (numero, mensaje) => {
  const id = numero.includes('@s.whatsapp.net') ? numero : numero + '@s.whatsapp.net'
  await sock.sendMessage(id, { text: mensaje })
}

module.exports = { iniciarCliente, enviarMensaje }
