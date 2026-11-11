// containerləri tuturuq
const swiperContainer = document.querySelector(".swiper-container");
const carsContainer = document.querySelector(".cars");
const categoriyaContainer = document.querySelector(".categoriya");

const endpoint = "http://localhost:3000/";

// Lokalda json-server (localhost:3000) işləyirsə ondan oxuyuruq.
// GitHub Pages-də və ya server işləmirsə eyni datanı backend/rentAcar.json faylından götürürük.
const tryLocalApi = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
let staticDb;
const loadStaticDb = () => {
  if (!staticDb) staticDb = axios.get("./backend/rentAcar.json").then((res) => res.data);
  return staticDb;
};
const getData = (key) =>
  (tryLocalApi ? axios.get(endpoint + key) : Promise.reject(new Error("no local API")))
    .catch(() => loadStaticDb().then((db) => ({ status: 200, statusText: "OK", data: db[key] })));
//---------------------------------------------------------------------------------
// Swiper instansiyasını bir dəfə yaratmaq
let swiperInstance;
// Swiper üçün API ilə əlaqə qururuq
getData("swippers")
  .then((res) => {
    if (res.status === 200) {
      showSwipper(res.data); // Serverdən gələn məlumatı göstərmək
      // Swiper-in başlanğıcını göstərmək
      if (!swiperInstance) {
        // Burada "swipper" əvəzinə "Swiper" istifadə edilir
        swiperInstance = new Swiper('.swiper-container', {
          loop: true,
          slidesPerView: 1, // Hər slaydda 1 görünəcək
          spaceBetween: 5, // Slaytlar arasında məsafə
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          },
          pagination: {
            el: '.swiper-pagination',
            clickable: true,
          },
          autoplay: {
            delay: 3000, // 3 saniyədən bir avtomatik dəyişir
          },
          breakpoints: {
            768: {
              slidesPerView: 1,
            },
            978: {
              slidesPerView: 1,
            },
          },
        });
      }
    }
  })
  

// Swipper göstərmək funksiyası
const showSwipper = (a) => {
  swiperContainer.innerHTML = "";
  // Yalnızca bir dəfə swiper-wrapper əlavə edirik
  const swiperWrapper = document.createElement("div");
  swiperWrapper.classList.add("swiper-wrapper");
  a.forEach(({ imageUrl, names, description, price }) => {
    const slide = document.createElement("div");
    slide.classList.add("swiper-slide");
    slide.innerHTML = `
      <img src="${imageUrl}" alt="car">
      <div class="info">
        <h1>${names}</h1>
        <h2>${description}</h2>
        <p>${price}</p>
        <a href="#">İndi icarə et</a>
      </div>
    `;
    swiperWrapper.appendChild(slide);
  });

  swiperContainer.appendChild(swiperWrapper);
};

// `cars` verilənlərini serverdən çəkirik
getData("cars")
  .then((res) => {
    if (res.status === 200 && res.statusText === "OK") {
      showCars(res.data); // cars arrayini ekrana göstərmək
    }
  })
  

// Avtomobilləri göstərmək funksiyası
const showCars = (arr) => {
  carsContainer.innerHTML = "";
  // Grid sistemi ilə avtomobilləri düzgün yerləşdiririk
  arr.forEach(({ model, categories, pricePerDay, engine, image, brand, year, transmission }) => {
    carsContainer.innerHTML += `
      <div class="car-item">
        <div class="rounded overflow-hidden shadow-lg">
          <div class="relative">
            <a href="#">
              <img class="w-full" src="${image}" alt="car for rent">
              <div class="hover:bg-transparent transition duration-300 absolute bottom-0 top-0 right-0 left-0 bg-gray-900 opacity-25"></div>
            </a>
            <a href="#!">
              <div class="text-xs absolute top-0 right-0 bg-orange-600 px-4 py-2 text-white mt-3 mr-3 border-2 border-orange-600 hover:bg-white hover:text-orange-600 transition duration-500 ease-in-out">
                ${categories}
              </div>
            </a>
          </div>

          <div class="px-6 py-4 mb-auto">
            <a href="#" class="font-bold text-2xl inline-block hover:text-indigo-600 transition duration-500 ease-in-out inline-block mb-2 text-black">${model}</a>
            <p class="font-bold text-black text-sm">${year} ci il</p>
            <p class="text-orange-600 text-xl font-bold">${pricePerDay} AZN/gün</p>
          </div>

          <div class="px-6 py-3 flex flex-row items-center justify-between bg-gray-100 border-t border-gray-400">
            <div class="flex items-center">
              <svg class="w-4 h-4 text-gray-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              <span class="ml-1 text-gray-500">${engine}L</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-gray-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
              <span class="ml-1 text-gray-500">${brand}</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-gray-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20"></path>
                <path d="M5 7l7 7 7-7"></path>
              </svg>
              <span class="ml-1 text-gray-500">${transmission}</span>
            </div>
          </div>

          <!-- Buton -->
          <div class="px-6 py-3">
            <a href="#!" class="inline-block px-6 py-2 bg-white text-orange-600 font-medium text-center rounded-full border-2 border-orange-600 hover:bg-orange-600 hover:text-white transition duration-300 ease-in-out">
              Ətraflı
            </a>
          </div>
        </div>
      </div>`;
  });
};

// `categories` verilənlərini serverdən çəkirik
getData("categories")
  .then((res) => {
    if (res.status === 200 && res.statusText === "OK") {
      showCategoriya(res.data); // categories arrayini ekrana göstərmək
    }
  })
  
// Kateqoriyanı göstərmək funksiyası
const showCategoriya = (arr) => {
  categoriyaContainer.innerHTML = "";
  arr.forEach((c) => {
    // `onclick` hadisəsi ilə kateqoriya seçimini edirik
    categoriyaContainer.innerHTML += `<p onclick="filterByCategory('${c.name}')"> ${c.name}</p>`;
  });
};

// Funksiya: Kateqoriya seçildikdə, maşınları filtr etmək
function filterByCategory(filter) {
  // API-dən `cars` məlumatını çəkirik
  getData("cars")
    .then((res) => {
      let filteredCars;  
      if (filter === "Hamısı") {
        // "Hamısı" seçildikdə, bütün avtomobilləri göstəririk
        filteredCars = res.data; 
      } else {
        // Seçilmiş kateqoriya uzre filtr edirik
        filteredCars = res.data.filter((car) => {
          return car.categories.includes(filter); // `filter`-in car.categories-də olub olmadığını yoxlayırıq
        });
      }
      
      showCars(filteredCars);
    })
    
}