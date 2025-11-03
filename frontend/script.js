// Global variables
let currentItinerary = null;
let userBudget = null; // Store the user's original budget
let draggedActivity = null;
let draggedFromDay = null;
let map = null;
let currentMarker = null;
let placesService = null;
let googleMapsApiKey = null; // Store the Google Maps API key

// DOM elements
const searchSection = document.getElementById("searchSection");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const errorSection = document.getElementById("errorSection");
const calendarContainer = document.getElementById("calendarContainer");
const itineraryForm = document.getElementById("itineraryForm");
const searchBtn = document.getElementById("searchBtn");
const editBtn = document.getElementById("editBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const retryBtn = document.getElementById("retryBtn");
const replacementModal = document.getElementById("replacementModal");
const closeModal = document.getElementById("closeModal");

// API Configuration
const API_BASE_URL = ""; // Use relative URLs for deployment

// Load configuration from backend
async function loadConfiguration() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const config = await response.json();
      googleMapsApiKey = config.google_maps_api_key;
      console.log("Configuration loaded successfully");

      // Load Google Maps API dynamically
      if (googleMapsApiKey) {
        await loadGoogleMapsAPI();
      } else {
        console.warn("Google Maps API key not found in configuration");
      }
    } else {
      console.error("Failed to load configuration");
    }
  } catch (error) {
    console.error("Error loading configuration:", error);
  }
}

// Load Google Maps API dynamically
function loadGoogleMapsAPI() {
  return new Promise((resolve, reject) => {
    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;

    // Set up callback
    window.initMap = function () {
      console.log("Google Maps API loaded successfully");
      resolve();
    };

    // Handle errors
    script.onerror = function () {
      console.error("Failed to load Google Maps API");
      reject(new Error("Failed to load Google Maps API"));
    };

    // Add script to document
    document.head.appendChild(script);
  });
}

// Initialize the application
document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOM loaded, initializing event listeners...");
  console.log("itineraryForm found:", document.getElementById("itineraryForm"));
  console.log("searchBtn found:", document.getElementById("searchBtn"));

  // Load configuration including Google Maps API key
  await loadConfiguration();

  initializeEventListeners();
  validatePreferences();
  console.log("Event listeners initialized");
});

// Event Listeners
function initializeEventListeners() {
  console.log("Setting up form event listener...");
  console.log("itineraryForm element:", itineraryForm);

  if (!itineraryForm) {
    console.error("itineraryForm element not found!");
    return;
  }

  // Form submission
  itineraryForm.addEventListener("submit", handleFormSubmit);
  console.log("Form event listener set up");

  // Also add click handler to the submit button
  searchBtn.addEventListener("click", function (event) {
    console.log("Search button clicked!");
    event.preventDefault();
    handleFormSubmit(event);
  });
  console.log("Search button event listener set up");

  // Navigation buttons
  editBtn.addEventListener("click", showSearchForm);
  regenerateBtn.addEventListener("click", regenerateItinerary);
  retryBtn.addEventListener("click", showSearchForm);

  // Modal
  closeModal.addEventListener("click", closeReplacementModal);
  window.addEventListener("click", function (event) {
    if (event.target === replacementModal) {
      closeReplacementModal();
    }
  });

  // Preference validation
  const preferenceSelects = document.querySelectorAll('select[name^="pref"]');
  preferenceSelects.forEach((select) => {
    select.addEventListener("change", validatePreferences);
  });
}

// Form validation
function validatePreferences() {
  const selects = document.querySelectorAll('select[name^="pref"]');
  const selectedValues = Array.from(selects).map((select) => select.value);
  const uniqueValues = [
    ...new Set(selectedValues.filter((value) => value !== "")),
  ];

  //-------------------Need to adjust this later --------------------
  // Enable/disable submit button based on validation
  const isValid =
    uniqueValues.length === 5 && selectedValues.every((value) => value !== "");
  searchBtn.disabled = !isValid;

  if (!isValid) {
    searchBtn.style.opacity = "0.6";
    searchBtn.style.cursor = "not-allowed";
  } else {
    searchBtn.style.opacity = "1";
    searchBtn.style.cursor = "pointer";
  }
}

