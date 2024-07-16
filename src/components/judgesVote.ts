import * as fs from 'fs'

interface JudgesVote {
  battleId: number
  judges: {
    [judgeId: string]: {
      user1: {
        classification?: number[]
      }
      user2: {
        classification?: number[]
      }
    }
  }
}

export let judgesVote: JudgesVote[] = []

export async function initializeJudgesVote() {
  try {
    const data = fs.readFileSync('judgesVote.json', 'utf-8')
    judgesVote = JSON.parse(data)
  } catch (err) {
    console.error('Error reading judgesVote.json:', err)
  }
}

export function saveJudgesVote() {
  fs.writeFileSync(
    'judgesVote.json',
    JSON.stringify(judgesVote, null, 2),
    'utf-8'
  )
}
