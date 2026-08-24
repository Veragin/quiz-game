import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TUser } from '../types';

@Injectable()
export class AuthService {
    /** token → user */
    private users = new Map<string, TUser>();
    /** userId → user */
    private usersById = new Map<string, TUser>();

    /** No password -- a name is all it takes to get a session token. */
    login(name: string): TUser {
        const user: TUser = { id: uuidv4(), name, token: uuidv4() };
        this.users.set(user.token, user);
        this.usersById.set(user.id, user);
        return user;
    }

    validateToken(token: string): TUser | null {
        return this.users.get(token) ?? null;
    }

    getUserByToken(token: string): TUser | null {
        return this.users.get(token) ?? null;
    }

    getUserById(id: string): TUser | null {
        return this.usersById.get(id) ?? null;
    }

    getDisplayName(userId: string): string {
        return this.usersById.get(userId)?.name ?? 'Unknown';
    }
}
