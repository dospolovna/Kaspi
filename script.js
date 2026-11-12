'use strict';

(() => {
  function initialize() {
    const root = document.getElementById('pin-app');

    if (!root || root.dataset.ready) return;

    root.dataset.ready = 'true';

    const home = document.getElementById('home-app');
    const transfersScreen = document.getElementById('transfers-app');

    const clientScreen = document.getElementById('client-app');
    const clientLayer = document.getElementById('client-layer');
    const clientScroll = clientScreen.querySelector('.client-scroll');

    const clientPhone = document.getElementById('client-phone');
    const clientPhoneField = document.getElementById('client-phone-field');
    const clientPhoneSlots = [4, 5, 6, 9, 10, 11, 13, 14, 16, 17];

    let clientPhoneDigits = '';
    let clientPhoneFocused = false;

    const clientAmount = document.getElementById('client-amount');
    const clientMessage = document.getElementById('client-message');
    const clientMessageCount = document.getElementById(
      'client-message-count'
    );
    const clientSubmit = document.getElementById('client-submit');

    let clientCloseTimer;

    const pinLayer = document.getElementById('pin-layer');
    const pinScroll = pinLayer.querySelector('.pin-scroll');

    let closeTimer;

    const transfersButton = document.getElementById('open-transfers');

    let activeView = null;
    let enteredCount = 0;
    let loading = false;
    let loadingTimer;
    let toastTimer;

    const dots = [...root.querySelectorAll('.dot')];
    const dotsContainer = root.querySelector('#dots-container');
    const spinner = root.querySelector('#spinner');

    const loadingOverlay = document.getElementById('loading-overlay');
    const status = root.querySelector('#pin-status');
    const toast = root.querySelector('#toast');

    const deleteButton = root.querySelector('#delete-btn');
    const numberButtons = [...root.querySelectorAll('[data-key]')];
    const faceButton = root.querySelector('#face-btn');

    const keyPressTimers = new Map();

    function sanitizeDigits(input) {
      const raw = input.value;

      const selection = input.selectionStart === null
        ? raw.length
        : input.selectionStart;

      const cleaned = raw
        .replace(/[^0-9]/g, '')
        .slice(0, input.maxLength);

      if (cleaned !== raw) {
        const caret = Math.min(
          raw.slice(0, selection).replace(/[^0-9]/g, '').length,
          cleaned.length
        );

        input.value = cleaned;
        input.setSelectionRange(caret, caret);
      }
    }

    function normalizeClientPhone(raw) {
      let digits = raw.replace(/[^0-9]/g, '');

      if (
        raw.trimStart().startsWith('+7') ||
        (digits.length >= 11 && /^[78]/.test(digits))
      ) {
        digits = digits.slice(1);
      }

      return digits.slice(0, 10);
    }

    function clientPhoneIndex(position) {
      return Math.min(
        clientPhoneDigits.length,
        clientPhoneSlots.filter(slot => slot < position).length
      );
    }

    function setClientPhoneCaret(index) {
      const clamped = Math.max(
        0,
        Math.min(index, clientPhoneDigits.length)
      );

      const position = clamped === 10
        ? 18
        : clientPhoneSlots[clamped];

      clientPhone.setSelectionRange(position, position);
    }

    function renderClientPhone(caretIndex = null) {
      const digits = clientPhoneDigits;

      const mask =
        '+7 (' +
        digits.slice(0, 3).padEnd(3, ' ') +
        ') ' +
        digits.slice(3, 6).padEnd(3, ' ') +
        '-' +
        digits.slice(6, 8).padEnd(2, ' ') +
        '-' +
        digits.slice(8, 10).padEnd(2, ' ');

      clientPhone.value = clientPhoneFocused || digits ? mask : '';

      clientPhoneField.classList.toggle(
        'is-focused',
        clientPhoneFocused
      );

      clientPhoneField.classList.toggle(
        'has-value',
        digits.length > 0
      );

      if (caretIndex !== null && clientPhoneFocused) {
        setClientPhoneCaret(caretIndex);
      }
    }

    function editClientPhone(kind, text = '') {
      const selectionStart = clientPhone.selectionStart === null
        ? 4
        : clientPhone.selectionStart;

      const selectionEnd = clientPhone.selectionEnd === null
        ? selectionStart
        : clientPhone.selectionEnd;

      let start = clientPhoneIndex(selectionStart);
      let end = clientPhoneIndex(selectionEnd);
      let incoming = '';

      if (kind.startsWith('delete')) {
        if (
          start === end &&
          selectionStart === selectionEnd
        ) {
          if (
            kind === 'deleteWordBackward' ||
            kind === 'deleteSoftLineBackward'
          ) {
            start = 0;
          } else if (
            kind === 'deleteWordForward' ||
            kind === 'deleteSoftLineForward'
          ) {
            end = clientPhoneDigits.length;
          } else if (kind.endsWith('Backward')) {
            start = Math.max(0, start - 1);
          } else if (kind.endsWith('Forward')) {
            end = Math.min(clientPhoneDigits.length, end + 1);
          }
        }
      } else {
        incoming = text.length > 1
          ? normalizeClientPhone(text)
          : text.replace(/[^0-9]/g, '');

        if (!incoming) return;
      }

      clientPhoneDigits = (
        clientPhoneDigits.slice(0, start) +
        incoming +
        clientPhoneDigits.slice(end)
      ).slice(0, 10);

      renderClientPhone(
        Math.min(start + incoming.length, clientPhoneDigits.length)
      );
    }

    function fallbackClientPhoneInput() {
      const raw = clientPhone.value;

      const selection = clientPhone.selectionStart === null
        ? raw.length
        : clientPhone.selectionStart;

      let before = raw
        .slice(0, selection)
        .replace(/[^0-9]/g, '')
        .length;

      const all = raw.replace(/[^0-9]/g, '');

      if (
        raw.trimStart().startsWith('+7') ||
        (all.length >= 11 && /^[78]/.test(all))
      ) {
        before = Math.max(0, before - 1);
      }

      clientPhoneDigits = normalizeClientPhone(raw);

      renderClientPhone(
        Math.min(before, clientPhoneDigits.length)
      );
    }

    function updateClientAmount() {
      sanitizeDigits(clientAmount);

      const digits = clientAmount.value.replace(/^0+(?=\d)/, '');

      const formatted = (digits || '0').replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ' '
      );

      clientAmount.style.setProperty(
        '--amount-length',
        Math.max(1, clientAmount.value.length)
      );

      clientSubmit.textContent = 'Перевести ' + formatted + ' ₸';
    }

    function updateMessageCount() {
      clientMessage.value = clientMessage.value.slice(0, 50);

      clientMessageCount.textContent =
        clientMessage.value.length + '/50';
    }

    function goTransfers() {
      clientPhone.blur();
      clientAmount.blur();
      clientMessage.blur();

      window.location.hash = 'transfers';
      syncRoute();
    }

    clientPhone.addEventListener('focus', () => {
      clientPhoneFocused = true;
      renderClientPhone(clientPhoneDigits.length);
    });

    clientPhone.addEventListener('blur', () => {
      clientPhoneFocused = false;
      renderClientPhone();
    });

    clientPhone.addEventListener('click', () => {
      if (clientPhone.selectionStart === clientPhone.selectionEnd) {
        setClientPhoneCaret(
          clientPhoneIndex(clientPhone.selectionStart)
        );
      }
    });

    clientPhone.addEventListener('beforeinput', event => {
      if (event.isComposing) return;

      const kind = event.inputType || '';

      if (
        kind.startsWith('delete') ||
        (
          kind.startsWith('insert') &&
          event.data !== null &&
          event.data !== undefined
        )
      ) {
        event.preventDefault();
        editClientPhone(kind, event.data || '');
      }
    });

    clientPhone.addEventListener('paste', event => {
      if (!event.clipboardData) return;

      event.preventDefault();

      editClientPhone(
        'insertFromPaste',
        event.clipboardData.getData('text')
      );
    });

    clientPhone.addEventListener('keydown', event => {
      if (
        event.key !== 'Backspace' &&
        event.key !== 'Delete'
      ) {
        return;
      }

      event.preventDefault();

      const word = event.ctrlKey || event.metaKey;

      const kind = event.key === 'Backspace'
        ? (
          word
            ? 'deleteWordBackward'
            : 'deleteContentBackward'
        )
        : (
          word
            ? 'deleteWordForward'
            : 'deleteContentForward'
        );

      editClientPhone(kind);
    });

    clientPhone.addEventListener(
      'input',
      fallbackClientPhoneInput
    );

    clientAmount.addEventListener('beforeinput', event => {
      if (
        !event.isComposing &&
        event.inputType === 'insertText' &&
        event.data &&
        /[^0-9]/.test(event.data)
      ) {
        event.preventDefault();
      }
    });

    clientAmount.addEventListener('input', updateClientAmount);
    clientMessage.addEventListener('input', updateMessageCount);

    clientScreen.querySelectorAll('[data-message]').forEach(button => {
      button.addEventListener('click', () => {
        clientMessage.value = button.dataset.message;
        updateMessageCount();
      });
    });

    document.getElementById('open-client').addEventListener(
      'click',
      () => {
        window.location.hash = 'client';
        syncRoute();
      }
    );

    document.getElementById('client-back').addEventListener(
      'click',
      goTransfers
    );

    renderClientPhone();
    updateClientAmount();
    updateMessageCount();

    function updateView() {
      dots.forEach((dot, index) => {
        dot.classList.toggle('filled', index < enteredCount);
      });

      dotsContainer.setAttribute(
        'aria-label',
        'Введено ' + enteredCount + ' из 4 цифр'
      );

      dotsContainer.setAttribute('aria-busy', String(loading));
      dotsContainer.classList.toggle('loading', loading);

      spinner.hidden = !loading;
      loadingOverlay.hidden = !loading;

      root.setAttribute('aria-busy', String(loading));

      numberButtons.forEach(button => {
        button.disabled = loading;
      });

      faceButton.disabled = loading;
      deleteButton.disabled = loading || enteredCount === 0;

      deleteButton.classList.toggle(
        'visible',
        enteredCount > 0
      );
    }

    function clearKeyPresses() {
      keyPressTimers.forEach(timer => clearTimeout(timer));
      keyPressTimers.clear();

      numberButtons.forEach(button => {
        button.classList.remove('is-pressed');
      });
    }

    function showKeyPress(button) {
      if (
        !button ||
        activeView !== 'pin' ||
        loading ||
        button.disabled
      ) {
        return;
      }

      clearTimeout(keyPressTimers.get(button));
      keyPressTimers.delete(button);

      button.classList.remove('is-pressed');
      void button.offsetWidth;
      button.classList.add('is-pressed');
    }

    function releaseKeyPress(button, delay = 140) {
      clearTimeout(keyPressTimers.get(button));

      if (!button.classList.contains('is-pressed')) return;

      if (delay === 0) {
        button.classList.remove('is-pressed');
        keyPressTimers.delete(button);
      } else {
        keyPressTimers.set(
          button,
          setTimeout(() => {
            button.classList.remove('is-pressed');
            keyPressTimers.delete(button);
          }, delay)
        );
      }
    }

    function hideToast() {
      clearTimeout(toastTimer);
      toast.hidden = true;
    }

    function showToast(message) {
      hideToast();

      toast.textContent = message;
      toast.hidden = false;

      toastTimer = setTimeout(hideToast, 2200);
    }

    function resetScreen() {
      clearTimeout(loadingTimer);

      clearKeyPresses();

      enteredCount = 0;
      loading = false;
      status.textContent = '';

      hideToast();
      updateView();
    }

    function pressKey() {
      if (
        activeView !== 'pin' ||
        loading ||
        enteredCount >= 4
      ) {
        return;
      }

      hideToast();
      enteredCount += 1;

      if (enteredCount === 4) {
        loading = true;
        status.textContent = 'Загрузка';

        loadingTimer = setTimeout(() => {
          if (activeView !== 'pin' || !loading) return;

          window.location.hash = 'transfers';
          syncRoute();
        }, 2000);
      } else {
        status.textContent =
          'Введено ' + enteredCount + ' из 4 цифр';
      }

      updateView();
    }

    function deleteKey() {
      if (loading) return;

      enteredCount = Math.max(0, enteredCount - 1);
      updateView();
    }

    numberButtons.forEach(button => {
      button.addEventListener('pointerdown', event => {
        if (
          event.button !== undefined &&
          event.button !== 0
        ) {
          return;
        }

        showKeyPress(button);
      });

      button.addEventListener('pointerup', () => {
        releaseKeyPress(button);
      });

      button.addEventListener('pointercancel', () => {
        releaseKeyPress(button, 0);
      });

      button.addEventListener('pointerleave', () => {
        releaseKeyPress(button, 0);
      });

      button.addEventListener('blur', () => {
        releaseKeyPress(button, 0);
      });

      button.addEventListener('click', () => {
        if (
          activeView !== 'pin' ||
          loading ||
          button.disabled
        ) {
          return;
        }

        showKeyPress(button);
        releaseKeyPress(button);
        pressKey();
      });
    });

    window.addEventListener('pointerup', () => {
      numberButtons.forEach(button => {
        releaseKeyPress(button);
      });
    });

    window.addEventListener('pointercancel', clearKeyPresses);
    window.addEventListener('blur', clearKeyPresses);

    deleteButton.addEventListener('click', deleteKey);

    faceButton.addEventListener('click', () => {
      showToast('Face ID недоступен в этом браузере');
    });

    ['#back-btn', '#close-btn'].forEach(selector => {
      root.querySelector(selector).addEventListener('click', () => {
        resetScreen();

        window.location.hash = '';
        syncRoute();
      });
    });

    root.querySelector('#forgot-btn').addEventListener('click', () => {
      resetScreen();
      showToast('Введите четыре цифры заново');
    });

    document.addEventListener('keydown', event => {
      if (
        activeView === 'client' &&
        event.key === 'Escape'
      ) {
        event.preventDefault();
        goTransfers();
        return;
      }

      if (activeView !== 'pin') return;

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.repeat
      ) {
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();

        const button = numberButtons.find(item => {
          return item.textContent.trim() === event.key;
        });

        showKeyPress(button);

        if (button) releaseKeyPress(button);

        pressKey();
      } else if (
        event.key === 'Backspace' ||
        event.key === 'Delete'
      ) {
        event.preventDefault();
        deleteKey();
      } else if (event.key === 'Escape') {
        resetScreen();
      }
    });

    function syncRoute() {
      const hash = window.location.hash;

      const nextView = hash === '#pin'
        ? 'pin'
        : hash === '#transfers'
          ? 'transfers'
          : hash === '#client'
            ? 'client'
            : 'home';

      if (activeView === nextView) return;

      const previousView = activeView;

      const showPin = nextView === 'pin';
      const showClient = nextView === 'client';

      const inTransfers =
        nextView === 'transfers' || showClient;

      const leavingPin =
        previousView === 'pin' && !showPin;

      const leavingClient =
        previousView === 'client' && !showClient;

      clearTimeout(closeTimer);
      clearTimeout(clientCloseTimer);

      resetScreen();

      activeView = nextView;

      home.hidden = inTransfers;
      home.inert = showPin || inTransfers;

      home.setAttribute(
        'aria-hidden',
        String(home.inert)
      );

      transfersScreen.hidden = !inTransfers;
      transfersScreen.inert = nextView !== 'transfers';

      transfersScreen.setAttribute(
        'aria-hidden',
        String(nextView !== 'transfers')
      );

      pinLayer.setAttribute(
        'aria-hidden',
        String(!showPin)
      );
      pinLayer.inert = !showPin;

      clientLayer.setAttribute(
        'aria-hidden',
        String(!showClient)
      );
      clientLayer.inert = !showClient;

      document.body.classList.toggle(
        'pin-presented',
        showPin
      );

      document.body.classList.toggle(
        'transfers-presented',
        inTransfers
      );

      document.title = showPin
        ? 'Код доступа — Арман Т.'
        : showClient
          ? 'Клиенту Kaspi'
          : nextView === 'transfers'
            ? 'Переводы'
            : 'Главная';

      if (showPin) {
        root.hidden = false;
        pinScroll.scrollTop = 0;

        pinLayer.getBoundingClientRect();
        pinLayer.classList.add('is-open');

        root.focus({ preventScroll: true });
      } else {
        pinLayer.classList.remove('is-open');

        if (leavingPin) {
          closeTimer = setTimeout(() => {
            if (activeView !== 'pin') {
              root.hidden = true;
            }
          }, 400);
        } else {
          root.hidden = true;
        }

        if (nextView === 'transfers') {
          if (previousView !== 'client') {
            transfersScreen.querySelector(
              '.transfers-content'
            ).scrollTop = 0;
          }

          transfersScreen.focus({ preventScroll: true });
        } else if (
          nextView === 'home' &&
          previousView
        ) {
          home.focus({ preventScroll: true });
        }
      }

      if (showClient) {
        clientScreen.hidden = false;
        clientScroll.scrollTop = 0;

        clientLayer.getBoundingClientRect();
        clientLayer.classList.add('is-open');

        clientScreen.focus({ preventScroll: true });
      } else {
        clientLayer.classList.remove('is-open');

        if (leavingClient) {
          clientCloseTimer = setTimeout(() => {
            if (activeView !== 'client') {
              clientScreen.hidden = true;
            }
          }, 360);
        } else {
          clientScreen.hidden = true;
        }
      }
    }

    function goHome() {
      window.location.hash = '';
      syncRoute();
    }

    document.getElementById('transfers-back').addEventListener(
      'click',
      goHome
    );

    document.getElementById('transfers-home').addEventListener(
      'click',
      goHome
    );

    transfersButton.addEventListener('click', () => {
      window.location.hash = 'pin';
      syncRoute();
    });

    window.addEventListener('hashchange', syncRoute);

    syncRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
