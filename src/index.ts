import 'dotenv/config'
import {
  Client,
  TextChannel,
  Interaction,
  Message,
  User,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js'
import {
  initializeCurrentBattles,
  saveCurrentBattles,
  currentBattles,
  clearCurrentBattlesVar,
  currentBattlesRemove,
} from './components/currentBattles'

import {
  initializeJudgesVote,
  saveJudgesVote,
  judgesVote,
} from './components/judgesVote'
import {
  initializeLoopSubmissions,
  updateLoopSubmissions,
  loopSubmissionRemove,
  clearLoopSubmissionsVar,
  loopSubmissions,
} from './components/loopSubmissions'

import {
  initializeUserRank,
  updateUserRanks,
  getUserRank,
  updateUserRankVar,
  getBasePoints,
  updateRanks,
  getUserPoints,
  clearUserRanks,
  userRanks,
  Rank,
} from './components/userRanks'

import {
  initializeTotalBattles,
  saveTotalBattles,
  clearTotalBattlesVar,
  totalBattles,
  incrementTotalBattles,
} from './components/totalBattles'

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
})

const LOOP_ALLOWED_EXTENSIONS = ['.mp3', '.wav']
const LOOP_SUBMIT_CHANNEL = '1189035597478756433'
const BATTLE_CHANNEL = '1189035629720383658'
const RESULT_CHANNEL = '1189035708183224480'
const VOTE_CHANNEL = '1192254953188769873'
const SERVER_ID = '769932241953488896'

const judgeRole = '1192250088492372069'
const loopMakerRole = '1192250383423262791'
const playerRole = '1192250147153903626'

const JUDGES_THRESHOLD = 2

const BATTLE_TIMEOUT = 30 * 60 * 1000
const timers: NodeJS.Timeout[] = []

let battleQueueMessages: { userId: string; messageId: string }[] = []

let pointsToGiveGlob = 0
let pointsToTakeGlob = 0