// Handle form submission
async function handleFormSubmit(event) {
  console.log("Form submit event triggered!");
  event.preventDefault();

  const formData = new FormData(itineraryForm);

  // Validate and ensure positive values
  const budget = Math.abs(parseInt(formData.get("budget")));
  const days = Math.abs(parseInt(formData.get("days")));

  // Store the user's budget globally for later use
  userBudget = budget;

  // Additional validation for minimum values
  if (budget <= 0) {
    showError("Budget must be greater than $0");
    return;
  }

  if (days <= 0 || days > 30) {
    showError("Duration must be between 1 and 30 days");
    return;
  }

  const requestData = {
    destination: formData.get("destination"),
    budget: budget,
    days: days,
    user_pref: {
      1: formData.get("pref1"),
      2: formData.get("pref2"),
      3: formData.get("pref3"),
      4: formData.get("pref4"),
      5: formData.get("pref5"),
    },
  };

  await generateItinerary(requestData);
}

// Generate itinerary
async function generateItinerary(requestData) {
  showLoading();

  try {
    console.log("Sending request to:", `${API_BASE_URL}/plan-trip`);
    console.log("Request data:", requestData);

    const response = await fetch(`${API_BASE_URL}/plan-trip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const itinerary = await response.json();
    console.log("Received itinerary:", itinerary);
    currentItinerary = itinerary;
    displayItinerary(itinerary);
    showResults();
  } catch (error) {
    console.error("Error generating itinerary:", error);
    showError(
      `Failed to generate itinerary: ${error.message}. Please check your connection and try again.`
    );
  }
}

// Display itinerary in calendar view
function displayItinerary(itinerary) {
  console.log("Displaying itinerary:", itinerary);
  calendarContainer.innerHTML = "";

  itinerary.daily_itinerary.forEach((day, index) => {
    console.log(`Creating day ${index}:`, day);
    const dayCard = createDayCard(day, index);
    console.log("Created day card:", dayCard);
    console.log("Day card innerHTML:", dayCard.innerHTML);
    calendarContainer.appendChild(dayCard);
  });

  // Initialize drag and drop for all containers
  initializeDragAndDrop();

  updateSummary(itinerary);
}

// Create day card
function createDayCard(day, dayIndex) {
  const dayCard = document.createElement("div");
  dayCard.className = "day-card";
  dayCard.setAttribute("data-day", dayIndex);

  // Create the day header
  const dayHeader = document.createElement("div");
  dayHeader.className = "day-header";

  const dayTitle = document.createElement("div");
  dayTitle.className = "day-title";
  dayTitle.textContent = `Day ${day.day}`;

  const dayStats = document.createElement("div");
  dayStats.className = "day-stats";
  dayStats.textContent = `${day.day_total_hours}h • $${day.day_total_cost}`;

  dayHeader.appendChild(dayTitle);
  dayHeader.appendChild(dayStats);

  // Create the activities container
  const activitiesContainer = document.createElement("div");
  activitiesContainer.className = "activities-container";
  activitiesContainer.setAttribute("data-day", dayIndex);

  // Add activities to the container
  day.activities.forEach((activity) => {
    console.log("Adding activity to container:", activity);
    const activityCard = createActivityCard(activity, dayIndex);
    console.log("Created activity card element:", activityCard);
    activitiesContainer.appendChild(activityCard);
  });

  // Assemble the day card
  dayCard.appendChild(dayHeader);
  dayCard.appendChild(activitiesContainer);

  // Add drag and drop event listeners
  addDragAndDropListeners(dayCard);

  return dayCard;
}

// Create activity card
function createActivityCard(activity, dayIndex) {
  console.log("Creating activity card:", activity);
  const activityCard = document.createElement("div");
  activityCard.className = "activity-card";
  activityCard.setAttribute("data-activity-id", activity.name);
  activityCard.setAttribute("draggable", "true");

  activityCard.innerHTML = `
        <div class="activity-header">
            <div class="activity-name">${activity.name}</div>
            <div class="activity-actions">
                <button class="action-btn map-btn" data-activity-id="${
                  activity.name
                }" data-day-index="${dayIndex}" title="View on Map">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="action-btn replace-btn" data-activity-id="${
                  activity.name
                }" data-day-index="${dayIndex}" title="Replace activity">
                    <i class="fas fa-exchange-alt"></i>
                </button>
                <button class="action-btn delete-btn" data-activity-id="${
                  activity.name
                }" data-day-index="${dayIndex}" title="Delete activity">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="activity-type ${activity.activity_type.toLowerCase()}">${
    activity.activity_type
  }</div>
        <div class="activity-notes">${activity.notes}</div>
        <div class="activity-details">
            <div class="activity-duration">
                <i class="fas fa-clock"></i>
                ${activity.duration}h
            </div>
            <div class="activity-cost">$${activity.cost}</div>
        </div>
    `;

  // Add event listeners for action buttons
  const mapBtn = activityCard.querySelector(".map-btn");
  const replaceBtn = activityCard.querySelector(".replace-btn");
  const deleteBtn = activityCard.querySelector(".delete-btn");

  mapBtn.addEventListener("click", function () {
    const activityName = this.dataset.activityId;
    const dayIdx = parseInt(this.dataset.dayIndex);
    showMapModal(activityName, dayIdx);
  });

  replaceBtn.addEventListener("click", function () {
    const activityName = this.dataset.activityId;
    const dayIdx = parseInt(this.dataset.dayIndex);
    showReplacementModal(activityName, dayIdx);
  });

  deleteBtn.addEventListener("click", function () {
    const activityName = this.dataset.activityId;
    const dayIdx = parseInt(this.dataset.dayIndex);
    deleteActivity(activityName, dayIdx);
  });

  console.log("Activity card innerHTML:", activityCard.innerHTML);

  return activityCard;
}

// Add drag and drop functionality
function addDragAndDropListeners(dayCard) {
  const activitiesContainer = dayCard.querySelector(".activities-container");

  // Make activities draggable
  const activityCards = dayCard.querySelectorAll(".activity-card");
  activityCards.forEach((card) => {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
  });

  // Make day containers droppable
  activitiesContainer.addEventListener("dragover", handleDragOver);
  activitiesContainer.addEventListener("drop", handleDrop);
  activitiesContainer.addEventListener("dragenter", handleDragEnter);
  activitiesContainer.addEventListener("dragleave", handleDragLeave);
}

// Initialize drag and drop for all day containers
function initializeDragAndDrop() {
  const allDayContainers = document.querySelectorAll(".activities-container");
  allDayContainers.forEach((container) => {
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
  });
}

// Drag and drop handlers
function handleDragStart(event) {
  // Only handle drag start on activity cards
  if (!event.target.classList.contains("activity-card")) {
    return;
  }

  draggedActivity = event.target;
  draggedFromDay = event.target.closest(".activities-container").dataset.day;
  event.target.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", ""); // Required for some browsers
}

function handleDragEnd(event) {
  if (!event.target.classList.contains("activity-card")) {
    return;
  }

  event.target.classList.remove("dragging");
  draggedActivity = null;
  draggedFromDay = null;

  // Remove all drag-over classes
  document.querySelectorAll(".day-card").forEach((card) => {
    card.classList.remove("drag-over");
  });
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDragEnter(event) {
  event.preventDefault();
  const dayCard = event.target.closest(".day-card");
  if (dayCard) {
    dayCard.classList.add("drag-over");
  }
}

function handleDragLeave(event) {
  const dayCard = event.target.closest(".day-card");
  const activitiesContainer = event.target.closest(".activities-container");

  if (
    dayCard &&
    activitiesContainer &&
    !activitiesContainer.contains(event.relatedTarget)
  ) {
    dayCard.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  event.preventDefault();

  const targetContainer = event.target.closest(".activities-container");
  if (!targetContainer || !draggedActivity) {
    console.log("Drop failed: missing target container or dragged activity");
    return;
  }

  const targetDay = targetContainer.dataset.day;
  const sourceDay = draggedFromDay;

  console.log(`Dropping activity from day ${sourceDay} to day ${targetDay}`);

  if (sourceDay !== targetDay) {
    moveActivity(draggedActivity, sourceDay, targetDay);
  }

  // Remove drag-over class
  const dayCard = event.target.closest(".day-card");
  if (dayCard) {
    dayCard.classList.remove("drag-over");
  }
}

// Move activity between days
function moveActivity(activityElement, fromDay, toDay) {
  // Fix: Use more specific selectors to target activities containers
  const fromContainer = document.querySelector(
    `.activities-container[data-day="${fromDay}"]`
  );
  const toContainer = document.querySelector(
    `.activities-container[data-day="${toDay}"]`
  );

  if (!fromContainer || !toContainer) {
    console.error("Could not find source or target container");
    return;
  }

  // Remove from source
  fromContainer.removeChild(activityElement);

  // Add to destination
  toContainer.appendChild(activityElement);

  // Update backend data
  updateItineraryData();

  // Add visual feedback
  activityElement.classList.add("new");
  setTimeout(() => {
    activityElement.classList.remove("new");
  }, 500);
}

// Delete activity
function deleteActivity(activityName, dayIndex) {
  if (confirm(`Are you sure you want to delete "${activityName}"?`)) {
    // Fix: Use specific selector to target activities container
    const dayContainer = document.querySelector(
      `.activities-container[data-day="${dayIndex}"]`
    );

    if (!dayContainer) {
      console.error("Could not find day container for deletion");
      return;
    }

    const activityElement = dayContainer.querySelector(
      `[data-activity-id="${activityName}"]`
    );

    if (activityElement) {
      dayContainer.removeChild(activityElement);
      updateItineraryData();
      console.log(`Deleted activity: ${activityName} from day ${dayIndex}`);
    } else {
      console.error(`Could not find activity element: ${activityName}`);
    }
  }
}

// Show replacement modal
function showReplacementModal(activityName, dayIndex) {
  const currentActivityElement = document.querySelector(
    `[data-activity-id="${activityName}"]`
  );
  const currentActivity = currentActivityElement.cloneNode(true);
  currentActivity.querySelector(".activity-actions").remove();

  document.getElementById("currentActivity").innerHTML = "";
  document.getElementById("currentActivity").appendChild(currentActivity);

  // Generate replacement suggestions
  generateReplacementSuggestions(activityName, dayIndex);

  replacementModal.style.display = "block";
}

// Generate replacement suggestions
async function generateReplacementSuggestions(activityName, dayIndex) {
  const replacementOptions = document.getElementById("replacementOptions");
  replacementOptions.innerHTML =
    '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Generating suggestions...</div>';

  try {
    // Validate that we have the required data structure
    if (
      !currentItinerary ||
      !currentItinerary.daily_itinerary ||
      !currentItinerary.daily_itinerary[dayIndex]
    ) {
      throw new Error("Invalid itinerary data structure");
    }

    // Get ALL activities from the entire itinerary to avoid duplicates
    const allActivities = [];
    currentItinerary.daily_itinerary.forEach((day) => {
      if (day && day.activities) {
        day.activities.forEach((activity) => {
          if (activity && activity.name) {
            allActivities.push(activity.name);
          }
        });
      }
    });

    const currentDay = currentItinerary.daily_itinerary[dayIndex];
    if (
      !currentDay ||
      !currentDay.activities ||
      currentDay.activities.length === 0
    ) {
      throw new Error("No activities found for the selected day");
    }

    const activityType = currentDay.activities[0].activity_type;

    // Calculate remaining day duration safely
    let day_duration = 13.0; // Default to full day
    if (
      currentItinerary.days &&
      currentItinerary.days[dayIndex] &&
      currentItinerary.days[dayIndex].day_total_hours
    ) {
      day_duration = 13.0 - currentItinerary.days[dayIndex].day_total_hours;
    }

    // Calculate remaining budget safely
    let budget = 200; // Default budget
    if (
      typeof userBudget !== "undefined" &&
      userBudget &&
      currentItinerary.budget
    ) {
      budget = userBudget - currentItinerary.budget;
    }

    // Generate 3 replacement suggestions
    const suggestions = await generateActivitySuggestions(
      currentItinerary,
      currentItinerary.destination,
      activityType,
      allActivities,
      dayIndex
    );

    replacementOptions.innerHTML = suggestions
      .filter((suggestion) => !allActivities.includes(suggestion.name))
      .slice(0, 4)
      .map(
        (suggestion) => `
                <div class="replacement-option new" data-old-activity="${activityName}" data-new-activity="${suggestion.name}" data-day-index="${dayIndex}">
                    <div style="font-weight: 600; margin-bottom: 5px;">${suggestion.name}</div>
                    <div style="font-size: 0.9rem; color: #666;">${suggestion.description}</div>
                    <div style="font-size: 0.8rem; color: #999; margin-top: 5px;">
                        <i class="fas fa-clock"></i> ${suggestion.duration}h • 
                        <i class="fas fa-dollar-sign"></i> $${suggestion.cost}
                    </div>
                </div>
            `
      )
      .join("");

    // Add event listeners to replacement options
    const replacementOptionElements = replacementOptions.querySelectorAll(
      ".replacement-option"
    );
    replacementOptionElements.forEach((option) => {
      option.addEventListener("click", function () {
        const oldActivity = this.dataset.oldActivity;
        const newActivity = this.dataset.newActivity;
        const dayIdx = parseInt(this.dataset.dayIndex);
        replaceActivity(oldActivity, newActivity, dayIdx);
      });
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      currentItinerary: currentItinerary,
      dayIndex: dayIndex,
      activityName: activityName,
    });
    replacementOptions.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">
        Failed to generate suggestions: ${error.message}<br>
        <small>Please try again or check the console for more details.</small>
      </div>`;
  }
}

