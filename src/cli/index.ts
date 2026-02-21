#!/usr/bin/env node

import { createStudyCommand } from '@aryazos/study-cli';
import { createCli } from '@aryazos/ts-base/cli';
import { createAiCommand } from "./ai";
import { createSyncCommand } from "./commands";

const cli = createCli({
  name: "aryazos",
  description: "Aryazos command line tools",
  commands: [
    createStudyCommand({
      subcommands: [createSyncCommand(), createAiCommand()],
    }),
  ],
});

cli.run();