client.on('ready', () => {
  if (!client.user) {
    console.log('No user')
    return
  }

  const submit = new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit your loop')
    .addAttachmentOption((option) =>
      option.setName('loop').setDescription('Loop file').setRequired(true)
    )

  const vote = new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Vote for Submision')
    .addStringOption((option) =>
      option
        .setName('battle_number')
        .setDescription('Battle Number')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('player').setDescription('Player A or B').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('vote')
        .setDescription('Vote for submitted loop')
        .setRequired(true)
    )

  const battle = new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Queue for Battle')

  client.application?.commands.create(submit, SERVER_ID)
  client.application?.commands.create(vote, SERVER_ID)
  client.application?.commands.create(battle, SERVER_ID)

  console.log(`${client.user.username} is online`)
})

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) {
    return
  }
  const member = message.member

  if (
    message.attachments.size > 0 &&
    message.member?.roles.cache.has(loopMakerRole) &&
    LOOP_SUBMIT_CHANNEL == message.channelId
  ) {
    await initializeLoopSubmissions()

    message.attachments.forEach((attachment) => {
      const fileName = attachment.name.toLowerCase()
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'))

      if (LOOP_ALLOWED_EXTENSIONS.includes(fileExtension)) {
        const submissionId = loopSubmissions.length + 1
        const submissionData = { id: submissionId, messageId: message.id }

        loopSubmissions.push(submissionData)

        loopSubmissions.forEach((submission, index) => {
          submission.id = index + 1
        })

        message.react('✅')

        updateLoopSubmissions()

        clearLoopSubmissionsVar()

        return
      }
    })
  }
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  if (
    interaction.commandName === 'battle' &&
    interaction.guild?.roles.cache.has(playerRole) &&
    BATTLE_CHANNEL == interaction.channelId
  ) {
    await initializeLoopSubmissions()
    await initializeCurrentBattles()
    await initializeUserRank()

    if (
      battleQueueMessages.some(
        (queuedUser) => queuedUser.userId === interaction.user.id
      )
    ) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('You are already queued for battle. Please wait!')

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    if (
      currentBattles.some(
        (battle) =>
          battle.user1.id === interaction.user.id ||
          battle.user2.id === interaction.user.id
      )
    ) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('You are already in a battle. Please finish it first!')

      interaction.reply({ embeds: [battleQueueEmbed] })

      clearCurrentBattlesVar()
      clearLoopSubmissionsVar()

      return
    }

    if (loopSubmissions.length < 1) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription(
          'There are not enough loops available. Please wait for more loops and try again later!'
        )

      interaction.reply({ embeds: [battleQueueEmbed] })
      clearCurrentBattlesVar()
      clearLoopSubmissionsVar()

      return
    }

    const currentUserRank = getUserRank(interaction.user.id)

    if (!currentUserRank) {
      userRanks.push({
        id: interaction.user.id,
        rank: Rank.Unranked,
        points: 0,
      })
      updateUserRanks()
    }

    const battleQueueEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setDescription('You are queuing for Battle, please wait! ⚔️')

    const queueMessage = await interaction.reply({ embeds: [battleQueueEmbed] })

    battleQueueMessages.push({
      userId: interaction.user.id,
      messageId: queueMessage.id,
    })

    if (battleQueueMessages.length >= 2) {
      startBattle()
    }
  }

  const attachment = interaction.options.getAttachment('loop')
  const player = interaction.guild?.members.cache.get(interaction.user.id)
  const getPlayerRole = interaction.guild?.roles.cache.find(
    (role) => role.id === playerRole
  )

  if (
    getPlayerRole &&
    interaction.commandName === 'submit' &&
    player?.roles.cache.has(getPlayerRole.id) &&
    BATTLE_CHANNEL == interaction.channelId
  ) {
    await initializeCurrentBattles()
    const userBattle = currentBattles.find(
      (battle) =>
        battle.user1.id === interaction.user.id ||
        battle.user2.id === interaction.user.id
    )
    if (!userBattle) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('You are not currently in a battle.')

      await interaction.reply({ embeds: [battleQueueEmbed] })
      return
    }

    if (interaction.options.data.length === 0) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('Please attach a valid file for submission.')

      await interaction.reply({ embeds: [battleQueueEmbed] })
      return
    }

    if (
      (userBattle.user1.id === interaction.user.id &&
        userBattle.user1.submission) ||
      (userBattle.user2.id === interaction.user.id &&
        userBattle.user2.submission)
    ) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('You have already submitted a song for current battle')

      await interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    const attachment = interaction.options.getAttachment('loop')
    const fileName = attachment?.name.toLowerCase()
    const fileExtension = fileName?.substring(fileName.lastIndexOf('.'))

    if (!fileExtension || !LOOP_ALLOWED_EXTENSIONS.includes(fileExtension)) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription(
          'Invalid file type. Allowed extensions: ' +
            LOOP_ALLOWED_EXTENSIONS.join(', ')
        )

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    const voteChannel = client.channels.cache.get(VOTE_CHANNEL) as TextChannel
    const time = Date.now() - userBattle.startTime
    const minutes = Math.floor((time / 1000 / 60) % 60)

    const submittingPlayer =
      userBattle.user1.id === interaction.user.id ? 'A' : '**Player:** B'

    const userKey =
      userBattle.user1.id === interaction.user.id ? 'user1' : 'user2'

    userBattle[userKey].submissionTime = time

    const battleQueueEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setDescription('Your submission has been received successfully!')

    await interaction.reply({ embeds: [battleQueueEmbed] })

    const submissionEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setTitle(`New Submission`)
      .setDescription(`<@&${judgeRole}> time to vote!`)
      .addFields(
        {
          name: 'Battle Number',
          value: `#${userBattle.battleId}`,
          inline: true,
        },
        { name: 'Player:', value: `${submittingPlayer}`, inline: true }
      )
      .setFooter({ text: `Votes: 0/${JUDGES_THRESHOLD}` })

    const submissionMessage = await voteChannel.send({
      embeds: [submissionEmbed],
      files: [attachment?.url || ''],
    })

    userBattle[userKey].submissionMessageId = submissionMessage.id

    //await interaction.deleteReply()

    if (userBattle.user1.id === interaction.user.id) {
      userBattle.user1.submission = true
    } else {
      userBattle.user2.submission = true
    }

    saveCurrentBattles()

    clearCurrentBattlesVar()
  }

  const judge = interaction.guild?.members.cache.get(interaction.user.id)
  const getJudgesRole = interaction.guild?.roles.cache.find(
    (role) => role.id === judgeRole
  )

  if (
    getJudgesRole &&
    interaction.commandName === 'vote' &&
    judge?.roles.cache.has(getJudgesRole.id) &&
    VOTE_CHANNEL === interaction.channelId
  ) {
    const battleNumber = interaction.options.getString('battle_number')
    const targetUser = interaction.options.getString('player')
    const voteValue = interaction.options.getString('vote')

    if (!battleNumber || !targetUser || !voteValue) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription(
          'Invalid format. Use `/vote <battle number> <user A or B> <vote>'
        )

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    await initializeJudgesVote()

    const battleNumberParse = parseInt(battleNumber)
    const voteValueParse = parseInt(voteValue)
    const validTargets = ['A', 'B']

    if (
      isNaN(battleNumberParse) ||
      !validTargets.includes(targetUser.toUpperCase()) ||
      isNaN(voteValueParse) ||
      voteValueParse < 1 ||
      voteValueParse > 10
    ) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription(
          'Invalid format. Use `!vote <battle number> <user A or B> <vote>'
        )

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }
    await initializeCurrentBattles()

    const userBattle = currentBattles.find(
      (battle) => battle.battleId === battleNumberParse
    )

    if (!userBattle) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('Battle not found.')

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    const userKey = `user${targetUser.toUpperCase() === 'A' ? '1' : '2'}` as
      | 'user1'
      | 'user2'

    if (!judgesVote.some((vote) => vote.battleId === battleNumberParse)) {
      judgesVote.push({
        battleId: battleNumberParse,
        judges: {},
      })
    }

    const voteEntry = judgesVote.find(
      (vote) => vote.battleId === battleNumberParse
    )!

    if (!voteEntry.judges[interaction.user.id]) {
      voteEntry.judges[interaction.user.id] = {
        user1: {},
        user2: {},
      }
    }

    if (
      voteEntry.judges[interaction.user.id][userKey]?.classification !==
      undefined
    ) {
      const battleQueueEmbed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setDescription('You have already voted for this battle.')

      interaction.reply({ embeds: [battleQueueEmbed] })

      return
    }

    voteEntry.judges[interaction.user.id][userKey] = {
      classification: [voteValueParse],
    }

    saveJudgesVote()

    const battleQueueEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setDescription(
        `Your vote (${voteValue}) for Battle #${battleNumber} has been recorded successfully!`
      )

    interaction.reply({ embeds: [battleQueueEmbed] })

    await calculateAverages(battleNumberParse, userKey)
  }
})

