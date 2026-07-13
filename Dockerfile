FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json yarn.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN yarn install --frozen-lockfile --non-interactive

COPY . .
RUN yarn build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["yarn", "start"]
