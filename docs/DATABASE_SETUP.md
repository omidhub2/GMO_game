# راه‌اندازی PostgreSQL
## پیش‌نیازها
- PostgreSQL نسخهٔ 15 یا جدیدتر
- Node.js نسخهٔ 20 یا بالاتر
- متغیر `DATABASE_URL` برای اتصال مستقیم Prisma به پایگاه‌داده
تنظیمات در فایل محلی `.env` ریشهٔ پروژه نگهداری می‌شود. مقدار placeholder `DATABASE_URL` را با connection string واقعی PostgreSQL جایگزین کنید؛ سایر متغیرها نیز فقط وقتی قابلیت مربوطه را راه‌اندازی می‌کنید مقداردهی شوند. `.env` محرمانه است و نباید commit یا منتشر شود.

نمونهٔ قالب URL (این مقادیر نمونه‌اند و قابل اتصال نیستند):

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/gmo_arena?sslmode=require"
```

در تولید، URL پایگاه‌داده باید محرمانه و سمت سرور باشد. برای اجرای Prisma Migrate همیشه `DATABASE_URL` مستقیم بدهید. `getPrisma(connectionString)` اتصال صریح PostgreSQL را می‌پذیرد و برای Hyperdrive قابل استفاده است؛ اتصال binding و سازگاری runtime باید در entry point و build/preview Workers جداگانه تأیید شود.

## ساخت دیتابیس و اعمال schema
```powershell
createdb -U postgres gmo_arena
# فایل .env از قبل در ریشهٔ پروژه وجود دارد؛ DATABASE_URL را در همان فایل تنظیم کنید.
npm install
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:status
```

برای توسعهٔ محلی که اجازهٔ ایجاد migration جدید لازم است:

```powershell
npm run db:migrate --name change_description
```

`db:seed` با اجرای مجدد امن است و کاتالوگ نمونه، roleهای بدون انتساب، حساب دفترکل سیستمی، مأموریت، دستاورد، تورنمنت `DRAFT` و رویدادها/بازارهای پیش‌بینی ورزشی نمایشی را اضافه/به‌روزرسانی می‌کند. هیچ کاربر، دارایی/موجودی، پرداخت یا حساب مدیریتی ساخته نمی‌شود. رویدادها و بازارهای پیش‌بینی seed شده نمایشی و غیرفعال‌اند.

## اتصال برنامه
در APIهای Node.js سمت سرور:

```ts
import { getPrisma } from "@/lib/db";

const prisma = getPrisma();
const games = await prisma.game.findMany({ where: { isEnabled: true } });
```

`GET /api/health/db` برای اتصال سروری Node.js، پاسخ `200` در صورت اتصال و `503` در صورت در دسترس نبودن DB می‌دهد و هیچ اطلاعات محرمانه‌ای برنمی‌گرداند.

## اتصال ذخیره‌سازی S3-compatible
برای bucket خصوصی، متغیرهای server-only در `.env` لازم‌اند: `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` و در صورت تفاوت با مقدار پیش‌فرض `assets`، `AWS_S3_BUCKET`. endpoint توسعهٔ `POST /api/storage/upload-url` فقط در محیط غیرتولیدی URL امضاشدهٔ کوتاه‌عمر برای تصاویر JPEG/PNG/WebP/AVIF صادر می‌کند. تا وقتی احراز هویت و کنترل دسترسی مالک فایل به آن اضافه نشده، این endpoint عمداً در production غیرفعال است. هرگز کلیدها را در مرورگر یا `NEXT_PUBLIC_*` قرار ندهید.

## یادداشت‌های امنیت و مالی
- در اولین اجرای Neon در تاریخ ۲۰۲۶-۱-۰۹، migration اولیه موفق شد؛ migration تکمیلی به‌علت افزودن دوبارهٔ foreign key از پیش ساخته‌شده متوقف شد. migration اصلاح شد تا constraintهای موجود را تکرار نکند، migration ناموفق به‌عنوان rolled back ثبت و دوباره اجرا شد؛ هر سه migration اکنون اعمال شده‌اند و seed با موفقیت اجرا شده است. شمارش تأییدی: ۳ بازی، ۲ مأموریت، ۱ achievement، ۱ تورنمنت نمایشی، ۳ رویداد ورزشی، ۳ fixture، ۳ market و ۸ گزینه.
- رمز نشست فقط به‌صورت hash در `sessions.token_hash` نگه‌داری شود.
- برای ثبت/تغییر دفترکل از تراکنش PostgreSQL استفاده کنید. migration دوم، دفترکل را تغییرناپذیر و double-entry balance را با deferred constraint trigger اجباری می‌کند.
- هر ورودی ledger باید مثبت باشد؛ تراز بدهکار/بستانکار در انتهای تراکنش بررسی می‌شود.
- ماندهٔ کیف پول از جمع ledger خوانده می‌شود؛ موجودی cache شده منبع حقیقت نیست.
- جداول `deposits` و `withdrawals` فقط درخواست/وضعیت را نگه می‌دارند؛ هیچ provider پرداخت یا برداشت فعالی پیکربندی نشده است.
- دیتابیس ابری Neon متصل و migrationهای موجود اعمال شده‌اند؛ seed اولیه اجرا و شمار رکوردهای پایه تأیید شده است. از آنجا که credentials دیتابیس در گفتگو افشا شده‌اند، باید فوراً در پنل Neon rotate و `.env` با مقدار جدید به‌روزرسانی شوند.