async function startBattle() {
  await initializeLoopSubmissions()

  await initializeCurrentBattles()

  await initializeUserRank()

  const randomIndex = Math.floor(Math.random() * loopSubmissions.length)
  const randomLoop = loopSubmissions[randomIndex]

  const loopSubmissionMessage = await getMessageById(randomLoop.messageId)

  if (loopSubmissionMessage) {
    const user1 = await client.users.fetch(battleQueueMessages[0].userId)
    const user2 = await client.users.fetch(battleQueueMessages[1].userId)

    const user1Index = userRanks.findIndex(
      (userRank) => userRank.id === user1.id
    )
    if (user1Index === -1) {
      // User not found in userRanks, add with initial values
      userRanks.push({ id: user1.id, rank: Rank.Unranked, points: 0 })
    }

    const user2Index = userRanks.findIndex(
      (userRank) => userRank.id === user2.id
    )
    if (user2Index === -1) {
      // User not found in userRanks, add with initial values
      userRanks.push({ id: user2.id, rank: Rank.Unranked, points: 0 })
    }

    const battleChannel = client.channels.cache.get(
      BATTLE_CHANNEL
    ) as TextChannel

    battleQueueMessages.forEach(async (queueMessage) => {
      const botMessage = await battleChannel.messages
        .fetch(queueMessage.messageId)
        .catch(() => null)

      if (botMessage) await botMessage.delete()
    })

    updateUserRanks()

    const user1Rank = getUserRank(user1.id)
    const user2Rank = getUserRank(user2.id)
    const user1Points = user1Rank ? user1Rank.points : 0
    const user2Points = user2Rank ? user2Rank.points : 0

    await initializeTotalBattles()

    incrementTotalBattles()

    const battleQueueEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setTitle(`New Battle #${totalBattles}`)
      .setDescription(`Battle between ${user1} and ${user2} Started!`)
      .addFields(
        {
          name: `${user1.globalName}`,
          value: `${user1Rank?.rank} -> ${user1Points} points`,
          inline: true,
        },
        {
          name: `${user2.globalName}`,
          value: `${user2Rank?.rank} -> ${user2Points} points`,
          inline: true,
        }
      )

    const battleMessage = await battleChannel.send({
      embeds: [battleQueueEmbed],
    })

    battleChannel.send({
      files: [loopSubmissionMessage.attachments.first()?.url || ''],
    })

    const startTime = Date.now()
    const newBattleId = totalBattles

    saveTotalBattles()

    currentBattles.push({
      battleId: newBattleId,
      user1: {
        id: user1.id,
        submission: false,
      },
      user2: {
        id: user2.id,
        submission: false,
      },
      battleMessageId: battleMessage.id,
      startTime,
    })

    saveCurrentBattles()

    await loopSubmissionMessage.delete()

    loopSubmissionRemove(randomLoop.id)

    // Update the IDs to be in sequential order
    loopSubmissions.forEach((submission, index) => {
      submission.id = index + 1
    })

    updateLoopSubmissions()
  }

  clearLoopSubmissionsVar()
  clearCurrentBattlesVar()
  clearUserRanks()
  battleQueueMessages = []

  const timer = setInterval(() => {
    handleBattleTimeout(totalBattles)

    clearInterval(timer) // Clear the timer after it's executed
    clearTotalBattlesVar()

    const timerIndex = timers.indexOf(timer)

    if (timerIndex !== -1) {
      timers.splice(timerIndex, 1) // Remove the timer from the array
    }
  }, BATTLE_TIMEOUT)

  timers.push(timer)
}