// Generate activity suggestions (using mock for now)
async function generateActivitySuggestions(
  currentItinerary,
  destination,
  activityType,
  excludeActivities = [],
  dayIndex = 0
) {
  try {
    console.log("Calling backend API for activity suggestions...");

    // Create an activity object to send to the backend
    const requestData = {
      name: `Replace ${activityType} Activity`,
      duration: 2.0,
      notes: `Looking for ${activityType} activity replacements in ${destination}`,
      activity_type: activityType,
      cost: 25.0,
    };

    // Create the request body with all required parameters
    const requestBody = {
      request: requestData,
      destination: destination,
      excluded_activities: excludeActivities.map((name) => ({
        name: name,
        duration: 2.0,
        notes: `Excluded activity: ${name}`,
        activity_type: "Cultural", // Default activity type for excluded activities
        cost: 25.0,
      })),
      budget:
        userBudget && currentItinerary.budget
          ? userBudget - currentItinerary.budget
          : 200, // Use remaining budget or default
      day_duration:
        currentItinerary.days &&
        currentItinerary.days[dayIndex] &&
        currentItinerary.days[dayIndex].day_total_hours
          ? 13.0 - currentItinerary.days[dayIndex].day_total_hours
          : 13.0, // Use remaining day duration or default
    };

    console.log("Sending request to backend:", requestBody);

    const response = await fetch("/modify-activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Backend response:", data);

    // Transform the backend response to match the expected format
    if (
      data.replacement_activities &&
      Array.isArray(data.replacement_activities)
    ) {
      return data.replacement_activities.map((activity) => ({
        name: activity.name,
        description: activity.notes || "Activity description",
        duration: activity.duration,
        cost: activity.cost,
      }));
    }

    throw new Error("Invalid response format from backend");
  } catch (error) {
    console.error("Error calling backend API:", error);
    console.log("Falling back to mock suggestions...");

    // Fallback to mock suggestions if API fails
    const mockSuggestions = {
      Cultural: [
        {
          name: "Art Gallery Visit",
          description: "Explore local contemporary art",
          duration: 2,
          cost: 15,
        },
        {
          name: "Historical Walking Tour",
          description: "Discover the city's rich history",
          duration: 3,
          cost: 25,
        },
        {
          name: "Museum Exhibition",
          description: "View special cultural exhibitions",
          duration: 2.5,
          cost: 20,
        },
      ],
      Food: [
        {
          name: "Local Food Market Tour",
          description: "Explore vibrant local food markets",
          duration: 2,
          cost: 35,
        },
        {
          name: "Cooking Class",
          description: "Learn to prepare authentic local dishes",
          duration: 3,
          cost: 60,
        },
        {
          name: "Wine Tasting",
          description: "Sample local wines and learn traditions",
          duration: 1.5,
          cost: 40,
        },
      ],
      Tour: [
        {
          name: "City Bus Tour",
          description: "Comprehensive city overview",
          duration: 3,
          cost: 30,
        },
        {
          name: "Boat Cruise",
          description: "Scenic waterway tour",
          duration: 2,
          cost: 25,
        },
        {
          name: "Walking Tour",
          description: "Guided neighborhood exploration",
          duration: 2.5,
          cost: 20,
        },
      ],
      Recreational: [
        {
          name: "Park Picnic",
          description: "Relax in beautiful green spaces",
          duration: 2,
          cost: 15,
        },
        {
          name: "Shopping District",
          description: "Browse local shops and boutiques",
          duration: 3,
          cost: 50,
        },
        {
          name: "Spa Experience",
          description: "Pamper yourself with treatments",
          duration: 2,
          cost: 80,
        },
      ],
      Adventure: [
        {
          name: "Hiking Trail",
          description: "Scenic outdoor adventure",
          duration: 4,
          cost: 25,
        },
        {
          name: "Water Sports",
          description: "Exciting aquatic activities",
          duration: 3,
          cost: 60,
        },
        {
          name: "Rock Climbing",
          description: "Challenge yourself on climbing walls",
          duration: 2.5,
          cost: 45,
        },
      ],
    };

    return mockSuggestions[activityType] || mockSuggestions["Cultural"];
  }
}

