const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const qrcode = require('qrcode-terminal')
const axios = require('axios')

const OWNER = 2348063898506
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  // CONNECTION
  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update

    if (qr) qrcode.generate(qr, { small: true })

    if (connection === 'open') {
      console.log('✅ BOT ONLINE')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // MESSAGE HANDLER
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message) return

    const from = m.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? m.key.participant : from

    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ''

    const isCmd = body.startsWith('!')
    const command = isCmd ? body.slice(1).split(' ')[0].toLowerCase() : ''
    const args = body.split(' ').slice(1)

    // AUTO REPLY
    if (!isCmd && body.toLowerCase() === 'hi') {
      return sock.sendMessage(from, { text: 'Hello 👋' })
    }

    if (!isCmd) return

    // MENU
    if (command === 'menu') {
      return sock.sendMessage(from, {
        text: `📋 *BOT MENU*

🤖 GENERAL
!ping
!menu
!owner

🧠 AI
!ai <text>

🖼️ MEDIA
!sticker (reply image)

👥 GROUP
!kick @user
!promote @user
!demote @user

⚡ FUN
!joke
!quote`
      })
    }

    // PING
    if (command === 'ping') {
      return sock.sendMessage(from, { text: '🏓 Pong!' })
    }

    // OWNER
    if (command === 'owner') {
      return sock.sendMessage(from, { text: '👑 Owner: Michael' })
    }

    // AI CHAT
    if (command === 'ai') {
      if (!args[0]) {
        return sock.sendMessage(from, { text: '❌ Ask something' })
      }

      try {
        const res = await axios.get(
          `https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(args.join(" "))}&owner=Michael&botname=VOID`
        )

        return sock.sendMessage(from, {
          text: res.data.response
        })
      } catch {
        return sock.sendMessage(from, { text: '⚠️ AI error' })
      }
    }

    // JOKE
    if (command === 'joke') {
      try {
        const res = await axios.get('https://official-joke-api.appspot.com/random_joke')
        return sock.sendMessage(from, {
          text: `${res.data.setup}\n\n😂 ${res.data.punchline}`
        })
      } catch {
        sock.sendMessage(from, { text: '❌ Failed to get joke' })
      }
    }

    // QUOTE
    if (command === 'quote') {
      try {
        const res = await axios.get('https://api.quotable.io/random')
        return sock.sendMessage(from, {
          text: `"${res.data.content}"\n— ${res.data.author}`
        })
      } catch {
        sock.sendMessage(from, { text: '❌ Failed to get quote' })
      }
    }

    // STICKER
    if (command === 'sticker') {
      const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage

      if (!quoted?.imageMessage) {
        return sock.sendMessage(from, { text: '❌ Reply to an image' })
      }

      try {
        const buffer = await sock.downloadMediaMessage({
          message: quoted
        })

        await sock.sendMessage(from, {
          sticker: buffer
        })
      } catch {
        sock.sendMessage(from, { text: '❌ Sticker failed' })
      }
    }

    // GROUP COMMANDS
    if (isGroup) {
      const metadata = await sock.groupMetadata(from)
      const admins = metadata.participants
        .filter(p => p.admin !== null)
        .map(p => p.id)

      const isAdmin = admins.includes(sender)

      if (!isAdmin) return

      const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid

      // KICK
      if (command === 'kick' && mentioned) {
        await sock.groupParticipantsUpdate(from, mentioned, 'remove')
      }

      // PROMOTE
      if (command === 'promote' && mentioned) {
        await sock.groupParticipantsUpdate(from, mentioned, 'promote')
      }

      // DEMOTE
      if (command === 'demote' && mentioned) {
        await sock.groupParticipantsUpdate(from, mentioned, 'demote')
      }
    }
  })
}

startBot()