async function getMessageById(messageId: string): Promise<Message | null> {
  try {
    const channel = client.channels.cache.get(
      LOOP_SUBMIT_CHANNEL
    ) as TextChannel

    if (channel) {
      const message = await channel.messages.fetch(messageId)

      return message
    } else {
      return null
    }
  } catch (error) {
    return null
  }
}

async function calculateAverages(battleId: number, user: string) {
  await initializeJudgesVote()
  await initializeCurrentBattles()

  const battleVotes = judgesVote.find((vote) => vote.battleId === battleId)
  const battleVotesIndex = judgesVote.findIndex(
    (vote) => vote.battleId === battleId
  )

  if (!battleVotes) {
    return
  }

  const user1Votes = Object.values<number>(
    Object.values(battleVotes.judges)
      .map((judge) => judge.user1.classification || [])
      .reduce((acc, val) => acc.concat(val), [])
  )

  const user2Votes = Object.values<number>(
    Object.values(battleVotes.judges)
      .map((judge) => judge.user2.classification || [])
      .reduce((acc, val) => acc.concat(val), [])
  )

  const voteChannel = client.channels.cache.get(VOTE_CHANNEL) as TextChannel

  const currentBattle = currentBattles.find(
    (battle) => battle.battleId === battleId
  )

  if (!currentBattle) {
    console.log('Battle not found:', battleId)

    return
  }

  const userKey = user as 'user1' | 'user2'
  const submissionMessageId = currentBattle[userKey].submissionMessageId || ''

  const submissionMessage = await voteChannel.messages.fetch(
    submissionMessageId
  )

  if (submissionMessage && battleVotes) {
    const votesForUser = Object.values<number>(
      Object.values(judgesVote[battleVotesIndex].judges)
        .map((judge) => judge[userKey]?.classification || [])
        .reduce((acc, val) => acc.concat(val), [])
    )

    const currentVotes = votesForUser.length

    const submissionEmbed = new EmbedBuilder()
      .setColor(0x0f0f0f)
      .setTitle(`New Submission`)
      .setDescription(`<@&${judgeRole}> time to vote!`)
      .addFields(
        {
          name: 'Battle Number',
          value: `#${battleId}`,
          inline: true,
        },
        {
          name: 'Player:',
          value: `${userKey === 'user1' ? 'A' : 'B'}`,
          inline: true,
        }
      )
      .setFooter({ text: `Votes: ${currentVotes}/${JUDGES_THRESHOLD}` })

    submissionMessage.edit({ embeds: [submissionEmbed] })
  }

  if (
    user1Votes.length >= JUDGES_THRESHOLD &&
    user2Votes.length >= JUDGES_THRESHOLD
  ) {
    const user1Average =
      user1Votes.reduce((sum, value) => sum + value, 0) / JUDGES_THRESHOLD

    const user2Average =
      user2Votes.reduce((sum, value) => sum + value, 0) / JUDGES_THRESHOLD

    let winner: string
    let loser: string
    let winnerId: string
    let loserId: string

    if (user1Average > user2Average) {
      winner = `<@${
        currentBattles.find((battle) => battle.battleId === battleId)?.user1
          .id || ''
      }>`

      winnerId = currentBattle.user1.id || ''

      loser = `<@${
        currentBattles.find((battle) => battle.battleId === battleId)?.user2
          .id || ''
      }>`

      loserId = currentBattle.user2.id || ''
    } else if (user2Average > user1Average) {
      winner = `<@${
        currentBattles.find((battle) => battle.battleId === battleId)?.user2
          .id || ''
      }>`

      winnerId = currentBattle.user2.id || ''

      loser = `<@${
        currentBattles.find((battle) => battle.battleId === battleId)?.user1
          .id || ''
      }>`

      loserId = currentBattle.user2.id || ''
    } else {
      winner = "It's a tie!"
      loser = "It's a tie!"
      loserId = ''
      winnerId = ''
    }

    const winningUserKey =
      currentBattles.find((battle) => battle.battleId === battleId)?.user1
        .id === winnerId
        ? 'user1'
        : 'user2'

    const losingUserKey =
      currentBattles.find((battle) => battle.battleId === battleId)?.user2
        .id === loserId
        ? 'user1'
        : 'user2'

    await initializeUserRank()

    const winningUser = currentBattle[winningUserKey]
    const loosingUser = currentBattle[losingUserKey]

    const winningUserRank = getUserRank(winningUser.id)
    const loosingUserRank = getUserRank(loosingUser.id)

    if (winningUserRank !== undefined && loosingUserRank !== undefined) {
      const basePoints = getBasePoints(winningUserRank.rank)
      const maxPointsGain = 300
      const maxPointsLoss = 200

      let pointsWon = basePoints
      let pointsLost = basePoints

      if (winningUserRank.rank > loosingUserRank.rank) {
        const divisionBonus = basePoints * 0.25
        pointsWon += divisionBonus
        pointsLost -= divisionBonus
      } else if (winningUserRank.rank < loosingUserRank.rank) {
        const divisionPenalty = basePoints * 0.25
        pointsWon -= divisionPenalty
        pointsLost += divisionPenalty
      }
      const winningUserTime = winningUser.submissionTime
      const fifteenMinutes = 15 * 60 * 1000

      if (winningUserTime && winningUserTime < fifteenMinutes) {
        const bonusPercentage =
          (fifteenMinutes - winningUserTime) / fifteenMinutes

        const bonusPercentageToGive = Math.min(bonusPercentage, 0.05)

        pointsWon = pointsWon + pointsWon * bonusPercentageToGive
      }

      const pointsToGive = Math.min(pointsWon, maxPointsGain)
      const pointsToTake = Math.max(-pointsLost, -maxPointsLoss)

      pointsToGiveGlob = pointsToGive
      pointsToTakeGlob = pointsToTake

      updateRanks(winningUser, pointsToGive)
      updateRanks(loosingUser, pointsToTake)
    }

    const resultChannel = client.channels.cache.get(
      RESULT_CHANNEL
    ) as TextChannel

    const updatedUser1Rank = getUserRank(currentBattle.user1.id)
    const updatedUser1Points = updatedUser1Rank ? updatedUser1Rank.points : 0

    const updatedUser2Rank = getUserRank(currentBattle.user2.id)
    const updatedUser2Points = updatedUser2Rank ? updatedUser2Rank.points : 0

    const user1 = await client.users.fetch(currentBattle.user1.id)
    const user2 = await client.users.fetch(currentBattle.user2.id)

    if (winnerId === user1.id) {
      const user1SubmissionTime = currentBattle.user1.submissionTime
      const user2SubmissionTime = currentBattle.user2.submissionTime

      if (user1SubmissionTime && user2SubmissionTime) {
        const submissionEmbed = new EmbedBuilder()
          .setColor(0x0f0f0f)
          .setTitle(`Results for Battle #${battleId}`)
          .setDescription(`<@&${user1.id}> VS <@&${user2.id}>`)
          .addFields(
            {
              name: 'Winner',
              value: `${winner}`,
              inline: false,
            },
            {
              name: `${user1.globalName}`,
              value: `Score: ${user1Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser1Rank?.rank} -> ${updatedUser1Points} (+${pointsToGiveGlob}) Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user1SubmissionTime / (1000 * 60))} min`,
              inline: true,
            },
            {
              name: `${user2.globalName}`,
              value: `Score: ${user2Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser2Rank?.rank} -> ${updatedUser2Points} (${pointsToTakeGlob}) Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user2SubmissionTime / (1000 * 60))} min`,
              inline: true,
            }
          )

        resultChannel.send({
          embeds: [submissionEmbed],
        })
      }
    } else if (winnerId === user2.id) {
      const user1SubmissionTime = currentBattle.user1.submissionTime
      const user2SubmissionTime = currentBattle.user2.submissionTime

      if (user1SubmissionTime && user2SubmissionTime) {
        const submissionEmbed = new EmbedBuilder()
          .setColor(0x0f0f0f)
          .setTitle(`Results for Battle #${battleId}`)
          .setDescription(`<@&${user1.id}> VS <@&${user2.id}>`)
          .addFields(
            {
              name: 'Winner',
              value: `${winner}`,
              inline: false,
            },
            {
              name: `${user1.globalName}`,
              value: `Score: ${user1Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser1Rank?.rank} -> ${updatedUser1Points} (${pointsToTakeGlob}) Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user1SubmissionTime / (1000 * 60))}`,
              inline: true,
            },
            {
              name: `${user2.globalName}`,
              value: `Score: ${user2Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser2Rank?.rank} -> ${updatedUser2Points} (+${pointsToGiveGlob}) Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user2SubmissionTime / (1000 * 60))}`,
              inline: true,
            }
          )

        resultChannel.send({
          embeds: [submissionEmbed],
        })
      }
    } else if (winnerId === '') {
      const user1SubmissionTime = currentBattle.user1.submissionTime
      const user2SubmissionTime = currentBattle.user2.submissionTime

      if (user1SubmissionTime && user2SubmissionTime) {
        const submissionEmbed = new EmbedBuilder()
          .setColor(0x0f0f0f)
          .setTitle(`Results for Battle #${battleId}`)
          .setDescription(`<@&${user1.id}> VS <@&${user2.id}>`)
          .addFields(
            {
              name: `It's a Tie`,
              value: ` `,
              inline: false,
            },
            {
              name: `${user1.globalName}`,
              value: `Score: ${user1Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser1Rank?.rank} -> ${updatedUser1Points} Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user1SubmissionTime / (1000 * 60))}`,
              inline: true,
            },
            {
              name: `${user2.globalName}`,
              value: `Score: ${user2Average.toFixed(2)}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser2Rank?.rank} -> ${updatedUser2Points} Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${Math.floor(user2SubmissionTime / (1000 * 60))}`,
              inline: true,
            }
          )

        resultChannel.send({
          embeds: [submissionEmbed],
        })
      }
    }

    judgesVote.splice(battleVotesIndex, 1)

    currentBattlesRemove(battleId)

    saveJudgesVote()

    saveCurrentBattles()

    clearLoopSubmissionsVar()

    clearUserRanks()
  }
}

