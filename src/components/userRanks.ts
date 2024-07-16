import * as fs from 'fs'

interface UserRank {
  id: string
  rank: Rank
  points: number
}

interface BattleUser {
  id: string
  classification?: number
  submission: boolean
  submissionTime?: number
  submissionMessageId?: string
}

export enum Rank {
  Unranked = 'Unranked',
  Bronze1 = 'Bronze 1',
  Bronze2 = 'Bronze 2',
  Bronze3 = 'Bronze 3',
  Silver1 = 'Silver 1',
  Silver2 = 'Silver 2',
  Silver3 = 'Silver 3',
  Gold1 = 'Gold 1',
  Gold2 = 'Gold 2',
  Gold3 = 'Gold 3',
  Platinum1 = 'Platinum1',
  Platinum2 = 'Platinum2',
  Platinum3 = 'Platinum3',
  Diamond = 'Diamond',
}

export let userRanks: { id: string; rank: Rank; points: number }[] = []

export async function initializeUserRank() {
  try {
    const data = fs.readFileSync('userRanks.json', 'utf-8')
    userRanks = JSON.parse(data)
  } catch (err) {
    console.error('Error reading userRanks.json:', err)
  }
}

export function updateUserRanks() {
  fs.writeFileSync(
    'userRanks.json',
    JSON.stringify(userRanks, null, 2),
    'utf-8'
  )
}

export function getUserRank(userId: string): UserRank | undefined {
  const user = userRanks.find((userRank) => userRank.id === userId)
  return user ? user : { id: userId, rank: Rank.Unranked, points: 0 }
}

export function updateUserRankVar(userId: string, rank: Rank, points: number) {
  const existingUserRankIndex = userRanks.findIndex(
    (userRank) => userRank.id === userId
  )
  const existingUserRank = getUserRank(userId)

  if (existingUserRank) {
    userRanks[existingUserRankIndex].rank = rank
    userRanks[existingUserRankIndex].points = points
  } else {
    userRanks.push({ id: userId, rank, points })
  }

  updateUserRanks()
}

export function getBasePoints(rank: Rank): number {
  switch (rank) {
    case Rank.Bronze1:
    case Rank.Bronze2:
    case Rank.Bronze3:
      return 50

    case Rank.Silver1:
    case Rank.Silver2:
    case Rank.Silver3:
      return 75

    case Rank.Gold1:
    case Rank.Gold2:
    case Rank.Gold3:
    case Rank.Platinum1:
    case Rank.Platinum2:
    case Rank.Platinum3:
    case Rank.Diamond:
      return 100

    default:
      return 50
  }
}

export function updateRanks(user: BattleUser, points: number) {
  let currentUserRank = getUserRank(user.id)

  if (!currentUserRank)
    currentUserRank = { id: user.id, rank: Rank.Unranked, points: 0 }
  else {
    if (currentUserRank?.points === undefined) {
      currentUserRank.points = points
    } else if (currentUserRank.points + points <= 50) {
      currentUserRank.points = 50
    } else {
      currentUserRank.points += points
    }
  }

  if (currentUserRank.points < 50) currentUserRank.rank = Rank.Unranked

  if (currentUserRank.points >= 50 && currentUserRank.points < 200)
    currentUserRank.rank = Rank.Bronze1
  if (currentUserRank.points >= 200 && currentUserRank.points < 350)
    currentUserRank.rank = Rank.Bronze2
  if (currentUserRank.points >= 350 && currentUserRank.points < 500)
    currentUserRank.rank = Rank.Bronze3

  if (currentUserRank.points >= 500 && currentUserRank.points < 700)
    currentUserRank.rank = Rank.Silver1
  if (currentUserRank.points >= 700 && currentUserRank.points < 1000)
    currentUserRank.rank = Rank.Silver2
  if (currentUserRank.points >= 1000 && currentUserRank.points < 1300)
    currentUserRank.rank = Rank.Silver3

  if (currentUserRank.points >= 1300 && currentUserRank.points < 1600)
    currentUserRank.rank = Rank.Gold1
  if (currentUserRank.points >= 1700 && currentUserRank.points < 2000)
    currentUserRank.rank = Rank.Gold2
  if (currentUserRank.points >= 2000 && currentUserRank.points < 2500)
    currentUserRank.rank = Rank.Gold3

  if (currentUserRank.points >= 2500 && currentUserRank.points < 3000)
    currentUserRank.rank = Rank.Platinum1
  if (currentUserRank.points >= 3000 && currentUserRank.points < 3700)
    currentUserRank.rank = Rank.Platinum2
  if (currentUserRank.points >= 3700 && currentUserRank.points < 4500)
    currentUserRank.rank = Rank.Platinum3

  if (currentUserRank.points >= 4500) currentUserRank.rank = Rank.Diamond

  const userIndex = userRanks.findIndex((u) => u.id === currentUserRank?.id)

  if (userIndex !== -1) {
    userRanks[userIndex] = currentUserRank
  } else {
    userRanks.push(currentUserRank)
  }

  userRanks.sort((a, b) => b.points - a.points)

  updateUserRankVar(
    currentUserRank.id,
    currentUserRank.rank,
    currentUserRank.points
  )
}

export function getUserPoints(user: BattleUser) {
  const userRank = getUserRank(user.id)
  return userRank?.points
}

export function clearUserRanks() {
  userRanks = []
}
