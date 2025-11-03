from pydantic_ai import Agent
from models import Itinerary, DayPlan, Activity, UserRequest, Replacement_Activity_List, ACTTYPE
from dotenv import load_dotenv
import json
from typing import Any, Dict, List

load_dotenv()


SYSTEM_PROMPT = (
    "You are an expert itinerary planning assistant that creates personalized travel plans."
    " Generate a JSON response matching this exact schema:"
    " {destination: str, daily_itinerary: [{day: int, activities: [{name: str, duration: float, notes: str, activity_type: str, cost: int}], day_total_hours: float, day_total_cost: int}], total_cost: int}."
    " CRITICAL REQUIREMENTS:"
    " 1) DESTINATION FOCUS: You MUST create activities for the EXACT destination provided in the user's request. If the user specifies 'Tokyo', create Tokyo activities. If 'Paris', create Paris activities. If 'London', create London activities. NEVER use a different city than what the user specified."
    " 2) DURATION RESPECT: Plan EXACTLY the number of days requested. If user requests 3 days, create 3 days. If 5 days, create 5 days. Each day should have 6-13 hours of activities (day trips can be 12+ hours)."
    " 3) BUDGET COMPLIANCE: Total cost MUST be <= budget. Choose cost-effective options when budget is tight. Include free activities when possible."
    " 4) PREFERENCE PRIORITIZATION: Heavily favor activities matching user's top preferences (rank 1-2), moderately include rank 3, sparingly use ranks 4-5."
    " 5) PROXIMITY GROUPING: Group nearby activities together to minimize travel time. Start each day from popular tourist areas or central neighborhoods."
    " 6) REALISTIC DURATIONS: Use 0.5-4 hours for regular activities, 8-12 hours for day trips. Include travel time between locations."
    " 7) AUTHENTIC EXPERIENCES: Include must-see attractions, local cuisine, cultural sites, and hidden gems specific to the destination."
    " 8) DAILY BALANCE: Each day should have 1-4 activities with a good mix of activity types based on user preferences."
    " Activity Types (use EXACTLY these values - no other types allowed):"
    " - Food: Local restaurants, food tours, cooking classes, markets, street food, traditional cuisine"
    " - Cultural: Museums, galleries, historical sites, temples, churches, cultural performances, local customs"
    " - Tour: City tours, walking tours, boat tours, landmark visits, guided experiences, sightseeing"
    " - Recreational: Parks, gardens, beaches, shopping districts, entertainment venues, leisure activities"
    " - Adventure: Outdoor activities, hiking, water sports, extreme sports, nature excursions, adrenaline activities"
    " NEVER use 'Entertainment' or any other activity type. Only use: Food, Cultural, Tour, Recreational, Adventure."
    " IMPORTANT: Always use the destination, duration, budget, and preferences provided in the user's request. Do not make assumptions or use default destinations."
)


def compute_totals(itinerary_dict: Dict[str, Any]) -> Dict[str, Any]:
    total_cost = 0
    # Handle both "days" and "daily_itinerary" keys
    days_key = "daily_itinerary" if "daily_itinerary" in itinerary_dict else "days"
    for day in itinerary_dict.get(days_key, []):
        day_hours = 0.0
        day_cost = 0
        for act in day.get("activities", []):
            day_hours += float(act.get("duration", 0))
            day_cost += int(act.get("cost", 0))
        day["day_total_hours"] = round(day_hours, 2)
        day["day_total_cost"] = day_cost
        total_cost += day_cost
    itinerary_dict["total_cost"] = total_cost
    return itinerary_dict


builder_agent = Agent("openai:gpt-3.5-turbo", system_prompt=SYSTEM_PROMPT)


