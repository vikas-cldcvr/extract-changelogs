/* eslint-disable no-console */
import * as core from '@actions/core'
import fs from 'fs'
import readline from 'readline'
import slackifyMarkdown from 'slackify-markdown'
import esrever from 'esrever'

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
  releaseNotes = trimEmptyLinesBottom(releaseNotes)
  return releaseNotes
}

function trimEmptyLinesTop(releaseNotes: string): string {
  return releaseNotes.replace(topEmptyLines, '')
}

function trimEmptyLinesBottom(releaseNotes: string): string {
  return esrever.reverse(trimEmptyLinesTop(esrever.reverse(releaseNotes)))
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
    const packageVersions = JSON.parse(packageVersionsString) as {
      name: string
      version: string
    }[]
    let changeLogs = ``

    console.log(packageFilesPath, packageVersions)
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < packageVersions.length; i++) {
      const packageWithVersion = packageVersions[i]
      console.log(
        `Extracting logs for ${packageWithVersion.name} from ${
          packageFilesPath[packageWithVersion.name]
        }`
      )
      const releaseNotes = await extractReleaseNotes(
        packageFilesPath[packageWithVersion.name],
        'false'
      )

      const md = `\n# Package : \`${packageWithVersion.name}@${packageWithVersion.version}\`\n${releaseNotes}\nTo update your package to the latest version, simply run the following command in your project directory:\n\`npm install ${packageWithVersion.name}@${packageWithVersion.version}\`\n\n\n`
      const mrkdwn = slackifyMarkdown(md.trim())

      changeLogs += `${mrkdwn.trim()}\n\n`
    }
    console.info(`${changeLogs}`)
    core.setOutput('changeLogs', changeLogs)
  } catch (error) {
    console.error(error)
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
