'use strict';

const SHEET_ID = '1DcVTQueJPmJlfYNSFrQ6gAtfQki5g2mJ6Zm4cGhE7AM';

const GVIZ_BASE_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;

const ARCANA_SHEET_ID =
  '10yLQ3RyxoaOkrOcRIA8yq--dARDp6gFiidEtWtKkJIY';

const ARCANA_GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${ARCANA_SHEET_ID}/gviz/tq`;

const PHOTOS = {
  samael:
    'https://raw.githubusercontent.com/arturosm89/web/refs/heads/main/img/vmsaw.jpg',

  lakhsmi:
    'https://raw.githubusercontent.com/arturosm89/web/refs/heads/main/img/vmld.jpg'
};

const invitations = {
  martes:
    '{saludo} hermanos invitamos para hoy cadena de fuerza y meditación. Abrazo grande! 😃🫂🌹',

  miercoles:
    '{saludo} hermanos😃 quedamos invitados hoy a participar de la cadena con la Divina Madre y el Señor Jehova 🫂🌹',

  jueves:
    '{saludo} hermanos 😃 quedamos todos invitados hoy cadena de curación 🫂🌹',

  sabado:
    '{saludo} hermanos 😃\nInvitamos a todos para hoy al taller de estudio y posteriormente al oficio litúrgico\nAbrazo grande🫂🌹',

  dia19:
    '{saludo} hermanos 😃\n\nLos invitamos hoy a la Plegaria al Cristo.\n\nAbrazo grande!🫂❤️🌹'
};

let selectedActivity = null;
let selectedQuote = null;
let totalQuotes = 0;
let loadingQuote = false;

const elements = {
  date: document.querySelector('#currentDate'),
  time: document.querySelector('#currentTime'),
  status: document.querySelector('#sheetStatus'),
  grid: document.querySelector('#activityButtons'),
  day19: document.querySelector('#day19Button'),
  empty: document.querySelector('#emptyState'),
  card: document.querySelector('#messageCard'),
  invitation: document.querySelector('#invitationText'),
  quote: document.querySelector('#quoteText'),
  teacher: document.querySelector('#teacherName'),
  reference: document.querySelector('#quoteReference'),
  photo: document.querySelector('#teacherPhoto'),
  quoteBlock: document.querySelector('#quoteBlock'),
  actions: document.querySelector('#actions'),
  refresh: document.querySelector('#refreshQuote'),
  copy: document.querySelector('#copyButton'),
  whatsapp: document.querySelector('#whatsappButton'),
  toast: document.querySelector('#toast'),

  quotesView: document.querySelector('#quotesView'),
  kabalaView: document.querySelector('#kabalaView'),
  openKabala: document.querySelector('#openKabalaButton'),
  backToQuotes: document.querySelector('#backToQuotesButton'),

  kabalaForm: document.querySelector('#kabalaForm'),
  kabalaName: document.querySelector('#kabalaName'),
  kabalaBirthDate: document.querySelector('#kabalaBirthDate'),
  kabalaError: document.querySelector('#kabalaError'),
  kabalaLoading: document.querySelector('#kabalaLoading'),
  kabalaResults: document.querySelector('#kabalaResults'),

  innerUrgency: document.querySelector('#innerUrgencyResult'),
  fundamentalTone: document.querySelector('#fundamentalToneResult'),
  initiaticKabala: document.querySelector('#initiaticKabalaResult'),

  currentArcanoText: document.querySelector('#currentArcanoText'),
  currentArcanoAxiom: document.querySelector('#currentArcanoAxiom'),
  nextArcanoText: document.querySelector('#nextArcanoText'),
  nextArcanoAxiom: document.querySelector('#nextArcanoAxiom'),
  currentArcanoImage: document.querySelector('#currentArcanoImage'),
  nextArcanoImage: document.querySelector('#nextArcanoImage'),

  currentArcanoImageWrap: document.querySelector('#currentArcanoImage').parentElement,
  nextArcanoImageWrap: document.querySelector('#nextArcanoImage').parentElement,

  currentArcanoLink: document.querySelector('#currentArcanoLink'),
  nextArcanoLink: document.querySelector('#nextArcanoLink'),
};

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getGreeting() {
  return new Date().getHours() < 12
    ? 'Buenos días'
    : 'Buenas tardes';
}

function updateClock() {
  const now = new Date();

  elements.date.textContent = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(now);

  elements.time.textContent = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);

  const show19 = now.getDate() === 19;

  elements.day19.classList.toggle('hidden', !show19);
  elements.grid.classList.toggle('has-special', show19);
}

function cellValue(cell) {
  if (!cell) return '';
  return cell.v ?? cell.f ?? '';
}

/*
 * Ejecuta una consulta GViz usando JSONP.
 * La hoja devuelve solamente los registros pedidos por la consulta.
 */
function runSheetQuery(query) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `sheetCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = response => {
      cleanup();

      if (response?.status === 'error') {
        reject(
          new Error(
            response.errors?.[0]?.detailed_message ||
            'Error al consultar la hoja.'
          )
        );

        return;
      }

      resolve(response);
    };

    const params = new URLSearchParams({
      tqx: `responseHandler:${callbackName}`,
      tq: query,
      range: 'A:E',
      _: Date.now().toString()
    });

    script.src = `${GVIZ_BASE_URL}?${params.toString()}`;

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Google Sheets.'));
    };

    document.body.appendChild(script);
  });
}

