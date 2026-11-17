<!-- One appointment, to look at.

     Reading and changing are two screens rather than one, the same
     way they are for a client. A screen with nothing editable on it
     cannot lose an edit: the alternative was a card where the hour
     was a button, and somebody who changed it and pressed Назад would
     have walked away sure they had moved the appointment. -->
<section class="view visit" data-view="visit-card" aria-label="Запис">

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

      <!-- The hour first and larger, the day under it: somebody
           opening this already knows which day they were looking at,
           and what they came for is the time. -->
      <h2 class="vc-time" data-card-time>—</h2>
      <p class="vc-day" data-card-day></p>

      <!-- The row: the person on the left, one action on the right.
           Everything in it is about her, never about the appointment
           — the appointment's own actions are at the foot. -->
      <div class="vc-who" data-card-who></div>

      <p class="vc-comment" data-card-comment hidden></p>

    </div>
  </div>

  <div class="cd-foot">
    <button class="quiet" type="button" data-visit-edit>Редагувати</button>
    <button class="quiet quiet-danger" type="button" data-visit-delete>Скасувати запис</button>
  </div>

</section>