async function replaceActivity(oldActivityName, newActivityName, dayIndex) {
  console.log(
    `Replacing activity: ${oldActivityName} with ${newActivityName} on day ${dayIndex}`
  );

  const dayContainer = document.querySelector(
    `.activities-container[data-day="${dayIndex}"]`
  );
  console.log("Day container found:", dayContainer);

  const oldActivityElement = dayContainer.querySelector(
    `[data-activity-id="${oldActivityName}"]`
  );
  console.log("Old activity element found:", oldActivityElement);

  if (oldActivityElement) {
    // Get the activity type from the old activity
    const activityType =
      oldActivityElement.querySelector(".activity-type").textContent;

    // Get ALL activities from the entire itinerary to avoid duplicates
    const allActivities = [];
    currentItinerary.daily_itinerary.forEach((day) => {
      if (day && day.activities) {
        day.activities.forEach((activity) => {
          if (activity && activity.name) {
            allActivities.push(activity.name);
          }
        });
      }
    });

    // Get the suggestion data to use real duration and cost
    const suggestions = await generateActivitySuggestions(
      currentItinerary, // ✅ Fixed: pass currentItinerary
      currentItinerary.destination, // ✅ Fixed: pass destination
      activityType, // ✅ Fixed: pass activityType
      allActivities, // ✅ Fixed: pass excluded activities
      dayIndex // ✅ Fixed: pass dayIndex
    );
    const suggestion = suggestions.find((s) => s.name === newActivityName);

    // Create new activity element with real data
    const newActivity = {
      name: newActivityName,
      activity_type: activityType,
      duration: suggestion ? suggestion.duration : 2,
      cost: suggestion ? suggestion.cost : 25,
      notes: suggestion ? suggestion.description : "Newly suggested activity",
    };

    const newActivityElement = createActivityCard(newActivity, dayIndex);
    newActivityElement.classList.add("new");

    // Replace the old activity
    dayContainer.replaceChild(newActivityElement, oldActivityElement);

    // Re-add drag and drop listeners
    addDragAndDropListeners(dayContainer.closest(".day-card"));

    updateItineraryData();
  } else {
    console.error(
      `Could not find activity element with id: ${oldActivityName}`
    );
    alert(
      `Could not find activity "${oldActivityName}" to replace. Please try again.`
    );
  }

  closeReplacementModal();
}

