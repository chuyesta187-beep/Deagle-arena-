const express = require("express");
const fs = require("fs"); // 💾 Módulo nativo para leer/escribir archivos
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
    res.send("🤖 Discord Bot is active with Persistent Storage");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Web server successfully listening on port ${PORT}`);
});

// 🤖 DISCORD CLIENT CONFIGURATION
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,             
        GatewayIntentBits.GuildMessages,      
        GatewayIntentBits.MessageContent,     
        GatewayIntentBits.DirectMessages      
    ],
    partials: [Partials.Channel] 
});

// ⚙️ GLOBAL TICKET SYSTEM CONFIGURATION (Asegúrate de que estos IDs existan)
const CONFIG = {
    TOKEN: process.env.TOKEN,                  
    CLIENT_ID: '1521212807754809507',          
    GUILD_ID: '1519740211301716120',           
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

// 💾 FUNCIONES DE PERSISTENCIA LOCAL (JSON ANTI-REINICIOS)
function loadJSON(filename) {
    if (fs.existsSync(filename)) {
        try {
            const data = JSON.parse(fs.readFileSync(filename, "utf-8"));
            return new Map(data);
        } catch (e) {
            console.error(`Error leyendo ${filename}, creando nuevo Map.`, e);
        }
    }
    return new Map();
}

function saveJSON(filename, mapData) {
    fs.writeFileSync(filename, JSON.stringify([...mapData], null, 2), "utf-8");
}

// Carga inicial desde archivos locales
const databaseDeResultados = loadJSON("./database.json");
const messageMap = loadJSON("./messages.json");

// --- EVENT: BOT READY & REGISTER SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`🤖 Bot successfully logged in as ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder().setName('panel-appeal').setDescription('Sends the panel with the Ban Appeal button'),
        new SlashCommandBuilder().setName('panel-creator').setDescription('Sends the panel with the Content Creator button'),
        new SlashCommandBuilder().setName('panel-inquiry').setDescription('Sends the panel with the Inquiry/Question button')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
        console.log('✅ Slash commands (/panel) successfully registered in the server.');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
});

// --- EVENT: HANDLING SLASH COMMANDS (/panel) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'panel-appeal') {
        await interaction.deferReply(); 

        const embed = new EmbedBuilder()
            .setTitle('📩 BAN APPEAL')
            .setDescription('If you were sanctioned and believe it was a mistake, press the button below to start your appeal process.')
            .setColor(0x0099FF);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Appeal Sanction').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'panel-creator') {
        await interaction.deferReply(); 

        const embed = new EmbedBuilder()
            .setTitle('🎥 CONTENT CREATOR APPLICATION')
            .setDescription('Are you a content creator wanting to get a rank in our community? Apply right here!')
            .setColor(0x9146FF);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Apply Now').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'panel-inquiry') {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle('❓ INQUIRY OR QUESTION')
            .setDescription('Do you have doubts, concerns, or an issue inside the game? Send your inquiry to the support team.')
            .setColor(0x00FF87);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Send Inquiry').setStyle(ButtonStyle.Success)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
});

// --- EVENT: TRIGGERING FORM MODALS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'btn_open_appeal') {
        const modal = new ModalBuilder().setCustomId('modal_appeal').setTitle('Ban Appeal Form');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('What is your Roblox username?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Why were you banned?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Why do you think you should be unbanned?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Provide a photo or video link as proof').setStyle(TextInputStyle.Short).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_open_creator') {
        const modal = new ModalBuilder().setCustomId('modal_creator').setTitle('Content Creator Application');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('What is your Roblox username?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('On which platform do you create content?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Send the link to your channel or profile').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('How many followers/subscribers do you have?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel('Why do you want to be a Content Creator?').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_open_inquiry') {
        const modal = new ModalBuilder().setCustomId('modal_inquiry').setTitle('New Inquiry');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('What is your Roblox username?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('What is your inquiry or problem?').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Explain more details').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Photo/Video links or proof (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
        );
        await interaction.showModal(modal);
    }
});

