import { WebappEnvSchema } from '@tracked/shared';

const rawEnv = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_USE_MSW: import.meta.env.VITE_USE_MSW,
};

const result = WebappEnvSchema.safeParse(rawEnv);

export const webappEnv = result.success
  ? result.data
  : {
      VITE_API_BASE_URL: '',
      VITE_USE_MSW: undefined,
    };

if (!result.success && import.meta.env.DEV) {
  console.warn('⚠️ Webapp env validation failed:', result.error.errors);
}
