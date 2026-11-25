import argon2 from 'argon2';

export interface PasswordHasherOptions {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

/** Argon2id password hashing. Hashes are self-describing (PHC string), so parameters can be raised later. */
export class PasswordHasher {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly opts: PasswordHasherOptions) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, ...this.opts });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, { ...this.opts });
  }

  /** Spends the same time as a real check, so unknown e-mails cannot be detected by timing. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-only');
    await this.verify(await this.dummyHash, password);
  }
}
