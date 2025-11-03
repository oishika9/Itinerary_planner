// Google Maps API Configuration
// The API key is now loaded dynamically from the backend environment variables
// No need to hardcode the API key here anymore!

// Instructions for setting up Google Maps API key:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select an existing one
// 3. Enable the following APIs:
//    - Maps JavaScript API
//    - Places API
//    - Geocoding API
// 4. Create credentials (API Key)
// 5. Add the API key to your environment variables as GOOGLE_MAPS_API_KEY
// 6. For production, restrict the API key to your domain for security

// Note: The API key is now securely stored in environment variables
// and served through the backend API endpoint /api/config
