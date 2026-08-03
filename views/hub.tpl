<!-- The home screen. Only one section works today; the rest are shown
     rather than hidden so the shape of the app is legible from the
     start — a menu that grows is harder to learn than one that lights
     up. -->
<section class="view hub" data-view="hub" aria-label="Головна сторінка">

  <div class="hub-top">
    <!-- Opposite the theme toggle and weighted the same. Reading about
         the app should not require signing out of it, but it is also
         not something anyone does twice — so it sits at the edge with
         the other quiet controls rather than among the sections. -->
    <a class="hub-icon" href="about.html" aria-label="Про Mirra" title="Про Mirra">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 11v5.5"/>
        <path d="M12 7.6v.6"/>
      </svg>
    </a>
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

  <div class="hub-body">
    <div class="hub-inner">
      <h2 class="hub-title">Головна</h2>

      <div class="tiles">
        <!-- Clients and its table switch share one row, so the row still
             reads as one item beside the two below it. -->
        <div class="tile-row">
          <button class="tile" type="button" data-open-clients>
            <span class="tile-name">Клієнти</span>
            <span class="tile-hint">Ваша база записів</span>
          </button>

          <button class="tile-square" type="button" data-pick-other>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 5.5h13v13h-13z"/>
              <path d="M3.5 9.5h13M9 9.5v9"/>
              <path d="M15.5 3 21 3v5.5"/>
              <path d="M21 3 15 9"/>
            </svg>
            <span>Інша<br>таблиця</span>
          </button>
        </div>

        <button class="tile" type="button" disabled>
          <span class="tile-name">Календар</span>
          <span class="tile-soon">Скоро</span>
        </button>

        <button class="tile" type="button" disabled>
          <span class="tile-name">Аналітика</span>
          <span class="tile-soon">Скоро</span>
        </button>
      </div>

      <button class="install-line" type="button" data-install data-install-keep hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11M8 10.5l4 3.5 4-3.5"/>
          <path d="M4 16.5v2.5h16v-2.5"/>
        </svg>
        Додати на головний екран
      </button>

      <p class="hub-note">Mirra зараз в активній розробці. З часом можливостей стане більше.</p>
    </div>
  </div>

  <div class="hub-foot">
    <button class="quiet" type="button" data-signout>Вийти</button>
  </div>

</section>
