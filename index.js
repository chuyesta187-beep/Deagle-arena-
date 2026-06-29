const express = require("express");
const fs = require("fs");
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

// 🌐 EXPRESS WEB SERVER CONFIGURATION
app.get("/", (req, res) => {
    res.send("🤖 Bot de Alta Disponibilidad - Blindaje Nivel Kernel");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor web escuchando en el puerto ${PORT}`));

// ⚙️ GLOBAL TICKET SYSTEM CONFIGURATION
const CONFIG = {
    TOKEN: process.env.TOKEN,                  
    CLIENT_ID: process.env.CLIENT_ID || '1521212807754809507',          
    GUILD_ID: process.env.GUILD_ID || '1519740211301716120',           
    PRIVATE_CATEGORY: '1520097680972447744',   
    APPEAL: { CHANNEL: '1521208884197589164', ROLE: '1521208595557908611' },
    CREATOR: { CHANNEL: '1521208966556680202', ROLE: '1521208730543460505' },
    INQUIRY: { CHANNEL: '1521209048371040327', ROLE: '1521208655628996689' }
};

if (!CONFIG.TOKEN) {
    console.error("❌ ERROR FATAL: La variable de entorno 'TOKEN' es obligatoria. Apagando.");
    process.exit(1);
}

// 🤖 DISCORD CLIENT CONFIGURATION
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,             
        GatewayIntentBits.GuildMessages,      
        GatewayIntentBits.MessageContent,     
        GatewayIntentBits.DirectMessages      
    ],
    partials: [Partials.Channel, Partials.User, Partials.Message] 
});

// 💾 PERSISTENCIA SEGURA ATÓMICA (FIX 5: Anti-Corrupción por reinicios abruptos de Render)
const DB_FILE = "./results.json";
const MSG_FILE = "./messages.json";

function safeLoad(file) {
    if (!fs.existsSync(file)) return {};
    try { 
        const content = fs.readFileSync(file, "utf8").trim();
        if (!content) return {};
        return JSON.parse(content); 
    } catch (e) { 
        console.error(`❌ Error leyendo archivo ${file}:`, e); 
        return {}; 
    }
}

function safeSave(file, data) {
    const tmpFile = `${file}.tmp`;
    try { 
        // 1. Escribimos primero de forma síncrona en un archivo temporal
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8"); 
        // 2. Renombramos de forma atómica. Si el proceso muere, el original queda intacto y no en 0 bytes.
        fs.renameSync(tmpFile, file);
    } catch (e) { 
        console.error(`❌ Error crítico guardando archivo atómico ${file}:`, e); 
        // Limpieza del archivo temporal si falló el renombrado
        if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch {}
    }
}

let database = safeLoad(DB_FILE);
let messageDatabase = safeLoad(MSG_FILE);

// 🛠️ FUNCIÓN AUXILIAR: RESPUESTA INTELIGENTE ABSOLUTA (FIX 1)
async function smartReply(interaction, payload) {
    try {
        // Validación dual estricta nativa de discord.js v14 para evitar InteractionAlreadyReplied
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(payload);
        } else {
            return await interaction.reply(payload);
        }
    } catch (err) {
        console.error("❌ Error de desincronización controlando smartReply:", err);
    }
}

// --- EVENT: READY & REGISTRO DE COMANDOS ---
client.once('ready', async () => {
    console.log(`🟢 Bot conectado exitosamente como: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('panel-appeal').setDescription('Envía el panel de apelaciones de baneo'),
        new SlashCommandBuilder().setName('panel-creator').setDescription('Envía el panel de postulación a creador'),
        new SlashCommandBuilder().setName('panel-inquiry').setDescription('Envía el panel de dudas y soporte')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
        console.log("✅ Comandos de barra '/' registrados correctamente.");
    } catch (error) {
        console.error('❌ Error registrando comandos de barra:', error);
    }
});

