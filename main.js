let typingTimer,
  menus = document.getElementsByClassName("content"),
  mc = document.getElementById("main_content"),
  contentQueue = [],
  currentChunkIndex = 0,
  currentSubChunkIndex = 0,
  currentCharIndex = 0,
  defaultTypingInterval = 20;

let currentParentParagraph = null;
let currentTypingElement = null;
let currentTextNode = null;

let typewriterBaseSound;
let switchSound;

const TYPING_VOLUME = 0.3;
const MIN_SOUND_INTERVAL = 70;
const SOUND_PLAY_CHANCE = 0.4;
const SWITCH_VOLUME = 0.6;

let lastSoundTimestamp = 0;

let isSoundEnabled = true;

let defaultCursorUrl;
let hoverCursorUrl;

function createCursorUrl(color, offsetX = 10, offsetY = 14) {
  let canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 28;
  let c = canvas.getContext("2d");
  c.fillStyle = color;
  c.shadowColor = color;
  c.shadowBlur = 5;
  c.fillRect(3, 3, 14, 23);
  return `url(${canvas.toDataURL()}) ${offsetX} ${offsetY}, auto`;
}

function playTypingSound(char) {
  if (!isSoundEnabled) {
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

function menu(e) {
  for (let i = 0; i < menus.length; i++) {
    menus[i].style.visibility = "hidden";
  }

  let selectedPageElement;

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
    selectedPageElement = document.getElementById(e.target.id + "_page");
  } else if (e) {
    let choiceId = e.target.id || e.target.parentElement.id;
    selectedPageElement = document.getElementById(choiceId + "_page");
  } else {
    selectedPageElement = document.getElementById("init_page");
  }

  if (selectedPageElement) {
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
    mc.innerHTML = "";

    contentQueue = [];
    currentChunkIndex = 0;
    currentSubChunkIndex = 0;
    currentCharIndex = 0;
    currentParentParagraph = null;
    currentTypingElement = null;
    currentTextNode = null;

    for (let i = 0; i < selectedPageElement.children.length; i++) {
      const child = selectedPageElement.children[i];

      if (child.tagName === "P") {
        const paragraphChunks = [];
        const speed = parseInt(child.dataset.speed) || defaultTypingInterval;
        const textColor = child.dataset.color;

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
            color: textColor
          });
        }
      } else if (child.tagName === "IMG") {
        contentQueue.push({
          type: "image",
          src: child.src,
          alt: child.alt || "",
        });
      } else if (child.tagName === "A") {
        contentQueue.push({
          type: "link_block",
          href: child.href,
          text: child.textContent,
          target: child.target || "_self",
          speed: parseInt(child.dataset.speed) || defaultTypingInterval,
        });
      }
    }

    typeContent();
  }
}

function typeContent() {
  if (currentChunkIndex >= contentQueue.length) {
    typingTimer = null;
    return;
  }

  const currentChunk = contentQueue[currentChunkIndex];
  let delayForNextAction = defaultTypingInterval;

  if (currentChunk.type === "paragraph") {
    if (!currentParentParagraph) {
      currentParentParagraph = document.createElement("p");
      currentParentParagraph.style.wordBreak = "break-all";
      currentParentParagraph.style.margin = "0";
      currentParentParagraph.style.padding = "0";
      if (currentChunk.color) {
        currentParentParagraph.style.color = currentChunk.color;
      }
      mc.appendChild(currentParentParagraph);
      currentSubChunkIndex = 0;
    }

    const subChunk = currentChunk.content[currentSubChunkIndex];

    if (!subChunk) {
      currentChunkIndex++;
      currentSubChunkIndex = 0;
      currentCharIndex = 0;
      currentParentParagraph = null;
      currentTypingElement = null;
      currentTextNode = null;
      delayForNextAction = 0;
      mc.appendChild(document.createElement("br"));
    } else if (subChunk.type === "text") {
      currentTypingElement = currentParentParagraph;

      if (!currentTextNode || currentTextNode.parentNode !== currentTypingElement) {
        currentTextNode = document.createTextNode("");
        currentTypingElement.appendChild(currentTextNode);
        currentCharIndex = 0;
      }

      if (currentCharIndex < subChunk.value.length) {
        currentTextNode.nodeValue += subChunk.value[currentCharIndex];
        playTypingSound(subChunk.value[currentCharIndex]);
        currentCharIndex++;
        delayForNextAction = subChunk.speed || currentChunk.speed;
      } else {
        currentSubChunkIndex++;
        currentCharIndex = 0;
        currentTextNode = null;
        delayForNextAction = 0;
      }
    } else if (subChunk.type === "link") {
      if (!currentTypingElement || currentTypingElement.tagName !== "A") {
        const link = document.createElement("a");
        link.href = subChunk.href;
        link.target = subChunk.target;
        link.className = "retro-link";
        currentParentParagraph.appendChild(link);
        currentTypingElement = link;
        currentTextNode = document.createTextNode("");
        currentTypingElement.appendChild(currentTextNode);
        currentCharIndex = 0;
      }

      if (currentCharIndex < subChunk.text.length) {
        currentTextNode.nodeValue += subChunk.text[currentCharIndex];
        playTypingSound(subChunk.text[currentCharIndex]);
        currentCharIndex++;
        delayForNextAction = subChunk.speed || currentChunk.speed;
      } else {
        currentSubChunkIndex++;
        currentCharIndex = 0;
        currentTextNode = null;
        currentTypingElement = null;
        delayForNextAction = 0;
      }
    }
  } else if (currentChunk.type === "image") {
    currentParentParagraph = null;
    currentTypingElement = null;
    currentTextNode = null;

    const img = document.createElement("img");
    img.src = currentChunk.src;
    img.alt = currentChunk.alt;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "1em 0";

    mc.appendChild(img);
    currentChunkIndex++;
    currentCharIndex = 0;
    currentSubChunkIndex = 0;
    delayForNextAction = 0;
    mc.appendChild(document.createElement("br"));
  } else if (currentChunk.type === "link_block") {
    currentParentParagraph = null;

    if (!currentTypingElement || currentTypingElement.tagName !== "A") {
      const link = document.createElement("a");
      link.href = currentChunk.href;
      link.target = currentChunk.target;
      link.className = "retro-link";
      link.style.display = "block";
      link.style.margin = "1em 0";
      mc.appendChild(link);
      currentTypingElement = link;
      currentTextNode = document.createTextNode("");
      currentTypingElement.appendChild(currentTextNode);
      currentCharIndex = 0;
    }

    if (currentCharIndex < currentChunk.text.length) {
      currentTextNode.nodeValue += currentChunk.text[currentCharIndex];
      playTypingSound(currentChunk.text[currentCharIndex]);
      currentCharIndex++;
      delayForNextAction = currentChunk.speed || defaultTypingInterval;
    } else {
      currentChunkIndex++;
      currentCharIndex = 0;
      currentSubChunkIndex = 0;
      currentTypingElement = null;
      currentTextNode = null;
      delayForNextAction = 0;
      mc.appendChild(document.createElement("br"));
    }
  }

  typingTimer = setTimeout(typeContent, delayForNextAction);
}

