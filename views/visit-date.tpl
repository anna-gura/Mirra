<!-- Choosing the day of a booking, and nothing else.

     A screen of its own rather than the month in a special mode. Back
     has to mean one thing, and it can only mean one thing if each
     screen does one job: this one answers "which day", the next one
     answers "which hour", and neither answers for the other. -->
<section class="view calmonth" data-view="visit-date" aria-label="Вибір дати">

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

  <div class="cday-bar">
    <button class="cday-step" type="button" data-vd-prev aria-label="Попередній місяць">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
    </button>

    <div class="cday-when">
      <h2 class="cday-date" data-month-title>Вибір дати</h2>
    </div>

    <button class="cday-step" type="button" data-vd-next aria-label="Наступний місяць">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5 16 12l-6.5 7"/></svg>
    </button>
  </div>

  <div class="cm-body">
    <div class="cm-sheet">
      <p class="cday-pick-for" data-vd-for></p>
      <div class="cm-week" data-month-weekdays aria-hidden="true"></div>
      <div class="cm-grid" data-month-grid></div>
      <p class="cm-key">
        <span class="cm-key-item" data-state="free">є вільні години</span>
        <span class="cm-key-item" data-state="full">день заповнений</span>
      </p>
    </div>
  </div>

</section>
