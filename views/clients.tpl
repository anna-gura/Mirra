<!-- The client list. Names only: everything else about a person belongs
     on their own screen, where there is room for it. -->
<section class="view clients" data-view="clients" aria-label="Клієнти">

  <div class="cl-top">
    <button class="back" type="button" data-open-hub>
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

  <div class="cl-body" data-scroll>
    <div class="cl-inner">
      <h2 class="cl-title" data-sheet-title>—</h2>
      <p class="cl-count" data-sheet-count></p>

      <!-- Sticks to the top of the scrolling area. Searching is what
           this screen is for, and a search field that scrolls away is
           one you have to scroll back for. -->
      <div class="cl-tools">
        <button class="cl-add" type="button" data-add-client>
          <span aria-hidden="true">+</span> Додати
        </button>

        <div class="cl-search">
          <svg class="cl-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5"/>
            <path d="m15.5 15.5 4 4"/>
          </svg>
          <input class="cl-search-input" type="search" data-search
                 placeholder="Ім'я, телефон або #тег" aria-label="Пошук клієнтів"
                 autocomplete="off" spellcheck="false" enterkeyhint="search">
          <button class="cl-search-clear" type="button" data-search-clear
                  aria-label="Очистити пошук" hidden>×</button>
        </div>
      </div>

      <!-- Filled from the tags actually present in the sheet. Offering
           them is what makes tagging discoverable: nobody types a hash
           into a search box on a hunch. -->
      <div class="cl-tagbar" data-tagbar hidden></div>

      <div data-client-list></div>
    </div>
  </div>

  <div class="cl-foot">
    <button class="quiet" type="button" data-reload>Оновити</button>
  </div>

</section>
