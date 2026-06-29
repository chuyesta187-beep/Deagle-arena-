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

// Create the Discord client instance with Intents and Partials configuration
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,             
        GatewayIntentBits.GuildMessages,      
        GatewayIntentBits.MessageContent,     
        GatewayIntentBits.DirectMessages      
    ],
    partials: [Partials.Channel] // Enabled Channel partial to safely parse DMs
});

// ⚙️ GLOBAL TICKET SYSTEM CONFIGURATION (Updated with your custom IDs)
const CONFIG = {
    TOKEN: 'PON_AQUI_TU_TOKEN',              // Paste your Discord Bot Token here
    CLIENT_ID: '1521212807754809507',          // Your Bot Client ID
    GUILD_ID: '1519740211301716120',           // Your Guild/Server ID
    PRIVATE_CATEGORY: '1520097680972447744',   // 📂 PRIVATE TICKETS Category
    APPEAL: {
        CHANNEL: '1521208884197589164',        // 📩 BAN APPEAL Channel
        ROLE: '1521208595557908611'            // Authorized Review Role
    },
    CREATOR: {
        CHANNEL: '1521208966556680202',        // 🎥 CONTENT CREATOR Channel
        ROLE: '1521208730543460505'            // Authorized Review Role
    },
    INQUIRY: {
        CHANNEL: '1521209048371040327',        // ❓ INQUIRY OR QUESTION Channel
        ROLE: '1521208655628996689'            // Authorized Review Role
    }
};

// 📂 IN-MEMORY STORAGE (Temporary Database)
// Saves the status of the request (Approved/Denied), staff reason, and moderator using the user ID as the key.
const databaseDeResultados = new Map(); 

// --- EVENT: BOT READY & REGISTER SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`🤖 Bot successfully logged in as ${client.user.tag}`);
    
    // Define Slash Commands (/panel) using the Discord Builder
    const commands = [
        new SlashCommandBuilder().setName('panel-appeal').setDescription('Sends the panel with the Ban Appeal button'),
        new SlashCommandBuilder().setName('panel-creator').setDescription('Sends the panel with the Content Creator button'),
        new SlashCommandBuilder().setName('panel-inquiry').setDescription('Sends the panel with the Inquiry/Question button')
    ].map(command => command.toJSON());

    // Initialize the Discord REST service to register commands in the guild
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

    // Execution of the Ban Appeal panel command
    if (interaction.commandName === 'panel-appeal') {
        const embed = new EmbedBuilder()
            .setTitle('📩 BAN APPEAL')
            .setDescription('If you were sanctioned and believe it was a mistake, press the button below to start your appeal process.')
            .setColor(0x0099FF);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_appeal').setLabel('Appeal Sanction').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Execution of the Content Creator panel command
    if (interaction.commandName === 'panel-creator') {
        const embed = new EmbedBuilder()
            .setTitle('🎥 CONTENT CREATOR APPLICATION')
            .setDescription('Are you a content creator wanting to get a rank in our community? Apply right here!')
            .setColor(0x9146FF);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_creator').setLabel('Apply Now').setStyle(ButtonStyle.Purple)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Execution of the General Inquiries panel command
    if (interaction.commandName === 'panel-inquiry') {
        const embed = new EmbedBuilder()
            .setTitle('❓ INQUIRY OR QUESTION')
            .setDescription('Do you have doubts, concerns, or an issue inside the game? Send your inquiry to the support team.')
            .setColor(0x00FF87);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_inquiry').setLabel('Send Inquiry').setStyle(ButtonStyle.Success)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    }
});

// --- EVENT: TRIGGERING FORM MODALS ---
// Activates when a regular user clicks any of the panel buttons.
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Display Appeal Modal
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

    // Display Content Creator Modal
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

    // Display Inquiries / Questions Modal
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

    const channel = await interaction.guild.channels.fetch(sendChannel);
    if (!channel) return interaction.reply({ content: 'Critical Error: Target review channel not found in the guild.', ephemeral: true });

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

    await channel.send({ content: `<@&${targetRole}>`, embeds: [embedStaff], components: [staffButtons] });
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
            await interaction.editReply({ content: '❌ A technical error occurred while trying to build the private ticket text channel.' });
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

    databaseDeResultados.set(targetId, {
        status: action === 'approve' ? '🟢 APPROVED' : '🔴 REJECTED',
        reason: staffMsg,
        moderator: interaction.user.tag
    });

    const originalMessage = interaction.message;
    if (originalMessage) {
        const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
            .setFooter({ text: `Action closed: ${action.toUpperCase()} by ${interaction.user.tag}` });
        await originalMessage.edit({ embeds: [updatedEmbed], components: [] });
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
            return message.reply('❌ You do not have any recently processed applications or data cleared following the latest bot reboot cycle.');
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
