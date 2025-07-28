const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Ruta al archivo de autenticación
const authFile = path.join(__dirname, '../auth_info.json');
const { state, saveState } = useSingleFileAuthState(authFile);

// Función para iniciar el socket de WhatsApp
const startSock = () => {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log('Conexión cerrada, reconectando...', shouldReconnect);
      if (shouldReconnect) startSock();
    } else if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp');
    }
  });

  sock.ev.on('creds.update', saveState);

  return sock;
};

module.exports = startSock;
