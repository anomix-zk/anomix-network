import pino, { Logger } from 'pino';
import config from './config';

const logLevelData = { '*': 'info' };
const logLevels = new Map<string, string>(Object.entries(logLevelData));

function getLogLevel(logger: string): string {
    return logLevels.get(logger) || logLevels.get('*') || 'info';
}

// TODO need configure file storage, pattern, etc.
export function getLogger(name: string): Logger {
    return pino({
        name,
        level: getLogLevel(name),
        transport: {
            targets: [
                {
                    target: 'pino/file',
                    level: 'info',
                    options: { destination: config.pinoLogFilePath.concat('/coordinator-log.log') }
                },
                { target: 'pino-pretty', level: 'info', options: { destination: '/dev/stdout' } }
            ]
        }
    });
}


const logOpt = {
    console: process.env.NODE_ENV !== 'production',
    file: config.pinoLogFilePath, //此处设置log文件输出路径
    //logrotator设置按什么归档日志
    logrotator: {
        byDay: true,
        dayDelimiter: '_'
    },
    maxBufferLength: 4096,
    flushInterval: 1000,
    //自定义level设置输出所有级别日志
    customLevels: 'all',
    //prettyPrint自定义日志输出格式，colorize设置为false为不显示颜色，防止日志文件出现 [32m 乱码
    prettyPrint: {
        colorize: false,
        timestampKey: 'time',
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        messageFormat: '{msg}'
    }
};


