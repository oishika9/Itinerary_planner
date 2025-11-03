# Travel Itinerary Builder Frontend

A modern, interactive web application for planning personalized travel itineraries with AI-powered recommendations.

## Features

### 🏠 Homepage & Search

- Clean, intuitive search form
- Destination input with autocomplete suggestions
- Budget and duration selection
- Activity preference ranking (1-5 scale)
- Real-time form validation

### 📅 Calendar View

- Responsive calendar-style layout
- Maximum 4 days displayed in a row
- Each day shows activities as interactive cards
- Real-time cost and duration calculations

### 🎯 Activity Management

- **Drag & Drop**: Move activities between days seamlessly
- **Delete**: Remove activities with confirmation
- **Replace**: Get AI-powered replacement suggestions
- **Visual Feedback**: Smooth animations and hover effects

### 🎨 UI/UX Features

- Modern gradient design
- Responsive layout for all devices
- Smooth drag-and-drop interactions
- Real-time updates without page refresh
- Loading states and error handling

## Getting Started

### Prerequisites

- Backend API running on `http://127.0.0.1:8000`
- Modern web browser with JavaScript enabled

### Running the Frontend

1. **Open the application**:

   ```bash
   # Navigate to the frontend directory
   cd frontend

   # Open index.html in your browser
   open index.html
   # OR
   # Use a local server (recommended)
   python -m http.server 8001
   # Then visit http://localhost:8001
   ```

2. **Start the backend** (in another terminal):
   ```bash
   cd backend
   python main.py
   ```

### Usage

1. **Fill out the search form**:

   - Enter your destination (e.g., "Paris", "Tokyo", "New York")
   - Set your budget in dollars
   - Choose trip duration (1-14 days)
   - Rank your activity preferences (1=most preferred, 5=least preferred)

2. **Generate your itinerary**:

   - Click "Generate Itinerary"
   - Wait for AI to create your personalized plan
   - View results in the calendar format

3. **Customize your trip**:
   - **Drag activities** between days
   - **Delete activities** you don't want
   - **Replace activities** with new suggestions
   - **Regenerate** the entire itinerary

## File Structure

```
frontend/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and animations
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## API Integration

The frontend connects to the backend API at `http://127.0.0.1:8000`:

- **POST /plan-trip**: Generate new itinerary
- **GET /**: Health check

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Features in Detail

### Drag & Drop

- Smooth visual feedback during dragging
- Activities snap into place when dropped
- Real-time cost and duration updates

### Activity Replacement

- AI-powered suggestions based on activity type
- Unique suggestions (no duplicates)
- Clear "NEW" indicators for replacements

### Responsive Design

- Mobile-first approach
- Adapts to different screen sizes
- Touch-friendly on mobile devices

## Troubleshooting

### Common Issues

1. **"Failed to generate itinerary"**

   - Check if backend is running on port 8000
   - Verify API endpoint is accessible

2. **Drag & drop not working**

   - Ensure you're using a modern browser
   - Check that JavaScript is enabled

3. **Styling issues**
   - Clear browser cache
   - Check CSS file is loaded correctly

### Development Tips

- Use browser developer tools for debugging
- Check console for JavaScript errors
- Verify API responses in Network tab
- Test on different screen sizes

## Future Enhancements

- Save itineraries locally
- Export to PDF
- Share itineraries
- More activity categories
- Real-time collaboration
- Offline support
