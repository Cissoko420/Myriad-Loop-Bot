import * as fs from 'fs'

export let loopSubmissions: { id: number; messageId: string }[] = []

export async function initializeLoopSubmissions() {
  try {
    const data = fs.readFileSync('loopSubmissions.json', 'utf-8')
    loopSubmissions = JSON.parse(data)
  } catch (err) {
    console.error('Error reading loopSubmissions.json:', err)
  }
}

export function updateLoopSubmissions() {
  fs.writeFileSync(
    'loopSubmissions.json',
    JSON.stringify(loopSubmissions, null, 2),
    'utf-8'
  )
}

export function loopSubmissionRemove(loopId: number) {
  loopSubmissions = loopSubmissions.filter(
    (submission) => submission.id !== loopId
  )
}

export function clearLoopSubmissionsVar() {
  loopSubmissions = []
}
