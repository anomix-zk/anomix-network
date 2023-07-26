import pino, { Logger } from 'pino';

const logLevelData = { '*': 'info' };
const logLevels = new Map<string, string>(Object.entries(logLevelData));

function getLogLevel(logger: string): string {
    return logLevels.get(logger) || logLevels.get('*') || 'info';
}

console.log('__dirname:', __dirname);
console.log('__filename:', __filename);

// TODO need configure file storage, pattern, etc.
export function getLogger(name: string): Logger {
    return pino({
        name,
        level: getLogLevel(name),
        transport: {
            targets: [
                {
                    target: __dirname.concat('../../../anomix-network-log-storage/log.log'),// TODO improve it for prod&dev
                    level: 'info',
                },
                { target: 'pino-pretty', options: { destination: '/dev/stdout' } }
            ]
        }
    });
}


const logOpt = {
    console: process.env.NODE_ENV !== 'production',
    file: 'D://Test//test.log', //此处设置log文件输出路径
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