/*
 * Consulta únicamente cuántas frases existen.
 * No descarga las frases completas.
 */
async function loadQuoteCount() {
  const response = await runSheetQuery(
    'select count(A) where B is not null and C is not null'
  );

  const countCell = response?.table?.rows?.[0]?.c?.[0];

  totalQuotes = Number(cellValue(countCell)) || 0;

  if (totalQuotes <= 0) {
    throw new Error('No se encontraron frases válidas.');
  }
}

/*
 * Trae una sola frase aleatoria.
 *
 * Ejemplo de consulta generada:
 * select A, B, C, D, E
 * where B is not null and C is not null
 * offset 25
 * limit 1
 */
async function fetchRandomQuote(attempt = 1) {
  if (!totalQuotes) {
    await loadQuoteCount();
  }

  const randomOffset = Math.floor(Math.random() * totalQuotes);

  const query = `
    select A, B, C, D, E
    where B is not null
    and C is not null
    limit 1
    offset ${randomOffset}
    
  `;

  const response = await runSheetQuery(query);

  const row = response?.table?.rows?.[0];
  const c = row?.c || [];

  const quote = {
    id: cellValue(c[0]),

    frase: String(cellValue(c[1]))
      .replace(/--/g, ',')
      .replace(/COMMA/g, ',')
      .trim(),

    maestro: String(cellValue(c[2])).trim(),
    fuente: String(cellValue(c[3])).trim(),
    capitulo: String(cellValue(c[4])).trim()
  };

  if (!quote.frase || !quote.maestro) {
    throw new Error('La frase obtenida no es válida.');
  }

  /*
   * Si salió la misma frase que ya estaba mostrándose,
   * vuelve a intentar hasta tres veces.
   */
  if (
    totalQuotes > 1 &&
    selectedQuote &&
    quote.id === selectedQuote.id &&
    attempt < 3
  ) {
    return fetchRandomQuote(attempt + 1);
  }

  return quote;
}

function showLoadingStatus() {
  elements.status.className = 'status';
  elements.status.innerHTML = '<i></i>Cargando frase...';

  elements.refresh.disabled = true;
}

function showReadyStatus() {
  elements.status.className = 'status ready';
  elements.status.innerHTML =
    `<i></i>${totalQuotes} frases disponibles`;

  elements.refresh.disabled = false;
}

