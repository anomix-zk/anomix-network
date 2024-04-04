import { UserAccountTx } from './user_account_tx';
import { UserPaymentTx } from './user_payment_tx';

export type UserTx = UserAccountTx | UserPaymentTx;
