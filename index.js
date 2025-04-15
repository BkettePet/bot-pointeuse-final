const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const prefix = "!";
let data = {};
const DATA_FILE = 'data.json';

if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

client.once('ready', () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const now = new Date();

    if (!data[userId]) {
        data[userId] = { sessions: [], total: 0 };
    }

    if (interaction.customId === 'start') {
        data[userId].currentStart = now;
        await interaction.reply({ content: `🟢 ${interaction.user.username} a pris son service à **${now.toLocaleTimeString()}**`, ephemeral: true });
    }

    if (interaction.customId === 'end') {
        const start = data[userId].currentStart;
        if (!start) {
            return await interaction.reply({ content: "❌ Tu dois d'abord cliquer sur **Prise de service**.", ephemeral: true });
        }

        const end = now;
        const startDate = new Date(start);
        const duration = (end - startDate) / (1000 * 60 * 60); // heures
        data[userId].sessions.push({ start: startDate, end: end });
        data[userId].total += duration;
        delete data[userId].currentStart;

        await interaction.reply({ content: `🔴 ${interaction.user.username} a terminé son service à **${end.toLocaleTimeString()}**\n🕒 Durée : **${duration.toFixed(2)}h**`, ephemeral: true });
    }

    saveData();
});

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const userId = message.author.id;
    if (!data[userId]) {
        data[userId] = { sessions: [], total: 0 };
    }

    if (command === "help") {
        const helpEmbed = new EmbedBuilder()
            .setTitle("📘 Commandes disponibles")
            .setColor(0x00AE86)
            .setDescription([
                "`!service` → Prendre ou finir un service (avec boutons)",
                "`!total` → Voir les heures totales par utilisateur",
                "`!info` → Voir qui est en service actuellement",
                "`!clear` → Réinitialise les heures de tout le monde (admin)",
                "`!help` → Affiche ce message"
            ].join("\n"));
        message.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (command === "service") {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start')
                .setLabel('🟢 Prise de service')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('end')
                .setLabel('🔴 Fin de service')
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle("🕒 Pointeuse")
            .setDescription("Clique sur un des boutons ci-dessous selon ton action.")
            .setColor(0x5865F2);

        message.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (command === "total") {
        let totalList = Object.entries(data)
            .filter(([_, d]) => d.total > 0)
            .sort((a, b) => b[1].total - a[1].total);

        const lines = await Promise.all(totalList.map(async ([id, userData]) => {
            const user = await client.users.fetch(id).catch(() => null);
            if (!user) return null;
            return `- **${user.username}** : ${userData.total.toFixed(2)}h`;
        }));

        const embed = new EmbedBuilder()
            .setTitle("📊 Heures totales par utilisateur")
            .setColor(0x2ECC71)
            .setDescription(lines.filter(Boolean).join("\n") || "Aucune donnée disponible.");

        message.reply({ embeds: [embed], ephemeral: true });
    }

    if (command === "clear") {
        for (let id in data) {
            data[id] = { sessions: [], total: 0 };
        }
        saveData();
        message.reply({ content: "🧹 Tous les compteurs ont été remis à zéro.", ephemeral: true });
    }

    if (command === "info") {
        let onService = Object.entries(data)
            .filter(([_, userData]) => userData.currentStart)
            .map(async ([userId, userData]) => {
                const user = await client.users.fetch(userId).catch(() => null);
                if (!user) return null;
                const heure = new Date(userData.currentStart).toLocaleTimeString();
                return `- ${user.username} → En service depuis **${heure}**`;
            });

        onService = (await Promise.all(onService)).filter(Boolean);

        const embed = new EmbedBuilder()
            .setTitle("🟢 Utilisateurs actuellement en service")
            .setColor(0x3498DB)
            .setDescription(onService.length > 0 ? onService.join('\n') : "Aucun utilisateur en service.");

        message.reply({ embeds: [embed], ephemeral: true });
    }

    saveData();
});

client.login('MTM2MTQwMzQwNjc4MjAzODA2Nw.GvhJp3.F_tqfVkyepuT_eDGi3gHQu3GeL4RMw_PYP2j3E'); // Remplace par ton token
