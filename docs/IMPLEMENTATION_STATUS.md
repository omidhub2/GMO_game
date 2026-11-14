# GMO ARENA — نقشهٔ پیاده‌سازی
آخرین به‌روزرسانی: ۲۰۲۶-۱-۰۴
## وضعیت کلی
- فاز فعال: **فاز ۱ — Foundation**
- آخرین گام تکمیل‌شده: پوستهٔ پایهٔ داشبورد فارسی RTL در Next.js، شامل ناوبری اصلی، خانهٔ واکنش‌گرا، کارت‌های وضعیت رقابتی، مسابقات و مأموریت‌ها.
- گام بعدی: نصب وابستگی‌های کامل و اجرای typecheck/test/build؛ سپس ادامهٔ فاز پایه با پیکربندی و بررسی سازگاری Cloudflare.
- این فایل نقطهٔ ادامهٔ دائمی پروژه است؛ در هر مرحله وضعیت و گام بعدی به‌روزرسانی شود.

## نقشهٔ معماری
- رابط کاربری: Next.js App Router، React، TypeScript، Tailwind CSS، طراحی mobile-first با فارسی و RTL؛ آماده برای locale انگلیسی/LTR.
- اجرا/انتشار: Cloudflare Workers از طریق پیکربندی vinext/Wrangler موجود؛ سازگاری باید در build و preview تأیید شود.
- منبع دادهٔ اصلی: PostgreSQL مدیریت‌شده؛ Prisma/adapter فقط پس از تأیید سازگاری runtime؛ عملیات مالی تنها با تراکنش واقعی دیتابیس.
- دامنه‌ها: auth، users، games، tournaments، teams، matches، rankings، wallet/ledger، missions/rewards، referrals، notifications، administration/infrastructure.
- امنیت: ورودی اعتبارسنجی‌شده، دسترسی سمت سرور، اسرار فقط سمت سرور، عدم اعتماد به دادهٔ کلاینت.

## مراحل اجرا
| فاز | محدوده | وضعیت |
|---|---|---|
| ۰ | بررسی پروژه و معماری | انجام‌شده؛ تنظیمات موجود بررسی شد، سازگاری اجرایی هنوز نیازمند build است |
| ۱ | ساختار، UI پایه، RTL، طراحی و اعتبارسنجی محیط | در حال انجام؛ خانهٔ نمایشی آماده، بررسی اجرا مسدود به علت وابستگی‌های نصب‌نشده |
| ۲ | PostgreSQL، مدل داده و احراز هویت | انجام‌نشده |
| ۳ | خانهٔ متصل به داده، کاتالوگ/جزئیات بازی، پروفایل و تنظیمات | انجام‌نشده |
| ۴ | ثبت‌نام مسابقات، براکت، مسابقه و نتایج | انجام‌نشده |
| ۵ | کیف پول سه‌حسابی و دفترکل دوبل تراکنشی | انجام‌نشده |
| ۶ | Elo، رتبه‌بندی، مأموریت، پاداش و ارجاع | انجام‌نشده |
| ۷ | مدیریت، RBAC، ممیزی و پایش زیرساخت | انجام‌نشده |
| ۸ | دسترس‌پذیری، امنیت، آزمون و پرداخت نهایی | انجام‌نشده |
| ۹ | پیکربندی و تأیید انتشار Cloudflare/PostgreSQL | انجام‌نشده |

## ثبت پیشرفت
### ۲۰۲۶-۱-۰۴
- ساختار قبلی بررسی شد؛ پیکربندی Next.js، TypeScript، Vitest، vinext/Wrangler، Prisma/PostgreSQL حاضر بود اما فایل‌های برنامه وجود نداشتند.
- `.env` بدون خواندن یا تغییر محفوظ ماند.
- ساخته شد: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `tests/homepage.test.ts`, `docs/DESIGN_REFERENCES.md`.
- داشبورد خانه: ناوبری پنج‌بخشی فارسی، هویت تیره با accent سبز، خلاصه کیف پول، آمار رقابتی، مسابقات و progress مأموریت؛ mobile-first و RTL.
- داده‌های نمایشگر با برچسب واضح «نمایشی»؛ هیچ عملیات کیف پول یا ثبت‌نام واقعی ادعا نشده است.
- نوع‌آزمایی/تست‌ها اجرا نشدند: وابستگی‌های `vitest` و `lucide-react` در `node_modules` در دسترس نیستند و `npm install` بیش از مهلت محیط قطع شد. typecheck اولیه همچنین خطاهای قدیمی `.next/types` مربوط به مسیرهای ریشهٔ `app/` حذف‌شده/ناموجود نشان می‌دهد؛ خطاهای وابستگی مانع ارزیابی کامل کد جدید شدند.

