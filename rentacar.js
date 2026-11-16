// AFN rent a car – page logic
// Data source: by default the static file backend/rentAcar.json (works on GitHub Pages).
// To use the json-server REST API instead, run it (see README) and open the page with
// ?api=http://localhost:3000  — e.g. index.html?api=http://localhost:3000
const API_URL = new URLSearchParams(location.search).get("api");
const INITIAL_CARDS = 6;

let staticDb;
const loadStaticDb = () => {
  if (!staticDb) staticDb = axios.get("./backend/rentAcar.json").then((res) => res.data);
  return staticDb;
};
const getData = (key) =>
  (API_URL ? axios.get(`${API_URL.replace(/\/$/, "")}/${key}`).then((res) => res.data) : Promise.reject(new Error("static")))
    .catch(() => loadStaticDb().then((db) => db[key]));

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const state = { cars: [], category: "Hamısı", showAll: false };

/* ---------- Mobile menu ---------- */
const navToggle = $(".nav-toggle");
const nav = $("#site-nav");
const setNav = (open) => {
  nav.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Menyunu bağla" : "Menyunu aç");
};
navToggle.addEventListener("click", () => setNav(!nav.classList.contains("open")));
$$("a", nav).forEach((a) => a.addEventListener("click", () => setNav(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setNav(false); navToggle.focus(); } });

/* ---------- Hero slider ---------- */
getData("slides").then((slides) => {
  const wrapper = $("#hero-slides");
  slides.forEach((s) => {
    const slide = el("div", "swiper-slide");
    const img = el("img");
    img.src = s.image;
    img.alt = s.title;
    img.width = 800;
    img.height = 500;
    const info = el("div", "slide-info");
    info.append(el("p", "slide-title", s.title), el("p", "slide-sub", s.subtitle), el("p", "slide-price", s.price));
    const btn = el("button", "btn btn-solid", "İndi icarə et");
    btn.type = "button";
    btn.addEventListener("click", () => selectCategory(s.category, true));
    info.append(btn);
    slide.append(info, img);
    wrapper.append(slide);
  });
  new Swiper(".hero-swiper", {
    loop: true,
    autoplay: { delay: 5000, disableOnInteraction: true },
    pagination: { el: ".swiper-pagination", clickable: true },
    navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
    a11y: { prevSlideMessage: "Əvvəlki slayd", nextSlideMessage: "Növbəti slayd" },
  });
});

/* ---------- Cars, filters, show all ---------- */
const carsList = $("#cars");
const statusEl = $("#cars-status");
const showAllBtn = $("#show-all");
const filtersEl = $("#filters");

function renderFilters(categories) {
  filtersEl.innerHTML = "";
  categories.forEach(({ name }) => {
    const b = el("button", "filter", name);
    b.type = "button";
    b.dataset.category = name;
    b.setAttribute("aria-pressed", String(name === state.category));
    b.addEventListener("click", () => selectCategory(name));
    filtersEl.append(b);
  });
}

function selectCategory(name, scroll) {
  state.category = name;
  state.showAll = false;
  $$(".filter", filtersEl).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.category === name)));
  renderCars();
  if (scroll) $("#avtomobiller").scrollIntoView({ behavior: "smooth" });
}

function carCard(car) {
  const li = el("li", "car-card");
  const media = el("div", "car-media");
  const img = el("img");
  img.src = car.image;
  img.alt = `${car.model}, ${car.year}`;
  img.loading = "lazy";
  img.width = 800;
  img.height = 500;
  media.append(img, el("span", "badge", car.category));
  if (!car.available) media.append(el("span", "badge busy", "Hazırda icarədədir"));
  const body = el("div", "car-body");
  body.append(el("h3", "", car.model), el("p", "car-year", `Buraxılış ili: ${car.year}`), el("p", "car-price", `${car.pricePerDay} AZN/gün`));
  const specs = el("ul", "car-specs");
  [`${car.engine} L`, car.transmission, car.fuelType, `${car.seats} yer`].forEach((t) => specs.append(el("li", "", t)));
  const btn = el("button", "btn btn-ghost", "Ətraflı");
  btn.type = "button";
  btn.setAttribute("aria-label", `${car.model} – ətraflı`);
  btn.addEventListener("click", () => openCar(car));
  li.append(media, body, specs, btn);
  return li;
}

function renderCars() {
  const list = state.category === "Hamısı" ? state.cars : state.cars.filter((c) => c.category === state.category);
  const visible = state.showAll ? list : list.slice(0, INITIAL_CARDS);
  carsList.innerHTML = "";
  visible.forEach((c) => carsList.append(carCard(c)));
  statusEl.textContent = list.length ? `${list.length} avtomobil tapıldı${state.category !== "Hamısı" ? ` (${state.category})` : ""}.` : "Bu kateqoriyada avtomobil yoxdur.";
  showAllBtn.hidden = list.length <= INITIAL_CARDS;
  showAllBtn.textContent = state.showAll ? "Daha az göstər" : `Hamısını göstər (${list.length})`;
  showAllBtn.setAttribute("aria-expanded", String(state.showAll));
}

showAllBtn.addEventListener("click", () => {
  state.showAll = !state.showAll;
  renderCars();
  if (!state.showAll) $("#avtomobiller").scrollIntoView({ behavior: "smooth" });
});

