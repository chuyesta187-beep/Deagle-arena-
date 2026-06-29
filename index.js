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
app.get("/", (req, res) => res.send("🤖 Hybrid Multi-Purpose Bot Online"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// 🎫 IDs ORIGINALES Y ESTÁTICOS DE TU SISTEMA DE TICKETS (Intocables)
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

// 💾 CAPA DE PERSISTENCIA GENERAL Y DINÁMICA (Para Logs, Bienvenidas, Sugerencias y Roles)
const DB_FILE = "./results.json";
const MSG_FILE = "./messages.json";
const WARNS_FILE = "./warns.json";
const CONFIG_FILE = "./config.json"; 

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

const getConfig = (key, fallback = null) => {
    return guildConfig[key] || fallback;
};

// 🤖 CLIENTE DISCORD COMPLETO
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,             
        GatewayIntentBits.GuildMessages,      
        GatewayIntentBits.MessageContent,     
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages      
    ],
    partials: [Partials.Channel, Partials.User, Partials.Message, Partials.Reaction] 
});

// Helper de Respuesta Inteligente
async function smartReply(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
        return await interaction.reply(payload);
    } catch (err) { console.error("❌ Desfase en smartReply:", err); }
}

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

// --- 🚀 REGISTRO GLOBAL DE SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`🟢 Bot conectado: ${client.user.tag}`);

    const commands = [
        // Paneles Públicos
        new SlashCommandBuilder().setName('appeal-panel').setDescription('Muestra el panel de apelación de ban'),
        new SlashCommandBuilder().setName('creator-panel').setDescription('Muestra el panel de creadores'),
        new SlashCommandBuilder().setName('support-panel').setDescription('Muestra el panel de soporte técnico'),
        new SlashCommandBuilder().setName('suggestion-panel').setDescription('Muestra el panel/formulario para enviar sugerencias'),
        new SlashCommandBuilder().setName('reactionrole-panel').setDescription('Despliega panel de Auto-Roles por botones'),
        
        // 🛠️ COMANDOS DE CONFIGURACIÓN INTERACTIVA (Módulos Nuevos Solamente)
        new SlashCommandBuilder().setName('setlogs').setDescription('Configura el canal de logs de acciones')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
        new SlashCommandBuilder().setName('setwelcome').setDescription('Configura el canal de mensajes de bienvenidas')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
        new SlashCommandBuilder().setName('setautorole').setDescription('Configura el rol automático otorgado al entrar')
            .addRoleOption(o => o.setName('rol').setDescription('Selecciona el rol').setRequired(true)),
        new SlashCommandBuilder().setName('setsuggestions').setDescription('Configura el canal del buzón de sugerencias')
            .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),

        // Módulos de Moderación
        new SlashCommandBuilder().setName('kick').setDescription('Expulsa a un usuario')
            .addUserOption(o => o.setName('target').setDescription('Usuario a expulsar').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón del kick')),
        new SlashCommandBuilder().setName('ban').setDescription('Banea a un usuario del servidor')
            .addUserOption(o => o.setName('target').setDescription('Usuario a banear').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón del ban')),
        new SlashCommandBuilder().setName('mute').setDescription('Aplica aislamiento temporal (Timeout)')
            .addUserOption(o => o.setName('target').setDescription('Usuario a mutear').setRequired(true))
            .addIntegerOption(o => o.setName('minutes').setDescription('Minutos de duración').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón')),
        new SlashCommandBuilder().setName('warn').setDescription('Aplica una advertencia a un miembro')
            .addUserOption(o => o.setName('target').setDescription('Usuario a advertir').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Razón').setRequired(true)),

        // Roblox
        new SlashCommandBuilder().setName('roblox-user').setDescription('Obtiene información pública del perfil de Roblox de un usuario')
            .addStringOption(o => o.setName('username').setDescription('Nombre exacto del usuario de Roblox').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("✅ Comandos registrados (Tickets Intocados + Módulos Dinámicos activos).");
    } catch (error) { console.error('❌ Error registrando comandos:', error); }
});

// --- 👋 EVENTOS DINÁMICOS: BIENVENIDAS Y DESPEDIDAS ---
client.on('guildMemberAdd', async member => {
    const autoRoleId = getConfig('AUTO_ROLE_ID');
    if (autoRoleId) await member.roles.add(autoRoleId).catch(() => null);

    const welcomeChannelId = getConfig('WELCOME_CHANNEL');
    if (welcomeChannelId) {
        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`👋 ¡Te damos la bienvenida a ${member.guild.name}!`)
                .setDescription(`Hola <@${member.id}>, gracias por unirte a nuestra comunidad. No olvides revisar las reglas y disfrutar tu estadía. 🎉\n\n*Actualmente somos **${member.guild.memberCount}** miembros.*`)
                .setColor(0x00FF87).setThumbnail(member.user.displayAvatarURL()).setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    }
    await logAction("📥 Miembro Unido", `El usuario <@${member.id}> (\`${member.id}\`) entró al servidor.`, 0x00FF00);
});

client.on('guildMemberRemove', async member => {
    const welcomeChannelId = getConfig('WELCOME_CHANNEL');
    if (welcomeChannelId) {
        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🍂 ¡Hasta luego!`)
                .setDescription(`**${member.user.username}** ha abandonado el servidor. ¡Esperamos verte pronto de vuelta!`)
                .setColor(0xFF4B4B).setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    }
    await logAction("📤 Miembro Salido", `El usuario **${member.user.tag}** (\`${member.id}\`) abandonó el servidor.`, 0xFF0000);
});

// --- 🤖 MÓDULO AUTOMOD ---
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    const member = message.member;
    if (!member) return;

    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return; 

    let deleteTriggered = false;
    let reason = "";

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(message.content)) {
        deleteTriggered = true;
        reason = "Envío de enlaces externos no permitidos";
    }

    if (message.mentions.users.size > 5) {
        deleteTriggered = true;
        reason = `Menciones masivas superiores al límite establecido (5)`;
    }

    if (deleteTriggered) {
        await message.delete().catch(() => null);
        const warnEmbed = new EmbedBuilder()
            .setDescription(`⚠️ <@${message.author.id}>, tu mensaje fue eliminado por el sistema AutoMod: **${reason}**.`)
            .setColor(0xFFCC00);
        
        const alert = await message.channel.send({ embeds: [warnEmbed] });
        setTimeout(() => alert.delete().catch(() => null), 6000);
        await logAction("🛡️ AutoMod Activado", `Mensaje de <@${message.author.id}> eliminado en <#${message.channelId}>.\n**Causa:** ${reason}`, 0xFF4500);
    }
});

