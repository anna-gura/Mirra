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
  "візит":  n => (n === 1 ? "visit" : "visits"),
  "номер":  n => (n === 1 ? "number" : "numbers"),
  "значення": n => (n === 1 ? "value" : "values"),
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
  "Ведете записи через ChatGPT? Як робити це безпечно":
    "Keeping your records through ChatGPT? How to do it safely",
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
  "Номер пошкоджено в таблиці — впишіть його знову": "This number was damaged in the sheet — please enter it again",
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
  "Зв'язки з цим клієнтом також буде прибрано з карток: {}.":
    "Links to this client will also be removed from: {}.",
  "Клієнта видалено, але зв'язки з ним в інших картках прибрати не вдалося.":
    "The client was deleted, but their links on other cards could not be removed.",
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
  "Дописати позначки у стовпець ID?": "Fill in the markers in the ID column?",
  "{} {} без позначки": "{} {} without a marker",
  "Стовпець ID у цій таблиці з'явився не з Mirra, тож вона не пише в нього без дозволу. Це службовий стовпець: за ним Mirra впізнає людину у зв'язках між клієнтами, і на решту даних він не впливає — ні на імена, ні на телефони, ні на нотатки. Заповнені клітинки не змінюються, позначки з'являться лише в порожніх.":
    "The ID column in this sheet did not come from Mirra, so Mirra does not write into it without permission. It is a service column: Mirra uses it to recognise a person in links between clients, and it affects nothing else — not names, not phone numbers, not notes. Cells that already hold something are left alone; markers appear only in the empty ones.",
  "Дописати": "Add them",
  "Позначки дописано.": "The markers have been added.",
  "запис": "record",
  "записи": "records",
  "записів": "records",

  /* ---------------- checking the sheet ---------------- */
  "Відновити номери телефонів?": "Restore the phone numbers?",
  "{} {} пошкоджено.": "{} {} with digits missing.",
  "Схоже, таблицю редагували поза Mirra, і вона прочитала номер як число — так зникає нуль на початку. Ті номери, які Mirra може відновити, вона запише назад. Інші дані не зміняться. Якщо не чіпати, Mirra не нагадає про це наступні 7 днів.":
    "It looks as though the sheet was edited outside Mirra, and it read the number as a figure — which is how a leading zero disappears. The numbers Mirra can recover, it will write back. Nothing else changes. Leave it alone and Mirra will not mention it again for seven days.",
  "Номери відновлено.": "The numbers have been restored.",
  "Не вдалося прочитати: {}.": "Could not be read: {}.",
  "{} — {} і ще {}": "{} — {} and {} more",

  "Частина даних не читається": "Some of the data cannot be read",
  "Схоже, таблицю редагували поза Mirra, і ці значення пошкодилися так, що відновити їх неможливо. Mirra нічого не змінювала й не змінить без вашої згоди.":
    "It looks as though the sheet was edited outside Mirra, and these values were damaged beyond recovery. Mirra has changed nothing, and will change nothing without your say.",
  "Відкрити картку: {}": "Open the card: {}",
  "Відкрити картку": "Open the card",
  "Очистити пошкоджені клітинки": "Empty the damaged cells",
  "Не нагадувати 7 днів": "Do not remind me for 7 days",
  "Закрити": "Close",
  "рядок {}": "row {}",

  "Очистити ці клітинки?": "Empty these cells?",
  "{} {} буде видалено.": "{} {} will be deleted.",
  "Клітинки стануть порожніми, і поля в картці читатимуться як незаповнені. Те, що там написано зараз, Mirra прочитати не може — але ви, можливо, можете. Якщо там є щось зрозуміле вам, спершу перепишіть це собі: скасувати видалення Mirra не вміє.":
    "The cells will be left empty, and the fields on the card will read as unfilled. Mirra cannot make sense of what is in them now — but you may be able to. If any of it means something to you, copy it down first: Mirra cannot undo a deletion.",
  "Не видаляти": "Keep them",
  "Пошкоджені клітинки очищено.": "The damaged cells have been emptied.",
  "Не вдалося очистити клітинки. Спробуйте пізніше.":
    "The cells could not be emptied. Please try again later.",

  /* ---------------- the sheet's appearance ---------------- */
  "Оновити вигляд таблиці?": "Update how the sheet looks?",
  "Зміниться: {}.": "What changes: {}.",
  "кольори рядків": "row colours",
  "закріплений заголовок": "a frozen heading row",
  "порядок стовпців": "the column order",
  "Таблиця читатиметься так, як Mirra робить їх тепер. Стовпці, які ви додали самі, не рухаються. Але якщо десь — в іншому аркуші, у діаграмі, у фільтрі чи в умовному форматуванні — є посилання на конкретну клітинку цієї таблиці, воно може зламатися, бо стовпці Mirra поміняються місцями. Дані не зміняться. Якщо відмовитися, Mirra не спитає знову, доки вигляд не зміниться в новому випуску.":
    "The sheet will read the way Mirra builds them now. Columns you added yourself stay where they are. But if anything — another tab, a chart, a filter, a conditional format — points at a particular cell in this sheet, it may break, because Mirra's own columns will swap places. The data itself does not change. Decline and Mirra will not ask again until the look changes in a later release.",
  "Таблиця читатиметься так, як Mirra робить їх тепер. Дані не зміняться. Якщо відмовитися, Mirra не спитає знову, доки вигляд не зміниться в новому випуску.":
    "The sheet will read the way Mirra builds them now. The data itself does not change. Decline and Mirra will not ask again until the look changes in a later release.",
  "Цю таблицю створили не в Mirra, тож змінюються лише кольори рядків і закріплення заголовка. Ні дані, ні порядок стовпців, ні ваше оформлення не чіпаються, а самі кольори ви можете прибрати в Google Таблицях: Формат → Чергові кольори → Видалити. Якщо відмовитися, Mirra не спитає знову, доки вигляд не зміниться в новому випуску.":
    "This sheet was not made in Mirra, so only the row colours and the frozen heading change. The data, the column order and your own formatting are all left alone, and you can take the colours off again from Google Sheets itself: Format → Alternating colours → Remove. Decline and Mirra will not ask again until the look changes in a later release.",
  "Оновити вигляд": "Update the look",
  "Вигляд таблиці оновлено.": "The sheet's appearance has been updated.",
  "Не вдалося оновити вигляд таблиці.": "The sheet's appearance could not be updated.",

  /* ---------------- instructions for assistants ---------------- */
  /* The notice at the top of ai.md. The rest of that file is in English
     for every language, because it is read by machines; this part is
     addressed to the person, so it is translated like anything else. */
  "Цей файл Мірра написала не для вас, а для штучного інтелекту.":
    "Mirra wrote this file for an AI assistant, not for you.",
  "Він англійською, бо такі інструкції помічники читають найточніше, і описує саме вашу таблицю: її заголовки, формат дат і де шукати файли. Якщо дати помічникові доступ до теки Mirra, він знайде цей файл сам.":
    "It is in English because assistants follow instructions most reliably in English, and it describes your sheet in particular: its headings, its date format, where its files are. Give an assistant access to your Mirra folder and it will find this file by itself.",
  "Не редагуйте його: Мірра перезаписує файл, щойно в таблиці щось змінюється, і ваші правки зникнуть. Що помічник може зробити з вашими записами — і чого не може — описано тут: {}":
    "Do not edit it: Mirra rewrites the file whenever anything about the sheet changes, and your edits would be lost. What an assistant can and cannot do with your records is explained here: {}",
  "Оновлено {} · Мірра {}": "Updated {} · Mirra {}",

  /* ---------------- calendar ---------------- */
  "Записи на візити": "Appointments",
  "Налаштування календаря": "Calendar settings",
  "Mirra створить у вашому Google Календарі окремий календар і бачитиме тільки його. Усе інше у вашому календарі лишиться їй невидимим.":
    "Mirra will make a calendar of its own in your Google Calendar and see only that one. Everything else in your calendar stays invisible to it.",
  "Цей календар створила Mirra. Вона бачить тільки його — решта вашого Google Календаря їй невидима.":
    "Mirra made this calendar. It sees only this one — the rest of your Google Calendar is invisible to it.",
  "Назва календаря": "Calendar name",
  "Так він називатиметься у вашому Google Календарі. Перейменувати його там можна будь-коли — Mirra впізнає його за внутрішнім номером, а не за назвою.":
    "This is what it will be called in your Google Calendar. You can rename it there whenever you like — Mirra knows it by an internal id, not by its name.",
  "Часовий пояс": "Time zone",
  "Записи, які вже створені, залишаться на своєму часі. Пояс визначає, о котрій годині з'являтимуться нові.":
    "Appointments already made stay at their own time. The zone decides what hour new ones land on.",
  "Робочі дні": "Working days",
  "Початок дня": "Day starts",
  "Кінець дня": "Day ends",
  "Поза цими годинами записувати можна — вони просто показані тьмянішими, щоб день читався з першого погляду.":
    "You can still book outside these hours — they are simply shown dimmer, so a day reads at a glance.",
  "Візит триває, хв": "A visit lasts, min",
  "Проміжок, хв": "Gap, min",
  "Проміжок — це час після візиту: прибрати, перевести дух, підготуватися до наступного. Якщо не потрібно — поставте 0.":
    "The gap is the time after a visit: tidying up, catching your breath, getting ready for the next one. Set it to 0 if you don't need it.",
  "Слоти виходитимуть такі: {}…": "The slots come out like this: {}…",
  "За таких налаштувань у дні не вміщається жоден візит.":
    "With these settings not a single visit fits in the day.",
  "Цим буде заповнена форма нового запису. Змінити час конкретного візиту можна буде в ній самій.":
    "This is what a new appointment starts as. The time of any one visit can be changed in the form itself.",
  "Створити календар": "Create the calendar",
  "Зберегти зміни": "Save changes",
  "Для календаря, який уже створено": "For the calendar that already exists",
  "Новий календар у вашому Google Календарі": "A new calendar in your Google Calendar",
  "Створити календар?": "Create a calendar?",
  "Mirra не бачить цього календаря": "Mirra cannot see this calendar",
  "Календаря ще немає": "No calendar yet",
  "Перевірити календар": "Check the calendar",
  "Спитати Google, чи він на місці": "Ask Google whether it is still there",
  "Календаря ще немає — спершу створіть його.": "There is no calendar yet — make one first.",
  "Календаря більше немає в Google — його видалили поза Mirra. Можна створити новий.":
    "The calendar is no longer in Google — it was deleted outside Mirra. You can make a new one.",
  "Календар на місці, але прихований у вашому Google Календарі.":
    "The calendar is there, but hidden in your Google Calendar.",
  "Календар на місці. Чи є він у вашому переліку календарів — Google цього разу не відповів.":
    "The calendar is there. Whether it is on your list of calendars, Google did not answer this time.",
  "Календар на місці — Google його бачить.": "The calendar is there — Google can see it.",
  "Підключено: {}": "Connected: {}",
  "Існує в Google, але не у вашому переліку календарів: {}":
    "Exists in Google, but not on your list of calendars: {}",
  "Прихований у вашому Google Календарі: {}": "Hidden in your Google Calendar: {}",
  "Цього календаря немає у вашому переліку календарів Google — схоже, його прибрали зі списку. Він існує, але ви його не бачите.":
    "This calendar is not on your list of calendars in Google — it looks as though it was removed from the list. It exists, but you cannot see it.",
  "Збережено, але цього календаря немає у вашому переліку календарів Google — там змін не видно.":
    "Saved, but this calendar is not on your list of calendars in Google — the changes are not visible there.",
  "Календар створено, але Google не додав його до вашого переліку календарів — у Google Календарі його не видно.":
    "The calendar has been created, but Google did not add it to your list of calendars — it is not visible in Google Calendar.",
  "Теперішнього календаря немає у вашому переліку календарів Google — зазвичай це означає, що його прибрали зі списку, а не видалили. Новий календар буде видимий, але порожній: записи зі старого в нього не переносяться, а доступ до старого Mirra втратить назавжди.":
    "The present calendar is not on your list of calendars in Google — which usually means it was removed from the list rather than deleted. A new calendar will be visible but empty: the appointments in the old one do not move across, and Mirra will lose access to it for good.",
  "Його видалили або прибрали з вашого Google Календаря поза Mirra, і повернути його Mirra не може. Створити натомість новий? Він буде порожній — записи зі старого в нього не переносяться.":
    "It was deleted or removed from your Google Calendar outside Mirra, and Mirra cannot bring it back. Make a new one instead? It will be empty — appointments from the old one do not move across.",
  "Створити новий": "Make a new one",
  "Такий календар уже є": "There is already a calendar like this",
  "Mirra вже працює з календарем із цією назвою. Якщо ви хотіли змінити його налаштування — їх можна просто зберегти.":
    "Mirra is already working with a calendar of that name. If you meant to change its settings, they can simply be saved.",
  "Зберегти зміни в ньому": "Save the changes to it",
  "Все одно створити новий": "Make a new one anyway",
  "Mirra назавжди втратить доступ до теперішнього календаря: за правилами Google вона бачить лише той календар, який створила сама, і повернутися до попереднього не зможе. Він залишиться у вашому Google Календарі, але Mirra його більше не читатиме, і чи вдасться колись це змінити — поки невідомо.":
    "Mirra will lose access to the present calendar for good: by Google's rules it sees only the calendar it made itself, and it cannot go back to an earlier one. That calendar stays in your Google Calendar, but Mirra will no longer read it — and whether that can ever be changed is not yet known.",
  "Створити": "Create",
  "Mirra бачить лише той календар, який створила сама. Решту вашого Google Календаря вона не читає й читати не може.":
    "Mirra sees only the calendar it made itself. The rest of your Google Calendar it does not read, and cannot.",
  "Mirra бачить лише той календар, який створила сама — решту вашого Google Календаря вона не читає. Попередній календар вона більше не знаходить, тож якщо він десь лишився, записи в ньому там і залишаться.":
    "Mirra sees only the calendar it made itself — the rest of your Google Calendar it does not read. It can no longer find the previous one, so if that still exists somewhere, the appointments in it stay there.",
  "Календар створено.": "The calendar has been created.",
  "Налаштування збережено.": "Your settings have been saved.",
  "Цей календар видалили в Google Календарі поза Mirra. Можна створити новий.":
    "This calendar was deleted in Google Calendar, outside Mirra. You can make a new one.",
  "Виберіть хоча б один робочий день.": "Choose at least one working day.",
  "Без дозволу на календар записи вести не вийде. Усе інше в Mirra працює як раніше.":
    "Without permission for the calendar there is no way to keep appointments. Everything else in Mirra works as before.",

  /* ---------------- the day ---------------- */
  "є вільні години": "has free hours",
  "день заповнений": "day is full",
  "Попередній день": "Previous day",
  "Наступний день": "Next day",
  "записати раніше": "book earlier",
  "записати пізніше": "book later",
  "зараз": "now",
  "Записати": "Book someone",
  "Цей день не робочий": "This day is not a working day",
  "Додати перерву на {} хв": "Add a {}-minute break",
  "хв": "min",
  "{} хв": "{} min",
  "{} год": "{} h",
  "{} год {} хв": "{} h {} min",
  "проміжок {} · до {}": "gap of {} · until {}",
  "{} · замало для звичайного візиту": "{} · shorter than a usual visit",
  "менше звичайного": "shorter than usual",
  "Перерва": "Break",
  "Без імені": "No name",
  "Два записи на один час": "Two appointments at the same time",
  "Вихідний": "Day off",
  "Форма запису — наступний крок. Поки що календар тільки показує день.":
    "The booking form is the next step. For now the calendar only shows the day.",

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

  /* ---------------- duplicates ---------------- */
  "Схоже, такий клієнт уже є": "This client may already be here",
  "Збігається: {}.": "Matches on: {}.",
  "Буде записано: {}.": "Will be saved: {}.",
  "було {}": "was {}",
  "Оновити наявного": "Update the existing client",
  "Нічого нового — усе це вже є в картці.": "Nothing new — the card already has all of this.",
  "Додати до наявного": "Add to the existing client",
  "Все одно створити нового": "Create a new one anyway",
  "Відкрити наявного": "Open the existing client",
  "той самий телефон": "same phone",
  "той самий {}": "same {}",
  "те саме ім'я": "same name",
  "Нотатка": "Note",
  "Зв'язок": "Link",

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
