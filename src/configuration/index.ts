export const APP = {
  name: 'myfuel-transaction-processor',
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  tz: process.env.TZ ?? 'Asia/Jakarta'
};

export default () => ({
  app: APP,
  database: {
    url: process.env.DATABASE_URL ?? ''
  },
  redis: {
    url: process.env.REDIS_URL ?? ''
  },
  security: {
    webhookApiKey: process.env.WEBHOOK_API_KEY ?? ''
  }
});
