import { consola, ConsolaInstance } from 'consola';
import { PublicKey } from 'snarkyjs';
import { Database } from '../database/database';
import { KeyStore } from '../key_store/key_store';
import { NoteProcessor } from '../note_processor/note_processor';
import { AnomixNode } from '../rollup_node/anomix_node';
import { InterruptableSleep } from '../utils/sleep';
import isNode from 'detect-node';
import { SdkEventType, SDK_BROADCAST_CHANNNEL_NAME } from '../constants';

export class Syncer {
  private runningPromise?: Promise<void>;
  private noteProcessors: NoteProcessor[] = [];
  private interruptableSleep = new InterruptableSleep();
  private running = false;
  private initialSyncBlockHeight = 0;
  private synchedToBlock = 0;
  private log: ConsolaInstance;
  private noteProcessorsToCatchUp: NoteProcessor[] = [];
  private broadcastChannel: BroadcastChannel | undefined;

  constructor(
    private node: AnomixNode,
    private db: Database,
    private keyStore: KeyStore,
    logSuffix = ''
  ) {
    this.log = consola.withTag(
      logSuffix ? `anomix:syncer_${logSuffix}` : 'anomix:syncer'
    );
    if (!isNode) {
      this.broadcastChannel = new BroadcastChannel(SDK_BROADCAST_CHANNNEL_NAME);
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(from = 1, limit = 1, retryInterval = 1000) {
    if (this.running) return;
    this.running = true;

    if (from < this.synchedToBlock + 1) {
      throw new Error(
        `From block ${from} is smaller than the currently synched block ${this.synchedToBlock}`
      );
    }
    this.synchedToBlock = from - 1;

    await this.initialSync();

    const run = async () => {
      while (this.running) {
        if (this.noteProcessorsToCatchUp.length > 0) {
          // There is a note processor that needs to catch up. We hijack the main loop to catch up the note processor.
          await this.workNoteProcessorCatchUp(limit, retryInterval);
        } else {
          // No note processor needs to catch up. We continue with the normal flow.
          await this.work(limit, retryInterval);
        }
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

  protected async work(limit = 1, retryInterval = 1000): Promise<void> {
    const from = this.synchedToBlock + 1;
    this.log.info(`Syncing from block ${from}`);

    try {
      const blocks = await this.node.getBlocks(from, limit);
      if (!blocks.length) {
        await this.interruptableSleep.sleep(retryInterval);
        return;
      }

      const latestBlock = blocks[blocks.length - 1];
      for (const noteProcessor of this.noteProcessors) {
        await noteProcessor.process(blocks);

        this.broadcastChannel?.postMessage({
          eventType: SdkEventType.UPDATED_ACCOUNT_STATE,
          data: {
            accountPk: noteProcessor.accountPublicKey.toBase58(),
            synchedToBlock: noteProcessor.status.syncedToBlock,
          },
        });
      }

      this.synchedToBlock = latestBlock.blockHeight;
      this.broadcastChannel?.postMessage({
        eventType: SdkEventType.UPDATED_SYNCER_STATE,
        data: this.getSyncStatus(),
      });
    } catch (err) {
      this.log.error(err);
      await this.interruptableSleep.sleep(retryInterval);
    }
  }

  protected async workNoteProcessorCatchUp(
    limit = 1,
    retryInterval = 1000
  ): Promise<void> {
    const noteProcessor = this.noteProcessorsToCatchUp[0];
    if (noteProcessor.status.syncedToBlock === this.synchedToBlock) {
      // Note processor already synched, nothing to do
      this.noteProcessorsToCatchUp.shift();
      this.noteProcessors.push(noteProcessor);
      return;
    }

    const from = noteProcessor.status.syncedToBlock + 1;
    // Ensuring that the note processor does not sync further than the main sync.
    limit = Math.min(limit, this.synchedToBlock - from + 1);
    this.log.info(
      `Syncing from block ${from} for note processor ${noteProcessor.accountPublicKey.toBase58()},limit: ${limit}`
    );

    if (limit < 1) {
      throw new Error(`Unexpected limit ${limit} for note processor catch up`);
    }

    try {
      const blocks = await this.node.getBlocks(from, limit);
      if (!blocks.length) {
        // This should never happen because this function should only be called when the note processor is lagging
        // behind main sync.
        throw new Error('No blocks in processor catch up mode');
      }

      await noteProcessor.process(blocks);

      this.broadcastChannel?.postMessage({
        eventType: SdkEventType.UPDATED_ACCOUNT_STATE,
        data: {
          accountPk: noteProcessor.accountPublicKey.toBase58(),
          synchedToBlock: noteProcessor.status.syncedToBlock,
        },
      });

      if (noteProcessor.status.syncedToBlock === this.synchedToBlock) {
        // Note processor caught up, move it to `noteProcessors` from `noteProcessorsToCatchUp`.
        this.noteProcessorsToCatchUp.shift();
        this.noteProcessors.push(noteProcessor);
      }
    } catch (err) {
      this.log.error(err);
      await this.interruptableSleep.sleep(retryInterval);
    }
  }

  public async stop() {
    this.running = false;
    this.interruptableSleep.interrupt();
    await this.runningPromise;
    this.log.info('Stopped');
  }

  public addAccount(accountPublicKey: PublicKey) {
    const processor = this.noteProcessors.find((x) =>
      x.accountPublicKey.equals(accountPublicKey)
    );
    if (processor) {
      return;
    }
    this.noteProcessorsToCatchUp.push(
      new NoteProcessor(accountPublicKey, this.db, this.keyStore, this.node)
    );
  }

  public async isAccountSynced(accountPk: string) {
    const result = await this.db.getUserState(accountPk);
    if (!result) {
      return false;
    }

    const processor = this.noteProcessors.find(
      (x) => x.accountPublicKey.toBase58() === accountPk
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

  public getSyncStatus() {
    return {
      SyncerSynchedToBlock: this.synchedToBlock,
      accountStatusList: this.noteProcessors.map((n) => {
        accountPk: n.accountPublicKey.toBase58();
        synchedToBlock: n.status.syncedToBlock;
      }),
    };
  }
}
