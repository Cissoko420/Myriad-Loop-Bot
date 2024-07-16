import * as fs from 'fs'

interface BattleUser {
  id: string
  classification?: number
  submission: boolean
  submissionTime?: number
  submissionMessageId?: string
}

export let currentBattles: {
  battleId: number
  user1: BattleUser
  user2: BattleUser
  battleMessageId: string
  startTime: number
}[] = []

export async function initializeCurrentBattles() {
  try {
    const data = fs.readFileSync('currentBattles.json', 'utf-8')
    currentBattles = JSON.parse(data)
  } catch (err) {
    console.error('Error reading currentBattles.json:', err)
  }
}

export function saveCurrentBattles() {
  fs.writeFileSync(
    'currentBattles.json',
    JSON.stringify(currentBattles, null, 2),
    'utf-8'
  )
}

export function currentBattlesRemove(battleId: number) {
  currentBattles = currentBattles.filter(
    (battle) => battle.battleId !== battleId
  )
}

export function clearCurrentBattlesVar() {
  currentBattles = []
}
