'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// A general Workout class
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in mi
    this.duration = duration; // in min
  }

  // Description for the workout message
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 
    'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/mi
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // mi/hour
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////
// Application Architecture
class App {
  #map;
  #mapEve;
  #workouts = [];
  #mapZoomLevel = 13;
  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Submit the form
    form.addEventListener('submit', this._newWorkout.bind(this));

    // Toggle "Elev Gain" and "Cadence"
    inputType.addEventListener('change', this._toggleElevationField);

    // Click the submitted form and make the map move to the corresponding marker
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  // Get the current position with "geolocation" API
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // "_loadMap" method for now is a regular function call, then "this" will set as "undefined"
        this._loadMap.bind(this),
        function () {
          alert('Failed to get the current position 😌');
        }
      );
    }
  }

  // Load an editable "openStreetMap" via "Leaflet" library
  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    // Initialize the map and set the view with coordinates and zoom level
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Render the workout marker after loading the map
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  // Show a form after the user clicks on the map
  _showForm(mapEvent) {
    this.#mapEve = mapEvent;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  // Hide and display a new form after the user submits
  _hideForm() {
    // Clear inputs
    inputDistance.value = inputCadence.value = inputDuration.value = inputElevation.value =
      '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // toggle the "Elevation gain" and "cadence" when the input type is switched
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // Initialize the marker and recreate another form each time
  _newWorkout(e) {
    e.preventDefault();

    // Validate if the input types are "Number"
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    // Validate if the numbers are positive
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEve.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive number');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive number');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);
    console.log(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  // Render the corresponding marker on the map
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'} ${workout.description}`
      )
      .openPopup();
  }

  // Render the corresponding workout message on the list
  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">mi</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/mi</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">mi/h</span>
      </div>
      <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
      </div>
    </li>
      `;
    }

    // Insert the message after the form
    form.insertAdjacentHTML('afterend', html);
  }

  // By clicking the message, the current view will be moved to that corresponding marker
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // Set up localStorage for the existed workout messages
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  // Get the workout messages from localStorager and render them to the list again
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    console.log(data);

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // Remove all of the messages in the localStorage
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
