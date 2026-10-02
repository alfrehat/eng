# Dockerfile
# 🐳 ملف البناء المؤسسي متعدد المراحل لنظام بلدية كفرنجة الجديدة
# v2.0 - Anti-Gravity Enterprise Multi-Stage Container Edition

# --- المرحلة الأولى: بيئة البناء وتجميع الحزم ---
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# --- المرحلة الثانية: بيئة التشغيل الإنتاجية المعزولة ---
FROM node:18-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3005

# نسخ ملفات الحزم وتثبيت الاعتماديات الإنتاجية فقط
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# نسخ ملفات الكود المصدري وقواعد البيانات
COPY --chown=node:node . .

# إنشاء المجلدات التشغيلية وضبط ملكيتها بالكامل لحساب node
RUN mkdir -p uploads logs database && chown -R node:node /usr/src/app

USER node

EXPOSE 3005

# فحص الجاهزية التشغيلية (Healthcheck)
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3005) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