async function handleBattleTimeout(battleId: number) {
  await initializeCurrentBattles()

  const currentBattle = currentBattles.find(
    (battle) => battle.battleId === battleId
  )

  if (currentBattle) {
    const user1Forfeit = !currentBattle.user1.submission
    const user2Forfeit = !currentBattle.user2.submission

    if (user1Forfeit || user2Forfeit) {
      const resultChannel = client.channels.cache.get(
        RESULT_CHANNEL
      ) as TextChannel

      const updatedUser1Rank = getUserRank(currentBattle.user1.id)
      const updatedUser1Points = updatedUser1Rank ? updatedUser1Rank.points : 0

      const updatedUser2Rank = getUserRank(currentBattle.user2.id)
      const updatedUser2Points = updatedUser2Rank ? updatedUser2Rank.points : 0

      const user1 = await client.users.fetch(currentBattle.user1.id)
      const user2 = await client.users.fetch(currentBattle.user2.id)

      const user1SubmissionTime = currentBattle.user1.submissionTime
      const user2SubmissionTime = currentBattle.user2.submissionTime

      if (user1SubmissionTime && user2SubmissionTime) {
        const submissionEmbed = new EmbedBuilder()
          .setColor(0x0f0f0f)
          .setTitle(`Battle #${battleId} Timeout`)
          .setDescription(`<@&${user1.id}> VS <@&${user2.id}>`)
          .addFields(
            {
              name: `It's a Tie`,
              value: ` `,
              inline: false,
            },
            {
              name: `${user1.globalName}`,
              value: `Score: ${user1Forfeit ? 'No Score' : 'Submitted'}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser1Rank?.rank} -> ${updatedUser1Points} Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${
                user1Forfeit
                  ? 'Not Submitted in Time'
                  : Math.floor(user1SubmissionTime / (1000 * 60))
              }`,
              inline: true,
            },
            {
              name: `${user2.globalName}`,
              value: `Score: ${user2Forfeit ? 'No Score' : 'Submitted'}`,
              inline: true,
            },
            {
              name: 'Rank',
              value: `${updatedUser2Rank?.rank} -> ${updatedUser2Points} Points`,
              inline: true,
            },
            {
              name: 'Submission Time',
              value: `${
                user2Forfeit
                  ? 'Not Submitted in Time'
                  : Math.floor(user2SubmissionTime / (1000 * 60))
              }`,
              inline: true,
            }
          )

        resultChannel.send({ embeds: [submissionEmbed] })
      }
      currentBattlesRemove(battleId)

      saveCurrentBattles()
    }
  }
}

client.login(process.env.BOT_TOKEN)