// --- 🎯 INTERACCIONES: CONFIGURACIÓN, COMANDOS, BOTONES Y MODALES ---
client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.guild) return;

        // ==========================================
        // 1. HANDLER: SLASH COMMANDS
        // ==========================================
        if (interaction.isChatInputCommand()) {
            const { commandName, options, member } = interaction;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const isMod = member.permissions.has(PermissionFlagsBits.ModerateMembers) || member.permissions.has(PermissionFlagsBits.KickMembers);

            // ⚙️ PROCESADOR AUTOMÁTICO DE COMANDOS /SET 
            if (commandName.startsWith('set')) {
                if (!isAdmin) return await interaction.reply({ content: "❌ Necesitas permisos de **Administrador** para configurar estos módulos.", ephemeral: true });

                if (commandName === 'setlogs') {
                    const ch = options.getChannel('canal');
                    guildConfig['LOGS_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de logs establecido en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setwelcome') {
                    const ch = options.getChannel('canal');
                    guildConfig['WELCOME_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de bienvenidas establecido en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setsuggestions') {
                    const ch = options.getChannel('canal');
                    guildConfig['SUGGESTIONS_CHANNEL'] = ch.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Canal de sugerencias establecido en ${ch}`, ephemeral: true });
                }
                if (commandName === 'setautorole') {
                    const role = options.getRole('rol');
                    guildConfig['AUTO_ROLE_ID'] = role.id; safeSave(CONFIG_FILE, guildConfig);
                    return await interaction.reply({ content: `✅ Rol automático de entrada establecido en ${role}`, ephemeral: true });
                }
            }

            // PANELES PÚBLICOS
            if (commandName === 'appeal-panel') {
                const embed = new EmbedBuilder().setTitle('📩 APELACIONES DE SANCIONES').setDescription('Si fuiste sancionado incorrectamente, presiona el botón de abajo para apelar tu caso.').setColor(0x0099FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Apelar Punish').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'creator-panel') {
                const embed = new EmbedBuilder().setTitle('🎥 RANGO CREADORES').setDescription('¿Eres creador de contenido de la comunidad? Envía tus estadísticas aquí para solicitar tu rango.').setColor(0x9146FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Postularse Ahora').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'support-panel') {
                const embed = new EmbedBuilder().setTitle('❓ CENTRO DE SOPORTE').setDescription('¿Tienes inconvenientes en el juego o reportes de bugs? Abre un ticket pulsando abajo.').setColor(0x00FF87);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Enviar Ticket').setStyle(ButtonStyle.Success));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'suggestion-panel') {
                const embed = new EmbedBuilder().setTitle('📊 BUZÓN DE SUGERENCIAS').setDescription('Ayúdanos a mejorar el servidor e interactuar con los desarrolladores aportando tus ideas.').setColor(0xFFEA00);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_suggest').setLabel('💡 Añadir Sugerencia').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (commandName === 'reactionrole-panel') {
                if (!isAdmin) return await interaction.reply({ content: "❌ No tienes permisos de administrador.", ephemeral: true });
                const embed = new EmbedBuilder().setTitle('🎭 AUTOROLES INTERACTIVOS').setDescription('Presiona el botón de abajo para reclamar o remover el Rol Automático configurado en el servidor.').setColor(0x36393F);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rr_toggle_role').setLabel('🎭 Reclamar/Quitar Rol').setStyle(ButtonStyle.Secondary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }

            // MODERACIÓN
            if (['kick', 'ban', 'mute', 'warn'].includes(commandName) && !isMod) {
                return await interaction.reply({ content: '❌ No cuentas con permisos de moderación.', ephemeral: true });
            }

            if (commandName === 'kick') {
                const target = options.getUser('target');
                const reason = options.getString('reason') || 'No especificada';
                await interaction.guild.members.kick(target.id, reason);
                await interaction.reply({ content: `✅ **${target.tag}** fue expulsado correctamente.`, ephemeral: true });
                await logAction("🔨 Usuario Expulsado", `**Miembro:** <@${target.id}>\n**Moderador:** <@${interaction.user.id}>\n**Razón:** ${reason}`, 0xFF9900);
            }

            if (commandName === 'ban') {
                const target = options.getUser('target');
                const reason = options.getString('reason') || 'No especificada';
                await interaction.guild.members.ban(target.id, { reason });
                await interaction.reply({ content: `✅ **${target.tag}** fue baneado permanentemente.`, ephemeral: true });
                await logAction("🚨 Usuario Baneado", `**Miembro:** <@${target.id}>\n**Moderador:** <@${interaction.user.id}>\n**Razón:** ${reason}`, 0xFF0000);
            }

            if (commandName === 'mute') {
                const target = options.getUser('target');
                const minutes = options.getInteger('minutes');
                const reason = options.getString('reason') || 'No especificada';
                const memberTarget = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (memberTarget) {
                    await memberTarget.timeout(minutes * 60 * 1000, reason);
                    await interaction.reply({ content: `✅ **${target.tag}** fue aislado por ${minutes} minutos.`, ephemeral: true });
                    await logAction("🤫 Member Mute", `**Miembro:** <@${target.id}>\n**Duración:** ${minutes}m\n**Moderador:** <@${interaction.user.id}>`, 0x3498DB);
                }
            }

            if (commandName === 'warn') {
                const target = options.getUser('target');
                const reason = options.getString('reason');
                if (!warnsDatabase[target.id]) warnsDatabase[target.id] = [];
                warnsDatabase[target.id].push({ reason, moderator: interaction.user.tag, timestamp: new Date().toISOString() });
                safeSave(WARNS_FILE, warnsDatabase);
                await interaction.reply({ content: `✅ Advertencia registrada para **${target.tag}**.`, ephemeral: true });
                await logAction("⚠️ Advertencia", `**Miembro:** <@${target.id}>\n**Moderador:** <@${interaction.user.id}>\n**Razón:** ${reason}`, 0xFFFF00);
            }

            if (commandName === 'roblox-user') {
                await interaction.deferReply();
                const username = options.getString('username');
                try {
                    const resUser = await axios.post('https://users.roblox.com/v1/usernames/users', { usernames: [username], excludeBannedUsers: false });
                    if (!resUser.data.data.length) return await interaction.editReply("❌ No se encontró ningún usuario con ese nombre en Roblox.");
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
                } catch { return await interaction.editReply("❌ Error con la API externa de Roblox."); }
            }
        }

        // ==========================================
        // 2. HANDLER: BUTTONS
        // ==========================================
        if (interaction.isButton()) {
            const { customId, user } = interaction;

            if (customId === 'rr_toggle_role') {
                const roleId = getConfig('AUTO_ROLE_ID'); 
                if (!roleId) return await interaction.reply({ content: "❌ El administrador aún no ha configurado el rol con `/setautorole`.", ephemeral: true });
                const member = await interaction.guild.members.fetch(user.id);
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    return await interaction.reply({ content: "🎭 Rol removido correctamente.", ephemeral: true });
                } else {
                    await member.roles.add(roleId);
                    return await interaction.reply({ content: "🎭 Rol asignado correctamente.", ephemeral: true });
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

            // Gestión de Decisiones Staff en Tickets
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
                    
                    // 🏛️ RESTAURADO: Usa el ID estático CONFIG.PRIVATE_CATEGORY
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

                    if (!privateChannel) return await interaction.editReply({ content: '❌ Error al crear el canal del ticket privado.' });
                    await privateChannel.send(`👋 ¡Atención! <@${targetId}>, se ha abierto un chat de soporte privado.`);
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
                
                if (!suggestChan) return await interaction.reply({ content: "❌ Canal de sugerencias no configurado por el Staff.", ephemeral: true });

                const embedSuggest = new EmbedBuilder()
                    .setTitle(`💡 Nueva Sugerencia: ${titleIdea}`)
                    .setDescription(bodyIdea)
                    .setFooter({ text: `Propuesta por: ${user.tag}`, iconURL: user.displayAvatarURL() })
                    .setColor(0x00D0FF).setTimestamp();

                const msgSuggest = await suggestChan.send({ embeds: [embedSuggest] });
                await msgSuggest.react('👍'); await msgSuggest.react('👎');
                return await interaction.reply({ content: "✅ Tu sugerencia ha sido enviada con éxito.", ephemeral: true });
            }

            if (['modal_appeal', 'modal_creator', 'modal_inquiry'].includes(customId)) {
                let targetChanId, embedTitle, arrayFields = [];

                // 🏛️ RESTAURADO: Mapeo exacto a las propiedades estáticas de CONFIG
                if (customId === 'modal_appeal') {
                    targetChanId = CONFIG.APPEAL.CHANNEL; embedTitle = '🚨 APELACIÓN ENVIADA';
                    arrayFields = [
                        { name: 'Roblox User:', value: fields.getTextInputValue('q1') },
                        { name: 'Motivo:', value: fields.getTextInputValue('q2') },
                        { name: 'Justificación:', value: fields.getTextInputValue('q3') }
                    ];
                } else if (customId === 'modal_creator') {
                    targetChanId = CONFIG.CREATOR.CHANNEL; embedTitle = '🎥 APLICACIÓN CREADOR';
                    arrayFields = [
                        { name: 'Roblox User:', value: fields.getTextInputValue('q1') },
                        { name: 'Canal:', value: fields.getTextInputValue('q2') },
                        { name: 'Motivo:', value: fields.getTextInputValue('q3') }
                    ];
                } else if (customId === 'modal_inquiry') {
                    targetChanId = CONFIG.INQUIRY.CHANNEL; embedTitle = '❓ CASO SOPORTE TÉCNICO';
                    arrayFields = [
                        { name: 'Roblox User:', value: fields.getTextInputValue('q1') },
                        { name: 'Problema:', value: fields.getTextInputValue('q2') }
                    ];
                }

                const staffChannel = targetChanId ? await interaction.guild.channels.fetch(targetChanId).catch(() => null) : null;
                if (!staffChannel) return await interaction.reply({ content: "❌ Canal Staff de destino no encontrado en la base fija.", ephemeral: true });

                const embedStaff = new EmbedBuilder().setTitle(embedTitle).setDescription(`Enviado por: <@${user.id}>`).addFields(arrayFields).setColor(0x2F3136).setTimestamp();
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`staff_approve_${user.id}`).setLabel('🟢 Aprobar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`staff_deny_${user.id}`).setLabel('🔴 Rechazar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`staff_ticket_${user.id}`).setLabel('📩 Abrir Chat').setStyle(ButtonStyle.Primary)
                );

                // Obtener el rol del staff estático correspondiente para mencionarlo si es necesario
                let staffRoleMention = "";
                if (customId === 'modal_appeal') staffRoleMention = `<@&${CONFIG.APPEAL.ROLE}> `;
                if (customId === 'modal_creator') staffRoleMention = `<@&${CONFIG.CREATOR.ROLE}> `;
                if (customId === 'modal_inquiry') staffRoleMention = `<@&${CONFIG.INQUIRY.ROLE}> `;

                const sended = await staffChannel.send({ content: staffRoleMention, embeds: [embedStaff], components: [buttons] });
                messageDatabase[user.id] = { messageId: sended.id, channelId: staffChannel.id };
                safeSave(MSG_FILE, messageDatabase);

                return await interaction.reply({ content: "✅ Tus respuestas han sido procesadas por el Staff.", ephemeral: true });
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
                    const dmEmbed = new EmbedBuilder()
                        .setTitle("🎫 ACTUALIZACIÓN DE TU SOLICITUD")
                        .addFields(
                            { name: "Resultado", value: action === "approve" ? "🟢 APROBADO" : "🔴 RECHAZADO" },
                            { name: "Razón", value: justification }
                        ).setColor(action === 'approve' ? 0x00FF00 : 0xFF0000).setTimestamp();
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
    const embed = new EmbedBuilder()
        .setTitle("🎫 CONSULTA DE RESULTADOS")
        .addFields(
            { name: "Estado", value: approved ? "🟢 APROBADO" : "🔴 RECHAZADO", inline: true },
            { name: "Detalles", value: result.reason }
        ).setColor(approved ? 0x00FF00 : 0xFF0000);

    await message.channel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
