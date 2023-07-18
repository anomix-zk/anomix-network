import { Paycard, Profile } from '@anomix/dao'

export interface UserDTO {
    id: string,
    username: string,
    email: string
    token?: string
    paycard?: Paycard
    profile?: Profile
}

export interface UserRequestSignupBody extends Omit<UserDTO, "id" | "token"> {
    password: string
}

export interface UserRequestSigninBody extends Pick<UserDTO, "email"> {
    password: string
}

export type UserRequestChangeUsernameBody = Pick<UserDTO, "username">

export interface UserRequestGetInfoParams {
    userId: string
}

export type UserResponseChangeAvatar = Pick<Profile, "avatarUrl">

export interface UserRequestTopUpBalanceBody {
    balanceToAdd: number
}

export type UserResponseTopUpBalance = Pick<Paycard, "balance">
