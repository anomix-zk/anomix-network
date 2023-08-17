export class UserState {
  constructor(
    public accountPk: string,
    public syncedToBlock: number,
    public alias?: string
  ) {}
}