// Close replacement modal
function closeReplacementModal() {
  replacementModal.style.display = "none";
}

// Update itinerary data after changes
function updateItineraryData() {
  // Recalculate totals and update summary
  const dayCards = document.querySelectorAll(".day-card");
  let totalCost = 0;
  let totalActivities = 0;

  dayCards.forEach((dayCard, index) => {
    const activities = dayCard.querySelectorAll(".activity-card");
    let dayCost = 0;
    let dayHours = 0;

    activities.forEach((activity) => {
      const cost = parseFloat(
        activity.querySelector(".activity-cost").textContent.replace("$", "")
      );
      const duration = parseFloat(
        activity
          .querySelector(".activity-duration")
          .textContent.replace("h", "")
      );
      dayCost += cost;
      dayHours += duration;
      totalActivities++;
    });

    totalCost += dayCost;

    // Update day stats
    const dayStats = dayCard.querySelector(".day-stats");
    dayStats.textContent = `${dayHours}h • $${dayCost}`;
  });

  // Update summary
  document.getElementById("totalCost").textContent = `$${totalCost}`;
  document.getElementById("totalActivities").textContent = totalActivities;
}

// Update summary
function updateSummary(itinerary) {
  const totalCost = itinerary.total_cost || 0;
  const totalActivities = itinerary.daily_itinerary.reduce(
    (sum, day) => sum + day.activities.length,
    0
  );

  document.getElementById("totalCost").textContent = `$${totalCost}`;
  document.getElementById("totalActivities").textContent = totalActivities;
}

