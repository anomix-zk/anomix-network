import { consola } from 'consola';
import { NodeProvider } from './node_provider';

const node = new NodeProvider('http://127.0.0.1:8099');

const res = await node.isReady();
consola.info('res: ', res);

const res1 = await node.getBlockHeight();
consola.info('blockHeight: ', res1);
