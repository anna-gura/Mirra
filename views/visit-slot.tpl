<!-- Choosing the hour of a booking, and nothing else.

     The same cards as a day, because they are the answer: every free
     stretch is already drawn there. What this screen adds is the two
     fields above them, for the hour nobody offered — and it takes no
     interest in which day it is, which is the other screen's job. -->
<section class="view calday" data-view="visit-slot" aria-label="Вибір години">

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

  <!-- No arrows, so no three-column grid: with one child in it, the
       title landed in the 44px column meant for an arrow and was cut
       to "вівт". -->
  <div class="cday-head">
    <h2 class="cday-date" data-day-title>Вибір години</h2>
    <p class="cday-count" data-day-count></p>
  </div>

  <!-- Inside the scroller, not pinned above it: it is the beginning of
       the list, not a bar over it. -->
  <div class="cday-body" data-scroll>
    <div class="cday-pick" data-pick>
      <p class="cday-pick-for" data-pick-for></p>

      <div class="cday-pick-times">
        <label class="cday-pick-field">
          <span class="cday-pick-label">Початок</span>
          <input class="field-input" type="time" data-pick-from>
        </label>
        <label class="cday-pick-field">
          <span class="cday-pick-label">Кінець</span>
          <input class="field-input" type="time" data-pick-to>
        </label>
      </div>

      <div class="cday-pick-gap" role="group" aria-label="Чи входить проміжок у цей час">
        <button class="cday-pick-mode" type="button" data-pick-gap="on" aria-pressed="true">з проміжком</button>
        <button class="cday-pick-mode" type="button" data-pick-gap="off" aria-pressed="false">без проміжку</button>
      </div>

      <p class="cday-pick-line" data-pick-line></p>

      <button class="cday-pick-apply" type="button" data-pick-apply>Обрати цей час</button>
      <p class="cday-pick-or">або виберіть картку нижче</p>
    </div>

    <div class="cday-list" data-day-cards aria-live="polite"></div>
  </div>

</section>
