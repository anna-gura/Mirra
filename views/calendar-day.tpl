<!-- One day, as a list of cards rather than a ruled timetable.

     There is no column of hours down the side on purpose. On a phone
     it costs a fifth of the width to say what every card already
     says, and it forces somebody to read a position when they could
     read a time. What it buys — a visit twice as long looking twice
     as tall — is worth less than the room it takes. -->
<section class="view calday" data-view="calendar-day" aria-label="Календар">

  <div class="cs-top">
    <!-- One screen back, whichever that was. The arrow is a promise
         about where somebody came from, not a shortcut chosen for
         them. -->
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
    <button class="cday-step" type="button" data-day-prev aria-label="Попередній день">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
    </button>

    <div class="cday-when">
      <h2 class="cday-date" data-day-title>Календар</h2>
      <p class="cday-count" data-day-count></p>
    </div>

    <button class="cday-step" type="button" data-day-next aria-label="Наступний день">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5 16 12l-6.5 7"/></svg>
    </button>
  </div>

  <div class="cday-tools">
    <button class="cday-today" type="button" data-day-today>Сьогодні</button>
    <button class="cday-gear" type="button" data-calendar-settings aria-label="Налаштування календаря">
      <!-- Eight teeth drawn as one outline rather than a circle with
           spokes around it: the spokes read as a sun, and a sun is
           not what anybody is looking for when they want settings. -->
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.39 2.84 L13.61 2.84 L13.20 5.20 L15.96 6.35 L17.33 4.38 L19.62 6.67 L17.65 8.04 L18.80 10.80 L21.16 10.39 L21.16 13.61 L18.80 13.20 L17.65 15.96 L19.62 17.33 L17.33 19.62 L15.96 17.65 L13.20 18.80 L13.61 21.16 L10.39 21.16 L10.80 18.80 L8.04 17.65 L6.67 19.62 L4.38 17.33 L6.35 15.96 L5.20 13.20 L2.84 13.61 L2.84 10.39 L5.20 10.80 L6.35 8.04 L4.38 6.67 L6.67 4.38 L8.04 6.35 L10.80 5.20 Z"/>
        <circle cx="12" cy="12" r="3.4"/>
      </svg>
    </button>
  </div>

  <div class="cday-body" data-scroll>
    <div class="cday-list" data-day-cards aria-live="polite"></div>
  </div>

  <!-- The one place Mirra asks Google again on purpose. Reading the
       calendar costs a request, so it happens when a month is opened
       and when an appointment is confirmed — not on a timer. This is
       for the other case: something changed in Google Calendar while
       Mirra was open, and she is the one who knows it. -->
  <div class="cday-foot">
    <button class="quiet" type="button" data-calendar-reload>Оновити</button>
  </div>

</section>