// --- EVENT: MODAL SUBMISSION & STAFF CHANNEL NOTIFICATION ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    let sendChannel, targetRole, title, fields = [], finalMsg;
    const userId = interaction.user.id;

    // Control estricto de Strings para evitar el error "channel not defined" 🛠️
    if (interaction.customId === 'modal_appeal') {
        sendChannel = CONFIG.APPEAL.CHANNEL;
        targetRole = CONFIG.APPEAL.ROLE;
        title = '🚨 NEW BAN APPEAL';
        finalMsg = '✅ Thanks for submitting your appeal. A staff member will review it shortly.';
        fields = [
            { name: '1. What is your Roblox username?', value: interaction.fields.getTextInputValue('q1') },
            { name: '2. Why were you banned?', value: interaction.fields.getTextInputValue('q2') },
            { name: '3. Why do you think you should be unbanned?', value: interaction.fields.getTextInputValue('q3') },
            { name: '4. Provide a photo or video link as proof', value: interaction.fields.getTextInputValue('q4') }
        ];
    } else if (interaction.customId === 'modal_creator') {
        sendChannel = CONFIG.CREATOR.CHANNEL;
        targetRole = CONFIG.CREATOR.ROLE;
        title = '🎥 NEW CREATOR APPLICATION';
        finalMsg = '✅ Thanks for submitting your application. A staff member will review it shortly.';
        fields = [
            { name: '1. What is your Roblox username?', value: interaction.fields.getTextInputValue('q1') },
            { name: '2. What is your Discord user?', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '3. On which platform do you create content?', value: interaction.fields.getTextInputValue('q2') },
            { name: '4. Send the link to your channel or profile', value: interaction.fields.getTextInputValue('q3') },
            { name: '5. How many followers or subscribers do you have?', value: interaction.fields.getTextInputValue('q4') },
            { name: '6. Why do you want to be a Content Creator?', value: interaction.fields.getTextInputValue('q5') }
        ];
    } else if (interaction.customId === 'modal_inquiry') {
        sendChannel = CONFIG.INQUIRY.CHANNEL;
        targetRole = CONFIG.INQUIRY.ROLE;
        title = '❓ NEW INQUIRY / QUESTION';
        finalMsg = '✅ Thanks for submitting your inquiry. A staff member will review it shortly.';
        fields = [
            { name: '1. What is your Roblox username?', value: interaction.fields.getTextInputValue('q1') },
            { name: '2. What is your inquiry or problem?', value: interaction.fields.getTextInputValue('q2') },
            { name: '3. Explain more details', value: interaction.fields.getTextInputValue('q3') },
            { name: '4. Links / Proofs', value: interaction.fields.getTextInputValue('q4') || 'Not provided' }
        ];
    }

    if (!sendChannel) {
        return interaction.reply({
            content: "❌ Config error: channel not defined. Revisa los IDs o los customId en los Modals.",
            ephemeral: true
        });
    }

    const channel = await interaction.guild.channels.fetch(sendChannel).catch(() => null);

    if (!channel) {
        return interaction.reply({
            content: "❌ Target channel not found",
            ephemeral: true
        });
    }

    const embedStaff = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`Submitted by user: <@${userId}> (${userId})`)
        .addFields(fields)
        .setColor(0x2F3136)
        .setTimestamp();

    const staffButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`staff_approve_${userId}`).setLabel('🟢 Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`staff_deny_${userId}`).setLabel('🔴 Reject').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`staff_ticket_${userId}`).setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary)
    );

    const msg = await channel.send({
        content: `<@&${targetRole}>`,
        embeds: [embedStaff],
        components: [staffButtons]
    });

    // Guardado de datos persistente en archivo local 🚀
    messageMap.set(userId, {
        messageId: msg.id,
        channelId: channel.id
    });
    saveJSON("./messages.json", messageMap);

    await interaction.reply({ content: finalMsg, ephemeral: true });
});

