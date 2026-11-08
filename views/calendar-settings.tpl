<!-- The calendar's own settings, and the screen that creates it in the
     first place. One screen for both, because the questions are the
     same ones: what it is called, which clock it runs on, when the
     working day starts and ends. Making a separate wizard for the
     first time would mean maintaining the same six fields twice. -->
<section class="view calset" data-view="calendar-settings" aria-label="Налаштування календаря">

  <div class="cs-top">
    <!-- Back to wherever this was opened from. Settings reached
         from a Tuesday should return to that Tuesday, not drop
         somebody at the front door of the app. -->
    <button class="back" type="button" data-calendar-back>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
      Назад
    </button>
    <button class="theme lang" type="button" data-lang-toggle aria-label="Змінити мову">
      <span data-lang-label>UA</span>
    </button>
    <button class="theme" type="button" data-theme-toggle aria-label="Змінити тему">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="moon" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>
        <g class="sun">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>
        </g>
      </svg>
    </button>
  </div>

  <div class="cs-body">
    <div class="cs-inner">
      <h2 class="cs-title" data-calendar-title>Календар</h2>
      <p class="cs-state" data-calendar-state></p>
      <p class="cs-lead" data-calendar-lead>Mirra створить у вашому Google Календарі окремий календар і бачитиме тільки його. Усе інше у вашому календарі лишиться їй невидимим.</p>

      <label class="field">
        <span class="field-label">Назва календаря</span>
        <input class="field-input" type="text" data-calendar-name
               autocomplete="off" spellcheck="false" maxlength="80">
        <span class="cs-note">Так він називатиметься у вашому Google Календарі. Перейменувати його там можна будь-коли — Mirra впізнає його за внутрішнім номером, а не за назвою.</span>
      </label>

      <label class="field">
        <span class="field-label">Часовий пояс</span>
        <select class="field-input cs-select" data-calendar-zone></select>
        <span class="cs-note">Записи, які вже створені, залишаться на своєму часі. Пояс визначає, о котрій годині з'являтимуться нові.</span>
      </label>

      <fieldset class="field cs-fieldset">
        <legend class="field-label">Робочі дні</legend>
        <div class="cs-days" data-calendar-days></div>
      </fieldset>

      <div class="cs-pair">
        <label class="field">
          <span class="field-label">Початок дня</span>
          <input class="field-input" type="time" data-calendar-from>
        </label>
        <label class="field">
          <span class="field-label">Кінець дня</span>
          <input class="field-input" type="time" data-calendar-to>
        </label>
      </div>
      <p class="cs-note cs-note-wide">Поза цими годинами записувати можна — вони просто показані тьмянішими, щоб день читався з першого погляду.</p>

      <div class="cs-pair">
        <label class="field">
          <span class="field-label">Візит триває, хв</span>
          <input class="field-input" type="number" data-calendar-duration
                 min="5" max="1440" step="5" inputmode="numeric">
        </label>
        <label class="field">
          <span class="field-label">Проміжок, хв</span>
          <input class="field-input" type="number" data-calendar-gap
                 min="0" max="720" step="5" inputmode="numeric">
        </label>
      </div>
      <p class="cs-note cs-note-wide">Проміжок — це час після візиту: прибрати, перевести дух, підготуватися до наступного. Якщо не потрібно — поставте 0.</p>
      <!-- The two numbers above decide what the day looks like, and
           no wording explains that as well as the result does.
           Recalculated while somebody types. -->
      <p class="cs-note cs-note-wide cs-example" data-calendar-example></p>

      <!-- Two buttons rather than one that changes its mind. The same
           button meaning "create" or "save" depending on what is in
           the settings file is how a save ended up reporting success
           for a calendar that had been deleted an hour earlier: the
           intent was never the person's, it was inferred. -->
      <button class="action action-open" type="button" data-save-calendar>
        <span class="action-name">Зберегти зміни</span>
        <span class="action-hint">Для календаря, який уже створено</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>

      <button class="action action-create cs-second" type="button" data-create-calendar>
        <span class="action-name">Створити календар</span>
        <span class="action-hint">Новий календар у вашому Google Календарі</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>

      <!-- Asks Google both of its questions about the calendar:
           whether it still exists, and whether it is on this
           account's list. It changes nothing. -->
      <button class="action cs-second" type="button" data-check-calendar>
        <span class="action-name">Перевірити календар</span>
        <span class="action-hint">Спитати Google, чи він на місці</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>
    </div>
  </div>

</section>
