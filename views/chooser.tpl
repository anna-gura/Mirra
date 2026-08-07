<!-- Shown on the first visit only. Once a spreadsheet is recorded in
     settings this screen is reached deliberately, not passed through. -->
<section class="view chooser" data-view="chooser" aria-label="Вибір таблиці">

  <div class="ch-top">
    <button class="back" type="button" data-open-hub>
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

  <div class="ch-body">
    <div class="ch-inner">
      <h2 class="ch-title">З чого почнемо?</h2>

      <button class="action action-open" type="button" data-open-existing>
        <span class="action-name">Відкрити наявну таблицю</span>
        <span class="action-hint">Виберете її зі свого Google Диска</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>

      <div class="ch-or"><span>або</span></div>

      <div class="ch-new">
        <label class="field">
          <span class="field-label">Назва нової таблиці</span>
          <input class="field-input" type="text" data-new-title
                 placeholder="Наприклад: Клієнти" autofocus
                 autocomplete="off" spellcheck="false" maxlength="80">
          <span class="field-error" data-title-error hidden>Впишіть назву таблиці</span>
        </label>

        <button class="action action-create" type="button" data-create-sheet>
          <span class="action-name">Створити нову</span>
          <span class="action-hint">З'явиться в теці Mirra з готовими стовпцями</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Signing out lives on the hub alone. A way out repeated on every
       screen is one more thing to press by mistake, and it is not
       something anybody does often enough to need it close at hand. -->
  <div class="ch-foot"></div>

</section>
