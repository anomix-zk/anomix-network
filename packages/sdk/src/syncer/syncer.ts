import { consola, ConsolaInstance } from 'consola';
import { PrivateKey } from 'snarkyjs';
import { Database } from '../database/database';
import { NoteProcessor } from '../note_processor/note_processor';
import { AnomixNode } from '../rollup_node/anomix_node';
import { InterruptableSleep } from '../utils/sleep';

export class Syncer {
  private runningPromise?: Promise<void>;
  private noteProcessors: NoteProcessor[] = [];
  private interruptableSleep = new InterruptableSleep();
  private running = false;
  private initialSyncBlockHeight = 0;
  private synchedToBlock = 0;
  private log: ConsolaInstance;

  constructor(private node: AnomixNode, private db: Database, logSuffix = '') {
    this.log = consola.withTag(
      logSuffix ? `anomix:syncer_${logSuffix}` : 'anomix:syncer'
    );
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(from = 1, take = 1, retryInterval = 1000) {
    if (this.running) return;
    this.running = true;

    await this.initialSync();

    const run = async () => {
      while (this.running) {
        from = await this.work(from, take, retryInterval);
      }
    };

    this.runningPromise = run();
    this.log.info('Started');
  }

  protected async initialSync() {
    const blockHeight = await this.node.getBlockHeight();
    this.initialSyncBlockHeight = blockHeight;
    this.synchedToBlock = this.initialSyncBlockHeight;
  }

  protected async work(
    from = 1,
    take = 1,
    retryInterval = 1000
  ): Promise<number> {
    try {
      this.log.info(`Syncing from block ${from}`);
      const blocks = await this.node.getBlocks(from, take);
      if (!blocks.length) {
        await this.interruptableSleep.sleep(retryInterval);
        return from;
      }

      const latestBlock = blocks[blocks.length - 1];
      for (const noteProcessor of this.noteProcessors) {
        await noteProcessor.process(blocks);
      }

      from += blocks.length;
      this.synchedToBlock = latestBlock.blockHeight;
      return from;
    } catch (err) {
      this.log.error(err);
      await this.interruptableSleep.sleep(retryInterval);
      return from;
    }
  }

  public async stop() {
    this.running = false;
    this.interruptableSleep.interrupt();
    await this.runningPromise;
    this.log.info('Stopped');
  }

  public addAccount(accountPrivateKey: PrivateKey) {
    const processor = this.noteProcessors.find((x) =>
      x.accountPrivateKey.equals(accountPrivateKey)
    );
    if (processor) {
      return;
    }
    this.noteProcessors.push(
      new NoteProcessor(accountPrivateKey, this.db, this.node)
    );
  }

  public async isAccountSynced(accountPk: string) {
    const result = await this.db.getUserState(accountPk);
    if (!result) {
      return false;
    }

    const processor = this.noteProcessors.find(
      (x) => x.accountPrivateKey.toPublicKey().toBase58() === accountPk
    );
    if (!processor) {
      return false;
    }
    return await processor.isSynced();
  }

  public async isSynced() {
    const latest = await this.node.getBlockHeight();
    return latest <= this.synchedToBlock;
  }
}
