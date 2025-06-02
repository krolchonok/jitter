let typingTimer,
  menus = document.getElementsByClassName("content"),
  mc = document.getElementById("main_content"),
  contentQueue = [],
  currentChunkIndex = 0,
  currentSubChunkIndex = 0, // Для подчастей параграфа (текст, ссылки)
  currentCharIndex = 0,     // Для символа внутри текстовой строки
  defaultTypingInterval = 20;

// Глобальные переменные для отслеживания текущего элемента и текстового узла, в который идет печать
let currentParentParagraph = null; // Текущий элемент <p>, если мы находимся внутри параграфа
let currentTypingElement = null;   // Элемент, в который в данный момент вводится текст (может быть <p> или <a>)
let currentTextNode = null;        // Фактический текстовый узел, принимающий символы

// Звуковые объекты
let typewriterBaseSound;
let switchSound;

// Константы для звуков
const TYPING_VOLUME = 0.3;
const MIN_SOUND_INTERVAL = 70;
const SOUND_PLAY_CHANCE = 0.4;
const SWITCH_VOLUME = 0.6;

let lastSoundTimestamp = 0;

// Глобальная переменная для управления состоянием звука (по умолчанию включен)
let isSoundEnabled = true;

// Глобальные переменные для хранения Data URL курсоров
let defaultCursorUrl;
let hoverCursorUrl;

/**
 * Генерирует Data URL для пользовательского курсора в виде прямоугольника.
 * @param {string} color Цвет заливки прямоугольника (например, '#FF0000', 'rgba(0, 255, 0, 0.85)').
 * @param {number} offsetX Горизонтальное смещение "горячей точки" курсора.
 * @param {number} offsetY Вертикальное смещение "горячей точки" курсора.
 * @returns {string} CSS `url()` строка для использования в свойстве `cursor`.
 */
function createCursorUrl(color, offsetX = 10, offsetY = 14) {
  let canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 28;
  let c = canvas.getContext("2d");
  c.fillStyle = color; // Используем предоставленный цвет
  c.shadowColor = color;
  c.shadowBlur = 5;
  c.fillRect(3, 3, 14, 23);
  return `url(${canvas.toDataURL()}) ${offsetX} ${offsetY}, auto`;
}

/**
 * Вспомогательная функция для воспроизведения звуков печати.
 * Звук проигрывается только если isSoundEnabled и соблюдены интервалы/шансы.
 * @param {string} char Печатаемый символ (для проверки, что это не пробел).
 */
function playTypingSound(char) {
  if (!isSoundEnabled) { // Проверяем, включен ли звук
    return;
  }
  const currentTime = Date.now();
  if (typewriterBaseSound && char.trim().length > 0 &&
      Math.random() < SOUND_PLAY_CHANCE &&
      (currentTime - lastSoundTimestamp > MIN_SOUND_INTERVAL)) {

      const clonedSound = typewriterBaseSound.cloneNode();
      clonedSound.volume = TYPING_VOLUME;
      clonedSound.playbackRate = 0.9 + Math.random() * 0.2;
      clonedSound.play().catch(e => console.warn("Typewriter sound play failed:", e));
      lastSoundTimestamp = currentTime;
  }
}

/**
 * Обработчик нажатия на элементы меню.
 * Определяет, какую страницу отобразить, и запускает анимацию печати.
 * @param {Event} e Событие клика.
 */