## محدودیت‌ها و تصمیم‌های باز
- هیچ اتصال واقعی دیتابیس/احراز هویت، مسابقه، پرداخت، کیف پول، دادهٔ پروفایل یا یکپارچه‌سازی بازی هنوز پیاده‌سازی/تأیید نشده است.
- داده‌های خانه نمونه‌اند و نباید به‌عنوان اطلاعات واقعی کاربر استفاده شوند.
- شناسه Hyperdrive در تنظیمات برای محیط واقعی باید پیکربندی شود؛ انتشار تا فراهم‌شدن منابع و اسرار واقعی تأیید نشده است.
- نصب وابستگی‌ها و پاکسازی خروجی typeهای stale در `.next` مانع فعلی اجرای آزمون‌ها است؛ فایل `.env` نباید دستکاری شود.

## به‌روزرسانی ادامهٔ پروژه — ۲۰۲۶-۱-۰۵
### انجام‌شده
- وابستگی‌های از قبل موجود در lockfile نصب/قابل اجرا شدند؛ `.env` دست‌نخورده ماند.
- اسکیمای اولیهٔ PostgreSQL/Prisma ساخته و با `prisma validate` تأیید شد (با `DATABASE_URL` موقت در محیط همان دستور؛ هیچ اتصال/مهاجرتی به سرور واقعی اجرا نشد).
- مهاجرت SQL شامل کاربران/پروفایل، بازی و حساب بازی، مسابقه/شرکت‌کننده/مسابقه‌های دور، سه نوع کیف پول + حساب سیستمی، دفترکل و محدودیت trigger ضدتغییر، مأموریت/پیشرفت، رتبه‌بندی/Elo/history، referral، اعلان و audit log.
- منطق دامنهٔ مستقل اضافه شد: کاتالوگ بازی نمایشی، براکت single-elimination با bye، محاسبه Elo، محاسبهٔ مجموع کیف پول از سه حساب، اعتبارسنجی double-entry و adapter API برای ثبت‌نام Serializable با درگاه مالی الزامی برای مسابقهٔ پولی.
- API نسخه‌دار فهرست و جزئیات بازی، صفحات کاتالوگ/جزئیات و صفحات مسیر مسابقات، کیف پول و حساب ساخته شد؛ صفحات وضعیت غیرفعال/نمایشی را صریح توضیح می‌دهند.
- تنظیمات ESLint flat و هدف TypeScript برای BigInt اصلاح شد؛ typeهای ماندهٔ `.next` از typecheck حذف شدند.
- نتایج نهایی بررسی: `npm test` موفق (۱ تست در ۲ فایل)، `npm run typecheck` موفق، `npm run lint` موفق بدون هشدار، `npm run build` موفق و ۱۰ مسیر خروجی گرفت.

### وضعیت فازها
| فاز | وضعیت تازه |
|---|---|
| ۰ | انجام‌شده؛ build بومی Next.js موفق، سازگاری انتشار Workers هنوز جداگانه باید با vinext/preview بررسی شود |
| ۱ | انجام‌شده برای foundation UI/RTL/layout، باقی: اتصال locale کامل و پیکربندی production environment |
| ۲ | بخشی انجام‌شده: مدل/مهاجرت اولیه؛ احراز هویت، session و repository واقعی باقی است |
| ۳ | بخشی انجام‌شده: کاتالوگ/جزئیات نمایشی؛ خانه، حساب و بازی هنوز به PostgreSQL/auth متصل نیستند |
| ۴ | بخشی انجام‌شده: الگوریتم single-elimination و validation ثبت‌نام با abstraction؛ persistence/برگ واقعی/نتیجه/اعتراض باقی است |
| ۵ | بخشی انجام‌شده: مدل و اعتبارسنجی دفترکل؛ adapter دیتابیس متصل، قفل سطری و عملیات مالی عملیاتی هنوز باقی است؛ هیچ پول واقعی پذیرفته نمی‌شود |
| ۶ | بخشی انجام‌شده: Elo pure calculation؛ رتبه‌های متصل، missions/rewards/referrals عملیاتی باقی‌اند |
| ۷ | انجام‌نشده؛ admin/RBAC/audit workflows/infrastructure telemetry باید کامل شوند |
| ۸ | بخشی انجام‌شده: ۱ آزمون واحد؛ integration/e2e، accessibility/security/performance review باقی است |
| ۹ | انجام‌نشده؛ build معمولی موفق، Cloudflare deploy/preview/PostgreSQL Hyperdrive تولیدی تأیید نشده است |