// Regenerate itinerary
function regenerateItinerary() {
  if (currentItinerary) {
    const formData = new FormData(itineraryForm);
    const requestData = {
      destination: formData.get("destination"),
      budget: parseInt(formData.get("budget")),
      days: parseInt(formData.get("days")),
      user_pref: {
        1: formData.get("pref1"),
        2: formData.get("pref2"),
        3: formData.get("pref3"),
        4: formData.get("pref4"),
        5: formData.get("pref5"),
      },
    };

    generateItinerary(requestData);
  }
}

// Show different sections
function showLoading() {
  hideAllSections();
  loadingSection.style.display = "block";
  searchBtn.classList.add("btn-loading");
  searchBtn.disabled = true;
}

function showResults() {
  hideAllSections();
  resultsSection.style.display = "block";
  searchBtn.classList.remove("btn-loading");
  searchBtn.disabled = false;
}

function showSearchForm() {
  hideAllSections();
  searchSection.style.display = "block";
}

function showError(message) {
  hideAllSections();
  errorSection.style.display = "block";
  document.getElementById("errorMessage").textContent = message;
  searchBtn.classList.remove("btn-loading");
  searchBtn.disabled = false;
}

function hideAllSections() {
  searchSection.style.display = "none";
  loadingSection.style.display = "none";
  resultsSection.style.display = "none";
  errorSection.style.display = "none";
}

