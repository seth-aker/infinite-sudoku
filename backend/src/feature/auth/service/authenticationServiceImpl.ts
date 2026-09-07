import { IUserDTO } from "@/feature/users/datasource/models/user";
import { timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { AuthenticationService } from "./authenticationService";
import { AuthenticationError } from "../errors/authenticationError";
import { UserDataSource } from "@/feature/users/datasource/userDataSource";
import { registerBodySchema } from "../middleware/validation";
import z from "zod/v4";
import { DatabaseError } from "@/core/errors/databaseError";
import { config } from "@/core/config";
import { SignJWT } from "jose";
import { RefreshTokenDataSource } from "../datasource/refreshTokenDataSource";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthorizationError } from "../errors/authorizationError";
import { ResetTokenDataSource } from "../datasource/resetTokenDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";
import { logger } from "@/core/logging/logger";
const SCRYPT_KEYLEN = 64
const SALT_LEN = 16

const DUMMY_SALT = randomBytes(SALT_LEN)
const DUMMY_HASHED = scryptSync('not-a-real-password', DUMMY_SALT, SCRYPT_KEYLEN)
const RESET_TOKEN_MAX_AGE = 1000 * 60 * 15; // 15 minutes
export class AuthenticationServiceImpl implements AuthenticationService {
  static instance: AuthenticationServiceImpl | null = null;
  private userDataSource: UserDataSource;
  private accessTokenDataSource: RefreshTokenDataSource; 
  private resetTokenDataSource: ResetTokenDataSource;
  private textEncoder: TextEncoder;
  private constructor(userDataSource: UserDataSource, accessTokenDataSource: RefreshTokenDataSource, resetTokenDataSource: ResetTokenDataSource) {
    this.userDataSource = userDataSource;
    this.accessTokenDataSource = accessTokenDataSource;
    this.resetTokenDataSource = resetTokenDataSource;
    this.textEncoder = new TextEncoder();
  }
  
  static create(userDataSource: UserDataSource, accessTokenDataSource: RefreshTokenDataSource, resetTokenDataSource: ResetTokenDataSource): AuthenticationServiceImpl {
    if(AuthenticationServiceImpl.instance === null) {
      AuthenticationServiceImpl.instance = new AuthenticationServiceImpl(userDataSource, accessTokenDataSource, resetTokenDataSource);
    }
    return AuthenticationServiceImpl.instance
  }
  async verify(email: string, password: string): Promise<IUserDTO> {
      const res = await this.userDataSource.getUserByEmail(email);
      const salt = res?.salt ? Buffer.from(res.salt, 'hex') : DUMMY_SALT
      const storedPassword = res.password_hash ? Buffer.from(res.password_hash, 'hex'): DUMMY_HASHED
      const hashedPassword = scryptSync(password.normalize(), salt, SCRYPT_KEYLEN)
      const matches = timingSafeEqual(storedPassword, hashedPassword)
      if(!res || !res.salt || !res.password_hash || res.deleted_at || !matches) {
        throw new AuthenticationError("Incorrect Email or Password");
      }
      if(!res.email_verified) {
	throw new AuthorizationError("Email not verified", { type: ErrorType.UNVERIFIED_EMAIL })
    } 
      return {
          id: res.user_id,
	  email: res.email,
          username: res.username,
          role: res.role,
          imageUrl: res.image_url ?? undefined,
          currentPuzzleId: res.current_puzzle_id ?? undefined
      }
  }
  async registerUser(user: z.infer<typeof registerBodySchema>) {
      const {passwordHash, salt} = await this.hashPassword(user.password);
      if(!user.tosAcknowledged) {
	throw new AuthenticationError("Terms of Service must be acknowledged", {type: ErrorType.VALIDATION_FAILED})
      }
      const userId = await this.userDataSource.createUser({
	email: user.email.toLowerCase(),
        username: user.username.toLowerCase(),
        passwordHash,
        salt,
	tosAcknowledged: user.tosAcknowledged,
	role: 'user',
      })

      if(!userId) {
        throw new DatabaseError(`Insert Operation failed`)
      }
      return userId
  }

  async refreshAccessToken(refreshToken: string) {
    const {token: newRefresh, userId } = await this.accessTokenDataSource.rotateRefreshToken(refreshToken);
    const newAccessToken = await this.generateAccessToken(userId);
    return {refreshToken: newRefresh, accessToken: newAccessToken}
  }

  async getNewTokenSet(userId: string) {
    const refreshToken = await this.accessTokenDataSource.create(userId);
    const accessToken = await this.generateAccessToken(userId);
    return {accessToken, refreshToken};
  }
  async clearRefreshToken(token: string) {
    await this.accessTokenDataSource.delete(token);
  }

  async requestPasswordResetToken(email: string) {
    try {
      const user = await this.userDataSource.getUserByEmail(email);
      if(user) {
	const token = await this.resetTokenDataSource.createResetToken(user.user_id);
	// TODO: Send token in email;
      }
    } catch (err) {
      logger.error(err, 'Error occured during password reset request')
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const unusedToken = await this.resetTokenDataSource.consumeToken(token);
    if (!unusedToken) throw new NotFoundError("Invalid token", {type: 'token_invalid'});
    if (unusedToken.createdAt.getTime() + RESET_TOKEN_MAX_AGE < Date.now()) {
      throw new AuthorizationError('Token expired', {type: 'token_expired'});
    }

    const {passwordHash, salt} = await this.hashPassword(newPassword);
    await this.userDataSource.changePassword(unusedToken.userId, passwordHash, salt);
    await this.accessTokenDataSource.invalidateAllForUser(unusedToken.userId);
    return await this.getNewTokenSet(unusedToken.userId);
  }

  private async generateAccessToken(userId: string) {
    const secret =  this.textEncoder.encode(config.jwtSecret);
    const user = await this.userDataSource.getUser(userId);
    const audience = config.audience;
    const issuerUrl = config.issuer;
    return await new SignJWT({
      userId: userId,
      role: user.role
    })
    .setProtectedHeader({alg: 'HS256'})
    .setExpirationTime('15m')
    .setIssuedAt()
    .setIssuer(issuerUrl)
    .setAudience(audience)
    .sign(secret);
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(SALT_LEN);
    const hashedPassword = scryptSync(password.normalize(), salt, SCRYPT_KEYLEN);
    return {passwordHash: hashedPassword.toString('hex'), salt: salt.toString('hex')};
  }
}
