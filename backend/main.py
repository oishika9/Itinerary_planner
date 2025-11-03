from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models import Itinerary, UserRequest, Replacement_Activity_List, Activity, ModifyActivityRequest
from agent import build_itinerary, change_activity
import uvicorn
import os
from typing import List
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Travel Itinerary API")

# Add CORS middleware --- for frontend to access the backend?   --- why?
app.add_middleware(
    CORSMiddleware,
    # * is very broad , but should be more specific eg : allow_origins=["http;//thedomain/com"]
    allow_origins=["*"],  # Allows all origins (apis)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # Allows all headers
)

# since we running backend and frontend from the saem server do we need CORS middleware?

# Mount static files (frontend)
# any file in the frontend directory can be accessed at /static/filename
import os
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")


# Run both frontend and backend from the same server
@app.get("/")
async def read_root():
    # Serve the frontend index.html file
    return FileResponse(os.path.join(frontend_path, "index.html"))

# Serve the frontend styles.css file from the frontend directory
@app.get("/styles.css")
async def get_styles():
    return FileResponse(os.path.join(frontend_path, "styles.css"))

# Serve the frontend script.js file from the frontend directory
@app.get("/script.js")
async def get_script():
    return FileResponse(os.path.join(frontend_path, "script.js"))

# Serve the frontend config.js file from the frontend directory
@app.get("/config.js")
async def get_config_js():
    return FileResponse(os.path.join(frontend_path, "config.js"))


@app.get("/backgroundvid.mp4")
async def get_video():
    return FileResponse(os.path.join(frontend_path, "backgroundvid.mp4"))



@app.get("/api/config")
async def get_config():
    """Return configuration including Google Maps API key"""
    return {
        "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY", "")
    }       


@app.post("/user-input", response_model=UserRequest)
async def user_input(request: UserRequest) -> UserRequest: 
    return request


@app.post("/plan-trip", response_model=Itinerary)
async def plan_trip(request: UserRequest) -> Itinerary:
    """
    Combined endpoint: accepts user preferences and generates itinerary in one step
    """
    return await build_itinerary(request)



@app.post("/modify-activity", response_model=Replacement_Activity_List)
async def modify_activity(request_body: ModifyActivityRequest) -> Replacement_Activity_List:
    """
    Generate replacement activities for a given activity
    """
    return await change_activity(
        request_body.request, 
        request_body.destination, 
        request_body.excluded_activities, 
        request_body.budget, 
        request_body.day_duration
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
