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
    res.send("🤖 Bot Online - High Availability");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));

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
    console.error("❌ FATAL ERROR: 'TOKEN' environment variable is required. Shutting down.");
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

// 💾 ATOMIC PERSISTENCE LAYER (Anti-corruption system)
const DB_FILE = "./results.json";
const MSG_FILE = "./messages.json";

function safeLoad(file) {
    if (!fs.existsSync(file)) return {};
    try { 
        const content = fs.readFileSync(file, "utf8").trim();
        if (!content) return {};
        return JSON.parse(content); 
    } catch (e) { 
        console.error(`❌ Error reading file ${file}:`, e); 
        return {}; 
    }
}

function safeSave(file, data) {
    const tmpFile = `${file}.tmp`;
    try { 
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8"); 
        fs.renameSync(tmpFile, file);
    } catch (e) { 
        console.error(`❌ Critical error saving atomic file ${file}:`, e); 
        if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch {}
    }
}

let database = safeLoad(DB_FILE);
let messageDatabase = safeLoad(MSG_FILE);

// 🛠️ HELPER: SMART REPLY SYSTEM
async function smartReply(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(payload);
        } else {
            return await interaction.reply(payload);
        }
    } catch (err) {
        console.error("❌ Desynchronization error handling smartReply:", err);
    }
}

