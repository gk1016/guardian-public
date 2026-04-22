FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma seed support: schema, seed scripts, client, and bcryptjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Mammoth + all transitive deps for seed docx extraction
COPY --from=builder /app/node_modules/mammoth ./node_modules/mammoth
COPY --from=builder /app/node_modules/underscore ./node_modules/underscore
COPY --from=builder /app/node_modules/jszip ./node_modules/jszip
COPY --from=builder /app/node_modules/xmlbuilder ./node_modules/xmlbuilder
COPY --from=builder /app/node_modules/@xmldom ./node_modules/@xmldom
COPY --from=builder /app/node_modules/bluebird ./node_modules/bluebird
COPY --from=builder /app/node_modules/dingbat-to-unicode ./node_modules/dingbat-to-unicode
COPY --from=builder /app/node_modules/lop ./node_modules/lop
COPY --from=builder /app/node_modules/duck ./node_modules/duck
COPY --from=builder /app/node_modules/option ./node_modules/option
COPY --from=builder /app/node_modules/pako ./node_modules/pako
COPY --from=builder /app/node_modules/lie ./node_modules/lie
COPY --from=builder /app/node_modules/immediate ./node_modules/immediate
COPY --from=builder /app/node_modules/readable-stream ./node_modules/readable-stream
COPY --from=builder /app/node_modules/inherits ./node_modules/inherits
COPY --from=builder /app/node_modules/isarray ./node_modules/isarray
COPY --from=builder /app/node_modules/safe-buffer ./node_modules/safe-buffer
COPY --from=builder /app/node_modules/string_decoder ./node_modules/string_decoder
COPY --from=builder /app/node_modules/core-util-is ./node_modules/core-util-is
COPY --from=builder /app/node_modules/process-nextick-args ./node_modules/process-nextick-args
COPY --from=builder /app/node_modules/util-deprecate ./node_modules/util-deprecate
COPY --from=builder /app/node_modules/setimmediate ./node_modules/setimmediate
COPY --from=builder /app/node_modules/base64-js ./node_modules/base64-js
COPY --from=builder /app/node_modules/path-is-absolute ./node_modules/path-is-absolute
COPY --from=builder /app/node_modules/argparse ./node_modules/argparse

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --spider -q http://localhost:3000 || exit 1

CMD ["node", "server.js"]
