import * as fs from 'fs'

export let totalBattles = 0

export async function initializeTotalBattles() {
  try {
    const data = fs.readFileSync('totalBattles.json', 'utf-8')
    totalBattles = JSON.parse(data)
  } catch (err) {
    console.error('Error reading currentBattles.json:', err)
  }
}

export function saveTotalBattles() {
  fs.writeFileSync(
    'totalBattles.json',
    JSON.stringify(totalBattles, null, 2),
    'utf-8'
  )
}

export function clearTotalBattlesVar() {
  totalBattles = 0
}

export function incrementTotalBattles() {
  totalBattles++
}
