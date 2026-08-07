/**
 * English.
 *
 * Keyed by the Ukrainian original rather than by an identifier. A
 * missing entry therefore leaves the Ukrainian sentence on screen —
 * wrong, but readable, which is the difference between a bug and a
 * blank interface full of dotted.key.names.
 *
 * This dictionary carries a second job: it is what every other language
 * falls back to. Somebody reading a Korean interface has a far better
 * chance with an English sentence than a Ukrainian one, so a gap here
 * ends the chain for everyone.
 *
 * {} marks a value the code substitutes. Their order is fixed by the
 * code, so a sentence that reads awkwardly in English has to be
 * rephrased around them rather than reordered.
 */
/**
 * How English counts, keyed by the Ukrainian singular.
 *
 * Ukrainian has three forms and English two, so the rule cannot be
 * shared — each language answers for itself.
 */
export const plurals = {
  "клієнт": n => (n === 1 ? "client" : "clients"),
  "рік":    n => (n === 1 ? "year" : "years"),
  "запис":  n => (n === 1 ? "record" : "records"),
  "день":   n => (n === 1 ? "day" : "days"),
};

export const dictionary = {
  /* ---------------- cover ---------------- */
  "Увійти через Google": "Sign in with Google",
  "Хочу знати більше": "Tell me more",
  "Ваші записи про клієнтів живуть у зошиті, у нотатках телефона або в таблиці, яку незручно відкривати на ходу?":
    "Are your client records in a notebook, in your phone's notes, or in a spreadsheet that is awkward to open on the move?",
  "Mirra показує їх зручно — з якого б пристрою ви не зайшли. Записи при цьому залишаються у вашій Google Таблиці.":
    "Mirra shows them properly, whichever device you open it on. The records stay in your own Google Sheet.",
  "Навіщо вам Mirra": "Why Mirra",
  "Хвилинку…": "One moment…",

  /* ---------------- hub ---------------- */
  "Головна": "Home",
  "Клієнти": "Clients",
  "Ваша база записів": "Your client records",
  "Календар": "Calendar",
  "Аналітика": "Analytics",
  "Скоро": "Soon",
  "Інша таблиця": "Another sheet",
  "Інша": "Other",
  "Вибрати іншу таблицю": "Choose another sheet",
  "Mirra зараз в активній розробці. З часом можливостей стане більше.":
    "Mirra is under active development. More will come with time.",
  "Вийти": "Sign out",
  "Про Mirra": "About Mirra",
  "Змінити тему": "Change theme",
  "Змінити мову": "Change language",

  /* ---------------- choosing a sheet ---------------- */
  "Вибір таблиці": "Choosing a sheet",
  "Виберіть таблицю": "Choose a sheet",
  "З чого почнемо?": "Where shall we start?",
  "Відкрити наявну таблицю": "Open an existing sheet",
  "Виберете її зі свого Google Диска": "You will pick it from your Google Drive",
  "або": "or",
  "Назва нової таблиці": "Name for the new sheet",
  "Наприклад: Клієнти": "For example: Clients",
  "Впишіть назву таблиці": "Please name the sheet",
  "Створити нову": "Create a new one",
  "З'явиться в теці Mirra з готовими стовпцями": "It will appear in your Mirra folder, ready to use",
  "Таблицю створено в теці Mirra на вашому Диску.": "The sheet has been created in your Mirra folder on Drive.",

  /* ---------------- client list ---------------- */
  "Назад": "Back",
  "Оновити": "Refresh",
  "+ Додати": "+ Add",
  "Додати": "Add",
  "Ім'я, телефон або #тег": "Name, phone or #tag",
  "Пошук клієнтів": "Search clients",
  "Очистити пошук": "Clear search",
  "клієнт": "client",
  "клієнти": "clients",
  "клієнтів": "clients",
  "з": "of",
  "{} з {}": "{} of {}",
  "{} {}": "{} {}",
  "Тут поки що порожньо. Додайте першого клієнта.": "Nothing here yet. Add your first client.",
  "Нікого не знайдено. Спробуйте інше ім'я або номер.": "Nobody found. Try another name or number.",
  "… ще {}": "… {} more",
  "Показати решту теґів: ще {}": "Show the remaining tags: {} more",
  "Сьогодні день народження": "Birthday today",

  /* ---------------- client card ---------------- */
  "Клієнт": "Client",
  "Подзвонити": "Call",
  "Написати": "Message",
  "Маршрут": "Route",
  "скоро": "soon",
  "Ці дії з'являться згодом": "These will come later",
  "Телефон не вказано": "No phone number",
  "Соцмережі": "Socials",
  "Месенджери": "Messengers",
  "Пов'язані люди": "Related people",
  "Не вказано": "Not given",
  "Тут поки що порожньо.": "Nothing here yet.",
  "Нотатки": "Notes",
  "Більше нічого не записано.": "Nothing else recorded.",
  "Додатково": "More",
  "Згорнути": "Less",
  "Редагувати": "Edit",
  "Видалити": "Delete",
  "День народження": "Birthday",
  "Останній візит": "Last visit",
  "автоматизація згодом": "automation coming",
  "зв'язок": "link",
  "рік": "year",
  "роки": "years",
  "років": "years",

  /* birthdays */
  "🎂 Сьогодні день народження 🎂": "🎂 Birthday today 🎂",
  "🎂 День народження завтра": "🎂 Birthday tomorrow",
  "🎂 День народження післязавтра": "🎂 Birthday the day after tomorrow",
  "🎂 День народження за {} {}": "🎂 Birthday in {} {}",

  /* ---------------- client form ---------------- */
  "Редагування клієнта": "Editing a client",
  "Новий клієнт": "New client",
  "Скасувати": "Cancel",
  "← Скасувати": "← Cancel",
  "Зберегти": "Save",
  "Ім'я": "Name",
  "Прізвище": "Surname",
  "Телефон": "Phone",
  "Зв'язки": "Links",
  "+ Додати мережу": "+ Add a network",
  "+ Додати месенджер": "+ Add a messenger",
  "+ Пов'язати з клієнтом": "+ Link to a client",
  "@нік": "@handle",
  "Прибрати": "Remove",
  "Прибрати зв'язок": "Remove link",
  "Вибрати людину": "Choose a person",
  "Будь-що про клієнта. Слово з #  стане теґом, за яким можна шукати.":
    "Anything about this client. A word starting with # becomes a searchable tag.",
  "Впишіть ім'я або прізвище, щоб зберегти.": "Enter a name or surname to save.",
  "Клієнта додано.": "Client added.",
  "Зміни збережено.": "Changes saved.",
  "Клієнта видалено.": "Client deleted.",
  "Збереження скасовано.": "Saving cancelled.",
  "Нічого не збережено.": "Nothing was saved.",

  /* ---------------- date picker ---------------- */
  "Вибір дати": "Choose a date",
  "Сьогодні": "Today",
  "Очистити": "Clear",
  "Без року": "No year",
  "Попередній місяць": "Previous month",
  "Наступний місяць": "Next month",
  "Місяць": "Month",
  "Рік": "Year",

  /* ---------------- dropdowns ---------------- */
  "Вибір": "Choose",
  "Соцмережа": "Social network",
  "Месенджер": "Messenger",
  "Кого пов'язати": "Who to link",
  "Ким доводиться": "How they are related",

  /* ---------------- people picker ---------------- */
  "Кого пов'язати?": "Who shall we link?",
  "Ім'я або прізвище": "Name or surname",
  "Пошук серед клієнтів": "Search your clients",
  "родич пов'язаного": "related to a link",
  "той самий рід": "same surname",
  "Нікого не знайдено.": "Nobody found.",
  "Усі інші клієнти вже пов'язані з цим.": "Every other client is already linked to this one.",
  "Поки що немає інших клієнтів, з ким можна пов'язати.": "There is nobody else to link to yet.",

  /* ---------------- relationship roles ---------------- */
  "мама": "mother",
  "батько": "father",
  "дитина": "child",
  "подружжя": "spouse",
  "партнер": "partner",
  "брат/сестра": "sibling",
  "опікун": "guardian",
  "інше": "other",
  "Ким {} доводиться цій людині?": "How is {} related to this person?",
  "Зараз у картці «{}» записано «{}». Відповідь замінить її.":
    "The card for {} currently says {}. Your answer will replace it.",
  "У картці «{}»: {}.": "On {}'s card: {}.",
  "Оновлено пов'язані картки: {}.": "Related cards updated: {}.",
  "«{}» тепер {}": "{} is now {}",
  "додано зв'язок: «{}» — {}": "link added: {} — {}",
  "зв'язок з «{}» прибрано": "link with {} removed",
  "{} не знайдено в таблиці.": "{} was not found in the sheet.",
  "Цього клієнта": "This client",
  "Клієнта збережено, але пов'язані картки оновити не вдалося.":
    "The client was saved, but the related cards could not be updated.",

  /* ---------------- dialogs ---------------- */
  "Так": "Yes",
  "Видалити клієнта?": "Delete this client?",
  "Запис буде видалено з таблиці. Цю дію не можна скасувати.":
    "The record will be removed from the sheet. This cannot be undone.",
  "Таблиця в кошику": "The sheet is in the bin",
  "Ви перемістили її в кошик на Google Диску. Google видалить її остаточно приблизно за 30 днів.":
    "You moved it to the bin on Google Drive. Google will delete it for good in about 30 days.",
  "Відновити": "Restore",
  "Таблицю відновлено з кошика.": "The sheet has been restored from the bin.",

  /* schema */
  "Немає потрібного стовпця": "A column is missing",
  "Немає потрібних стовпців": "Some columns are missing",
  "У вашій таблиці немає такого стовпця, тож ці дані нікуди записати. Додати його в кінець таблиці? Наявні стовпці залишаться на місці. Якщо відмовитись, зміни не збережуться.":
    "Your sheet has no such column, so this has nowhere to go. Add it at the end of the sheet? Existing columns stay where they are. If you decline, nothing will be saved.",
  "Додати стовпець": "Add the column",
  "Нічого не змінювати": "Change nothing",
  "Оновити таблицю до версії {}?": "Update the sheet to version {}?",
  "Нові стовпці: {}": "New columns: {}",
  "Наявні стовпці й дані залишаться на місці — нове додається в кінець таблиці. Без цього нові можливості не працюватимуть.":
    "Existing columns and data stay where they are — anything new is added at the end. Without this, the newer features will not work.",
  "Не зараз": "Not now",
  "Таблицю оновлено.": "The sheet has been updated.",
  "Технічні позначки пошкоджено": "Technical markers are damaged",
  "{} {} без правильної позначки": "{} {} without a valid marker",
  "Стовпець ID містить службові позначки, за якими Mirra впізнає клієнтів у зв'язках між ними. Схоже, їх змінили або видалили поза Mirra. Відновити? Інші дані не зміняться, але зв'язки на пошкоджені записи доведеться створити заново.":
    "The ID column holds the markers Mirra uses to recognise clients in links between them. It looks as though they were changed or deleted outside Mirra. Restore them? Nothing else changes, but links pointing at the damaged rows will have to be made again.",
  "Не чіпати": "Leave it alone",
  "Технічні позначки відновлено.": "The technical markers have been restored.",
  "запис": "record",
  "записи": "records",
  "записів": "records",

  /* ---------------- installing ---------------- */
  "Додати на головний екран": "Add to home screen",
  "Mirra як застосунок": "Mirra as an app",
  "Відкриватиметься з головного екрана — без адресного рядка й вкладок.":
    "It will open from your home screen, with no address bar and no tabs.",
  "Додати на екран «Домівка»": "Add to Home Screen",
  "Додати на головний екран Android": "Add to the home screen",
  "Встановити на комп'ютер": "Install on this computer",
  "Додати в Dock": "Add to the Dock",
  "Додати Mirra на пристрій": "Add Mirra to this device",
  "Натисніть <b>Поділитися</b> на панелі браузера": "Tap <b>Share</b> in the browser bar",
  "Виберіть <b>На екран «Домівка»</b>": "Choose <b>Add to Home Screen</b>",
  "Натисніть <b>Додати</b>": "Tap <b>Add</b>",
  "Відкрийте меню браузера <b>⋮</b>": "Open the browser menu <b>⋮</b>",
  "Виберіть <b>Встановити застосунок</b>": "Choose <b>Install app</b>",
  "Підтвердіть": "Confirm",
  "Натисніть значок встановлення в адресному рядку": "Click the install icon in the address bar",
  "Або меню <b>⋮</b> → <b>Транслювати, зберегти й поділитися</b>":
    "Or the menu <b>⋮</b> → <b>Cast, save and share</b>",
  "Виберіть <b>Встановити Mirra</b>": "Choose <b>Install Mirra</b>",
  "У меню Safari відкрийте <b>Файл</b>": "In the Safari menu open <b>File</b>",
  "Виберіть <b>Додати в Dock…</b>": "Choose <b>Add to Dock…</b>",
  "Відкрийте меню браузера": "Open your browser's menu",
  "Знайдіть <b>Встановити</b> або <b>Додати на головний екран</b>":
    "Look for <b>Install</b> or <b>Add to home screen</b>",
  "Закрити": "Close",
  "Не пропонувати тут": "Do not offer here",

  /* ---------------- odds and ends ---------------- */
  "Головна сторінка": "Home",
  "Дії": "Actions",
  "Заплановані дії": "Planned actions",
  "Зрозуміло": "Got it",
  "Що це таке": "What this is",
  "Як це працює": "How it works",
  "таблиця": "sheet",
  "цей клієнт": "this client",
  "Стовпець {}": "Column {}",
  "Увімкнути світлу тему": "Switch to the light theme",
  "Увімкнути темну тему": "Switch to the dark theme",

  /* Written into the sheet, so it follows the sheet's language rather
     than the interface — see ClientSchema.languageOf. */
  "Службовий стовпець Mirra — не редагуйте вручну":
    "Mirra's own column — please do not edit by hand",

  /* ---------------- errors ---------------- */
  "Доступ не надано. Щоб працювати з таблицею, потрібен дозвіл на вибраний файл.":
    "Access was not granted. Mirra needs permission for the file you choose.",
  "Застосунок не налаштовано. Заповніть js/config.js.":
    "The app is not configured. Fill in js/config.js.",
  "Не вдалося завантажити Google. Перевірте з'єднання.":
    "Google could not be loaded. Check your connection.",
  "Не вдалося прочитати таблицю. Спробуйте ще раз.":
    "The sheet could not be read. Please try again.",
  "Не вдалося увійти. Перевірте з'єднання і спробуйте ще раз.":
    "Signing in failed. Check your connection and try again.",
  "Немає доступу до цієї таблиці. Виберіть її через кнопку ще раз.":
    "No access to this sheet. Please choose it again with the button.",
  "Щось пішло не так. Спробуйте ще раз.": "Something went wrong. Please try again.",
  "Не вдалося зв'язатися з Google. Спробуйте ще раз.": "Could not reach Google. Please try again.",
  "Немає доступу до цього файлу. Виберіть його ще раз.":
    "No access to this file. Please choose it again.",
  "Забагато запитів поспіль. Зачекайте хвилину й спробуйте знову.":
    "Too many requests in a row. Wait a minute and try again.",
  "Браузер заблокував вікно Google. Дозвольте спливні вікна для цього сайту й спробуйте ще раз.":
    "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "Сеанс завершився. Увійдіть ще раз.": "Your session has ended. Please sign in again.",
  "Спочатку відкрийте картку клієнта.": "Open a client's card first.",
  "Спершу відкрийте таблицю клієнтів.": "Open your client sheet first.",
  "Форма не завантажилась. Спробуйте оновити сторінку.":
    "The form did not load. Try refreshing the page.",
  "Форма не готова. Спробуйте оновити сторінку.":
    "The form is not ready. Try refreshing the page.",
  "Таблиця не відкрита. Спробуйте оновити сторінку.":
    "No sheet is open. Try refreshing the page.",
  "Завантаження": "Loading",
};