// Google Maps Functions
function initMap() {
  // This function will be called when Google Maps API loads
  console.log("Google Maps API loaded");
}

function showMapModal(activityName, dayIndex) {
  const mapModal = document.getElementById("mapModal");
  const mapModalTitle = document.getElementById("mapModalTitle");

  mapModalTitle.textContent = `${activityName} - Location`;
  mapModal.style.display = "block";

  // Show loading state
  showMapLoading();

  // Get the destination from the current itinerary
  const destination = currentItinerary
    ? currentItinerary.destination
    : "Unknown";

  // Initialize map if not already done
  if (!map) {
    const mapElement = document.getElementById("map");
    map = new google.maps.Map(mapElement, {
      zoom: 15,
      center: { lat: 40.7128, lng: -74.006 }, // Default to NYC, will be updated by geocoding
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    placesService = new google.maps.places.PlacesService(map);
  }

  // First, center the map on the destination city
  centerMapOnDestination(destination, () => {
    // Then search for the specific activity in that destination
    searchPlace(activityName, destination);
  });
}

function closeMapModal() {
  const mapModal = document.getElementById("mapModal");
  mapModal.style.display = "none";

  // Clear previous marker
  if (currentMarker) {
    currentMarker.setMap(null);
    currentMarker = null;
  }

  // Clear place details
  clearPlaceDetails();
}

// Center map on destination city
function centerMapOnDestination(destination, callback) {
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: destination }, (results, status) => {
    if (status === google.maps.GeocoderStatus.OK && results[0]) {
      const location = results[0].geometry.location;
      map.setCenter(location);
      map.setZoom(12); // Zoom out to show the city area
      console.log(`Map centered on ${destination}:`, location);
      if (callback) callback();
    } else {
      console.error(`Geocoding failed for ${destination}:`, status);
      if (callback) callback(); // Still proceed with search
    }
  });
}

function searchPlace(placeName, destination = "") {
  // Create a more specific search query that includes the destination
  const searchQuery = destination ? `${placeName}, ${destination}` : placeName;

  const request = {
    query: searchQuery,
    fields: [
      "name",
      "geometry",
      "place_id",
      "formatted_address",
      "rating",
      "user_ratings_total",
      "opening_hours",
      "formatted_phone_number",
      "website",
      "photos",
    ],
  };

  console.log(`Searching for: "${searchQuery}"`);

  placesService.textSearch(request, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
      const place = results[0];
      console.log(`Found place: ${place.name} at ${place.formatted_address}`);

      // Center map on the place
      map.setCenter(place.geometry.location);
      map.setZoom(16); // Zoom in on the specific place

      // Add marker
      if (currentMarker) {
        currentMarker.setMap(null);
      }

      currentMarker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
      });

      // Get detailed place information
      getPlaceDetails(place.place_id);
    } else {
      console.error(`Place search failed for "${searchQuery}":`, status);

      // Try a fallback search with just the activity name if destination search failed
      if (destination && placeName !== searchQuery) {
        console.log(`Trying fallback search for: "${placeName}"`);
        const fallbackRequest = { ...request, query: placeName };
        placesService.textSearch(
          fallbackRequest,
          (fallbackResults, fallbackStatus) => {
            if (
              fallbackStatus === google.maps.places.PlacesServiceStatus.OK &&
              fallbackResults[0]
            ) {
              const place = fallbackResults[0];
              console.log(
                `Fallback found: ${place.name} at ${place.formatted_address}`
              );

              map.setCenter(place.geometry.location);
              map.setZoom(16);

              if (currentMarker) {
                currentMarker.setMap(null);
              }

              currentMarker = new google.maps.Marker({
                position: place.geometry.location,
                map: map,
                title: place.name,
              });

              getPlaceDetails(place.place_id);
            } else {
              showPlaceError(`Location not found for "${placeName}"`);
            }
          }
        );
      } else {
        showPlaceError(`Location not found for "${placeName}"`);
      }
    }
  });
}