function menu(e) {
  // Скрыть все выпадающие меню
  for (let i = 0; i < menus.length; i++) {
    menus[i].style.visibility = "hidden";
  }

  let selectedPageElement;

  // --- ИСПРАВЛЕНИЕ: Проблема с ID "achievements" ---
  // Если это клик по элементу меню, используем его ID напрямую.
  // Иначе, пытаемся определить страницу по ID контейнера.
  if (e && e.target.classList.contains("menu_item")) {
    let parentMenu = e.target.parentElement;
    let contentDropdown = document.getElementById(parentMenu.id + "_content");
    if (contentDropdown && contentDropdown.classList.contains("content")) {
      contentDropdown.style.top =
        parentMenu.offsetTop + parentMenu.offsetHeight + "px";
      contentDropdown.style.left = parentMenu.offsetLeft + "px";
      contentDropdown.style.visibility = "visible";
      return;
    }
    // Если это menu_item, который не является выпадающим меню, то e.target.id - это ID страницы
    selectedPageElement = document.getElementById(e.target.id + "_page");
  } else if (e) {
    // Если это не клик по menu_item, а возможно, клик по div.menu или другой элемент
    let choiceId = e.target.id || e.target.parentElement.id;
    selectedPageElement = document.getElementById(choiceId + "_page");
  } else {
    // Если вызов без события (например, при старте страницы)
    selectedPageElement = document.getElementById("init_page");
  }
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---


  if (selectedPageElement) {
    if (typingTimer) {
      clearTimeout(typingTimer); // Останавливаем любую текущую печать
    }
    mc.innerHTML = ""; // Очищаем основную область контента

    // Сбрасываем очередь и индексы, а также новые переменные состояния для новой страницы
    contentQueue = [];
    currentChunkIndex = 0;
    currentSubChunkIndex = 0;
    currentCharIndex = 0;
    currentParentParagraph = null;
    currentTypingElement = null;
    currentTextNode = null;

    // Заполнение очереди контента для печати
    for (let i = 0; i < selectedPageElement.children.length; i++) {
      const child = selectedPageElement.children[i];

      if (child.tagName === "P") {
        const paragraphChunks = [];
        const speed = parseInt(child.dataset.speed) || defaultTypingInterval;
        const textColor = child.dataset.color; // НОВОЕ: Считываем data-color

        child.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textValue = node.textContent;
            if (textValue.length > 0) {
              paragraphChunks.push({
                type: "text",
                value: textValue,
                speed: speed,
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "A") {
              paragraphChunks.push({
                type: "link",
                href: node.href,
                text: node.textContent,
                target: node.target || "_self",
                speed: speed,
              });
            }
          }
        });

        if (paragraphChunks.length > 0) {
          contentQueue.push({
            type: "paragraph",
            content: paragraphChunks,
            speed: speed,
            color: textColor // НОВОЕ: Передаем цвет в очередь
          });
        }
      } else if (child.tagName === "IMG") {
        contentQueue.push({
          type: "image",
          src: child.src,
          alt: child.alt || "",
        });
      } else if (child.tagName === "A") { // Для блочных ссылок <a>
        contentQueue.push({
          type: "link_block",
          href: child.href,
          text: child.textContent,
          target: child.target || "_self",
          speed: parseInt(child.dataset.speed) || defaultTypingInterval,
        });
      }
    }

    typeContent(); // Начинаем печать нового контента
  }
}

/**
 * Функция для управления пошаговым процессом печати контента (эффект "печатной машинки").
 */
