// EXPO_PUBLIC_* values are inlined at build time, so each must be referenced
// literally. Generate .env.local with `npm run configure`.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Run \`npm run configure\` and restart Expo.`);
  return value;
}

export const config = {
  env: process.env.EXPO_PUBLIC_ENV ?? 'dev',
  userPoolId: required('EXPO_PUBLIC_USER_POOL_ID', process.env.EXPO_PUBLIC_USER_POOL_ID),
  userPoolClientId: required('EXPO_PUBLIC_USER_POOL_CLIENT_ID', process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID),
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
};