// --- 🎯 EVENTO INTERACTIONCREATE UNIFICADO ---
client.on('interactionCreate', async interaction => {
    try {
        // 🔴 FIX 3: Verificación e inmunidad ante contextos externos / DMs de usuario globales
        if (!interaction.guild || !interaction.inGuild()) return;

        // ==========================================
        // 1. MANEJO DE SLASH COMMANDS (/panel-*)
        // ==========================================
        if (interaction.isChatInputCommand()) {
            await interaction.deferReply({ ephemeral: true });
            
            if (interaction.commandName === 'panel-appeal') {
                const embed = new EmbedBuilder().setTitle('📩 BAN APPEAL').setDescription('Si fuiste sancionado, presiona el botón inferior para apelar.').setColor(0x0099FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Apelar Sanción').setStyle(ButtonStyle.Primary));
                return await interaction.editReply({ embeds: [embed], components: [row] });
            }
            if (interaction.commandName === 'panel-creator') {
                const embed = new EmbedBuilder().setTitle('🎥 CREATOR APPLICATION').setDescription('¿Eres creador de contenido? ¡Postula aquí por tu rango!').setColor(0x9146FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Postular Ahora').setStyle(ButtonStyle.Primary));
                return await interaction.editReply({ embeds: [embed], components: [row] });
            }
            if (interaction.commandName === 'panel-inquiry') {
                const embed = new EmbedBuilder().setTitle('❓ DUDAS Y SOPORTE').setDescription('¿Tienes algún problema dentro del juego? Envía tu duda aquí.').setColor(0x00FF87);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Enviar Consulta').setStyle(ButtonStyle.Success));
                return await interaction.editReply({ embeds: [embed], components: [row] });
            }
        }

        // ==========================================
        // 2. MANEJO DE BOTONES (Formularios / Staff)
        // ==========================================
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_open_appeal') {
                const modal = new ModalBuilder().setCustomId('modal_appeal').setTitle('Formulario de Apelación');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('¿Nombre de usuario en Roblox?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('¿Por qué fuiste baneado?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('¿Por qué deberías ser desbaneado?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Pruebas (Links de fotos/videos)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_open_creator') {
                const modal = new ModalBuilder().setCustomId('modal_creator').setTitle('Postulación Creador');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('¿Nombre de usuario en Roblox?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('¿En qué plataforma subes videos?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Link de tu canal o perfil').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('¿Cuántos seguidores tienes?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel('¿Por qué quieres el rango?').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_open_inquiry') {
                const modal = new ModalBuilder().setCustomId('modal_inquiry').setTitle('Nueva Consulta');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('¿Nombre de usuario en Roblox?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('¿Cuál es tu problema o duda breve?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Explica los detalles aquí').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Pruebas / Capturas (Opcional)').setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // Acciones de Moderación (Botones del Staff)
            if (interaction.customId.startsWith('staff_')) {
                // 🔴 FIX 4: Reconstrucción e inmunidad de IDs que contengan caracteres "_" nativos
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const targetId = parts.slice(2).join('_');
                if (!action || !targetId) return;

                let hasRole = false;
                if (interaction.channelId === CONFIG.APPEAL.CHANNEL && interaction.member.roles.cache.has(CONFIG.APPEAL.ROLE)) hasRole = true;
                if (interaction.channelId === CONFIG.CREATOR.CHANNEL && interaction.member.roles.cache.has(CONFIG.CREATOR.ROLE)) hasRole = true;
                if (interaction.channelId === CONFIG.INQUIRY.CHANNEL && interaction.member.roles.cache.has(CONFIG.INQUIRY.ROLE)) hasRole = true;

                if (!hasRole) {
                    return await smartReply(interaction, { content: '❌ No cuentas con los permisos o rol de Staff requeridos para este canal.', ephemeral: true });
                }

                if (action === 'approve' || action === 'deny') {
                    const decisionModal = new ModalBuilder().setCustomId(`modal_decision_${action}_${targetId}`).setTitle(action === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud');
                    decisionModal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('staff_reason').setLabel('Mensaje / Justificación del Staff').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ));
                    return await interaction.showModal(decisionModal);
                }

                if (action === 'ticket') {
                    await interaction.deferReply({ ephemeral: true });
                    
                    if (!CONFIG.PRIVATE_CATEGORY) {
                        return await interaction.editReply({ content: '❌ Error: La categoría de tickets privados no está configurada.' });
                    }

                    // 🔴 FIX 2: Extracción asíncrona forzada vía REST para saltar fallas de caché frío de Shards
                    const me = await interaction.guild.members.fetchMe().catch(() => null);
                    if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        return await interaction.editReply({ content: '❌ Error de permisos: El bot carece del permiso `Manage Channels` verificado en tiempo de ejecución.' });
                    }

                    const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
                    
                    const privateChannel = await interaction.guild.channels.create({
                        name: `ticket-${targetUser ? targetUser.username : targetId}`,
                        type: ChannelType.GuildText,
                        parent: CONFIG.PRIVATE_CATEGORY,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: targetId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    }).catch(() => null);

                    if (!privateChannel) {
                        return await interaction.editReply({ content: '❌ Error: Fallo al instanciar el canal. Revisa los permisos de categoría.' });
                    }
                    
                    await privateChannel.send(`👋 Hola <@${targetId}>! El Staff <@${interaction.user.id}> abrió este ticket para evaluar tu caso.`);
                    return await interaction.editReply({ content: `✅ Canal de ticket creado exitosamente: ${privateChannel}` });
                }
            }
        }

        // ==========================================
        // 3. MANEJO DE SUBMISSION DE MODALS
        // ==========================================
        if (interaction.isModalSubmit()) {
            const userId = interaction.user.id;

            if (['modal_appeal', 'modal_creator', 'modal_inquiry'].includes(interaction.customId)) {
                let sendChannel, targetRole, title, fields = [], finalMsg;

                if (interaction.customId === 'modal_appeal') {
                    sendChannel = CONFIG.APPEAL.CHANNEL; targetRole = CONFIG.APPEAL.ROLE; title = '🚨 NUEVA APELACIÓN'; finalMsg = '✅ Formulario enviado correctamente.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Motivo:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Sustento:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Pruebas:', value: String(interaction.fields.getTextInputValue('q4') ?? 'N/A').slice(0, 1024) }
                    ];
                } else if (interaction.customId === 'modal_creator') {
                    sendChannel = CONFIG.CREATOR.CHANNEL; targetRole = CONFIG.CREATOR.ROLE; title = '🎥 NUEVA POSTULACIÓN CREADOR'; finalMsg = '✅ Postulación enviada correctamente.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Plataforma:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Link:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Seguidores:', value: String(interaction.fields.getTextInputValue('q4') ?? 'N/A').slice(0, 1024) },
                        { name: 'Razón:', value: String(interaction.fields.getTextInputValue('q5') ?? 'N/A').slice(0, 1024) }
                    ];
                } else if (interaction.customId === 'modal_inquiry') {
                    sendChannel = CONFIG.INQUIRY.CHANNEL; targetRole = CONFIG.INQUIRY.ROLE; title = '❓ NUEVA CONSULTA DE SOPORTE'; finalMsg = '✅ Consulta de soporte enviada.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Duda:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Detalles:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Adjuntos:', value: String(interaction.fields.getTextInputValue('q4') ?? 'No provisto').slice(0, 1024) }
                    ];
                }

                if (!sendChannel) return await smartReply(interaction, { content: "❌ Error: Canal de configuración no definido.", ephemeral: true });
                
                const channel = await interaction.guild.channels.fetch(sendChannel).catch(() => null);
                if (!channel) return await smartReply(interaction, { content: "❌ Error: El canal de destino no existe en el servidor.", ephemeral: true });

                // 🔴 FIX 6: Rebanado estricto máximo de campos admitidos por el constructor de Embeds de Discord
                const safeFields = fields.slice(0, 25);

                const embedStaff = new EmbedBuilder().setTitle(title).setDescription(`Enviado por: <@${userId}> (${userId})`).addFields(safeFields).setColor(0x2F3136).setTimestamp();
                const staffButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`staff_approve_${userId}`).setLabel('🟢 Aprobar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`staff_deny_${userId}`).setLabel('🔴 Rechazar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`staff_ticket_${userId}`).setLabel('📩 Abrir Ticket').setStyle(ButtonStyle.Primary)
                );

                const msg = await channel.send({ content: `<@&${targetRole}>`, embeds: [embedStaff], components: [staffButtons] }).catch(() => null);
                if (!msg) return await smartReply(interaction, { content: "❌ Error: El bot carece de permisos para escribir en el canal de Staff.", ephemeral: true });

                messageDatabase[userId] = { messageId: msg.id, channelId: channel.id };
                safeSave(MSG_FILE, messageDatabase);

                return await smartReply(interaction, { content: finalMsg, ephemeral: true });
            }

            // CASO B: Resoluciones del Staff
            if (interaction.customId.startsWith('modal_decision_')) {
                const parts = interaction.customId.split('_');
                const action = parts[2];
                const targetId = parts.slice(3).join('_');
                if (!action || !targetId) return;

                const staffMsg = String(interaction.fields.getTextInputValue('staff_reason') ?? 'Sin especificar.').slice(0, 1024);

                database[targetId] = {
                    status: action === "approve" ? "approved" : "rejected",
                    reason: staffMsg,
                    moderator: interaction.user.tag,
                    dmSent: false 
                };

                const data = messageDatabase?.[targetId];
                if (data) {
                    const channel = await interaction.guild.channels.fetch(data.channelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(data.messageId).catch(() => null);
                        
                        if (message && message.embeds && message.embeds.length > 0) {
                            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                                .setFooter({ text: `Cerrado por: ${interaction.user.tag} (${action.toUpperCase()})` });
                            await message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
                        }
                    }
                }

                // Notificación Directa al Usuario vía MD
                const user = await interaction.client.users.fetch(targetId).catch(() => null);
                if (user) {
                    const embedUserNotify = new EmbedBuilder()
                        .setTitle("🎫 ACTUALIZACIÓN DE TU SOLICITUD")
                        .setColor(action === "approve" ? 0x00FF00 : 0xFF0000)
                        .addFields(
                            { name: "Estado Final:", value: action === "approve" ? "🟢 APROBADO" : "🔴 RECHAZADO" },
                            { name: "Revisado Por:", value: interaction.user.tag },
                            { name: "Razón del Veredicto:", value: staffMsg }
                        )
                        .setTimestamp();

                    const dmSuccess = await user.send({ content: "👋 Tu solicitud ha sido evaluada:", embeds: [embedUserNotify] })
                        .then(() => true)
                        .catch(() => false);
                    
                    database[targetId].dmSent = dmSuccess;
                }

                safeSave(DB_FILE, database);

                return await smartReply(interaction, { content: `✅ El veredicto ha sido guardado exitosamente como **${action.toUpperCase()}**.`, ephemeral: true });
            }
        }
    } catch (globalError) {
        console.error("💥 Captura de error de contingencia general:", globalError);
    }
});

