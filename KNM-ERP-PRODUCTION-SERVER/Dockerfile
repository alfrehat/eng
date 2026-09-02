# Dockerfile
# ملف البناء متعدد المراحل المعزول والآمن لنظام بلدية كفرنجة ERP v4.0

# --- المرحلة الأولى: البناء وتثبيت الاعتماديات الشاملة ---
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# تثبيت متطلبات البناء لبعض حزم node المعتمدة على المترجمات (إن وجدت)
RUN apk add --no-cache python3 make g++ 

# نسخ ملفات الاعتماديات
COPY package*.json ./
RUN npm ci

# --- المرحلة الثانية: بيئة التشغيل الإنتاجية المخففة ---
FROM node:18-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3005

# نسخ ملفات الاعتماديات وتثبيت الحزم الإنتاجية فقط لمنع الثغرات
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# نسخ ملفات خادم التطبيق وقواعد البيانات من بيئة البناء
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

# إنشاء مجلدات للمرفوعات وسجلات التشغيل والتراجع بأمان
RUN mkdir -p uploads logs database

# حظر مستخدم root وتشغيل الحاوية بصلاحيات مستخدم node المعزول لأسباب أمنية
USER node

EXPOSE 3005

# فحص صحة الحاوية لضمان العلاج الذاتي (Self-Healing)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/').then(res => res.status === 200 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
