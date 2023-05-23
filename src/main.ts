import * as core from '@actions/core'
import fs from 'fs'
import readline from 'readline'
import slackifyMarkdown from 'slackify-markdown'

const encoding = 'utf8'
const eol = '\n'
const topEmptyLines = new RegExp(`^([${eol}]*)`, 'm')

async function extractReleaseNotes(
  changelogFile: fs.PathLike,
  prerelease: string
): Promise<string> {
  const fileStream = fs.createReadStream(changelogFile, {encoding})
  const rl = readline.createInterface({
    input: fileStream
  })
  const lines = []
  let inside_release = false
  for await (const line of rl) {
    const start_of_release =
      !!line.match('^#+ \\[[0-9]') ||
      (prerelease === 'true' && !!line.match('^#+ \\[Unreleased\\]'))
    if (inside_release) {
      if (start_of_release) {
        core.debug(`next version found: '${line}'`)
        break
      } else {
        lines.push(line)
        core.debug(`add line: '${line}'`)
      }
    } else {
      if (start_of_release) {
        inside_release = true
        core.debug(`version found: '${line}'`)
      } else {
        core.debug(`skip line: '${line}'`)
      }
    }
  }
  let releaseNotes = lines.reduce(
    (previousValue, currentValue) => previousValue + eol + currentValue
  )
  releaseNotes = trimEmptyLinesTop(releaseNotes)
  return releaseNotes
}

function trimEmptyLinesTop(releaseNotes: string): string {
  return releaseNotes.replace(topEmptyLines, '')
}

async function run(): Promise<void> {
  try {
    const packageFilesPathString: string = core.getInput(
      'changelog-files-config'
    )
    const packageVersionsString: string = core.getInput(
      'released-package-versions'
    )

    const packageFilesPath = JSON.parse(packageFilesPathString)
    const packageVersions = JSON.parse(packageVersionsString)
    let changeLogs = ``

    for (const packageWithVersion of Object.entries(packageVersions)) {
      const releaseNotes = extractReleaseNotes(
        packageFilesPath[packageWithVersion[0]],
        'false'
      )

      const md = `
			${packageWithVersion[0]}@${packageWithVersion[1]}\n
			${releaseNotes}\n
			To update your package to the latest version, simply run the following command in your project directory:\n
			\`npm install ${packageVersions[0]}@${packageVersions[1]}\`\n\nIf you're using Yarn, you can use the following command:\n\n\`yarn add ${packageVersions[0]}@${packageVersions[1]}\`\n
			`
      const mrkdwn = slackifyMarkdown(md)

      changeLogs += mrkdwn
    }
    // eslint-disable-next-line no-console
    console.info(`Final changelog '${changeLogs}'`)
    core.setOutput('changeLogs', changeLogs)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
