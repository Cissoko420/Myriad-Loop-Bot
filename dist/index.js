"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const fs = require("fs");
const client = new discord_js_1.Client({
    intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
});
const LOOP_ALLOWED_EXTENSIONS = ['.mp3', '.wav'];
const LOOP_SUBMIT_CHANNEL = '1189035597478756433';
const BATTLE_CHANNEL = '1189035629720383658';
const RESULT_CHANNEL = '1189035708183224480';
const VOTE_CHANNEL = '1192254953188769873';
const judgeRole = '1192250088492372069';
const loopMakerRole = '1192250383423262791';
const playerRole = '1192250147153903626';
let loopSubmissions = [];
try {
    const data = fs.readFileSync('loopSubmissions.json', 'utf-8');
    loopSubmissions = JSON.parse(data);
}
catch (err) {
    console.error('Error reading loopSubmissions.json:', err);
}
client.on('ready', () => {
    if (!client.user) {
        console.log('No user');
        return;
    }
    console.log(`${client.user.username} is online`);
});
client.on('messageCreate', async (message) => {
    const member = message.member;
    if (message.attachments.size > 0 &&
        message.member?.roles.cache.has(loopMakerRole) &&
        LOOP_SUBMIT_CHANNEL == message.channelId) {
        message.attachments.forEach((attachment) => {
            const fileName = attachment.name.toLowerCase();
            const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
            if (LOOP_ALLOWED_EXTENSIONS.includes(fileExtension)) {
                const submissionId = loopSubmissions.length + 1;
                const submissionData = { id: submissionId, messageId: message.id };
                loopSubmissions.push(submissionData);
                fs.writeFileSync('loopSubmissions.json', JSON.stringify(loopSubmissions, null, 2), 'utf-8');
                console.log(`Loop submission saved! Submission ID: ${submissionId}`);
                return;
            }
        });
    }
});
client.login(process.env.BOT_TOKEN);
