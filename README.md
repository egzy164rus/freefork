# 🍴 FreeFork — бесплатный счётчик калорий

Без рекламы и подписок. Оформление — тёмное «Midnight» (линейные SVG-иконки, шрифт Inter внутри проекта). Регистрация **не обязательна**: без входа данные хранятся только в браузере;
если войти (почта+пароль или Google), дневник синхронизируется между устройствами через Supabase.

**PWA:** устанавливается на телефон и компьютер (кнопка «Установить» в профиле, подсказка для iPhone), работает офлайн, предлагает обновление одним нажатием, ярлыки иконки: «Добавить еду», «Холодильник», «Инсайты».

Сайт — **статический** (чистый HTML/CSS/JS, без npm и сборщиков): вся логика (парсер текста, поиск, рецепты,
Open Food Facts) работает прямо в браузере, поэтому его можно разместить на любом бесплатном статическом хостинге
и он работает офлайн как PWA. Проект .NET нужен только как локальный хост для запуска из Visual Studio.

## Чем FreeFork отличается от остальных
| Фишка | Что делает |
|---|---|
| 🗓️ **Гибкая неделя** | Калории считаются на неделю: переели вчера — сегодняшний ориентир мягко ниже (−20%/+25%). Без «красных» цифр. |
| 🧊 **Холодильник → рецепты** | Перечисляете продукты — получаете блюда, порция подгоняется под *оставшиеся* калории и БЖУ дня. |
| 🔬 **Умные инсайты** | Настроение/энергия/сон → связи с питанием. Есть демо-данные. |
| ✨ **Ввод текстом** | «2 яйца и тост, 150 г гречки, стакан молока» → список с граммами и КБЖУ. |
| 🔒 **Приватность** | Вход по желанию, данные видны только владельцу (Row Level Security), экспорт/импорт JSON и CSV. |
| 🌍 **База** | Встроенные ~140 продуктов (ru/en, работают офлайн) + Open Food Facts (штрихкоды). |

## Запуск локально (Visual Studio)
1. Установите [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) и Visual Studio 2022 (workload **ASP.NET and web development**).
2. Откройте `FreeFork.sln` → **F5** (`http://localhost:5098`). Из консоли: `dotnet run --project src/FreeFork`.
Либо просто раздайте папку `src/FreeFork/wwwroot` любым статическим сервером.

## Облако (необязательно)
1. Создайте проект на [supabase.com](https://supabase.com) → SQL Editor → выполните `supabase/schema.sql`.
2. Authentication → URL Configuration: добавьте адрес сайта в **Site URL** и **Redirect URLs**.
3. Project Settings → API: скопируйте **Project URL** и **anon public key** в `src/FreeFork/wwwroot/js/config.js`
   (эти значения публичные, защита — в правилах RLS).
4. Google: Authentication → Providers → Google, затем `google: true` в `config.js`.
Пока `config.js` пустой, кнопок входа на сайте нет.

## Хостинг
Любой статический: GitHub Pages (workflow `.github/workflows/pages.yml` уже есть), Cloudflare Pages, Netlify, Vercel и т. д.
Публикуется содержимое `src/FreeFork/wwwroot`.

## Структура
```
src/FreeFork/wwwroot/
  index.html, manifest.webmanifest, sw.js, icon.svg
  js/engine.js    поиск, разбор текста, рецепты, Open Food Facts (в браузере)
  js/app.js       интерфейс, дневник, синхронизация
  js/cloud.js     Supabase: вход и облачное хранилище
  js/config.js    адрес и публичный ключ Supabase
  js/icons.js     набор SVG-иконок
  icons/, screenshots/   иконки PWA (192/512/maskable/apple-touch) и скриншоты для окна установки
  js/vendor/      supabase-js (локальная копия, без CDN)
  css/design.css  оформление Midnight
  fonts/          шрифт Inter (OFL)
  data/           foods.json, recipes.json   ← генерирует tools/gen_data.py
supabase/schema.sql   таблица user_data + RLS + удаление аккаунта
tools/gen_data.py     правьте продукты/рецепты здесь: python3 tools/gen_data.py
```

> Справочный инструмент, не медицинская рекомендация.