function showSheetError(error) {
  console.error(error);

  elements.status.className = 'status error';
  elements.status.innerHTML =
    '<i></i>No se pudo cargar la frase';

  elements.refresh.disabled = false;
}

async function loadRandomQuote() {
  if (loadingQuote) return;

  loadingQuote = true;
  showLoadingStatus();

  try {
    selectedQuote = await fetchRandomQuote();

    showReadyStatus();

    if (selectedActivity) {
      renderMessage();
    }
  } catch (error) {
    showSheetError(error);
  } finally {
    loadingQuote = false;
  }
}

function getPhoto(teacher) {
  const name = normalize(teacher);

  if (
    name.includes('lakhsmi') ||
    name.includes('lakhshmi') ||
    name.includes('daimon')
  ) {
    return PHOTOS.lakhsmi;
  }

  return PHOTOS.samael;
}

function buildReference(quote) {
  return [
    quote.fuente,
    quote.capitulo
      ? `Cap. ${quote.capitulo}`
      : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

function renderMessage() {
  if (!selectedActivity) return;

  const invitation =
    invitations[selectedActivity].replace(
      '{saludo}',
      getGreeting()
    );

  elements.invitation.textContent = invitation;

  elements.empty.classList.add('hidden');
  elements.card.classList.remove('hidden');
  elements.actions.classList.remove('hidden');

  if (selectedQuote) {
    elements.quoteBlock.classList.remove('hidden');

    elements.quote.textContent =
      selectedQuote.frase;

    elements.teacher.textContent =
      selectedQuote.maestro;

    elements.reference.textContent =
      buildReference(selectedQuote);

    elements.photo.src =
      getPhoto(selectedQuote.maestro);

    elements.photo.alt =
      `Fotografía de ${selectedQuote.maestro}`;

    elements.refresh.disabled = false;
  } else {
    elements.quoteBlock.classList.add('hidden');
    elements.refresh.disabled = true;
  }

  elements.whatsapp.href =
    `https://wa.me/?text=${encodeURIComponent(getFullMessage())}`;
}

function getFullMessage() {
  const parts = [
    elements.invitation.textContent.trim()
  ];

  if (selectedQuote) {
    const reference =
      buildReference(selectedQuote);

    parts.push(
      `“${selectedQuote.frase}”\n` +
      `— ${selectedQuote.maestro}` +
      `${reference ? ` · ${reference}` : ''}`
    );
  }

  return parts.join('\n\n');
}

function selectActivity(button) {
  document
    .querySelectorAll('.activity-btn')
    .forEach(btn => btn.classList.remove('selected'));

  button.classList.add('selected');

  selectedActivity = button.dataset.activity;

  renderMessage();
}

document
  .querySelectorAll('.activity-btn')
  .forEach(button => {
    button.addEventListener('click', () => {
      selectActivity(button);
    });
  });

elements.refresh.addEventListener('click', async () => {
  await loadRandomQuote();
});

elements.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(
      getFullMessage()
    );
  } catch {
    const area =
      document.createElement('textarea');

    area.value = getFullMessage();

    document.body.appendChild(area);
    area.select();

    document.execCommand('copy');

    area.remove();
  }

  elements.toast.classList.add('show');

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 1800);
});

/*
 * Suma los dígitos de un número.
 *
 * 1989 = 1 + 9 + 8 + 9 = 27
 */
function sumDigits(value) {
  return String(Math.abs(Number(value)))
    .replace(/\D/g, '')
    .split('')
    .reduce((total, digit) => total + Number(digit), 0);
}

/*
 * Reduce cualquier número hasta obtener
 * un resultado entre 1 y 9.
 *
 * 27 = 2 + 7 = 9
 * 20 = 2 + 0 = 2
 */
function reduceToOneDigit(value) {
  let number = Math.abs(Number(value));

  while (number > 9) {
    number = sumDigits(number);
  }

  return number;
}

