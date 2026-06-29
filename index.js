const express = require("express");
const fs = require("fs");
const axios = require("axios");
const app = express();

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
    Routes,
    REST
} = require('discord.js');

// 🌐 EXPRESS WEB SERVER
app.get("/", (req, res) => res.send("🤖 High-Performance Multi-Purpose Bot Online"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// 🎫 IDs ORIGINALES Y ESTÁTICOS DE TU SISTEMA DE TICKETS
const CONFIG = {
    PRIVATE_CATEGORY: '1520097680972447744',
    APPEAL: {
        CHANNEL: '1521208884197589164',
        ROLE: '1521208595557908611'
    },
    CREATOR: {
        CHANNEL: '1521208966556680202',
        ROLE: '1521208730543460505'
    },
    INQUIRY: {
        CHANNEL: '1521209048371040327',
        ROLE: '1521208655628996689'
    }
};

// 💾 CAPA DE PERSISTENCIA GENERAL
const DB_FILE = "./results.json";
const MSG_FILE = "./messages.json";
const WARNS_FILE = "./warns.json";
const CONFIG_FILE = "./config.json"; 
const LEVELS_FILE = "./levels.json";

function safeLoad(file) {
    if (!fs.existsSync(file)) return {};
    try { 
        const content = fs.readFileSync(file, "utf8").trim();
        return content ? JSON.parse(content) : {};
    } catch { return {}; }
}

function safeSave(file, data) {
    const tmp = `${file}.tmp`;
    try { 
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8"); 
        fs.renameSync(tmp, file);
    } catch (e) { console.error(`❌ Error guardando ${file}:`, e); }
}

let database = safeLoad(DB_FILE);
let messageDatabase = safeLoad(MSG_FILE);
let warnsDatabase = safeLoad(WARNS_FILE);
let guildConfig = safeLoad(CONFIG_FILE);
let levels = safeLoad(LEVELS_FILE);

const getConfig = (key, fallback = null) => {
    return guildConfig[key] || fallback;
};

// 🤖 CLIENTE DISCORD
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,             
        GatewayIntentBits.GuildMessages,      
        GatewayIntentBits.MessageContent,     
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildBans
    ],
    partials: [Partials.Channel, Partials.User, Partials.Message, Partials.Reaction] 
});

// 📈 SENDER DE LOGS AUTOMÁTICOS
async function logAction(title, description, color = 0xFFA500) {
    try {
        const logChannelId = getConfig('LOGS_CHANNEL');
        if (!logChannelId) return;
        const guild = client.guilds.cache.first(); 
        const channel = await guild?.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
        await channel.send({ embeds: [embed] });
    } catch (err) { console.error("❌ Error enviando log:", err); }
}

// 📊 MOTOR DE SISTEMA DE EXPERIENCIA (XP)
function addXP(userId) {
    if (!levels[userId]) levels[userId] = { xp: 0, level: 1 };
    
    levels[userId].xp += Math.floor(Math.random() * 5) + 5;
    const needed = levels[userId].level * 100;

    if (levels[userId].xp >= needed) {
        levels[userId].level++;
        levels[userId].xp = 0;
        safeSave(LEVELS_FILE, levels);
        return true;
    }
    safeSave(LEVELS_FILE, levels);
    return false;
}

const lastMessages = new Map();
const contentCache = new Map();

