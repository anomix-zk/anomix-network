/* eslint-disable no-unused-vars */
import jayson from 'jayson/promise/index.js';
import { CloudInterface, Instance } from './cloud_api.js';
import { logger } from './logger.js';

export { TaskCoordinator, TaskStack, Cluster };
export type { State, Worker, PoolOptions };

interface PoolOptions {
  width: number;
  maxAttempts?: number;
}

enum State {
  NOT_CONNECTED = 'not_connected',
  IDLE = 'idle',
  WORKING = 'working',
  TERMINATED = 'terminated',
}

interface Worker {
  instance: Instance;
  client?: jayson.HttpClient;
  state: State;
}
class TaskCoordinator<T> {
  private c: CloudInterface;
  private workers: Worker[] = [];
  private poolIsReady: boolean = false;

  constructor(c: CloudInterface) {
    this.c = c;
  }

  async connectToWorkers(options: PoolOptions) {
    let instances = await this.prepareWorkerPool(options);

    instances.forEach((i) => {
      const client = jayson.Client.http({
        host: i.ip,
        port: 3000,
      });
      this.workers.push({
        instance: i,
        client: client,
        state: State.NOT_CONNECTED,
      });
    });

    logger.info('Trying to establish connection to worker software..');

    let prev = Date.now();
    let res = await Promise.allSettled(
      this.workers.map((w) =>
        this.establishClientConnection(w, options.maxAttempts)
      )
    );
    // TODO: fall back workers
    let ready = res.filter((r) => r.status == 'fulfilled').length;
    if (ready == this.workers.length) {
      logger.info(
        `Connected to ${ready}/${this.workers.length}, took ${
          (Date.now() - prev) / 1000
        }s`
      );
    } else {
      logger.error(
        `Only connected to ${ready}/${this.workers.length} instances. Shutting down remaining instances`
      );
      await this.c.terminateInstance(instances);
      throw Error(
        'Encountered an error when trying to establish connection to worker instances.'
      );
    }
  }

  async findIdleWorker() {
    logger.info(`Looking for idle worker to execute task`);
    let worker: Worker | undefined = undefined;
    do {
      worker = this.workers.find((w) => w.state == State.IDLE);
    } while (worker === undefined);
    logger.info(`Found idle worker <${worker.instance.id}>`);

    return worker;
  }

  async executeOnWorker(w: Worker, method: string, ...args: T[]) {
    if (w.state !== State.IDLE) throw Error("Worker isn't ready");
    logger.info(
      `Executing method <${method}> on worker <${w.instance.id}> with payload <${args}>, entering <${State.WORKING}> state`
    );
    w.state = State.WORKING;
    let res = await w.client!.request(method, args);
    w.state = State.IDLE;
    logger.info(
      `Worker <${w.instance.id}> returned with result <${res.result}>, is now in state <${w.state}>`
    );
    return res.result as T;
  }

  private async prepareWorkerPool(options: PoolOptions): Promise<Instance[]> {
    let instances = await this.c.createInstance(options.width);
    while (!this.poolIsReady) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.checkReadiness(instances);
    }
    return await this.c.listAll(instances, 'running');
  }

  private async checkReadiness(instances: Instance[]) {
    // i couldnt figure out an more optimal way of checking if all instances are ready
    let instanceData = await this.c.listAll(instances, 'running');
    if (instanceData.length == instances.length) {
      this.poolIsReady = true;
    }
  }

  private async establishClientConnection(
    w: Worker,
    maxAttempts: number = 200
  ): Promise<Worker> {
    let attempts = 0;
    let interval = 1000;

    let c = Math.floor(Math.random() * 100);
    const executePoll = async (
      resolve: (w: Worker) => void,
      reject: (err: Error) => void | Error
    ) => {
      let res = null;
      try {
        res = await w.client!.request('echo', [c]);
      } catch (error) {}
      attempts++;
      if (res && res.result[0] == c) {
        w.state = State.IDLE;
        logger.info(
          `Connected to <${w.instance.ip}>:<${w.instance.id}> with status <${w.state}>`
        );
        return resolve(w);
      } else if (maxAttempts && attempts === maxAttempts) {
        return reject(new Error(`Exceeded max attempts`));
      } else {
        setTimeout(executePoll, interval, resolve, reject);
      }
    };
    return new Promise(executePoll);
  }

  async terminateIdleWorkers() {
    await this.c.terminateInstance(
      this.workers
        .filter((w) => w.state == State.IDLE)
        .map((i) => {
          i.state = State.TERMINATED;
          logger.warn(`Terminating idle worker <${i.instance.id}>`);
          return i.instance;
        })
    );
  }

  async cleanUp() {
    await this.c.terminateInstance(this.workers.map((w) => w.instance));
  }
}

class Cluster<T> {}

class TaskStack<T> extends Array<T> {
  private f: (xs: T[], n: number) => T[];
  private r: (xs: T[], n: number) => Promise<T[]>;

  result: T[] | undefined;

  private isIdle: boolean = false;

  constructor(
    f: (xs: T[]) => T[],
    r: (xs: T[]) => Promise<T[]>,
    isIdle: boolean = false
  ) {
    super();
    this.f = f;
    this.r = r;
    this.isIdle = isIdle;
    this.result = undefined;
  }

  prepare(...items: T[]) {
    this.idle();
    this.push(...items);
  }

  private async filterAndReduce() {
    if (!this.isIdle) {
      let n = this.length;
      let ys = this.f(this, n).slice();
      if (ys != undefined) {
        for (let y of ys) {
          let i = this.indexOf(y);
          if (i != -1) {
            this.splice(i, 1);
          }
        }
        let newTasks = await this.r(ys, n);
        if (ys.length < newTasks.length)
          throw Error('Adding more tasks than reducing');
        if (super.push(...newTasks) > 1) {
          await this.filterAndReduce();
        }
        if (this.length <= 1) this.result = this;
      }
    }
  }

  idle() {
    this.isIdle = true;
  }

  async work(): Promise<T> {
    this.isIdle = false;
    await this.filterAndReduce();
    return this.result![0];
  }
}

type ResponseData = {
  success: boolean;
  data: string;
};