function typeContent() {
  if (currentChunkIndex >= contentQueue.length) {
    typingTimer = null; // Все фрагменты напечатаны
    return;
  }

  const currentChunk = contentQueue[currentChunkIndex];
  let delayForNextAction = defaultTypingInterval; // Скорость по умолчанию

  if (currentChunk.type === "paragraph") {
    // Если это новый абзац или продолжение предыдущего
    if (!currentParentParagraph) {
      currentParentParagraph = document.createElement("p");
      currentParentParagraph.style.wordBreak = "break-all"; // Применяется инлайново, может быть переопределено CSS
      currentParentParagraph.style.margin = "0";
      currentParentParagraph.style.padding = "0";
      if (currentChunk.color) { // НОВОЕ: Применяем цвет к новому параграфу
        currentParentParagraph.style.color = currentChunk.color;
      }
      mc.appendChild(currentParentParagraph);
      currentSubChunkIndex = 0; // Сброс индекса под-фрагмента для нового абзаца
    }

    const subChunk = currentChunk.content[currentSubChunkIndex];

    if (!subChunk) {
      // Все под-фрагменты этого абзаца обработаны
      currentChunkIndex++;
      currentSubChunkIndex = 0;
      currentCharIndex = 0;
      currentParentParagraph = null; // Этот абзац завершен
      currentTypingElement = null;   // Нет активного элемента для печати
      currentTextNode = null;        // Нет активного текстового узла
      delayForNextAction = 0; // Сразу переходим к следующему чанку
      mc.appendChild(document.createElement("br")); // Добавляем перенос строки после абзаца
    } else if (subChunk.type === "text") {
      // Печать текстового фрагмента
      currentTypingElement = currentParentParagraph;

      // Создаем новый текстовый узел, если его нет или он принадлежит другому родителю
      if (!currentTextNode || currentTextNode.parentNode !== currentTypingElement) {
        currentTextNode = document.createTextNode("");
        currentTypingElement.appendChild(currentTextNode);
        currentCharIndex = 0; // Сброс индекса символа для нового текстового фрагмента
      }

      if (currentCharIndex < subChunk.value.length) {
        currentTextNode.nodeValue += subChunk.value[currentCharIndex];
        playTypingSound(subChunk.value[currentCharIndex]);
        currentCharIndex++;
        delayForNextAction = subChunk.speed || currentChunk.speed;
      } else {
        // Текстовый фрагмент завершен
        currentSubChunkIndex++;
        currentCharIndex = 0;
        currentTextNode = null; // Очищаем текстовый узел
        delayForNextAction = 0; // Сразу переходим к следующему под-чанку
      }
    } else if (subChunk.type === "link") {
      // Печать инлайн-ссылки
      if (!currentTypingElement || currentTypingElement.tagName !== "A") {
        // Создаем элемент ссылки, если еще не начали печатать эту ссылку
        const link = document.createElement("a");
        link.href = subChunk.href;
        link.target = subChunk.target;
        link.className = "retro-link";
        // Заметьте: стиль a.retro-link в CSS имеет color: #fff;, который переопределит цвет параграфа для самой ссылки.
        // Если вы хотите, чтобы цвет параграфа применялся и к ссылкам внутри,
        // вам нужно будет удалить 'color: #fff;' из a.retro-link в CSS или изменить эту логику.
        currentParentParagraph.appendChild(link); // Добавляем в текущий абзац
        currentTypingElement = link; // Теперь ссылка является целью печати
        currentTextNode = document.createTextNode("");
        currentTypingElement.appendChild(currentTextNode);
        currentCharIndex = 0; // Начинаем печатать текст ссылки с 0-го символа
      }

      if (currentCharIndex < subChunk.text.length) {
        currentTextNode.nodeValue += subChunk.text[currentCharIndex];
        playTypingSound(subChunk.text[currentCharIndex]);
        currentCharIndex++;
        delayForNextAction = subChunk.speed || currentChunk.speed;
      } else {
        // Текст ссылки завершен
        currentSubChunkIndex++;
        currentCharIndex = 0;
        currentTextNode = null; // Очищаем текстовый узел
        currentTypingElement = null; // Ссылка завершена, следующий текст идет в родительский абзац
        delayForNextAction = 0; // Сразу переходим к следующему под-чанку
      }
    }
  } else if (currentChunk.type === "image") {
    // Отображение изображения
    currentParentParagraph = null; // Нет контекста абзаца для изображений
    currentTypingElement = null;   // Нет активного элемента для печати
    currentTextNode = null;        // Нет активного текстового узла

    const img = document.createElement("img");
    img.src = currentChunk.src;
    img.alt = currentChunk.alt;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "1em 0";

    mc.appendChild(img);
    currentChunkIndex++; // Переходим к следующему основному фрагменту
    currentCharIndex = 0;
    currentSubChunkIndex = 0; // Сброс для безопасности
    delayForNextAction = 0; // Изображение появляется мгновенно
    mc.appendChild(document.createElement("br")); // Добавляем перенос строки после изображения
  } else if (currentChunk.type === "link_block") {
    // Печать блочной ссылки
    currentParentParagraph = null; // Нет контекста абзаца для блочных ссылок

    if (!currentTypingElement || currentTypingElement.tagName !== "A") {
      // Создаем элемент блочной ссылки
      const link = document.createElement("a");
      link.href = currentChunk.href;
      link.target = currentChunk.target;
      link.className = "retro-link";
      link.style.display = "block";
      link.style.margin = "1em 0";
      mc.appendChild(link);
      currentTypingElement = link; // Блочная ссылка является целью печати
      currentTextNode = document.createTextNode("");
      currentTypingElement.appendChild(currentTextNode);
      currentCharIndex = 0; // Начинаем печатать текст ссылки с 0-го символа
    }

    if (currentCharIndex < currentChunk.text.length) {
      currentTextNode.nodeValue += currentChunk.text[currentCharIndex];
      playTypingSound(currentChunk.text[currentCharIndex]);
      currentCharIndex++;
      delayForNextAction = currentChunk.speed || defaultTypingInterval;
    } else {
      // Текст блочной ссылки завершен
      currentChunkIndex++; // Переходим к следующему основному фрагменту
      currentCharIndex = 0;
      currentSubChunkIndex = 0; // Сброс для безопасности
      currentTypingElement = null; // Блочная ссылка завершена
      currentTextNode = null;        // Нет активного текстового узла
      delayForNextAction = 0; // Сразу переходим к следующему чанку
      mc.appendChild(document.createElement("br")); // Добавляем перенос строки после блочной ссылки
    }
  }

  // Запускаем следующий шаг печати
  typingTimer = setTimeout(typeContent, delayForNextAction);
}

// Прикрепление обработчиков событий к элементам меню
document.querySelectorAll(".menu_item").forEach((item) => {
  item.addEventListener("click", menu);
});

// Прикрепление обработчиков событий к элементам выпадающих списков (если они есть)
document.querySelectorAll(".content li").forEach((item) => {
  item.addEventListener("click", menu);
});