// --- EVENT: READY & SLASH COMMAND REGISTRATION ---
client.once('ready', async () => {
    console.log(`🟢 Bot successfully connected as: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName('appeal-panel').setDescription('Send the ban appeal panel'),
        new SlashCommandBuilder().setName('creator-panel').setDescription('Send the creator application panel'),
        new SlashCommandBuilder().setName('support-panel').setDescription('Send the support panel')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
        console.log("✅ Application slash commands registered successfully.");
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
});

// --- 🎯 UNIFIED INTERACTIONCREATE EVENT ---
client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.guild || !interaction.inGuild()) return;

        // ==========================================
        // 1. SLASH COMMANDS HANDLER (PUBLIC PANELS)
        // ==========================================
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'appeal-panel') {
                const embed = new EmbedBuilder().setTitle('📩 BAN APPEAL').setDescription('If you were punished, press the button below to appeal.').setColor(0x0099FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Appeal Punishment').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (interaction.commandName === 'creator-panel') {
                const embed = new EmbedBuilder().setTitle('🎥 CREATOR APPLICATION').setDescription('Are you a content creator? Apply here for your role!').setColor(0x9146FF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Apply Now').setStyle(ButtonStyle.Primary));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
            if (interaction.commandName === 'support-panel') {
                const embed = new EmbedBuilder().setTitle('❓ SUPPORT & QUESTIONS').setDescription('Do you have any issues in the game? Send your question here.').setColor(0x00FF87);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Send Inquiry').setStyle(ButtonStyle.Success));
                return await interaction.reply({ embeds: [embed], components: [row] });
            }
        }

        // ==========================================
        // 2. BUTTONS HANDLER (Forms / Staff Actions)
        // ==========================================
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_open_appeal') {
                const modal = new ModalBuilder().setCustomId('modal_appeal').setTitle('Ban Appeal Form');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Roblox Username?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Why were you banned?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Why should you be unbanned?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Evidence (Photo/Video Links)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_open_creator') {
                const modal = new ModalBuilder().setCustomId('modal_creator').setTitle('Creator Application');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Roblox Username?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Platform (YouTube/TikTok/etc)?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Channel or Profile Link?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Follower/Subscriber Count?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel('Why do you want the rank?').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_open_inquiry') {
                const modal = new ModalBuilder().setCustomId('modal_inquiry').setTitle('New Support Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Roblox Username?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Brief Summary of the issue?').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Explain the details here').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Evidence / Screenshots (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // Staff Actions Parsing
            if (interaction.customId.startsWith('staff_')) {
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const targetId = parts.slice(2).join('_');
                if (!action || !targetId) return;

                let hasRole = false;
                if (interaction.channelId === CONFIG.APPEAL.CHANNEL && interaction.member.roles.cache.has(CONFIG.APPEAL.ROLE)) hasRole = true;
                if (interaction.channelId === CONFIG.CREATOR.CHANNEL && interaction.member.roles.cache.has(CONFIG.CREATOR.ROLE)) hasRole = true;
                if (interaction.channelId === CONFIG.INQUIRY.CHANNEL && interaction.member.roles.cache.has(CONFIG.INQUIRY.ROLE)) hasRole = true;

                if (!hasRole) {
                    return await smartReply(interaction, { content: '❌ You do not have the required staff role or permissions.' });
                }

                if (action === 'approve' || action === 'deny') {
                    const decisionModal = new ModalBuilder().setCustomId(`modal_decision_${action}_${targetId}`).setTitle(action === 'approve' ? 'Approve Application' : 'Reject Application');
                    decisionModal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('staff_reason').setLabel('Staff Message / Justification').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ));
                    return await interaction.showModal(decisionModal);
                }

                if (action === 'ticket') {
                    await interaction.deferReply();
                    
                    if (!CONFIG.PRIVATE_CATEGORY) {
                        return await interaction.editReply({ content: '❌ Error: Private ticket category is not configured.' });
                    }

                    const me = await interaction.guild.members.fetchMe().catch(() => null);
                    if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        return await interaction.editReply({ content: '❌ Permission Error: The bot lacks `Manage Channels` permission.' });
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
                        return await interaction.editReply({ content: '❌ Error: Failed to instantiate channel.' });
                    }
                    
                    await privateChannel.send(`👋 Hello <@${targetId}>! Staff member <@${interaction.user.id}> opened this private ticket to review your case.`);
                    return await interaction.editReply({ content: `✅ Ticket channel successfully created: ${privateChannel}` });
                }
            }
        }

        // ==========================================
        // 3. MODALS SUBMISSION HANDLER
        // ==========================================
        if (interaction.isModalSubmit()) {
            const userId = interaction.user.id;

            if (['modal_appeal', 'modal_creator', 'modal_inquiry'].includes(interaction.customId)) {
                let sendChannel, targetRole, title, fields = [], finalMsg;

                if (interaction.customId === 'modal_appeal') {
                    sendChannel = CONFIG.APPEAL.CHANNEL; targetRole = CONFIG.APPEAL.ROLE; title = '🚨 NEW BAN APPEAL'; finalMsg = '✅ Form submitted successfully.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Reason:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Defense:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Evidence:', value: String(interaction.fields.getTextInputValue('q4') ?? 'N/A').slice(0, 1024) }
                    ];
                } else if (interaction.customId === 'modal_creator') {
                    sendChannel = CONFIG.CREATOR.CHANNEL; targetRole = CONFIG.CREATOR.ROLE; title = '🎥 NEW CREATOR APPLICATION'; finalMsg = '✅ Application submitted successfully.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Platform:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Link:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Followers:', value: String(interaction.fields.getTextInputValue('q4') ?? 'N/A').slice(0, 1024) },
                        { name: 'Statement:', value: String(interaction.fields.getTextInputValue('q5') ?? 'N/A').slice(0, 1024) }
                    ];
                } else if (interaction.customId === 'modal_inquiry') {
                    sendChannel = CONFIG.INQUIRY.CHANNEL; targetRole = CONFIG.INQUIRY.ROLE; title = '❓ NEW SUPPORT INQUIRY'; finalMsg = '✅ Support inquiry submitted successfully.';
                    fields = [
                        { name: 'User:', value: String(interaction.fields.getTextInputValue('q1') ?? 'N/A').slice(0, 1024) },
                        { name: 'Issue:', value: String(interaction.fields.getTextInputValue('q2') ?? 'N/A').slice(0, 1024) },
                        { name: 'Details:', value: String(interaction.fields.getTextInputValue('q3') ?? 'N/A').slice(0, 1024) },
                        { name: 'Attachments:', value: String(interaction.fields.getTextInputValue('q4') ?? 'Not provided').slice(0, 1024) }
                    ];
                }

                if (!sendChannel) return await smartReply(interaction, { content: "❌ Error: Destination channel configuration not found." });
                
                const channel = await interaction.guild.channels.fetch(sendChannel).catch(() => null);
                if (!channel) return await smartReply(interaction, { content: "❌ Error: Target channel does not exist in this server." });

                const safeFields = fields.slice(0, 25);

                const embedStaff = new EmbedBuilder().setTitle(title).setDescription(`Submitted by: <@${userId}> (${userId})`).addFields(safeFields).setColor(0x2F3136).setTimestamp();
                const staffButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`staff_approve_${userId}`).setLabel('🟢 Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`staff_deny_${userId}`).setLabel('🔴 Reject').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`staff_ticket_${userId}`).setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary)
                );

                const msg = await channel.send({ content: `<@&${targetRole}>`, embeds: [embedStaff], components: [staffButtons] }).catch(() => null);
                if (!msg) return await smartReply(interaction, { content: "❌ Error: Bot lacks required permissions to type into Staff channel." });

                messageDatabase[userId] = { messageId: msg.id, channelId: channel.id };
                safeSave(MSG_FILE, messageDatabase);

                return await smartReply(interaction, { content: finalMsg });
            }

            // Case B: Staff Resolution Form
            if (interaction.customId.startsWith('modal_decision_')) {
                const parts = interaction.customId.split('_');
                const action = parts[2];
                const targetId = parts.slice(3).join('_');
                if (!action || !targetId) return;

                const staffMsg = String(interaction.fields.getTextInputValue('staff_reason') ?? 'No reason specified.').slice(0, 1024);

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
                                .setFooter({ text: `Closed by: ${interaction.user.tag} (${action.toUpperCase()})` });
                            await message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
                        }
                    }
                }

                // DM User Notification System
                const user = await interaction.client.users.fetch(targetId).catch(() => null);
                if (user) {
                    const embedUserNotify = new EmbedBuilder()
                        .setTitle("🎫 YOUR APPLICATION UPDATE")
                        .setColor(action === "approve" ? 0x00FF00 : 0xFF0000)
                        .addFields(
                            { name: "Final Status", value: action === "approve" ? "🟢 APPROVED" : "🔴 REJECTED" },
                            { name: "Reviewed By", value: interaction.user.tag },
                            { name: "Reason", value: staffMsg }
                        )
                        .setTimestamp();

                    const dmSuccess = await user.send({ content: "👋 Your application has been reviewed:", embeds: [embedUserNotify] })
                        .then(() => true)
                        .catch(() => false);
                    
                    database[targetId].dmSent = dmSuccess;
                }

                safeSave(DB_FILE, database);

                return await smartReply(interaction, { content: `✅ Verdict has been logged successfully as **${action.toUpperCase()}**.` });
            }
        }
    } catch (globalError) {
        console.error("💥 General contingency error capture:", globalError);
    }
});

// --- EVENT: TRADITIONAL COMPATIBILITY CHAT COMMAND (=result) ---
// Configured with .channel.send() to avoid inline "Reply" notifications
client.on('messageCreate', async message => {
    try {
        if (message.author.bot) return;

        if (message.content.toLowerCase() === '=result') {
            const result = database[message.author.id];

            if (!result) {
                return void await message.channel.send("❌ No application data found associated with your Discord User ID.");
            }

            const isApproved = result.status === "approved";

            const embed = new EmbedBuilder()
                .setTitle("🎫 YOUR APPLICATION RESULT")
                .setColor(isApproved ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: "Status", value: isApproved ? "🟢 APPROVED" : "🔴 REJECTED", inline: true },
                    { name: "Staff Reviewer", value: result.moderator, inline: true },
                    { name: "Reason / Details", value: result.reason }
                )
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        }
    } catch (msgError) {
        console.error("❌ Error running traditional chat command parsing:", msgError);
    }
});

// Gateway Connection Capture Management
client.login(CONFIG.TOKEN).catch(err => {
    console.error("❌ FATAL ERROR LOADING DISCORD GATEWAY CLIENT:", err);
    process.exit(1);
});
