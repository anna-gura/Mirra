<!-- One person. Name, phone, and the two contact blocks; everything
     else waits behind Додатково, because a screen that shows fifteen
     fields is a screen nobody reads. -->
<section class="view client" data-view="client" aria-label="Клієнт">

  <div class="cd-top">
    <button class="back" type="button" data-back-clients>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
      Назад
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

  <div class="cd-body" data-scroll>
    <div class="cd-inner">

      <h2 class="cd-name" data-client-name>—</h2>
      <p class="cd-phone" data-client-phone></p>

      <!-- Anchors rather than buttons: tel: and sms: are handled by the
           device itself, so the operating system decides what opens.
           href is set at render time and removed when there is no
           number, which is what is-off reflects. -->
      <div class="cd-acts" role="group" aria-label="Дії">
        <a class="cd-act" data-action-call>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>
          <span>Подзвонити</span>
        </a>
        <a class="cd-act" data-action-sms>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20.5l1.6-4.8A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>
          <span>Написати</span>
        </a>
        <button class="cd-act is-soon" type="button" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16"/><path d="M8 3.5v4M16 3.5v4"/></svg>
          <span>Календар</span>
          <em>скоро</em>
        </button>
      </div>

      <div class="cd-line"></div>

      <button class="cd-row" type="button" aria-expanded="false" data-fold="fold-socials">
        <span class="cd-row-text">
          <span class="cd-label">Соцмережі</span>
          <span class="cd-value" data-socials-summary>—</span>
        </span>
        <span class="cd-chev" aria-hidden="true"></span>
      </button>
      <div class="cd-fold" id="fold-socials" style="height:0">
        <div class="cd-fold-inner" data-socials></div>
      </div>

      <div class="cd-line"></div>

      <button class="cd-row" type="button" aria-expanded="false" data-fold="fold-messengers">
        <span class="cd-row-text">
          <span class="cd-label">Месенджери</span>
          <span class="cd-value" data-messengers-summary>—</span>
        </span>
        <span class="cd-chev" aria-hidden="true"></span>
      </button>
      <div class="cd-fold" id="fold-messengers" style="height:0">
        <div class="cd-fold-inner" data-messengers></div>
      </div>

      <div class="cd-line"></div>

      <!-- Sits with the content it opens rather than in the footer: a
           control at the far edge of the screen reads as navigation,
           and this reveals rather than navigates. -->
      <button class="cd-more" type="button" aria-expanded="false" data-fold="fold-extra">
        <span data-more-label>Додатково</span>
        <span class="cd-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 9.5 12 15.5 18 9.5"/></svg>
        </span>
      </button>
      <div class="cd-fold" id="fold-extra" style="height:0">
        <div class="cd-fold-inner cd-extra" data-extra></div>
      </div>

    </div>
  </div>

  <div class="cd-foot">
    <button class="quiet" type="button" data-edit-client>Редагувати</button>
    <button class="quiet quiet-danger" type="button" data-delete-client>Видалити</button>
  </div>

</section>