// --- 🚀 REGISTRO GLOBAL DE SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`🟢 Bot conectado de forma limpia: ${client.user.tag}`);

    const commands = [
        // 🌟 NUEVOS COMANDOS UTILIDAD E INFORMACIÓN
        new SlashCommandBuilder().setName('serverinfo').setDescription('Muestra los datos estadísticos y técnicos del servidor actual'),
        new SlashCommandBuilder().setName('userinfo').setDescription('Muestra el perfil detallado de un usuario en este servidor')
            .addUserOption(o => o.setName('miembro').setDescription('Selecciona al miembro').setRequired(false)),
        new SlashCommandBuilder().setName('avatar').setDescription('Muestra y proporciona el enlace del avatar de un usuario')
            .addUserOption(o => o.setName('usuario').setDescription('Selecciona al usuario').setRequired(false)),
        new SlashCommandBuilder().setName('ping').setDescription('Comprueba la latencia del bot con la API de Discord'),

        // Paneles Públicos
        new SlashCommandBuilder().setName('appeal-panel').setDescription('Muestra el panel de apelación de ban'),
        new SlashCommandBuilder().setName('creator-panel').setDescription('Muestra el panel de creadores'),
        new SlashCommandBuilder().setName('support-panel').setDescription('Muestra el panel de soporte técnico'),
        new SlashCommandBuilder().setName('suggestion-panel').setDescription('Muestra el panel/formulario para enviar sugerencias'),
        new SlashCommandBuilder().setName('reactionrole-panel').setDescription('Despliega panel de Auto-Roles por botones'),
        
        // Configuración /set
        new SlashCommandBuilder().setName('setlogs').setDescription('Configura el canal de logs de acciones')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
        new SlashCommandBuilder().setName('setwelcome').setDescription('Configura el canal de mensajes de bienvenidas')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
        new SlashCommandBuilder().setName('setautorole').setDescription('Configura el rol automático otorgado al entrar')
            .addRoleOption(o => o.setName('rol').setDescription('Selecciona el rol').setRequired(true)),
        new SlashCommandBuilder().setName('setsuggestions').setDescription('Configura el canal del buzón de sugerencias')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),

        // Moderación Pro
        new SlashCommandBuilder().setName('kick').setDescription('Expulsa a un usuario')
            .addUserOption(o => o.setName('target').setDescription('Usuario a expulsar').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón del kick')),
        new SlashCommandBuilder().setName('ban').setDescription('Banea a un usuario del servidor')
            .addUserOption(o => o.setName('target').setDescription('Usuario a banea').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón del ban')),
        new SlashCommandBuilder().setName('unban').setDescription('Remueve el baneo de un usuario mediante su ID')
            .addStringOption(o => o.setName('userid').setDescription('ID del usuario a desbanear').setRequired(true)),
        new SlashCommandBuilder().setName('mute').setDescription('Aplica aislamiento temporal básico (Timeout)')
            .addUserOption(o => o.setName('target').setDescription('Usuario a mutear').setRequired(true))
            .addIntegerOption(o => o.setName('minutes').setDescription('Minutos de duración').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón')),
        new SlashCommandBuilder().setName('timeout').setDescription('Aplica un timeout restrictivo avanzado')
            .addUserOption(o => o.setName('target').setDescription('Usuario a sancionar').setRequired(true))
            .addIntegerOption(o => o.setName('minutos').setDescription('Minutos de aislamiento').setRequired(true))
            .addStringOption(o => o.setName('razon').setDescription('Razón')),
        new SlashCommandBuilder().setName('warn').setDescription('Aplica una advertencia a un miembro')
            .addUserOption(o => o.setName('target').setDescription('Usuario a advertir').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón').setRequired(true)),
        new SlashCommandBuilder().setName('unwarn').setDescription('Remueve la última advertencia de un miembro')
            .addUserOption(o => o.setName('target').setDescription('Usuario').setRequired(true)),
        new SlashCommandBuilder().setName('clear').setDescription('Borra mensajes masivos de un canal de texto')
            .addIntegerOption(o => o.setName('amount').setDescription('Cantidad de mensajes (1-100)').setRequired(true)),
        new SlashCommandBuilder().setName('lock').setDescription('Bloquea la escritura en el canal actual'),
        new SlashCommandBuilder().setName('unlock').setDescription('Desbloquea la escritura en el canal actual'),

        // 🎉 Diversión (Fun) Expandido
        new SlashCommandBuilder().setName('joke').setDescription('Muestra un chiste aleatorio para la comunidad'),
        new SlashCommandBuilder().setName('8ball').setDescription('Hazle una pregunta existencial a la bola mágica de cristal')
            .addStringOption(o => o.setName('pregunta').setDescription('¿Qué deseas consultar?').setRequired(true)),
        new SlashCommandBuilder().setName('hug').setDescription('Envía un tierno abrazo virtual a un miembro de la comunidad')
            .addUserOption(o => o.setName('usuario').setDescription('¿A quién abrazas?').setRequired(true)),
        new SlashCommandBuilder().setName('dance').setDescription('Saca tus mejores pasos de baile en el chat'),
        new SlashCommandBuilder().setName('coinflip').setDescription('Lanza una moneda al aire (Cara o Cruz)'),
        new SlashCommandBuilder().setName('roll').setDescription('Lanza un dado estándar de 6 caras de forma aleatoria'),
        new SlashCommandBuilder().setName('embed').setDescription('Construye y envía un anuncio personalizado estructurado en Embed')
            .addStringOption(o => o.setName('titulo').setDescription('Título del embed').setRequired(true))
            .addStringOption(o => o.setName('descripcion').setDescription('Contenido / Descripción').setRequired(true))
            .addStringOption(o => o.setName('color').setDescription('Color en HEX o nombre en español')),

        // Roblox
        new SlashCommandBuilder().setName('roblox-user').setDescription('Obtiene información pública del perfil de Roblox de un usuario')
            .addStringOption(o => o.setName('username').setDescription('Nombre exacto del usuario de Roblox').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("✅ Ecosistema de comandos globales refrescado exitosamente.");
    } catch (error) { console.error('❌ Error registrando comandos:', error); }
});

// --- 👋 LOGS / EVENTOS DE ENTRADAS Y SALIDAS ---
client.on('guildMemberAdd', async member => {
    const autoRoleId = getConfig('AUTO_ROLE_ID');
    if (autoRoleId) await member.roles.add(autoRoleId).catch(() => null);

    const welcomeChannelId = getConfig('WELCOME_CHANNEL');
    if (welcomeChannelId) {
        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`👋 ¡Te damos la bienvenida a ${member.guild.name}!`)
                .setDescription(`Hola <@${member.id}>, gracias por unirte a nuestra comunidad. 🎉\n\n*Actualmente somos **${member.guild.memberCount}** miembros.*`)
                .setColor(0x00FF87).setThumbnail(member.user.displayAvatarURL()).setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    }
    await logAction("📥 Miembro Unido", `El usuario **${member.user.tag}** (\`${member.id}\`) entró al servidor.`, 0x00FF00);
});

client.on('guildMemberRemove', async member => {
    const welcomeChannelId = getConfig('WELCOME_CHANNEL');
    if (welcomeChannelId) {
        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🍂 ¡Hasta luego!`)
                .setDescription(`**${member.user.username}** ha abandonado el servidor.`)
                .setColor(0xFF4B4B).setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    }
    await logAction("📤 Miembro Salido", `El usuario **${member.user.tag}** (\`${member.id}\`) abandonó el servidor.`, 0xFF0000);
});

// --- 📈 EXPANSIÓN DE LOGS PRO ---
client.on("messageDelete", async message => {
    if (message.author?.bot || !message.guild) return;
    await logAction(
        "🗑️ Mensaje Eliminado",
        `**Autor:** <@${message.author.id}> (\`${message.author.tag}\`)\n**Canal:** <#${message.channelId}>\n**Contenido:** ${message.content || "*Sin contenido de texto*"}`,
        0xFF3E3E
    );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot || !oldMessage.guild || oldMessage.content === newMessage.content) return;
    await logAction(
        "📝 Mensaje Editado",
        `**Autor:** <@${oldMessage.author.id}>\n**Canal:** <#${oldMessage.channelId}>\n**Antes:** ${oldMessage.content}\n**Después:** ${newMessage.content}`,
        0x3498DB
    );
});

// --- 🛡️ MÓDULO AUTOMOD MEJORADO & EXP MANAGER ---
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    const leveledUp = addXP(message.author.id);
    if (leveledUp) {
        message.channel.send(`🎉 ¡Enhorabuena <@${message.author.id}>, has subido al **Nivel ${levels[message.author.id].level}**!`);
    }

    const member = message.member;
    if (!member || member.permissions.has(PermissionFlagsBits.ManageMessages)) return; 

    let deleteTriggered = false;
    let reason = "";
    const now = Date.now();

    const lastTime = lastMessages.get(message.author.id);
    if (lastTime && now - lastTime < 1200) {
        deleteTriggered = true;
        reason = "Anti-Spam: Envío de mensajes demasiado rápido";
    }
    lastMessages.set(message.author.id, now);

    const lastContent = contentCache.get(message.author.id);
    if (lastContent === message.content.toLowerCase() && message.content.length > 3) {
        deleteTriggered = true;
        reason = "Anti-Flood: Repetición de textos idénticos";
    }
    contentCache.set(message.author.id, message.content.toLowerCase());

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(message.content)) {
        deleteTriggered = true;
        reason = "Anti-Links: Enlaces externos no autorizados";
    }

    if (message.content.length >= 8) {
        const capsCount = message.content.replace(/[^A-Z]/g, "").length;
        if ((capsCount / message.content.length) > 0.75) {
            deleteTriggered = true;
            reason = "Anti-Caps: Uso excesivo de letras mayúsculas";
        }
    }

    if (deleteTriggered) {
        await message.delete().catch(() => null);
        const alert = await message.channel.send(`⚠️ <@${message.author.id}>, tu mensaje fue removido por **${reason}**.`);
        setTimeout(() => alert.delete().catch(() => null), 4000);
        await logAction("🛡️ AutoMod Alerta", `Acción tomada contra <@${message.author.id}> en <#${message.channelId}>.\n**Razón:** ${reason}`, 0xFF8800);
    }
});