document.querySelectorAll(".menu_item").forEach((item) => {
  item.addEventListener("click", menu);
});

document.querySelectorAll(".content li").forEach((item) => {
  item.addEventListener("click", menu);
});

document.addEventListener("DOMContentLoaded", () => {
    const mainContentElement = document.getElementById("main_content");
    const defaultCaretColor = window.getComputedStyle(mainContentElement).getPropertyValue("caret-color");

    const hoverCaretColor = 'rgba(255, 0, 0, 0.85)';

    defaultCursorUrl = createCursorUrl(defaultCaretColor);
    hoverCursorUrl = createCursorUrl(hoverCaretColor);

    document.documentElement.style.setProperty('--default-cursor-url', defaultCursorUrl);
    document.documentElement.style.setProperty('--hover-cursor-url', hoverCursorUrl);
});

const keyboardShortcuts = {
  'Г': 'init',
  'У': 'about',
  'Д': 'achievements',
  'U': 'init',
  'E': 'about',
  'L': 'achievements'
};

window.onload = function() {
  typewriterBaseSound = new Audio('typewriter-key.mp3');
  typewriterBaseSound.volume = TYPING_VOLUME;
  typewriterBaseSound.preload = 'auto';

  switchSound = new Audio('switch-sound.mp3');
  switchSound.volume = SWITCH_VOLUME;
  switchSound.preload = 'auto';

  const powerToggle = document.getElementById('power-toggle');
  const soundToggle = document.getElementById('sound-toggle');

  if (soundToggle) {
    isSoundEnabled = soundToggle.checked;

    soundToggle.addEventListener('change', function() {
      isSoundEnabled = soundToggle.checked;
      if (switchSound && isSoundEnabled) {
        const clonedSwitchSound = switchSound.cloneNode();
        clonedSwitchSound.volume = SWITCH_VOLUME;
        clonedSwitchSound.play().catch(e => console.warn("Sound toggle switch sound play failed:", e));
      }
    });
  }

  if (powerToggle) {
    powerToggle.addEventListener('change', function() {
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
          menu();

          document.addEventListener('keydown', (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const pressedKey = event.key.toUpperCase();

            if (keyboardShortcuts[pressedKey]) {
              const targetId = keyboardShortcuts[pressedKey];
              const targetElement = document.querySelector(`#${targetId}.menu_item`);

              if (targetElement) {
                event.preventDefault();
                targetElement.click();
              }
            }
          });

        }, 700);
      }
    });
  } else {
    menu();
    document.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        const pressedKey = event.key.toUpperCase();
        if (keyboardShortcuts[pressedKey]) {
            event.preventDefault();
            const targetElement = document.querySelector(`#${keyboardShortcuts[pressedKey]}.menu_item`);
            if (targetElement) {
                targetElement.click();
            }
        }
    });
  }
};