function getPlaceDetails(placeId) {
  const request = {
    placeId: placeId,
    fields: [
      "name",
      "formatted_address",
      "rating",
      "user_ratings_total",
      "opening_hours",
      "formatted_phone_number",
      "website",
      "photos",
      "reviews",
    ],
  };

  placesService.getDetails(request, (place, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      displayPlaceDetails(place);
    } else {
      console.error("Place details failed:", status);
      showPlaceError("Could not load place details");
    }
  });
}

function displayPlaceDetails(place) {
  // Update place name
  document.getElementById("placeName").textContent = place.name || "Unknown";

  // Update rating
  const ratingElement = document.getElementById("placeRating");
  const ratingCountElement = document.getElementById("placeRatingCount");

  if (place.rating) {
    const stars =
      "★".repeat(Math.floor(place.rating)) +
      "☆".repeat(5 - Math.floor(place.rating));
    ratingElement.innerHTML = `<span class="stars">${stars}</span> ${place.rating.toFixed(
      1
    )}`;
    ratingCountElement.textContent = `(${
      place.user_ratings_total || 0
    } reviews)`;
  } else {
    ratingElement.textContent = "No rating available";
    ratingCountElement.textContent = "";
  }

  // Update address
  document.getElementById(
    "placeAddress"
  ).innerHTML = `<i class="fas fa-map-marker-alt"></i> ${
    place.formatted_address || "Address not available"
  }`;

  // Update hours
  const hoursElement = document.getElementById("placeHours");
  if (place.opening_hours && place.opening_hours.weekday_text) {
    const hoursText = place.opening_hours.weekday_text.join("<br>");
    hoursElement.innerHTML = `<i class="fas fa-clock"></i> <strong>Hours:</strong><br>${hoursText}`;
  } else {
    hoursElement.innerHTML = `<i class="fas fa-clock"></i> Hours not available`;
  }

  // Update phone
  const phoneElement = document.getElementById("placePhone");
  if (place.formatted_phone_number) {
    phoneElement.innerHTML = `<i class="fas fa-phone"></i> ${place.formatted_phone_number}`;
  } else {
    phoneElement.innerHTML = `<i class="fas fa-phone"></i> Phone not available`;
  }

  // Update website
  const websiteElement = document.getElementById("placeWebsite");
  if (place.website) {
    websiteElement.innerHTML = `<i class="fas fa-globe"></i> <a href="${place.website}" target="_blank">Visit Website</a>`;
  } else {
    websiteElement.innerHTML = `<i class="fas fa-globe"></i> Website not available`;
  }

  // Update photos
  const photosElement = document.getElementById("placePhotos");
  if (place.photos && place.photos.length > 0) {
    photosElement.innerHTML = "<h5>Photos:</h5>";
    place.photos.slice(0, 6).forEach((photo) => {
      const photoUrl = photo.getUrl({ maxWidth: 200, maxHeight: 200 });
      const img = document.createElement("img");
      img.src = photoUrl;
      img.className = "place-photo";
      img.alt = place.name;
      photosElement.appendChild(img);
    });
  } else {
    photosElement.innerHTML = "<p>No photos available</p>";
  }
}

function clearPlaceDetails() {
  document.getElementById("placeName").textContent = "";
  document.getElementById("placeRating").textContent = "";
  document.getElementById("placeRatingCount").textContent = "";
  document.getElementById("placeAddress").textContent = "";
  document.getElementById("placeHours").textContent = "";
  document.getElementById("placePhone").textContent = "";
  document.getElementById("placeWebsite").textContent = "";
  document.getElementById("placePhotos").innerHTML = "";
}

function showMapLoading() {
  document.getElementById("placeName").textContent = "Searching...";
  document.getElementById("placeRating").textContent =
    "Loading location information...";
  document.getElementById("placeRatingCount").textContent = "";
  document.getElementById("placeAddress").textContent = "";
  document.getElementById("placeHours").textContent = "";
  document.getElementById("placePhone").textContent = "";
  document.getElementById("placeWebsite").textContent = "";
  document.getElementById("placePhotos").innerHTML = "";
}

function showPlaceError(message) {
  document.getElementById("placeName").textContent = "Error";
  document.getElementById("placeRating").textContent = message;
  document.getElementById("placeRatingCount").textContent = "";
  document.getElementById("placeAddress").textContent = "";
  document.getElementById("placeHours").textContent = "";
  document.getElementById("placePhone").textContent = "";
  document.getElementById("placeWebsite").textContent = "";
  document.getElementById("placePhotos").innerHTML = "";
}
