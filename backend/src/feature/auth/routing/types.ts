
export type TokenPasswordBody = {
  grantType: "password";
  email: string;
  password: string;
};

export type TokenRefreshBody = {
  grantType: "refreshToken";
  refreshToken: string;
};

export type ResetPasswordBody = {
  token: string,
  password: string,
}
