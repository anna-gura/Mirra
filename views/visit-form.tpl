<!-- Booking somebody in.

     Four lines, and three of them are already filled by the time the
     screen opens: the day and the slot came from the plus that was
     pressed, and the client comes with it when the booking started
     from their card. On the commonest path there is one thing left to
     do, and it is the button at the bottom. -->
<section class="view visit" data-view="visit-form" aria-label="Запис">

  <div class="cs-top">
    <button class="back" type="button" data-back>
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

  <div class="cs-body" data-scroll>
    <div class="cs-inner">
      <h2 class="cs-title" data-visit-title>Новий запис</h2>

      <!-- The day on the left because it is the wider fact, the slot
           on the right because it is the one more often changed. Both
           lead back to the calendar rather than opening a picker of
           their own: there is one place in Mirra where time is chosen,
           and it is the one with the day already drawn in it. -->
      <div class="vf-when">
        <button class="vf-when-part vf-date" type="button" data-visit-date>
          <span class="vf-when-value" data-visit-day></span>
          <span class="vf-when-hint">змінити дату</span>
        </button>
        <button class="vf-when-part vf-slot" type="button" data-visit-slot>
          <span class="vf-when-value" data-visit-time></span>
          <span class="vf-when-hint">змінити час</span>
        </button>
      </div>

      <p class="vf-warn" data-visit-warn hidden></p>

      <div class="vf-who" data-visit-who></div>

      <label class="field">
        <span class="field-label">Коментар</span>
        <input class="field-input" type="text" data-visit-comment
               autocomplete="off" maxlength="200" placeholder="коротко про візит">
        <!-- One text node on purpose. The translator walks text nodes
             one by one, so a <b> in the middle of a sentence splits it
             into three pieces, none of which matches anything in the
             dictionary — and the line silently stays Ukrainian. -->
        <span class="cs-note">Хештеги можна писати просто в тексті: #тег</span>
      </label>

      <div class="vf-tags" data-visit-tags></div>

      <button class="action action-open" type="button" data-visit-save>
        <span class="action-name" data-visit-save-name>Записати</span>
        <span class="action-hint" data-visit-save-hint>У ваш календар і на телефон</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>

      <button class="action cs-second vf-drop" type="button" data-visit-delete hidden>
        <span class="action-name">Скасувати запис</span>
        <span class="action-hint">Прибрати його з календаря</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>
    </div>
  </div>

</section>