### مرحلهٔ بعد (اولویت ادامه)
۱. تولید Prisma Client و اضافه‌کردن repository واقعی Edge-compatible از طریق Hyperdrive، سپس health/read endpoints و آزمون integration.
۲. طراحی و پیاده‌سازی auth/session امن (ابتدا روش قابل اجرا و امن، سپس Telegram initData HMAC با server secret).
۳. تکمیل دفترکل و ثبت‌نام پولی فقط با transaction DB، account row locks/idempotency و آزمون PostgreSQL.
۴. آزمون Cloudflare از مسیر `build:vinext` و `preview` و رفع تفاوت‌های runtime، بدون ادعای deploy.

### موانع/محدودیت‌های واقعی
- PostgreSQL واقعی/معتبر `DATABASE_URL`/Hyperdrive و credentials سرویس در دسترس/تأیید نشده‌اند؛ مهاجرت روی دیتابیس اجرا نشده است.
- migration مالی از نظر trigger ضد UPDATE/DELETE immutable است؛ تضمین تعادل postings باید با PostgreSQL deferred constraint trigger یا تابع تراکنشی DB افزوده و در DB واقعی آزمایش شود؛ تا آن موقع ledger را production-ready فرض نکن.
- adapterهای Prisma که در این مرحله تعریف شده‌اند هنوز به generated client و DB وصل نشده‌اند.
- build معمولی Next.js موفق است؛ سازگاری Cloudflare Workers به‌طور مستقل با vinext/preview تأیید نشده؛ Telegram/auth/payment همچنان تأییدنشده هستند.
- داده‌های موجود در صفحه‌های UI demo هستند و برای ثبت‌نام/پاداش/موجودی واقعی کاربرد ندارند.


## ادامهٔ پیاده‌سازی PostgreSQL — ۲۰۲۶-۱-۰۷
### انجام‌شده در این نوبت
- مدل Prisma برای auth session، کاربران/شماره تلفن، external account metadata، ایجادکنندهٔ مسابقه، تیم/اعضا، شرکت‌کنندهٔ انفرادی یا تیمی، ارتباط دقیق match با شرکت‌کننده، reservation کیف پول، deposit/withdrawal، reward، achievement، RBAC، تنظیمات و مصرف زیرساخت تکمیل شد.
- برای missionها slug پایدار اضافه شد؛ migration آن slugهای رکوردهای قبلی را حفظ می‌کند و unique می‌سازد.
- migration تکمیلی `202611060001_complete_platform` با محدودیت مثبت بودن مبلغ‌ها/یک شرکت‌کننده در هر ثبت‌نام، FKهای match، relationهای ranking/referral/notification و deferred DB-level balanced-ledger trigger آماده شد.
- `src/lib/db.ts` برای PrismaPg، singleton در توسعه و گرفتن connection string صریح (برای integration آتی Hyperdrive) آماده شد.
- seed idempotent برای catalog، roleهای فاقد user assignment، حساب سیستم، missions، achievement و تورنمنت draft نمایشی اضافه شد؛ مبلغ/کاربر/پرداخت واقعی تولید نمی‌کند.
- route `GET /api/health/db` برای Node.js، راهنمای اتصال و migration و فرمان‌های db در npm scripts اضافه شد. `tsx` به devDependencies آمده است.
- Prisma Client ساخته شد؛ `prisma validate` موفق است، `npm run typecheck` و `npm run lint` موفق‌اند و تست‌ها ۱/۱ گذشتند.

### محدودیت‌های اتصال
- `.env` اکنون کلید `DATABASE_URL` را دارد اما مقدار آن placeholder است؛ ابزار `psql`/Docker یا سرویس PostgreSQL محلی در دسترس نیست. بنابراین migration روی دیتابیس واقعی اجرا نشده و seed/health اتصال واقعی آزمایش نشده‌اند.
- برای اتصال واقعی، PostgreSQL را فراهم کنید و مقدار placeholder `DATABASE_URL` را در `.env` با connection string معتبر جایگزین کنید؛ سپس `npm run db:deploy` و `npm run db:seed` اجرا کنید. راهنمای کامل در `docs/DATABASE_SETUP.md` است.
- صفحات کاتالوگ بازی و جزئیات هنوز محتوای نمایشی می‌خوانند؛ APIهای فهرست و جزئیات بازی حالا در صورت پیکربندی `DATABASE_URL` فقط بازی‌های فعال و تعداد تورنمنت‌های غیرنمونه را از PostgreSQL می‌خوانند، در غیر این صورت fallback نمایشی را با `meta.demo=true` علامت می‌زنند. قطع‌شدن دیتابیس پیکربندی‌شده برمی‌گرداند `503` و به دادهٔ نمونه ساکتانه برنمی‌گردد.
- مسیر health موجود Node.js است؛ پیاده‌سازی production روی Cloudflare Workers و دریافت Hyperdrive از context هنوز نیازمند build/preview مستقل و سازگاری adapter در runtime است.
- مبالغ GMO داخلی integer هستند؛ deposit/withdrawal provider پیکربندی نشده، هیچ عملیات مالی واقعی فعال نشده است.

