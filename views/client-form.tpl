<!-- One form for both adding and editing. The difference between the
     two is a title and whether a row number exists; everything else —
     fields, validation, the way a network is picked — is the same, and
     duplicating it would mean fixing every bug twice. -->
<section class="view form" data-view="form" aria-label="Редагування клієнта">

  <div class="fm-top">
    <button class="back" type="button" data-form-cancel>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
      Скасувати
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

  <div class="fm-body" data-scroll>
    <div class="fm-inner">

      <h2 class="fm-title" data-form-title>Редагувати</h2>

      <label class="fm-field">
        <span class="fm-label">Ім'я</span>
        <input class="fm-input" type="text" data-field="firstName"
               autocomplete="given-name" maxlength="80">
      </label>

      <label class="fm-field">
        <span class="fm-label">Прізвище</span>
        <input class="fm-input" type="text" data-field="lastName"
               autocomplete="family-name" maxlength="80">
      </label>

      <label class="fm-field">
        <span class="fm-label">Телефон</span>
        <span class="fm-phone">
          <span class="fm-phone-ghost" data-phone-ghost aria-hidden="true"></span>
          <input class="fm-input fm-phone-input" type="tel" data-field="phone"
                 autocomplete="tel" inputmode="tel" maxlength="32"
                 placeholder="000-000-0000">
        </span>
      </label>

      <div class="fm-field">
        <span class="fm-label">Останній візит</span>
        <div data-date-mount></div>
      </div>

      <div class="fm-group">
        <span class="fm-label">Соцмережі</span>
        <div data-social-rows></div>
        <button class="fm-add" type="button" data-add-social>+ Додати мережу</button>
      </div>

      <div class="fm-group">
        <span class="fm-label">Месенджери</span>
        <div data-messenger-rows></div>
        <button class="fm-add" type="button" data-add-messenger>+ Додати месенджер</button>
      </div>

      <label class="fm-field">
        <span class="fm-label">Нотатки</span>
        <textarea class="fm-input fm-area" rows="3" data-field="notes" maxlength="500"></textarea>
      </label>

      <div data-extra-fields></div>

    </div>
  </div>

  <div class="fm-foot">
    <button class="fm-save" type="button" data-form-save>
      <span class="spinner" aria-hidden="true"></span>
      <span>Зберегти</span>
    </button>
  </div>

</section>