async def build_itinerary(request: UserRequest) -> Itinerary:
    user_prompt = f"""
    Create an itinerary for the following trip:
    
    Destination: {request.destination}
    Budget: ${request.budget}
    Duration: {request.days} days
    Activity Preferences (1=most preferred, 5=least preferred):
    - 1st choice: {request.user_pref.get('1', 'Not specified')}
    - 2nd choice: {request.user_pref.get('2', 'Not specified')}
    - 3rd choice: {request.user_pref.get('3', 'Not specified')}
    - 4th choice: {request.user_pref.get('4', 'Not specified')}
    - 5th choice: {request.user_pref.get('5', 'Not specified')}
    
    Please create a detailed itinerary for {request.destination} for {request.days} days within a budget of ${request.budget}.
    """
    
    raw = await builder_agent.run(user_prompt)

    # Extract text output from PydanticAI Agent result
    text_output = None
    if hasattr(raw, 'output'):
        text_output = raw.output
    elif isinstance(raw, str):
        text_output = raw
    
    # Parse JSON from text output
    data = {}
    if text_output:
        try:
            data = json.loads(text_output)
        except json.JSONDecodeError:
            # If the model returned non-JSON, try to extract JSON from text
            start = text_output.find("{")
            end = text_output.rfind("}")
            if start != -1 and end != -1:
                try:
                    data = json.loads(text_output[start:end+1])
                except json.JSONDecodeError:
                    data = {"destination": request.destination, "daily_itinerary": []}
            else:
                data = {"destination": request.destination, "daily_itinerary": []}
    elif isinstance(raw, dict):
        data = raw
    else:
        data = {"destination": request.destination, "daily_itinerary": []}
    
    # Ensure data is a dictionary
    if not isinstance(data, dict):
        print(f"Warning: Expected dict, got {type(data)}: {data}")
        data = {"destination": request.destination, "daily_itinerary": []}

    # Normalize keys to match our Pydantic models (handle both "days" and "daily_itinerary")
    if "days" in data and "daily_itinerary" not in data:
        data["daily_itinerary"] = data.pop("days")

    data = compute_totals(data)
    itinerary = Itinerary(**data)


    # Budget enforcement: if over budget, reduce lowest-preference/highest-cost first
    if itinerary.total_cost > request.budget:
        # Build preference ranking: activity type string -> numeric rank (1 best ... 5 worst)
        pref_rank = {v: int(k) for k, v in request.user_pref.items()}

        # Collect activities with rank for removal consideration
        scored: list[tuple[int, int, Activity]] = []  # (day_index, activity_index, activity)
        for di, day in enumerate(itinerary.daily_itinerary):
            for ai, act in enumerate(day.activities):
                # Get activity type value (handle both enum and string)
                act_type_value = act.activity_type.value if hasattr(act.activity_type, "value") else str(act.activity_type)
                rank = pref_rank.get(act_type_value, 5)  # Default to 5 (least preferred) if not found
                scored.append((di, ai, act))
        
        # Sort by cost desc (drop expensive first)
        scored.sort(key=lambda t: t[2].cost, reverse=True)

        for di, _, act in scored:
            if itinerary.total_cost <= request.budget:
                break
            day = itinerary.daily_itinerary[di]
            if act in day.activities:
                day.activities.remove(act)
                day.day_total_cost = float(day.day_total_cost) - float(act.cost)
                day.day_total_hours = round(sum(float(a.duration) for a in day.activities), 2)
                itinerary.total_cost = float(itinerary.total_cost) - float(act.cost)

    return itinerary


REPLACEMENT_PROMPT = (
    "You are an expert itinerary planning assistant that creates personalized travel plans."
    " You MUST respond with a JSON object in this EXACT format:"
    " {"
    "   \"replacement_activities\": ["
    "     {"
    "       \"name\": \"Activity Name\","
    "       \"duration\": 2.5,"
    "       \"cost\": 30.0,"
    "       \"notes\": \"Detailed description of the activity\","
    "       \"activity_type\": \"Cultural\""
    "     },"
    "     {"
    "       \"name\": \"Another Activity\","
    "       \"duration\": 1.5,"
    "       \"cost\": 25.0,"
    "       \"notes\": \"Another detailed description\","
    "       \"activity_type\": \"Food\""
    "     },"
    "     {"
    "       \"name\": \"Third Activity\","
    "       \"duration\": 3.0,"
    "       \"cost\": 40.0,"
    "       \"notes\": \"Third detailed description\","
    "       \"activity_type\": \"Tour\""
    "     }"
    "   ]"
    " }"
    " CRITICAL REQUIREMENTS:"
    " 1) DESTINATION FOCUS: You MUST create activities for the EXACT destination provided in the user's request. If the user specifies 'Tokyo', create Tokyo activities. If 'Paris', create Paris activities. If 'London', create London activities. NEVER use a different city than what the user specified."
    " 2) UNIQUENESS: The activities generated should be unique from the list of excluded activities"
    " 3) Activity generated should be within the budget of the user"
    " 4) The activities generated should be within the day duration of the user"
    " 5) You should generate EXACTLY 3 activities"
    " 6) IMPORTANT: Each activity MUST have ALL required fields: name (string), duration (number), cost (number), notes (string), and activity_type (string)"
    " 7) Provide meaningful notes/descriptions for each activity"
    " 8) Activity types should be one of: Cultural, Food, Tour, Recreational, Adventure"
    " 9) Use ONLY the field names shown in the example above - do not use 'category' or any other field names"
)

