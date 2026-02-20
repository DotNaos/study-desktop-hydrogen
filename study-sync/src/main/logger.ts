import {
    isChannelEnabled,
    type LoggerBackend,
    registerLoggerBackend,
} from '@aryazos/ts-base/logging';
import { app } from "electron";
import pino from "pino";

const baseLogger = app.isPackaged
  ? pino()
  : pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
    });

const pinoBackend: LoggerBackend = {
  log: (channel, level, event, message, data) => {
    const fullChannel = event ? `${channel}:${event}` : channel;
    if (!isChannelEnabled(fullChannel)) return;

    const pinoChild = baseLogger.child({ channel });
    const logObj: Record<string, unknown> = {};
    if (event) logObj.event = event;
    if (data !== undefined) logObj.data = data;

    if (Object.keys(logObj).length > 0) {
      pinoChild[level](logObj, message);
    } else {
      pinoChild[level](message);
    }
  },
};

registerLoggerBackend(pinoBackend);

export { baseLogger };