// Инициализация URL-ов курсоров после готовности DOM
document.addEventListener("DOMContentLoaded", () => {
    // Получаем текущий цвет каретки из CSS для #main_content
    const mainContentElement = document.getElementById("main_content");
    const defaultCaretColor = window.getComputedStyle(mainContentElement).getPropertyValue("caret-color");

    // Определяем цвет курсора при наведении (ярко-зеленый)
    const hoverCaretColor = 'rgba(255, 0, 0, 0.85)';

    // Генерируем URL-ы курсоров
    defaultCursorUrl = createCursorUrl(defaultCaretColor);
    hoverCursorUrl = createCursorUrl(hoverCaretColor);

    // Устанавливаем пользовательские CSS-свойства (переменные) на корневой элемент документа
    document.documentElement.style.setProperty('--default-cursor-url', defaultCursorUrl);
    document.documentElement.style.setProperty('--hover-cursor-url', hoverCursorUrl);
});

// --- ЛОГИКА ГОРЯЧИХ КЛАВИШ ---
// Сопоставление горячих клавиш (кириллические символы) с ID элементов меню
const keyboardShortcuts = {
  'Г': 'init',          // Главная
  'У': 'about',         // Участники
  'Д': 'achievements',   // Достижения
  'U': 'init',          // Главная
  'E': 'about',         // Участники
  'L': 'achievements'   // Достижения
};

// Инициализация при полной загрузке страницы (включая ресурсы)
window.onload = function() {
  // Инициализация звуковых объектов
  typewriterBaseSound = new Audio('typewriter-key.mp3');
  typewriterBaseSound.volume = TYPING_VOLUME;
  typewriterBaseSound.preload = 'auto';

  switchSound = new Audio('switch-sound.mp3');
  switchSound.volume = SWITCH_VOLUME;
  switchSound.preload = 'auto';

  const powerToggle = document.getElementById('power-toggle');
  const soundToggle = document.getElementById('sound-toggle'); // Получаем тумблер звука

  // Обработчик события для тумблера звука
  if (soundToggle) {
    // Устанавливаем начальное состояние isSoundEnabled на основе checked-атрибута
    isSoundEnabled = soundToggle.checked;

    soundToggle.addEventListener('change', function() {
      isSoundEnabled = soundToggle.checked; // Обновляем глобальное состояние звука
      if (switchSound && isSoundEnabled) { // Проигрываем звук только если тумблер звука включен
        const clonedSwitchSound = switchSound.cloneNode();
        clonedSwitchSound.volume = SWITCH_VOLUME;
        clonedSwitchSound.play().catch(e => console.warn("Sound toggle switch sound play failed:", e));
      }
    });
  }

  // Обработчик события для тумблера питания
  if (powerToggle) {
    powerToggle.addEventListener('change', function() {
      // Проигрываем звук переключения только если звук включен
      if (switchSound && isSoundEnabled) {
        const clonedSwitchSound = switchSound.cloneNode();
        clonedSwitchSound.volume = SWITCH_VOLUME;
        clonedSwitchSound.play().catch(e => console.warn("Power toggle switch sound play failed:", e));
      }

      if (powerToggle.checked) {
        const powerScreen = document.getElementById('power-screen');
        powerScreen.style.transition = 'opacity 0.7s';
        powerScreen.style.opacity = '0';
        setTimeout(() => {
          powerScreen.style.display = 'none';
          // Запуск основного сайта (показываем меню по умолчанию)
          menu();

          // --- Активируем слушатель горячих клавиш только после скрытия стартового экрана ---
          document.addEventListener('keydown', (event) => {
            // Предотвращаем срабатывание, если пользователь печатает в поле ввода
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Преобразуем нажатую клавишу в верхний регистр для регистронезависимости
            const pressedKey = event.key.toUpperCase();

            // Проверяем, является ли нажатая клавиша одной из наших горячих клавиш
            if (keyboardShortcuts[pressedKey]) {
              const targetId = keyboardShortcuts[pressedKey];
              // Ищем элемент с этим ID, который является menu_item
              const targetElement = document.querySelector(`#${targetId}.menu_item`);

              if (targetElement) {
                // Предотвращаем стандартное поведение браузера (например, прокрутку)
                event.preventDefault();
                // Имитируем клик по элементу меню
                targetElement.click();
              }
            }
          });

        }, 700);
      }
    });
  } else {
    // Fallback: если экрана запуска нет, сразу запускаем основной сайт
    menu();
    // Активируем слушатель горячих клавиш сразу, если нет экрана запуска
    document.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        const pressedKey = event.key.toUpperCase();
        if (keyboardShortcuts[pressedKey]) {
            event.preventDefault();
            // Ищем элемент с этим ID, который является menu_item
            const targetElement = document.querySelector(`#${keyboardShortcuts[pressedKey]}.menu_item`);
            if (targetElement) {
                targetElement.click();
            }
        }
    });
  }
};