// --- 🎯 INTERACCIONES ---
client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.guild) return;

        if (interaction.isChatInputCommand()) {
            const { commandName, options, member, channel } = interaction;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const isMod = member.permissions.has(PermissionFlagsBits.ModerateMembers) || member.permissions.has(PermissionFlagsBits.KickMembers);

            // 🌟 PROCESADOR DE NUEVOS COMANDOS INFORMATIVOS
            if (commandName === 'ping') {
                const latency = Date.now() - interaction.createdTimestamp;
                const apiLatency = Math.round(client.ws.ping);
                return await interaction.reply(`🏓 **Pong!**\n• Latencia del Bot: \`${latency}ms\`\n• API de Discord: \`${apiLatency}ms\``);
            }

            if (commandName === 'avatar') {
                const targetUser = options.getUser('usuario') || interaction.user;
                const avatarUrl = targetUser.displayAvatarURL({ size: 1024, dynamic: true });
                const embedAvatar = new EmbedBuilder()
                    .setTitle(`🖼️ Avatar de ${targetUser.username}`)
                    .setImage(avatarUrl)
                    .setColor(0x00FF87);
                return await interaction.reply({ embeds: [embedAvatar] });
            }

            if (commandName === 'coinflip') {
                const choices = ["Cara", "Cruz"];
                const pick = choices[Math.floor(Math.random() * choices.length)];
                return await interaction.reply(`🪙 Lanzas la moneda al aire y cae en... **${pick}**!`);
            }

            if (commandName === 'roll') {
                const die = Math.floor(Math.random() * 6) + 1;
                return await interaction.reply(`🎲 Lanzaste el dado y obtuviste un **${die}**.`);
            }

            if (commandName === 'serverinfo') {
                const guild = interaction.guild;
                const embedServer = new EmbedBuilder()
                    .setTitle(`📊 Datos del Servidor: ${guild.name}`)
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: "👑 Dueño", value: `<@${guild.ownerId}>`, inline: true },
                        { name: "👥 Miembros Totales", value: `\`${guild.memberCount}\``, inline: true },
                        { name: "📅 Creación", value: new Date(guild.createdTimestamp).toLocaleDateString('es-ES'), inline: true },
                        { name: "🛡️ Nivel de Verificación", value: `\`${guild.verificationLevel}\``, inline: true },
                        { name: "🎭 Roles Existentes", value: `\`${guild.roles.cache.size}\``, inline: true },
                        { name: "📁 Canales", value: `\`${guild.channels.cache.size}\``, inline: true }
                    )
                    .setColor(0x36393F).setTimestamp();
                return await interaction.reply({ embeds: [embedServer] });
            }

            if (commandName === 'userinfo') {
                const targetUser = options.getUser('miembro') || interaction.user;
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                
                const embedUser = new EmbedBuilder()
                    .setTitle(`👤 Información de Usuario`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: "Tag Global", value: `\`${targetUser.tag}\``, inline: true },
                        { name: "ID Cuenta", value: `\`${targetUser.id}\``, inline: true },
                        { name: "📅 Creación Cuenta", value: new Date(targetUser.createdTimestamp).toLocaleDateString('es-ES'), inline: true }
                    )
                    .setColor(0x00AEFF).setTimestamp();

                if (targetMember) {
                    embedUser.addFields(
                        { name: "📥 Ingreso al Server", value: new Date(targetMember.joinedTimestamp).toLocaleDateString('es-ES'), inline: true },
                        { name: "👑 Rol Principal", value: `${targetMember.roles.highest}`, inline: true }
                    );
                }
                return await interaction.reply({ embeds: [embedUser] });
            }

            // Procesador comandos /set
            if (commandName.startsWith('set')) {
                if (!isAdmin) return await interaction.reply({ content: "❌ Requieres el permiso de **Administrador**.", ephemeral: true });

                if (commandName === 'setlogs') {
                    const ch = options.getChannel('canal');
                    guildConfig['LOGS_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de logs configurado en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setwelcome') {
                    const ch = options.getChannel('canal');
                    guildConfig['WELCOME_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de bienvenidas configurado en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setsuggestions') {
                    const ch = options.getChannel('canal');
                    guildConfig['SUGGESTIONS_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de sugerencias configurado en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setautorole') {
                    const role = options.getRole('rol');
                    guildConfig['AUTO_ROLE_ID'] = role.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Rol automático de entrada configurado en ${role}`, ephemeral: true });
                }
            }

            // Comandos Fun Base
            if (commandName === 'joke') {
                const jokes = [
                    "¿Qué hace una abeja en el gimnasio? ¡Zumba!",
                    "¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
                    "¿Qué le dice un jaguard a otro jaguard? Jaguayu."
                ];
                const randJoke = jokes[Math.floor(Math.random() * jokes.length)];
                return await interaction.reply(`🃏 **Chiste:** ${randJoke}`);
            }

            if (commandName === '8ball') {
                const answers = ["Sí", "No", "Tal vez", "100% asegurado", "Pregunta más tarde"];
                const result = answers[Math.floor(Math.random() * answers.length)];
                const question = options.getString('pregunta');
                return await interaction.reply(`🎱 **Pregunta:** *${question}*\n🔮 **Respuesta:** ${result}`);
            }

            if (commandName === 'hug') {
                const targetUser = options.getUser('usuario');
                return await interaction.reply(`🤗 <@${interaction.user.id}> le ha dado un gran abrazo reconfortante a <@${targetUser.id}>.`);
            }

            if (commandName === 'dance') {
                const embedDance = new EmbedBuilder().setDescription(`💃 ¡<@${interaction.user.id}> está bailando! 🕺`).setColor(0xFF00BB);
                return await interaction.reply({ embeds: [embedDance] });
            }

            if (commandName === 'embed') {
                if (!isMod) return await interaction.reply({ content: "❌ No tienes permisos de moderador.", ephemeral: true });
                const title = options.getString('titulo');
                const desc = options.getString('descripcion');
                let colorInput = options.getString('color') || '#00AEFF';
                
                if(colorInput.toLowerCase() === 'rojo') colorInput = '#FF0000';
                if(colorInput.toLowerCase() === 'azul') colorInput = '#0000FF';
                if(colorInput.toLowerCase() === 'verde') colorInput = '#00FF00';

                try {
                    const embedCustom = new EmbedBuilder()
                        .setTitle(title)
                        .setDescription(desc)
                        .setColor(colorInput.startsWith('#') ? parseInt(colorInput.replace('#', ''), 16) : 0x00AEFF)
                        .setTimestamp();
                    return await interaction.reply({ embeds: [embedCustom] });
                } catch {
                    return await interaction.reply({ content: "❌ Formato de color inválido.", ephemeral: true });
                }
            }

            // Paneles estáticos
            if (commandName === 'appeal-panel') {
                const embed = new EmbedBuilder().setTitle('📩 APELACIONES').setDescription('Presiona el botón de abajo para apelar tu caso.').setColor(0x0099FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Apelar Punish').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'creator-panel') {
                const embed = new EmbedBuilder().setTitle('🎥 RANGO CREADORES').setDescription('Envía tus estadísticas aquí para solicitar tu rango.').setColor(0x9146FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Postularse Ahora').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'support-panel') {
                const embed = new EmbedBuilder().setTitle('❓ CENTRO DE SOPORTE').setDescription('Abre un ticket pulsando abajo.').setColor(0x00FF87);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Enviar Ticket').setStyle(ButtonStyle.Success));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'suggestion-panel') {
                const embed = new EmbedBuilder().setTitle('📊 BUZÓN DE SUGERENCIAS').setDescription('Ayúdanos a mejorar aportando tus ideas.').setColor(0xFFEA00);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_suggest').setLabel('💡 Añadir Sugerencia').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'reactionrole-panel') {
                if (!isAdmin) return await interaction.reply({ content: "❌ No posees privilegios.", ephemeral: true });
                const embed = new EmbedBuilder().setTitle('🎭 AUTOROLES INTERACTIVOS').setDescription('Presiona el botón de abajo para reclamar o remover el Rol Automático.').setColor(0x36393F);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rr_toggle_role').setLabel('🎭 Reclamar/Quitar Rol').setStyle(ButtonStyle.Secondary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }

            // Moderación Pro
            if (['kick', 'ban', 'unban', 'mute', 'timeout', 'warn', 'unwarn', 'clear', 'lock', 'unlock'].includes(commandName) && !isMod) {
                return await interaction.reply({ content: '❌ Permisos insuficientes de moderación.', ephemeral: true });
            }

            if (commandName === 'clear') {
                const amount = options.getInteger("amount");
                if (amount < 1 || amount > 100) return await interaction.reply({ content: "❌ Ingresa un valor entre 1 y 100.", ephemeral: true });
                const deleted = await channel.bulkDelete(amount, true);
                await interaction.reply({ content: `🧹 Eliminados **${deleted.size}** mensajes.`, ephemeral: true });
                return await logAction("🧹 Limpieza Ejecutada", `**Moderador:** <@${interaction.user.id}>\n**Canal:** <#${channel.id}>`, 0x95A5A6);
            }

            if (commandName === 'lock') {
                await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
                await interaction.reply({ content: "🔒 Canal cerrado bajo llave por el Staff." });
                return await logAction("🔒 Canal Bloqueado", `El canal <#${channel.id}> fue bloqueado por <@${interaction.user.id}>.`, 0xE74C3C);
            }

            if (commandName === 'unlock') {
                await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
                return await interaction.reply({ content: "🔓 El canal ha sido desbloqueado." });
            }

            if (commandName === 'unban') {
                const userId = options.getString('userid');
                try {
                    await interaction.guild.members.unban(userId);
                    await interaction.reply({ content: `✅ Usuario \`${userId}\` desbaneado.`, ephemeral: true });
                    return await logAction("🔓 Usuario Desbaneado", `**ID:** \`${userId}\`\n**Moderador:** <@${interaction.user.id}>`, 0x2ECC71);
                } catch {
                    return await interaction.reply({ content: "❌ Imposible remover baneo. Verifica la ID.", ephemeral: true });
                }
            }

            if (commandName === 'unwarn') {
                const target = options.getUser('target');
                if (!warnsDatabase[target.id] || warnsDatabase[target.id].length === 0) {
                    return await interaction.reply({ content: `✅ El usuario no tiene advertencias.`, ephemeral: true });
                }
                warnsDatabase[target.id].pop();
                safeSave(WARNS_FILE, warnsDatabase);
                await interaction.reply({ content: `✅ Faltas actualizadas para **${target.tag}**.`, ephemeral: true });
                return await logAction("🩹 Warn Removido", `**Miembro:** <@${target.id}>\n**Moderador:** <@${interaction.user.id}>`, 0x2ECC71);
            }

            if (commandName === 'timeout') {
                const target = options.getUser('target');
                const minutes = options.getInteger('minutos');
                const reason = options.getString('razon') || 'Ninguna';
                const memberTarget = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (memberTarget) {
                    await memberTarget.timeout(minutes * 60 * 1000, reason);
                    await interaction.reply({ content: `✅ Aislamiento estricto aplicado a **${target.tag}**.`, ephemeral: true });
                    return await logAction("🤫 Timeout Avanzado", `**Miembro:** <@${target.id}>\n**Duración:** ${minutes}m\n**Razón:** ${reason}`, 0x9B59B6);
                }
            }

            if (commandName === 'kick') {
                const target = options.getUser('target');
                const reason = options.getString('reason') || 'No especificada';
                await interaction.guild.members.kick(target.id, reason);
                await interaction.reply({ content: `✅ Expulsado.`, ephemeral: true });
                await logAction("🔨 Usuario Expulsado", `**Miembro:** <@${target.id}>\n**Razón:** ${reason}`, 0xFF9900);
            }

            if (commandName === 'ban') {
                const target = options.getUser('target');
                const reason = options.getString('reason') || 'No especificada';
                await interaction.guild.members.ban(target.id, { reason });
                await interaction.reply({ content: `✅ Baneado.`, ephemeral: true });
                await logAction("🚨 Usuario Baneado", `**Miembro:** <@${target.id}>\n**Razón:** ${reason}`, 0xFF0000);
            }

            if (commandName === 'mute') {
                const target = options.getUser('target');
                const minutes = options.getInteger('minutes');
                const reason = options.getString('reason') || 'No especificada';
                const memberTarget = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (memberTarget) {
                    await memberTarget.timeout(minutes * 60 * 1000, reason);
                    await interaction.reply({ content: `✅ Aislado por ${minutes} minutos.`, ephemeral: true });
                }
            }

            if (commandName === 'warn') {
                const target = options.getUser('target');
                const reason = options.getString('reason');
                if (!warnsDatabase[target.id]) warnsDatabase[target.id] = [];
                warnsDatabase[target.id].push({ reason, moderator: interaction.user.tag, timestamp: new Date().toISOString() });
                safeSave(WARNS_FILE, warnsDatabase);
                await interaction.reply({ content: `✅ Advertencia registrada.`, ephemeral: true });
            }

            if (commandName === 'roblox-user') {
                await interaction.deferReply();
                const username = options.getString('username');
                try {
                    const resUser = await axios.post('https://users.roblox.com/v1/usernames/users', { usernames: [username], excludeBannedUsers: false });
                    if (!resUser.data.data.length) return await interaction.editReply("❌ No se encontró el usuario.");
                    const { id, displayName, name } = resUser.data.data[0];
                    const resDetails = await axios.get(`https://users.roblox.com/v1/users/${id}`);
                    const { description, created } = resDetails.data;
                    const resThumb = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png&isCircular=false`);
                    const avatarUrl = resThumb.data.data[0]?.imageUrl || "";

                    const embedRoblox = new EmbedBuilder()
                        .setTitle(`🎮 Perfil Roblox: ${displayName}`)
                        .setURL(`https://www.roblox.com/users/${id}/profile`)
                        .addFields(
                            { name: "Username Real", value: `\`${name}\``, inline: true },
                            { name: "Roblox ID", value: `\`${id}\``, inline: true },
                            { name: "Fecha de Creación", value: new Date(created).toLocaleDateString('es-ES'), inline: true }
                        )
                        .setThumbnail(avatarUrl).setColor(0xE12323);
                    return await interaction.editReply({ embeds: [embedRoblox] });
                } catch { return await interaction.editReply("❌ Error con la API externa."); }
            }
        }

        // ==========================================
        // 2. HANDLER: BUTTONS
        // ==========================================
        if (interaction.isButton()) {
            const { customId, user } = interaction;

            if (customId === 'rr_toggle_role') {
                const roleId = getConfig('AUTO_ROLE_ID'); 
                if (!roleId) return await interaction.reply({ content: "❌ No se ha configurado el rol.", ephemeral: true });
                const member = await interaction.guild.members.fetch(user.id);
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    return await interaction.reply({ content: "🎭 Rol removido.", ephemeral: true });
                } else {
                    await member.roles.add(roleId);
                    return await interaction.reply({ content: "🎭 Rol asignado.", ephemeral: true });
                }
            }

            if (customId === 'btn_open_appeal') {
                const modal = new ModalBuilder().setCustomId('modal_appeal').setTitle('Formulario de Apelaciones');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('¿Username de Roblox?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('¿Causa del Ban?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('¿Pruebas/Justificación?').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_open_creator') {
                const modal = new ModalBuilder().setCustomId('modal_creator').setTitle('Creator Application');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Roblox Username?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Link del Canal').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('¿Por qué deseas el rango?').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_open_inquiry') {
                const modal = new ModalBuilder().setCustomId('modal_inquiry').setTitle('New Support Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Roblox Username?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Detalles del Error / Bug').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_open_suggest') {
                const modal = new ModalBuilder().setCustomId('modal_suggest').setTitle('Enviar Idea / Sugerencia');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s1').setLabel('Título corto').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s2').setLabel('Detalles de tu propuesta').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId.startsWith('staff_')) {
                const parts = customId.split('_');
                const action = parts[1];
                const targetId = parts.slice(2).join('_');

                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    return await interaction.reply({ content: '❌ Careces de permisos de Staff.', ephemeral: true });
                }

                if (action === 'approve' || action === 'deny') {
                    const decisionModal = new ModalBuilder().setCustomId(`modal_decision_${action}_${targetId}`).setTitle('Resolución Final');
                    decisionModal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('staff_reason').setLabel('Justificación').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ));
                    return await interaction.showModal(decisionModal);
                }

                if (action === 'ticket') {
                    await interaction.deferReply({ ephemeral: true });
                    const targetUser = await client.users.fetch(targetId).catch(() => null);
                    
                    const categoryId = CONFIG.PRIVATE_CATEGORY;
                    const privateChannel = await interaction.guild.channels.create({
                        name: `ticket-${targetUser ? targetUser.username : targetId}`,
                        type: ChannelType.GuildText,
                        parent: categoryId || null,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: targetId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    }).catch(() => null);

                    if (!privateChannel) return await interaction.editReply({ content: '❌ Error al crear el canal.' });
                    await privateChannel.send(`👋 Chat de soporte privado abierto.`);
                    return await interaction.editReply({ content: `✅ Canal creado: ${privateChannel}` });
                }
            }
        }

        // ==========================================
        // 3. HANDLER: MODAL SUBMISSIONS
        // ==========================================
        if (interaction.isModalSubmit()) {
            const { customId, fields, user } = interaction;

            if (customId === 'modal_suggest') {
                const titleIdea = fields.getTextInputValue('s1');
                const bodyIdea = fields.getTextInputValue('s2');
                const suggestChanId = getConfig('SUGGESTIONS_CHANNEL');
                const suggestChan = suggestChanId ? await interaction.guild.channels.fetch(suggestChanId).catch(() => null) : null;
                if (!suggestChan) return await interaction.reply({ content: "❌ Canal de sugerencias no configurado.", ephemeral: true });

                const embedSuggest = new EmbedBuilder().setTitle(`💡 Nueva Sugerencia: ${titleIdea}`).setDescription(bodyIdea).setColor(0x00D0FF).setTimestamp();
                const msgSuggest = await suggestChan.send({ embeds: [embedSuggest] });
                await msgSuggest.react('👍'); await msgSuggest.react('👎');
                return await interaction.reply({ content: "✅ Sugerencia enviada.", ephemeral: true });
            }

            if (['modal_appeal', 'modal_creator', 'modal_inquiry'].includes(customId)) {
                let targetChanId, embedTitle, arrayFields = [];

                if (customId === 'modal_appeal') {
                    targetChanId = CONFIG.APPEAL.CHANNEL; embedTitle = '🚨 APELACIÓN ENVIADA';
                    arrayFields = [{ name: 'Roblox User:', value: fields.getTextInputValue('q1') }, { name: 'Motivo:', value: fields.getTextInputValue('q2') }, { name: 'Justificación:', value: fields.getTextInputValue('q3') }];
                } else if (customId === 'modal_creator') {
                    targetChanId = CONFIG.CREATOR.CHANNEL; embedTitle = '🎥 APLICACIÓN CREADOR';
                    arrayFields = [{ name: 'Roblox User:', value: fields.getTextInputValue('q1') }, { name: 'Canal:', value: fields.getTextInputValue('q2') }, { name: 'Motivo:', value: fields.getTextInputValue('q3') }];
                } else if (customId === 'modal_inquiry') {
                    targetChanId = CONFIG.INQUIRY.CHANNEL; embedTitle = '❓ CASO SOPORTE TÉCNICO';
                    arrayFields = [{ name: 'Roblox User:', value: fields.getTextInputValue('q1') }, { name: 'Problema:', value: fields.getTextInputValue('q2') }];
                }

                const staffChannel = targetChanId ? await interaction.guild.channels.fetch(targetChanId).catch(() => null) : null;
                if (!staffChannel) return await interaction.reply({ content: "❌ Canal Staff de destino no encontrado.", ephemeral: true });

                const embedStaff = new EmbedBuilder().setTitle(embedTitle).setDescription(`Enviado por: <@${user.id}>`).addFields(arrayFields).setColor(0x2F3136).setTimestamp();
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`staff_approve_${user.id}`).setLabel('🟢 Aprobar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`staff_deny_${user.id}`).setLabel('🔴 Rechazar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`staff_ticket_${user.id}`).setLabel('📩 Abrir Chat').setStyle(ButtonStyle.Primary)
                );

                let staffRoleMention = "";
                if (customId === 'modal_appeal') staffRoleMention = `<@&${CONFIG.APPEAL.ROLE}> `;
                if (customId === 'modal_creator') staffRoleMention = `<@&${CONFIG.CREATOR.ROLE}> `;
                if (customId === 'modal_inquiry') staffRoleMention = `<@&${CONFIG.INQUIRY.ROLE}> `;

                const sended = await staffChannel.send({ content: staffRoleMention, embeds: [embedStaff], components: [buttons] });
                messageDatabase[user.id] = { messageId: sended.id, channelId: staffChannel.id };
                safeSave(MSG_FILE, messageDatabase);
                return await interaction.reply({ content: "✅ Respuestas procesadas.", ephemeral: true });
            }

            if (customId.startsWith('modal_decision_')) {
                const parts = customId.split('_');
                const action = parts[2];
                const targetId = parts.slice(3).join('_');
                const justification = fields.getTextInputValue('staff_reason');

                database[targetId] = { status: action === 'approve' ? 'approved' : 'rejected', reason: justification, moderator: user.tag };
                safeSave(DB_FILE, database);

                const stored = messageDatabase[targetId];
                if (stored) {
                    const chan = await interaction.guild.channels.fetch(stored.channelId).catch(() => null);
                    const originalMsg = await chan?.messages.fetch(stored.messageId).catch(() => null);
                    if (originalMsg && originalMsg.embeds.length) {
                        const updEmbed = EmbedBuilder.from(originalMsg.embeds[0]).setFooter({ text: `Cerrado por: ${user.tag} [${action.toUpperCase()}]` });
                        await originalMsg.edit({ embeds: [updEmbed], components: [] }).catch(() => null);
                    }
                }

                const userTarget = await client.users.fetch(targetId).catch(() => null);
                if (userTarget) {
                    const dmEmbed = new EmbedBuilder().setTitle("🎫 ACTUALIZACIÓN DE TU SOLICITUD").addFields({ name: "Resultado", value: action === "approve" ? "🟢 APROBADO" : "🔴 RECHAZADO" }, { name: "Razón", value: justification }).setColor(action === 'approve' ? 0x00FF00 : 0xFF0000);
                    await userTarget.send({ embeds: [dmEmbed] }).catch(() => null);
                }
                return await interaction.reply({ content: `✅ Veredicto guardado.`, ephemeral: true });
            }
        }
    } catch (err) { console.error("💥 Error General:", err); }
});

// --- 💬 COMANDO COMPATIBILIDAD (=result) ---
client.on('messageCreate', async message => {
    if (message.author.bot || message.content.toLowerCase() !== '=result') return;

    const result = database[message.author.id];
    if (!result) return void await message.channel.send("❌ No se registran veredictos pendientes.");

    const approved = result.status === "approved";
    const embed = new EmbedBuilder().setTitle("🎫 CONSULTA").addFields({ name: "Estado", value: approved ? "🟢 APROBADO" : "🔴 RECHAZADO" }, { name: "Detalles", value: result.reason }).setColor(approved ? 0x00FF00 : 0xFF0000);
    await message.channel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
