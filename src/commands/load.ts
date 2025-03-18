import { Args, Command } from '@oclif/core'
import { load } from '../loading'

export default class Load extends Command {
  static override args = {
    lang: Args.string({ description: 'language name' }),
  }

  // static override description = 'describe the command here'
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  // static override flags = {
  //   // flag with no value (-f, --force)
  //   force: Flags.boolean({ char: 'f' }),
  //   // flag with a value (-n, --name=VALUE)
  //   name: Flags.string({ char: 'n', description: 'name to print' }),
  // }

  public async run(): Promise<void> {
    const { args } = await this.parse(Load)
    if (args.lang) {
      await load(args.lang)
    }
    // const name = flags.name ?? 'world'
    // this.log(`hello ${name} from /Users/mokevnin/projects/hexlet-basics-assistant/src/commands/load.ts`)
    // if (args.file && flags.force) {
    //   this.log(`you input --force and --file: ${args.file}`)
    // }
  }
}