/*
 * Convierte YYYY-MM-DD a fecha local.
 * Evita que JavaScript cambie el día por el huso horario.
 */
function parseLocalDate(value) {
  const parts = value.split('-').map(Number);

  if (parts.length !== 3) {
    return null;
  }

  const [year, month, day] = parts;

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/*
 * Cuenta solamente letras.
 * No cuenta espacios, números, guiones ni signos.
 */
function countNameLetters(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .length;
}

function calculateAge(birthDate, today = new Date()) {
  let age =
    today.getFullYear() -
    birthDate.getFullYear();

  const birthdayThisYear = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );

  if (today < birthdayThisYear) {
    age--;
  }

  return age;
}

/*
 * Calcula la fecha que está 183 días después
 * del cumpleaños correspondiente a la edad actual.
 *
 * Ejemplo:
 * nacimiento 27/02/1989
 * cumpleaños 27/02/2026
 * + 183 días = 29/08/2026
 */
function calculateArcanoChangeDate(birthDate, age) {
  const birthdayYear =
    birthDate.getFullYear() + age;

  const birthday = new Date(
    birthdayYear,
    birthDate.getMonth(),
    birthDate.getDate()
  );

  const changeDate = new Date(birthday);

  changeDate.setDate(changeDate.getDate() + 183);

  return changeDate;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function showKabalaError(message) {
  elements.kabalaError.textContent = message;
  elements.kabalaError.classList.remove('hidden');
}

function clearKabalaError() {
  elements.kabalaError.textContent = '';
  elements.kabalaError.classList.add('hidden');
}

/*
 * Consulta una única carta en la hoja correspondiente.
 *
 * Mayores: 1 a 22.
 * Menores: 23 a 78.
 *
 * Columna A: número.
 * Columna B: nombre.
 * Columna F: axioma trascendente.
 */
function fetchArcano(number) {
  return new Promise((resolve, reject) => {
    const sheetName =
      number <= 22
        ? 'Mayores'
        : 'Menores';

    const callbackName =
      `arcanoCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = response => {
      cleanup();

      if (response?.status === 'error') {
        reject(
          new Error(
            response.errors?.[0]?.detailed_message ||
            `No se pudo consultar el Arcano ${number}.`
          )
        );

        return;
      }

      const row = response?.table?.rows?.[0];
      const cells = row?.c || [];

      const arcano = {
        numero: Number(cellValue(cells[0])),
        nombre: String(cellValue(cells[1])).trim(),
        axioma: String(cellValue(cells[5])).trim(),
        fileId: String(cellValue(cells[11])).trim()
      };

      if (!arcano.numero || !arcano.nombre) {
        reject(
          new Error(
            `No se encontró el Arcano ${number} en la hoja ${sheetName}.`
          )
        );

        return;
      }

      resolve(arcano);
    };

    const query = `
      select A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P
      where A = ${number}
      limit 1
    `;

    const params = new URLSearchParams({
      tqx: `responseHandler:${callbackName}`,
      tq: query,
      sheet: sheetName,
      range: 'A:P',
      _: Date.now().toString()
    });

    script.src =
      `${ARCANA_GVIZ_URL}?${params.toString()}`;

    script.onerror = () => {
      cleanup();

      reject(
        new Error(
          `No se pudo conectar con la hoja de Arcanos.`
        )
      );
    };

    document.body.appendChild(script);
  });
}

function showKabalaView() {
  elements.quotesView.classList.add('hidden');
  elements.kabalaView.classList.remove('hidden');

  window.scrollTo({
    top: elements.kabalaView.offsetTop - 20,
    behavior: 'smooth'
  });

  setTimeout(() => {
    elements.kabalaName.focus();
  }, 300);
}

function showQuotesView() {
  elements.kabalaView.classList.add('hidden');
  elements.quotesView.classList.remove('hidden');

  window.scrollTo({
    top: elements.quotesView.offsetTop - 20,
    behavior: 'smooth'
  });
}

async function calculateKabala(event) {
  event.preventDefault();

  clearKabalaError();

  const name =
    elements.kabalaName.value.trim().toUpperCase();

  const birthDate =
    parseLocalDate(elements.kabalaBirthDate.value);

  if (!name) {
    showKabalaError(
      'Ingresá el nombre completo.'
    );

    return;
  }

  const letterCount =
    countNameLetters(name);

  if (letterCount === 0) {
    showKabalaError(
      'El nombre debe contener letras.'
    );

    return;
  }

  if (!birthDate) {
    showKabalaError(
      'Ingresá una fecha de nacimiento válida.'
    );

    return;
  }

  const today = new Date();

  if (birthDate > today) {
    showKabalaError(
      'La fecha de nacimiento no puede ser futura.'
    );

    return;
  }

  /*
   * URGENCIA INTERIOR
   *
   * Día reducido + mes reducido + año reducido.
   * El resultado final también se reduce.
   */
  const reducedDay =
    reduceToOneDigit(birthDate.getDate());

  const reducedMonth =
    reduceToOneDigit(birthDate.getMonth() + 1);

  const reducedYear =
    reduceToOneDigit(birthDate.getFullYear());

  const innerUrgency =
    reduceToOneDigit(
      reducedDay +
      reducedMonth +
      reducedYear
    );

  /*
   * TÓNICA FUNDAMENTAL
   *
   * Cantidad de letras reducida + urgencia interior.
   * El resultado final también se reduce.
   */
  const reducedLetterCount =
    reduceToOneDigit(letterCount);

  const fundamentalTone =
    reduceToOneDigit(
      reducedLetterCount +
      innerUrgency
    );

  /*
   * KÁBALA INICIÁTICA
   *
   * Suma simple de los dígitos del año,
   * más el mes sin reducir,
   * más el día reducido.
   *
   * Después se divide entre 10.
   */
  const yearSum =
    sumDigits(birthDate.getFullYear());

  const monthNumber =
    birthDate.getMonth() + 1;

  const initiaticTotal =
    yearSum +
    monthNumber +
    reducedDay;

  const initiaticKabala =
    initiaticTotal / 10;

  const age =
    calculateAge(birthDate, today);

  if (age < 1 || age > 77) {
    showKabalaError(
      'La edad debe permitir consultar los Arcanos del 1 al 78.'
    );

    return;
  }

  const currentArcanoNumber = age;
  const nextArcanoNumber = age + 1;

  const changeDate =
    calculateArcanoChangeDate(
      birthDate,
      age
    );

  elements.kabalaName.value = name;

  elements.kabalaLoading.classList.remove('hidden');
  elements.kabalaResults.classList.add('hidden');

  try {
    const [
      currentArcano,
      nextArcano
    ] = await Promise.all([
      fetchArcano(currentArcanoNumber),
      fetchArcano(nextArcanoNumber)
    ]);

    elements.innerUrgency.textContent =
      innerUrgency;

    elements.fundamentalTone.textContent =
      fundamentalTone;

    elements.initiaticKabala.textContent =
      Number.isInteger(initiaticKabala)
        ? initiaticKabala.toFixed(1)
        : initiaticKabala.toString();

    elements.currentArcanoText.textContent =
      `Por la edad que tiene, a la persona la rige el ` +
      `Arcano ${currentArcano.numero} (${currentArcano.nombre}).`;

    elements.currentArcanoAxiom.textContent =
      currentArcano.axioma || 'Sin axioma registrado.';


    // elements.currentArcanoImage.src =
    //   `https://lh3.googleusercontent.com/d/${currentArcano.fileId}`;

    // elements.currentArcanoImage.alt =
    //   currentArcano.nombre;

    if (currentArcano.fileId) {
      elements.currentArcanoImage.src =
        `https://lh3.googleusercontent.com/d/${currentArcano.fileId}=w300`;

      const currentImage =
        `https://lh3.googleusercontent.com/d/${currentArcano.fileId}`;

      elements.currentArcanoLink.href = currentImage;

      elements.currentArcanoImage.src =
        currentImage + '=w300';


      elements.currentArcanoImage.alt =
        `Arcano ${currentArcano.numero}: ${currentArcano.nombre}`;

      //elements.currentArcanoImage.classList.remove('hidden');
      elements.currentArcanoImageWrap.classList.remove('hidden');
    } else {
      elements.currentArcanoImage.removeAttribute('src');
      //elements.currentArcanoImage.classList.add('hidden');
      elements.currentArcanoImageWrap.classList.add('hidden');
    }

    // elements.nextArcanoText.textContent =
    //   `Pero a partir del ${formatDate(changeDate)}, ` +
    //   `a la persona también la empezará a regir el ` +
    //   `Arcano ${nextArcano.numero} (${nextArcano.nombre}).`;

    const changeDateAlreadyPassed = today >= changeDate;

    elements.nextArcanoText.textContent =
      changeDateAlreadyPassed
        ? `Pero a partir del ${formatDate(changeDate)}, ` +
          `a la persona también la empezó a regir el ` +
          `Arcano ${nextArcano.numero} (${nextArcano.nombre}).`
        : `Pero a partir del ${formatDate(changeDate)}, ` +
          `a la persona también la empezará a regir el ` +
          `Arcano ${nextArcano.numero} (${nextArcano.nombre}).`;


    elements.nextArcanoAxiom.textContent =
      nextArcano.axioma || 'Sin axioma registrado.';



    // elements.nextArcanoImage.src =
    //   `https://lh3.googleusercontent.com/d/${nextArcano.fileId}`;

    // elements.nextArcanoImage.alt =
    //   nextArcano.nombre;

    if (nextArcano.fileId) {
      // elements.nextArcanoImage.src =
      //   `https://lh3.googleusercontent.com/d/${nextArcano.fileId}=w300`;

      const nextImage =
        `https://lh3.googleusercontent.com/d/${nextArcano.fileId}`;

      elements.nextArcanoLink.href = nextImage;

      elements.nextArcanoImage.src =
        nextImage + '=w300';

      elements.nextArcanoImage.alt =
        `Arcano ${nextArcano.numero}: ${nextArcano.nombre}`;

      //elements.nextArcanoImage.classList.remove('hidden');
      elements.nextArcanoImageWrap.classList.remove('hidden');
    } else {
      elements.nextArcanoImage.removeAttribute('src');
      //elements.nextArcanoImage.classList.add('hidden');
      elements.nextArcanoImageWrap.classList.add('hidden');
    }

    elements.kabalaResults.classList.remove('hidden');
  } catch (error) {
    console.error(error);

    showKabalaError(
      error.message ||
      'No se pudieron obtener los Arcanos.'
    );
  } finally {
    elements.kabalaLoading.classList.add('hidden');
  }
}

elements.openKabala.addEventListener(
  'click',
  showKabalaView
);

elements.backToQuotes.addEventListener(
  'click',
  showQuotesView
);

elements.kabalaName.addEventListener(
  'input',
  event => {
    /*
     * Convierte automáticamente todo lo escrito
     * a mayúsculas.
     */
    const position =
      event.target.selectionStart;

    event.target.value =
      event.target.value.toUpperCase();

    event.target.setSelectionRange(
      position,
      position
    );
  }
);

elements.kabalaForm.addEventListener(
  'submit',
  calculateKabala
);

updateClock();

setInterval(updateClock, 1000);

/*
 * Al abrir la página:
 * 1. Consulta la cantidad de frases.
 * 2. Trae solamente una frase aleatoria.
 */
loadRandomQuote();