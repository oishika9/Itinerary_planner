from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional
from enum import Enum

#Types of activities
class ACTTYPE(Enum):
    FOOD = "Food"  
    # Activities centered around eating and drinking, exploring local cuisines, or culinary experiences.  
    # Example: food tours, wine tastings, cooking classes, street food markets, popular restaurants.  

    TOUR = "Tour"  
    # Guided or self-guided explorations of landmarks, cities, or natural sites.  
    # Example: city bus tours, walking tours, boat cruises, day trips to nearby towns.  

    CULTURAL = "Cultural"  
    # Activities highlighting traditions, art, history, and local customs.  
    # Example: visiting museums, attending festivals, exploring temples, watching traditional performances.  

    RECREATIONAL = "Recreational"  
    # Relaxing or leisurely activities focused on wellness and enjoyment.  
    # Example: spa visits, beach lounging, golf, swimming, shopping.  

    ADVENTURE = "Adventure"  
    # Thrilling and physically engaging activities, often outdoors.  
    # Example: hiking, scuba diving, zip-lining, rock climbing, paragliding.  


#User input schema 
class UserRequest(BaseModel):
    destination: str
    budget: int
    days: int
    # 1 implies most preferred and 5 implies least favoured
    user_pref: Dict[str, str]  # Changed to string keys for JSON compatibility
    # Optional: starting location coordinates to help proximity grouping


# Output schema 
class Activity(BaseModel):
    name: str
    duration: float # In Hours
    notes: str
    activity_type: ACTTYPE
    cost: float # In dollars

class DayPlan(BaseModel):
    day: int # Starting from 1 and max is days
    activities: List[Activity]
    day_total_hours: float = 0 # In hours
    day_total_cost: float = 0

class Itinerary(BaseModel):
    destination: str
    daily_itinerary: List[DayPlan]
    total_cost: float = 0 # In dollars  

    @property
    def total_days(self) -> int:
        return len(self.daily_itinerary)


# List of replacement activities
class Replacement_Activity_List(BaseModel):
    replacement_activities: List[Activity]





class ModifyActivityRequest(BaseModel):
    request: Activity
    destination: str
    excluded_activities: List[Activity]
    budget: int
    day_duration: float