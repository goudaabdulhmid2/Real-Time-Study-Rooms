import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';


// Ensure logs directory exists in production
if (process.env.NODE_ENV === 'production') {
    const logsDir = path.resolve(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? "info" : "debug",
    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'api-service' },
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...metadata }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(metadata).length > 0) {
                        msg += ` ${JSON.stringify(metadata)}`;
                    }
                    return msg;
                })
            )
        })
    ],
    exceptionHandlers: process.env.NODE_ENV === 'production' ? [
        new transports.File({ filename: 'logs/exceptions.log' })
    ] : [
        new transports.Console()
    ]
});


// In production, log to files as well
if (process.env.NODE_ENV === 'production') {

    // Add daily rotate file transport for log rotation
    logger.add(new DailyRotateFile({
        filename: 'logs/app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
    }));
}

export default logger;