replacement_agent = Agent("openai:gpt-3.5-turbo", system_prompt=REPLACEMENT_PROMPT)

async def change_activity(request: Activity, destination: str, excluded_activities: List[Activity], budget: int, day_duration: float) -> Replacement_Activity_List:
    user_prompt = f"""
    Swap the activity {request.name} for an activity in the itinerary for the destination {destination}. The excluded activities are {[act.name for act in excluded_activities]}. The activities generated should be unique from the list of excluded activities
    The budget of the user is {budget}. The day duration is {day_duration}.
    You should generate EXACTLY 3 activities
    """

    try:
        raw = await replacement_agent.run(user_prompt)
        print(f"Raw response: {raw}")
        
        # Extract text output from PydanticAI Agent result
        text_output = None
        if hasattr(raw, 'output'):
            text_output = raw.output
        elif isinstance(raw, str):
            text_output = raw
        
        # Parse JSON from text output
        data = {}
        if text_output:
            try:
                data = json.loads(text_output)
            except json.JSONDecodeError:
                # If the model returned non-JSON, try to extract JSON from text
                start = text_output.find("{")
                end = text_output.rfind("}")
                if start != -1 and end != -1:
                    try:
                        data = json.loads(text_output[start:end+1])
                    except json.JSONDecodeError:
                        data = {}
        elif isinstance(raw, dict):
            data = raw
        
        print(f"Parsed data: {data}")
        
        # Transform the AI response to match our Activity model
        if isinstance(data, dict) and 'replacement_activities' in data:
            transformed_activities = []
            for activity in data['replacement_activities']:
                # Safe numeric conversions with fallbacks
                try:
                    duration_val = float(activity.get('duration', 0.0))
                except (TypeError, ValueError):
                    duration_val = 0.0
                try:
                    cost_val = float(activity.get('cost', 0.0))
                except (TypeError, ValueError):
                    cost_val = 0.0
                
                # Convert activity_type string to ACTTYPE enum
                atype_str = activity.get('activity_type', 'Cultural')
                try:
                    # Try to match enum value
                    atype = ACTTYPE(atype_str)
                except (ValueError, KeyError):
                    # Default to Cultural if invalid
                    atype = ACTTYPE.CULTURAL
                
                transformed_activity = {
                    'name': activity.get('name', 'Unknown Activity'),
                    'duration': duration_val,
                    'notes': activity.get('notes', f"Visit {activity.get('name', 'this location')}"),
                    'activity_type': atype,
                    'cost': cost_val,
                }
                transformed_activities.append(transformed_activity)
            
            data['replacement_activities'] = transformed_activities
        
        return Replacement_Activity_List(**data)
    except Exception as e:
        print(f"Error in change_activity: {e}")
        fallback_activities = [
            Activity(name="Fallback Activity 1", duration=2.0, notes="Fallback activity", activity_type=ACTTYPE.CULTURAL, cost=25.0),
            Activity(name="Fallback Activity 2", duration=1.5, notes="Another fallback", activity_type=ACTTYPE.CULTURAL, cost=20.0),
            Activity(name="Fallback Activity 3", duration=2.5, notes="Third fallback", activity_type=ACTTYPE.CULTURAL, cost=30.0)
        ]
        return Replacement_Activity_List(replacement_activities=fallback_activities)    