## ادامهٔ کاتالوگ بازی‌ها — ۲۰۲۶-۱-۰۷
### انجام‌شده
- APIهای `GET /api/v1/games` و `GET /api/v1/games/[slug]` به Prisma/PostgreSQL متصل شدند؛ فقط بازی‌های فعال و تورنمنت‌های غیرنمونه در وضعیت‌های قابل نمایش گزارش می‌شوند، جست‌وجوی نام/دسته/پلتفرم و سقف ۱۰۰ نتیجه هم لحاظ شد.
- وقتی دیتابیس پیکربندی نشده، API صریحاً فهرست نمایشی ارائه می‌دهد؛ وقتی تنظیم شده ولی در دسترس نیست، پاسخ `503` بدون fallback به دادهٔ ساختگی داده می‌شود. routeها برای `PrismaPg` به Node.js محدود هستند و فعلاً Cloudflare Edge نیستند.
- نگاشت خلاصهٔ امن بازی از رکورد Prisma و آزمون واحد افزوده شد. پوشش Vitest اکنون تست‌های `src/**/*.test.ts` را هم اجرا می‌کند.
- بررسی نهایی: `npm run test` موفق (۱۴ تست در ۳ فایل)، `npm run typecheck` موفق و `npm run lint` موفق.

### گام بعدی
- همین الگو را به صفحات کاتالوگ/جزئیات بازی و سپس مسابقات تعمیم بده؛ پس از در دسترس بودن PostgreSQL، endpointها را با دیتابیس واقعی integration-test کن. سازگاری Cloudflare نیازمند adapter/runtime جداگانه است.

## دادهٔ پایهٔ پیش‌بینی رویدادهای ورزشی — ۲۰۲۶-۱-۰۸
- `seedSportingPredictions` یک ساختار داده‌محور و قابل توسعه دارد: هر رویداد به fixtureها، هر fixture به market و هر market به optionهایش وصل می‌شود. برای افزودن فوتبال، کشتی، المپیک یا رشته/رقابت جدید، یک مورد به آرایهٔ `events` در `prisma/seed.ts` اضافه کنید؛ `sport`, `competition`, `season`, تاریخ‌ها، `slug` یکتا، fixtureها و گزینه‌های پیش‌بینی را تکمیل کنید.
- seed اکنون سه مجموعهٔ **کاملاً نمایشی** برای جام جهانی فوتبال، رقابت کشتی و المپیک می‌سازد. همهٔ eventها و marketها `isDemo=true` هستند و بازارها `DRAFT` می‌مانند؛ شرکت‌کنندگان، تاریخ‌ها و نتایج این seed رسمی/واقعی نیستند و شرط‌بندی یا پرداختی فعال نمی‌شود.
- عملیات upsert تکرارپذیر است و رکوردهای قبلی را حذف نمی‌کند. رکورد نمایشی قدیمی `demo-2026-world-cup` اگر قبلاً seed شده باشد، خودکار پاک نخواهد شد.
- اسکیمای عمومی `SportingEvent`، `SportingFixture`، `PredictionMarket` و `PredictionOption` و migration `202611070001_sports_predictions` از قبل در پروژه موجود بودند؛ در این مرحله seed گسترش یافت و schema/migration جدیدی لازم نشد.
- تأیید: `prisma validate` با `DATABASE_URL` موقت و صرفاً ساختگی موفق؛ تست‌ها ۱۴/۱۴، `typecheck` و `lint` موفق‌اند. هیچ دیتابیس واقعی متصل یا seed نشده است؛ اجرای `npm run db:seed` نیازمند `DATABASE_URL` معتبر و اجرای migrationهای pending است.
- هنوز API/صفحهٔ نمایش، دریافت برنامه و نتایج از provider ورزشی، تسویهٔ بازارها یا منطق مجاز پیش‌بینی پیاده‌سازی نشده است؛ این تغییر فقط دادهٔ نمونه و آماده‌سازی seed است.