// --- EVENT: STAFF ACTION INTERACTIVE BUTTONS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('staff_')) return;

    const parts = interaction.customId.split('_');
    const action = parts[1];    
    const targetId = parts[2];  

    let hasRole = false;
    if (interaction.channelId === CONFIG.APPEAL.CHANNEL && interaction.member.roles.cache.has(CONFIG.APPEAL.ROLE)) hasRole = true;
    if (interaction.channelId === CONFIG.CREATOR.CHANNEL && interaction.member.roles.cache.has(CONFIG.CREATOR.ROLE)) hasRole = true;
    if (interaction.channelId === CONFIG.INQUIRY.CHANNEL && interaction.member.roles.cache.has(CONFIG.INQUIRY.ROLE)) hasRole = true;

    if (!hasRole) {
        return interaction.reply({ content: '❌ You do not have the required role or permissions to use these buttons.', ephemeral: true });
    }

    const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);

    if (action === 'approve' || action === 'deny') {
        const decisionModal = new ModalBuilder()
            .setCustomId(`modal_decision_${action}_${targetId}`)
            .setTitle(action === 'approve' ? 'Approve Application' : 'Reject Application');
        
        decisionModal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('staff_reason').setLabel('Staff Message / Rationale').setStyle(TextInputStyle.Paragraph).setRequired(true)
            )
        );
        return await interaction.showModal(decisionModal);
    }

    if (action === 'ticket') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const guild = interaction.guild;
            const privateChannel = await guild.channels.create({
                name: `ticket-${targetUser ? targetUser.username : targetId}`,
                type: ChannelType.GuildText,
                parent: CONFIG.PRIVATE_CATEGORY,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, 
                    { id: targetId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, 
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } 
                ]
            });

            await privateChannel.send(`👋 Hello <@${targetId}>! Staff member <@${interaction.user.id}> has opened this private ticket to discuss your submission.`);
            await interaction.editReply({ content: `Private ticket channel created successfully: ${privateChannel}` });
        } catch (error) {
            console.error('Error creating private channel ticket:', error);
            await interaction.editReply({ 
                content: '❌ A technical error occurred while creating the ticket.' 
            });
        }
    }
});

// --- EVENT: CLOSING SUBMISSION AND PROCESSING VERDICT REASON ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('modal_decision_')) return;

    const parts = interaction.customId.split('_');
    const action = parts[2];       
    const targetId = parts[3];     
    const staffMsg = interaction.fields.getTextInputValue('staff_reason');

    // Guardar veredicto permanentemente en base de datos local JSON 💾
    databaseDeResultados.set(targetId, {
        status: action === 'approve' ? '🟢 APPROVED' : '🔴 REJECTED',
        reason: staffMsg,
        moderator: interaction.user.tag
    });
    saveJSON("./database.json", databaseDeResultados);

    // Búsqueda robusta inter-canales usando tu lógica mejorada 🌟
    const data = messageMap.get(targetId);

    if (data) {
        const channel = await interaction.guild.channels.fetch(data.channelId).catch(() => null);

        if (channel) {
            const message = await channel.messages.fetch(data.messageId).catch(() => null);

            if (message && message.embeds[0]) {
                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                    .setFooter({ text: `Action closed: ${action.toUpperCase()} by ${interaction.user.tag}` });

                await message.edit({
                    embeds: [updatedEmbed],
                    components: [] // Remueve los botones de forma definitiva para evitar dobles clics
                }).catch(err => console.error("Error editing original embed message:", err));
            }
        }
    }

    const user = await interaction.client.users.fetch(targetId).catch(() => null);
    if (user) {
        await user.send('Your request has been reviewed. Type `=result` to view the outcome.').catch(() => {
            console.log(`⚠️ Could not send DM to user ${targetId}. The user likely has Direct Messages disabled.`);
        });
    }

    await interaction.reply({ content: `✅ Application successfully registered as **${action.toUpperCase()}**.`, ephemeral: true });
});

// --- TRADITIONAL CHAT COMMAND TEXT LOOKUP: =result ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '=result') {
        const lookupResult = databaseDeResultados.get(message.author.id);

        if (!lookupResult) {
            return message.reply('❌ You do not have any recently processed applications, or data cleared following a bot reboot cycle.');
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('🎫 APPLICATION EVALUATION RESULT')
            .setColor(lookupResult.status.includes('APPROVED') ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Status:', value: lookupResult.status, inline: true },
                { name: 'Reviewed By:', value: lookupResult.moderator, inline: true },
                { name: 'Staff Note / Rationale:', value: lookupResult.reason }
            )
            .setTimestamp();

        await message.reply({ embeds: [resultEmbed] });
    }
});

// Authenticate and establish gateway socket connections to API
client.login(CONFIG.TOKEN);