$$(".class-tile").forEach((t) => t.addEventListener("click", () => selectCategory(t.dataset.category, true)));

Promise.all([getData("categories"), getData("cars")])
  .then(([categories, cars]) => {
    state.cars = cars;
    renderFilters(categories);
    renderCars();
    fillCarSelect(cars);
  })
  .catch(() => { statusEl.textContent = "Avtomobil siyahısı yüklənmədi. Səhifəni yeniləyin."; });

/* ---------- Car detail modal ---------- */
const carModal = $("#car-modal");
let modalCar = null;

function openCar(car) {
  modalCar = car;
  $("#modal-img").src = car.image;
  $("#modal-img").alt = `${car.model}, ${car.year}`;
  $("#modal-cat").textContent = car.category;
  $("#modal-title").textContent = car.model;
  $("#modal-price").textContent = `${car.pricePerDay} AZN/gün`;
  const specs = $("#modal-specs");
  specs.innerHTML = "";
  [["Marka", car.brand], ["Buraxılış ili", car.year], ["Mühərrik", `${car.engine} L`], ["Sürətlər qutusu", car.transmission],
   ["Yanacaq", car.fuelType], ["Yer sayı", car.seats], ["Rəng", car.color], ["Status", car.available ? "Boşdur" : "Hazırda icarədədir"]]
    .forEach(([k, v]) => { specs.append(el("dt", "", k), el("dd", "", String(v))); });
  carModal.showModal();
}

$("#modal-book").addEventListener("click", () => {
  carModal.close();
  if (modalCar) $("#r-car").value = modalCar.id;
  updateEstimate();
  $("#rezervasiya").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#r-name").focus({ preventScroll: true }), 400);
});

$$("dialog").forEach((d) => {
  $$(".modal-close, [data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
});

/* ---------- Reservation form ---------- */
const form = $("#res-form");
const carSelect = $("#r-car");
const fromInput = $("#r-from");
const toInput = $("#r-to");
const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
fromInput.min = todayISO();
toInput.min = todayISO();

function fillCarSelect(cars) {
  cars.forEach((c) => {
    const o = el("option", "", `${c.model} – ${c.pricePerDay} AZN/gün${c.available ? "" : " (hazırda icarədədir)"}`);
    o.value = c.id;
    o.disabled = !c.available;
    carSelect.append(o);
  });
}

const days = () => {
  if (!fromInput.value || !toInput.value) return 0;
  return Math.round((new Date(toInput.value) - new Date(fromInput.value)) / 86400000);
};

function updateEstimate() {
  const car = state.cars.find((c) => c.id === carSelect.value);
  const d = days();
  $("#estimate").textContent = car && d > 0 ? `Təxmini məbləğ: ${d} gün × ${car.pricePerDay} AZN = ${d * car.pricePerDay} AZN` : "";
}
[carSelect, fromInput, toInput].forEach((i) => i.addEventListener("change", updateEstimate));
fromInput.addEventListener("change", () => { toInput.min = fromInput.value || todayISO(); });

function setError(input, msg) {
  $(`#${input.id}-err`).textContent = msg;
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) input.setAttribute("aria-describedby", `${input.id}-err`);
}

function validate() {
  const checks = [
    [$("#r-name"), (v) => (v.trim().length >= 3 ? "" : "Ad və soyadı yazın (ən azı 3 hərf).")],
    [$("#r-phone"), (v) => (/^[+]?[0-9 ()-]{9,}$/.test(v.trim()) ? "" : "Telefon nömrəsini düzgün yazın, məsələn +994 50 000 00 00.")],
    [carSelect, (v) => (v ? "" : "Avtomobil seçin.")],
    [fromInput, (v) => (!v ? "Götürmə tarixini seçin." : v < todayISO() ? "Keçmiş tarix seçmək olmaz." : "")],
    [toInput, (v) => (!v ? "Qaytarma tarixini seçin." : days() < 1 ? "Qaytarma tarixi götürmə tarixindən sonra olmalıdır." : "")],
  ];
  let firstBad = null;
  checks.forEach(([input, fn]) => {
    const msg = fn(input.value);
    setError(input, msg);
    if (msg && !firstBad) firstBad = input;
  });
  return firstBad;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const bad = validate();
  if (bad) { bad.focus(); return; }
  const car = state.cars.find((c) => c.id === carSelect.value);
  const d = days();
  const box = $("#confirm-text");
  box.innerHTML = "";
  box.append(
    el("p", "", `Hörmətli ${$("#r-name").value.trim()}, ${car.model} üçün sorğunuz qeydə alındı.`),
    el("p", "", `Tarix: ${fromInput.value} – ${toInput.value} (${d} gün). Götürmə yeri: ${$("#r-place").value}.`),
    el("p", "", `Təxmini məbləğ: ${d * car.pricePerDay} AZN. Menecer ${$("#r-phone").value.trim()} nömrəsi ilə əlaqə saxlayacaq.`),
    el("p", "muted", "Bu demo layihədir: məlumat heç yerə göndərilmir.")
  );
  $("#confirm-modal").showModal();
  form.reset();
  $("#estimate").textContent = "";
});