// --- EVENT: COMANDO DE TEXTO TRADICIONAL (=result) ---
client.on('messageCreate', async message => {
    try {
        if (message.author.bot) return;

        if (message.content.toLowerCase() === '=result') {
            const result = database[message.author.id];

            if (!result) {
                return void await message.reply("❌ No figura ninguna solicitud procesada bajo tu ID de Discord.");
            }

            const isApproved = result.status === "approved";
            const visualStatus = isApproved ? "🟢 APROBADO" : "🔴 RECHAZADO";

            const embed = new EmbedBuilder()
                .setTitle("🎫 TU RESULTADO DE EVALUACIÓN")
                .setColor(isApproved ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: "Estado:", value: visualStatus, inline: true },
                    { name: "Staff Evaluador:", value: result.moderator, inline: true },
                    { name: "Razón / Detalles:", value: result.reason }
                )
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    } catch (msgError) {
        console.error("❌ Error procesando comando de texto:", msgError);
    }
});

// 🔴 FIX 7: Captura asíncrona del flujo de login para evitar fallas silenciosas en la terminal de Render
client.login(CONFIG.TOKEN).catch(err => {
    console.error("❌ ERROR CRÍTICO AL INICIAR SESIÓN EN GATEWAY DE DISCORD:", err);
    process.exit(1);
});
